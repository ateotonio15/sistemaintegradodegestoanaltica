import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const indisponivel = "Não foi possível consultar os dados agora. Você pode preencher manualmente.";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: indisponivel }, 405);
  try {
    const auth = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!auth?.startsWith("Bearer ") || !url || !key) return json({ error: indisponivel }, 401);
    const client = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getClaims(auth.slice(7));
    if (error || !data?.claims?.sub) return json({ error: indisponivel }, 401);
    const body = await req.json().catch(() => null);
    const cnpj = typeof body?.cnpj === "string" ? body.cnpj.replace(/[.\/\-\s]/g, "") : "";
    if (!/^\d{14}$/.test(cnpj)) return json({ error: "CNPJ inválido." }, 400);
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
    if (response.status === 404) return json({ error: "Empresa não encontrada para este CNPJ." }, 404);
    if (!response.ok) return json({ error: indisponivel }, 503);
    const result = await response.json();
    if (!result?.estabelecimento || typeof result.razao_social !== "string") return json({ error: indisponivel }, 503);
    // Only public identification/address fields; no writes or company permission changes.
    const e = result.estabelecimento;
    return json({ razao_social: result.razao_social, estabelecimento: { cnpj: e.cnpj, nome_fantasia: e.nome_fantasia, tipo_logradouro: e.tipo_logradouro, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cep: e.cep, cidade: { nome: e.cidade?.nome }, estado: { sigla: e.estado?.sigla } } });
  } catch { return json({ error: indisponivel }, 503); }
});