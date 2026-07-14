import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function gerarSenhaProvisoria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 10; i++) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só admin_interno pode chamar
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin_interno")
      .maybeSingle();
    if (!role) throw new Error("Apenas admin_interno pode cadastrar empresas");

    const body = await req.json();
    const {
      nome,
      cnpj,
      valor_mensal,
      data_inicio,
      email,
    }: {
      nome: string;
      cnpj?: string;
      valor_mensal: number;
      data_inicio: string;
      email: string;
    } = body;

    if (!nome || !email || !valor_mensal || !data_inicio) {
      throw new Error("Campos obrigatórios ausentes");
    }

    // 1. Criar empresa
    const { data: empresa, error: empErr } = await admin
      .from("empresas")
      .insert({
        nome,
        cnpj: cnpj ?? null,
        email_empresa: email,
        status_empresa: "ativo",
        data_implantacao: data_inicio,
      })
      .select("id")
      .single();
    if (empErr) throw empErr;

    // 2. Criar contrato
    const { error: contratoErr } = await admin.from("contratos").insert({
      empresa_id: empresa.id,
      valor_mensal,
      data_inicio,
      status: "ativo",
    });
    if (contratoErr) throw contratoErr;

    // 3. Criar user auth
    const senha = gerarSenhaProvisoria();
    const { data: novo, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { display_name: nome },
    });
    if (userErr) {
      // rollback empresa/contrato para não deixar lixo
      await admin.from("empresas").delete().eq("id", empresa.id);
      throw userErr;
    }
    const userId = novo.user.id;

    // 4. Marcar troca de senha obrigatória + display_name
    await admin
      .from("profiles")
      .update({ must_change_password: true, display_name: nome })
      .eq("user_id", userId);

    // 5. Vincular à empresa como admin_empresa
    await admin.from("empresa_usuarios").insert({
      user_id: userId,
      empresa_id: empresa.id,
      papel: "admin_empresa",
    });

    // 6. Papel base 'comum' em user_roles (visibilidade real vem do vínculo)
    await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "comum" });

    return new Response(
      JSON.stringify({
        empresa_id: empresa.id,
        user_id: userId,
        email,
        senha_provisoria: senha,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = String((err as Error)?.message || "Erro inesperado");
    const emailExists =
      message.toLowerCase().includes("already been registered") ||
      message.toLowerCase().includes("email_exists");
    return new Response(
      JSON.stringify({
        error: emailExists ? "Já existe um usuário com este e-mail" : message,
      }),
      {
        status: emailExists ? 409 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
