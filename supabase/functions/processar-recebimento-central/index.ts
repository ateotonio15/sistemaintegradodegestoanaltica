import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { carregarEResolver } from "../_shared/nfse-central-db.ts";
import { avaliarValidacao } from "../_shared/nfse-central-regras.ts";

/**
 * Processa a fila "Recebidos da Central" com a validação feita pelo SIGA.
 * O servidor refaz as checagens de destino, status, CNPJ, data e revisão do
 * faturamento; só anexa com diferença zero e com a liberação ligada.
 */
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const Campo = z.object({ excel: z.number(), pdf: z.number().nullable(), ok: z.boolean() });
const Cat3 = z.object({ beneficiarios: Campo, mensalidade: Campo, total: Campo }).nullable();
const Tot = z.object({ total: Campo }).nullable();
const Body = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("resolver"), recebimento_id: z.string().uuid() }),
  z.object({
    acao: z.literal("concluir"),
    recebimento_id: z.string().uuid(),
    revisao: z.string().max(4000),
    leitura_ok: z.boolean(),
    valor_excel: z.number().nullable(),
    valor_pdf: z.number().nullable(),
    comparacao: z.object({
      enfermaria: Cat3, apartamento: Cat3, inclusoes: Tot, exclusoes: Tot, devolucoes: Tot,
      divergencias: z.array(z.string().max(500)).max(50), tomadorCnpj: z.string().max(20).nullable().optional(),
    }).nullable(),
    erro_leitura: z.string().max(500).optional(),
  }),
]);
const FINAIS = ["vinculado", "fora_do_periodo", "ja_recebido", "conflito"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ erro: "Sessão inválida" }, 401);
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "financeiro")) return json({ erro: "Sem permissão" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ erro: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;
  const { data: rec } = await db.from("nfse_recebimentos").select("*").eq("id", b.recebimento_id).maybeSingle();
  if (!rec) return json({ erro: "Recebimento não encontrado" }, 404);
  if (FINAIS.includes(rec.estado)) return json({ estado: rec.estado, motivo: rec.motivo });
  const upd = (patch: Record<string, unknown>) => db.from("nfse_recebimentos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", rec.id);

  const destino = await carregarEResolver(db, rec.cnpj_tomador, rec.movimentacao_sugerida_id);
  if (b.acao === "resolver" || !destino.destino || destino.destino.id !== rec.movimentacao_destino_id) {
    await upd({ estado: destino.estado, motivo: destino.motivo, movimentacao_destino_id: destino.destino?.id ?? null, status_observado: destino.destino ? "Faturado" : null });
    return json({ estado: destino.estado, motivo: destino.motivo, destino: destino.destino?.id ?? null });
  }

  const movId = destino.destino.id;
  const { data: revAtual } = await db.rpc("nfse_central_revisao", { _mov: movId });
  if (revAtual !== b.revisao) {
    await upd({ estado: "aguardando_validacao", motivo: "Faturamento alterado durante a análise; será reavaliado." });
    return json({ estado: "aguardando_validacao", motivo: "Faturamento alterado durante a análise" });
  }
  const { data: emp } = await db.from("empresas").select("cnpj").eq("id", destino.destino.empresa_id).maybeSingle();
  const { data: pags } = await db.from("financeiro_pagadores").select("cnpj").eq("empresa_id", destino.destino.empresa_id).eq("ativo", true);
  const d = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const cnpjPagador = [emp?.cnpj, ...(pags ?? []).map((p) => p.cnpj)].find((c) => d(c) === rec.cnpj_tomador) ?? null;

  const v = avaliarValidacao({
    cnpjTomador: rec.cnpj_tomador, cnpjPagador, emitidaEm: rec.emitida_em, faturado: true,
    leituraOk: b.leitura_ok, comparacao: b.comparacao, valorExcel: b.valor_excel, valorPdf: b.valor_pdf,
  });
  const motivo = [b.erro_leitura, ...v.motivos].filter(Boolean).join(" ") || null;
  const base = {
    valor_excel_centavos: v.valorExcelCentavos, valor_pdf_centavos: v.valorPdfCentavos, diferenca_centavos: v.diferencaCentavos,
    validacao: { comparacao: b.comparacao, motivos: v.motivos }, faturamento_revisao: b.revisao,
    validado_em: new Date().toISOString(), validado_por: u.user.id, validador_versao: "v2-siga-estrito",
  };
  if (!v.aprovado) { await upd({ ...base, estado: v.estado, motivo }); return json({ estado: v.estado, motivo, ...base }); }

  const { data: cfg } = await db.from("nfse_central_config").select("auto_anexar_reais").eq("id", 1).maybeSingle();
  if (!cfg?.auto_anexar_reais || rec.homologacao) {
    const m = rec.homologacao ? "Aprovado em homologação; não é anexado." : "Aprovado. Anexação automática desligada até a homologação.";
    await upd({ ...base, estado: "aprovado_aguardando_liberacao", motivo: m });
    return json({ estado: "aprovado_aguardando_liberacao", motivo: m, ...base });
  }

  await upd({ ...base, estado: "aprovado_aguardando_liberacao", motivo: "Anexando…" });
  const arq = await db.storage.from("nfse-entrada").download(rec.storage_path);
  if (arq.error) return json({ erro: "PDF da fila indisponível" }, 500);
  const destinoPath = `${destino.destino.empresa_id}/${movId}/central-${rec.pdf_sha256}.pdf`;
  const up = await db.storage.from("anexos-financeiro").upload(destinoPath, arq.data, { contentType: "application/pdf", upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) return json({ erro: "Falha ao copiar o PDF" }, 500);
  const { data: vinc, error } = await db.rpc("nfse_central_vincular", {
    _recebimento: rec.id, _revisao: b.revisao, _storage_path: destinoPath, _nome: rec.nome_arquivo ?? "nota.pdf", _tamanho: rec.pdf_tamanho_bytes,
  });
  if (error) return json({ erro: "Falha ao vincular" }, 500);
  return json(vinc);
});
