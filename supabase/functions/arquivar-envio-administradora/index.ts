import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { BUCKET_ENVIOS, nomeSeguro } from "../_shared/envios-empresa.ts";

// Arquiva no Repositório de Envios os Excel do "Enviar fechamento ao Financeiro".
// Lê só anexos que o usuário enxerga (RLS) e nunca reenvia e-mail.
const Body = z.object({ anexo_ids: z.array(z.string().uuid()).min(1).max(30) });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!u.user) return json({ error: "Sessão inválida" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r: { role: string }) => ["admin", "comum", "administradoras"].includes(r.role))) return json({ error: "Sem permissão" }, 403);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);

    const { data: anexos, error } = await userClient.from("anexos_movimentacao")
      .select("id, movimentacao_id, empresa_id, nome_arquivo, storage_path, mime_type, movimentacoes(mes_referencia, periodo), empresas(codigo_contrato, tipo_contrato)")
      .in("id", parsed.data.anexo_ids);
    if (error) throw error;
    const envioId = crypto.randomUUID();
    const itens: unknown[] = [];
    for (const a of (anexos ?? []) as any[]) {
      if (a.empresas?.tipo_contrato !== "ADMINISTRADORA" || !a.empresas?.codigo_contrato) continue;
      const { data: blob } = await admin.storage.from("anexos-movimentacoes").download(a.storage_path);
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const contrato = String(a.empresas.codigo_contrato);
      const path = `envios/${a.movimentacao_id}/${envioId}/${contrato}-xlsx-${nomeSeguro(a.nome_arquivo)}`;
      const mime = a.mime_type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const { error: upErr } = await admin.storage.from(BUCKET_ENVIOS).upload(path, bytes, { contentType: mime, upsert: false });
      if (upErr) continue;
      itens.push({ movimentacao_id: a.movimentacao_id, empresa_id: a.empresa_id, contrato, competencia: String(a.movimentacoes?.mes_referencia ?? ""), periodo: a.movimentacoes?.periodo ?? null, nome_arquivo: a.nome_arquivo, bucket: BUCKET_ENVIOS, storage_path: path, mime_type: mime, tamanho_bytes: bytes.length, tipo_relatorio: "OPS Mensalidades" });
    }
    if (itens.length) {
      const { data: perfil } = await admin.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle();
      const { error: rpcErr } = await admin.rpc("registrar_envio_empresa_arquivos", { p_envio_id: envioId, p_usuario: u.user.id, p_nome: perfil?.display_name ?? "", p_itens: itens });
      if (rpcErr) throw rpcErr;
    }
    return json({ ok: true, arquivados: itens.length, total: parsed.data.anexo_ids.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
