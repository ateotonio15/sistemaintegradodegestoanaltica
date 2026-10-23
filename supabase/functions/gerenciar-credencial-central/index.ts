import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

/** Gestão de credenciais da Central de NFS-e. Somente Admin.
 * A credencial é gerada aqui, devolvida UMA vez e armazenada apenas como SHA-256. */
const Body = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("gerar"), nome: z.string().trim().min(1).max(80) }),
  z.object({ acao: z.literal("revogar"), id: z.string().uuid() }),
]);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "Não autenticado" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (authErr || !uid) return json({ erro: "Não autenticado" }, 401);
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!isAdmin) return json({ erro: "Apenas administradores" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const p = Body.safeParse(await req.json());
    if (!p.success) return json({ erro: "Dados inválidos" }, 400);
    body = p.data;
  } catch { return json({ erro: "JSON inválido" }, 400); }

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (body.acao === "gerar") {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = "cnfse_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await db.from("nfse_central_credenciais")
      .insert({ nome: body.nome, token_hash: await sha256Hex(token), criada_por: uid })
      .select("id, nome, created_at").single();
    if (error) return json({ erro: "Falha ao gerar" }, 500);
    return json({ ...data, credencial: token });
  }
  const { error } = await db.from("nfse_central_credenciais")
    .update({ revogada_em: new Date().toISOString(), revogada_por: uid })
    .eq("id", body.id).is("revogada_em", null);
  if (error) return json({ erro: "Falha ao revogar" }, 500);
  return json({ ok: true });
});
