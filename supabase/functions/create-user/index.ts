import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller identity
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Apenas administradores podem executar esta ação");

    const body = await req.json();
    const { action } = body;

    // --- DELETE USER ---
    if (action === "delete-user") {
      const { userId } = body;
      if (!userId) throw new Error("userId é obrigatório");
      if (userId === caller.id) throw new Error("Não é permitido excluir seu próprio usuário");

      // Delete links, profile, roles, then auth user
      await adminClient.from("empresa_usuarios").delete().eq("user_id", userId);
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);

      const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
      if (authErr) throw authErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- RESET PASSWORD ---
    if (action === "reset-password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) throw new Error("userId e newPassword são obrigatórios");

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- CREATE USER (default) ---
    const { email, password, displayName, username } = body;
    if (!email || !password) throw new Error("E-mail e senha são obrigatórios");
    if (!username) throw new Error("Nome de usuário é obrigatório");

    // Check username uniqueness
    const { data: existingUsername } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (existingUsername) throw new Error("Já existe um usuário com este nome de usuário");

    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName || email },
    });

    if (error) throw error;

    // Update the profile with the username (profile created by trigger)
    await adminClient
      .from("profiles")
      .update({ username: username.toLowerCase() })
      .eq("user_id", newUser.user.id);

    return new Response(JSON.stringify({ user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = String(err?.message || "Erro inesperado");
    const emailExists = message.toLowerCase().includes("already been registered") || message.toLowerCase().includes("email_exists");

    return new Response(JSON.stringify({ error: emailExists ? "Já existe um usuário com este e-mail" : message }), {
      status: emailExists ? 409 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
