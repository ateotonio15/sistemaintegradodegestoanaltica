// Edge function: username+password login.
// Resolves the username to an email server-side and performs sign-in
// without ever returning the email to the client. This prevents
// username -> email enumeration. Returns generic error on failure.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory sliding window per instance. Defense-in-depth only.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const buckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    buckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  buckets.set(ip, arr);
  return false;
}

const GENERIC_ERROR = "Usuário ou senha inválidos";

function invalidCredentialsResponse() {
  return new Response(JSON.stringify({ ok: false, error: GENERIC_ERROR }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde um instante." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!username || username.length < 2 || username.length > 64 || !password) {
      return invalidCredentialsResponse();
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: email, error: rpcErr } = await admin.rpc("get_email_by_username", { _username: username });
    if (rpcErr) {
      console.error("RPC error", rpcErr);
      return invalidCredentialsResponse();
    }
    if (!email) {
      return invalidCredentialsResponse();
    }

    // Use anon client to perform sign-in (returns a session without admin powers).
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({
      email: email as string,
      password,
    });

    if (signErr || !signIn?.session) {
      return invalidCredentialsResponse();
    }

    // Bloqueia acesso se a empresa vinculada estiver com portal_ativo = false
    const userId = signIn.user?.id;
    if (userId) {
      const { data: vinc } = await admin
        .from("empresa_usuarios")
        .select("empresa_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (vinc?.empresa_id) {
        const { data: emp } = await admin
          .from("empresas")
          .select("portal_ativo")
          .eq("id", vinc.empresa_id)
          .maybeSingle();
        if (emp && emp.portal_ativo === false) {
          return new Response(
            JSON.stringify({ error: "Acesso ao portal está bloqueado. Fale com a Samel." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        session: {
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error(e);
    return invalidCredentialsResponse();
  }
});
