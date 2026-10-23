import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { carregarEResolver } from "../_shared/nfse-central-db.ts";
import { processarRecebimento, PENDENTES, type Adaptador, type Recebimento } from "../_shared/nfse-central-processador.ts";

/**
 * Avança a fila "Recebidos da Central" no servidor.
 * - Agendador (a cada minuto): cabeçalho x-sync-token conferido com config_sync.
 * - Admin/Financeiro: pede reavaliação de um recebimento. Não aceita valores nem resultados.
 */
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
export const BodyUsuario = z.object({ recebimento_id: z.string().uuid() }).strict();
const LOTE = 3;

// deno-lint-ignore no-explicit-any
export function adaptadorBanco(db: any): Adaptador {
  const d = (s: string | null) => (s ?? "").replace(/\D/g, "");
  return {
    resolverDestino: (rec) => carregarEResolver(db, rec.cnpj_tomador, rec.movimentacao_sugerida_id),
    anexosDaMov: async (id) => (await db.from("anexos_financeiro").select("id, mime_type, nome_arquivo, storage_path, bucket, origem").eq("financeiro_movimentacao_id", id)).data ?? [],
    revisaoAtual: async (id) => (await db.rpc("nfse_central_revisao", { _mov: id })).data ?? "",
    tipoAnalise: async (id) => (await db.from("financeiro_movimentacoes").select("tipo_analise").eq("id", id).maybeSingle()).data?.tipo_analise ?? null,
    cnpjPagador: async (empresaId, cnpj) => {
      const [{ data: e }, { data: p }] = await Promise.all([
        db.from("empresas").select("cnpj").eq("id", empresaId).maybeSingle(),
        db.from("financeiro_pagadores").select("cnpj").eq("empresa_id", empresaId).eq("ativo", true),
      ]);
      return [e?.cnpj, ...(p ?? []).map((x: any) => x.cnpj)].find((c) => d(c) === cnpj) ?? null;
    },
    baixar: async (bucket, path) => {
      const r = await db.storage.from(bucket).download(path);
      return r.error ? null : await r.data.arrayBuffer();
    },
    autoAnexarReais: async () => !!(await db.from("nfse_central_config").select("auto_anexar_reais").eq("id", 1).maybeSingle()).data?.auto_anexar_reais,
    salvar: async (id, patch) => { await db.from("nfse_recebimentos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id); },
    copiarParaAnexos: async (rec, empresaId, movId) => {
      const arq = await db.storage.from("nfse-entrada").download(rec.storage_path!);
      if (arq.error) return null;
      const path = `${empresaId}/${movId}/central-${rec.pdf_sha256}.pdf`;
      const up = await db.storage.from("anexos-financeiro").upload(path, arq.data, { contentType: "application/pdf", upsert: false });
      return up.error && !/exists/i.test(up.error.message) ? null : path;
    },
    vincular: async (recId, revisao, path, nome, tamanho) => {
      const { data, error } = await db.rpc("nfse_central_vincular", { _recebimento: recId, _revisao: revisao, _storage_path: path, _nome: nome, _tamanho: tamanho });
      return error ? { estado: "aprovado_aguardando_liberacao", motivo: "Falha ao vincular; nova tentativa no próximo ciclo." } : data;
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ad = adaptadorBanco(db);

  const tokenAgendador = req.headers.get("x-sync-token");
  if (tokenAgendador) {
    const { data: cfg } = await db.from("config_sync").select("valor").eq("chave", "nfse_central_token").maybeSingle();
    if (!cfg?.valor || cfg.valor !== tokenAgendador) return json({ erro: "Token inválido" }, 401);
    const { data: fila } = await db.from("nfse_recebimentos").select("*").in("estado", PENDENTES)
      .order("updated_at", { ascending: true }).limit(LOTE);
    const resultados = [];
    for (const rec of (fila ?? []) as Recebimento[]) {
      try { resultados.push({ id: rec.id, ...(await processarRecebimento(rec, ad)) }); }
      catch { await ad.salvar(rec.id, {}); resultados.push({ id: rec.id, estado: "erro" }); }
    }
    return json({ processados: resultados.length, resultados });
  }

  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ erro: "Sessão inválida" }, 401);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "financeiro")) return json({ erro: "Sem permissão" }, 403);
  const parsed = BodyUsuario.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ erro: "Apenas recebimento_id é aceito; valores e resultados não são recebidos do navegador." }, 400);
  const { data: rec } = await db.from("nfse_recebimentos").select("*").eq("id", parsed.data.recebimento_id).maybeSingle();
  if (!rec) return json({ erro: "Recebimento não encontrado" }, 404);
  return json(await processarRecebimento(rec as Recebimento, ad));
});
