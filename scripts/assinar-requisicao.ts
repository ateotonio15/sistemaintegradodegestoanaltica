// Uso: PORTAL_FINANCEIRO_HMAC_SECRET=... deno run --allow-env scripts/assinar-requisicao.ts "/v1/movimentacoes?competencia=2026-11&limit=10"
// Imprime um curl assinado (válido por 300 s). O segredo nunca é impresso.
import { assinar } from "../supabase/functions/siga-api/lib.ts";

const BASE = "https://gdojlriuewowyomypwzl.supabase.co/functions/v1/siga-api";
const path = Deno.args[0] ?? "/v1/resumo-periodos?competencia=2026-11";
const secret = Deno.env.get("PORTAL_FINANCEIRO_HMAC_SECRET");
if (!secret) { console.error("Defina PORTAL_FINANCEIRO_HMAC_SECRET"); Deno.exit(1); }
if (!path.startsWith("/v1/")) { console.error("O caminho deve começar com /v1/"); Deno.exit(1); }
const ts = String(Math.floor(Date.now() / 1000));
const sig = await assinar(secret, ts, "GET", path);
console.log(`curl -sS '${BASE}${path}' \\
  -H 'X-Siga-Client: portal-financeiro' \\
  -H 'X-Siga-Timestamp: ${ts}' \\
  -H 'X-Siga-Signature: ${sig}' \\
  -H 'X-Correlation-Id: ${crypto.randomUUID()}'`);
