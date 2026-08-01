import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("ORBIT_BILLING_WEBHOOK_URL");
  const apiKey = Deno.env.get("ORBIT_BILLING_API_KEY");
  if (!url || !apiKey) {
    return json({ ok: false, skipped: true, error: "Webhook do Orbit não configurado" }, 200);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ ok: false, error: "Não autenticado" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: perfil } = await admin
    .from("profiles")
    .select("username,display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const payload = {
    user: body.user || perfil?.username || perfil?.display_name || auth.user.email,
    company: body.company ?? null,
    contract: body.contract ? String(body.contract) : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))
      ? String(body.date)
      : new Date().toISOString().slice(0, 10),
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
    });
    const texto = await resp.text();
    console.log("[orbit-billing-notify]", resp.status, payload.company, payload.contract);
    return json({ ok: resp.ok, status: resp.status, response: texto.slice(0, 500) }, 200);
  } catch (e) {
    console.error("[orbit-billing-notify] erro", e);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
