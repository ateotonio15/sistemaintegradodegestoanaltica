import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UPSTREAM = "https://api-iasam.samel.com.br/producao-guias-ambulatorio/agrupado";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ status: false, message: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return json({ status: false, message: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const dt_inicio = String(body?.dt_inicio ?? "");
    const dt_fim = String(body?.dt_fim ?? "");
    if (!DATE_RE.test(dt_inicio) || !DATE_RE.test(dt_fim)) {
      return json({ status: false, message: "Período inválido (use AAAA-MM-DD)" }, 400);
    }

    const r = await fetch(`${UPSTREAM}?dt_inicio=${dt_inicio}&dt_fim=${dt_fim}`);
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return json({ status: false, message: (e as Error).message }, 502);
  }
});
