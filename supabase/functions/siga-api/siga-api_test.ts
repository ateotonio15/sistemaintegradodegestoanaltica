import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assinar, canonicalPath, verificarAssinatura } from "./lib.ts";
import { handler } from "./index.ts";

const SECRET = "segredo-de-teste-nao-usar";

Deno.test("a) vetor de assinatura", async () => {
  assertEquals(
    await assinar(SECRET, "1763000000", "GET", "/v1/movimentacoes?competencia=2026-11&limit=100&periodo=05-10"),
    "v1=83a95d4e48db4375ebfa699d4bcacdb25449958ebd18e1156ea1adbaa3c06b93",
  );
});
Deno.test("b) /siga-api/v1/movimentacoes", () => {
  assertEquals(canonicalPath("/siga-api/v1/movimentacoes", ""), "/v1/movimentacoes");
});
Deno.test("c) /functions/v1/siga-api/v1/movimentacoes", () => {
  assertEquals(canonicalPath("/functions/v1/siga-api/v1/movimentacoes", ""), "/v1/movimentacoes");
  assertEquals(canonicalPath("/functions/v1/siga-api/v1/movimentacoes", "?b=2&a=%20"), "/v1/movimentacoes?b=2&a=%20");
});
Deno.test("verificação aceita assinatura correta na janela", async () => {
  const path = "/v1/resumo-periodos?competencia=2026-11";
  const sig = await assinar(SECRET, "1763000000", "GET", path);
  assertEquals((await verificarAssinatura({ secret: SECRET, client: "portal-financeiro", timestamp: "1763000000",
    signature: sig, method: "GET", path, agoraSeg: 1763000100 })).ok, true);
  assertEquals((await verificarAssinatura({ secret: SECRET, client: "outro", timestamp: "1763000000",
    signature: sig, method: "GET", path, agoraSeg: 1763000100 })).ok, false);
});

async function chamar(ts: string, sig: (path: string) => Promise<string>, method = "GET") {
  Deno.env.set("PORTAL_FINANCEIRO_HMAC_SECRET", SECRET);
  const path = "/v1/movimentacoes?competencia=2026-11";
  return await handler(new Request(`https://x.supabase.co/functions/v1/siga-api${path}`, {
    method, headers: { "X-Siga-Client": "portal-financeiro", "X-Siga-Timestamp": ts, "X-Siga-Signature": await sig(path) },
  }));
}
Deno.test("d) timestamp fora da janela → 401", async () => {
  const ts = String(Math.floor(Date.now() / 1000) - 301);
  const r = await chamar(ts, (p) => assinar(SECRET, ts, "GET", p));
  assertEquals(r.status, 401);
  assertEquals(r.headers.get("Content-Type"), "application/problem+json");
  assertEquals((await r.json()).code, "NAO_AUTORIZADO");
});
Deno.test("d) assinatura errada → 401", async () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await chamar(ts, (p) => assinar("outro-segredo", ts, "GET", p));
  assertEquals(r.status, 401);
  await r.body?.cancel();
});
Deno.test("método diferente de GET → 405", async () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await chamar(ts, (p) => assinar(SECRET, ts, "POST", p), "POST");
  assertEquals(r.status, 405);
  await r.body?.cancel();
});
