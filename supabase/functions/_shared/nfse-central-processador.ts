/**
 * Processamento de um recebimento da Central inteiramente no servidor:
 * resolve o destino, lê os arquivos armazenados com os parsers do SIGA,
 * decide com regras estritas e só então pede o vínculo transacional.
 * Nenhum valor vindo do navegador participa da decisão.
 */
import { avaliarValidacao, type ResultadoDestino } from "./nfse-central-regras.ts";
import { validarArquivosCentral } from "./siga-validador.generated.js";

export const VALIDADOR_VERSAO = "v3-servidor";
export const PENDENTES = [
  "recebido_pendente", "aguardando_faturado", "aguardando_faturamento_anexado",
  "destino_ambiguo", "aguardando_validacao", "validacao_inconclusiva", "divergencia", "aprovado_aguardando_liberacao",
];

export interface Recebimento {
  id: string; estado: string; cnpj_tomador: string; emitida_em: string; storage_path: string | null;
  movimentacao_sugerida_id: string | null; movimentacao_destino_id: string | null;
  faturamento_revisao: string | null; homologacao: boolean; pdf_sha256: string;
  nome_arquivo: string | null; pdf_tamanho_bytes: number;
}
export interface AnexoArmazenado { id: string; mime_type: string | null; nome_arquivo: string | null; storage_path: string; bucket: string | null; origem: string | null }

export interface Adaptador {
  resolverDestino(rec: Recebimento): Promise<ResultadoDestino>;
  anexosDaMov(movId: string): Promise<AnexoArmazenado[]>;
  revisaoAtual(movId: string): Promise<string>;
  tipoAnalise(movId: string): Promise<string | null>;
  cnpjPagador(empresaId: string, cnpjTomador: string): Promise<string | null>;
  baixar(bucket: string, path: string): Promise<ArrayBuffer | null>;
  autoAnexarReais(): Promise<boolean>;
  salvar(id: string, patch: Record<string, unknown>): Promise<void>;
  copiarParaAnexos(rec: Recebimento, empresaId: string, movId: string): Promise<string | null>;
  vincular(recId: string, revisao: string, path: string, nome: string, tamanho: number): Promise<{ estado: string; motivo?: string }>;
}

const isXls = (a: AnexoArmazenado) =>
  /spreadsheet|excel|csv/i.test(a.mime_type ?? "") || /\.(xlsx|xlsm|xls|csv)$/i.test(a.nome_arquivo ?? "");
const contaStatus = (a: AnexoArmazenado) => !["retroativo", "reajuste"].includes((a.origem ?? "normal").toLowerCase());

export async function processarRecebimento(rec: Recebimento, ad: Adaptador): Promise<{ estado: string; motivo: string | null }> {
  if (!PENDENTES.includes(rec.estado)) return { estado: rec.estado, motivo: null };
  const destino = await ad.resolverDestino(rec);
  if (!destino.destino) {
    await ad.salvar(rec.id, { estado: destino.estado, motivo: destino.motivo, movimentacao_destino_id: null, status_observado: null });
    return { estado: destino.estado, motivo: destino.motivo };
  }
  const mov = destino.destino;
  const revisao = await ad.revisaoAtual(mov.id);
  // Não repete a mesma análise de arquivos inalterados
  if (["divergencia", "validacao_inconclusiva"].includes(rec.estado) && rec.movimentacao_destino_id === mov.id && rec.faturamento_revisao === revisao)
    return { estado: rec.estado, motivo: null };
  if (rec.estado === "aprovado_aguardando_liberacao" && rec.movimentacao_destino_id === mov.id && rec.faturamento_revisao === revisao
      && (rec.homologacao || !(await ad.autoAnexarReais())))
    return { estado: rec.estado, motivo: null };

  const falhar = async (estado: string, motivo: string) => {
    await ad.salvar(rec.id, { estado, motivo, movimentacao_destino_id: mov.id, status_observado: "Faturado", faturamento_revisao: revisao, validador_versao: VALIDADOR_VERSAO, validado_em: new Date().toISOString() });
    return { estado, motivo };
  };
  const planilhas = (await ad.anexosDaMov(mov.id)).filter((a) => contaStatus(a) && isXls(a));
  if (planilhas.length !== 1) return falhar("validacao_inconclusiva", planilhas.length ? "Mais de uma planilha de faturamento anexada." : "Faturamento não anexado.");
  const tipo = await ad.tipoAnalise(mov.id);
  if ((tipo ?? "").toLowerCase().includes("honda")) return falhar("validacao_inconclusiva", "Análise simplificada não participa da anexação automática.");
  if (!rec.storage_path) return falhar("validacao_inconclusiva", "PDF da fila indisponível.");

  const [pdf, xls] = await Promise.all([
    ad.baixar("nfse-entrada", rec.storage_path),
    ad.baixar(planilhas[0].bucket || "anexos-financeiro", planilhas[0].storage_path),
  ]);
  if (!pdf || !xls) return falhar("validacao_inconclusiva", "Não foi possível baixar o PDF ou a planilha.");

  let arq;
  try { arq = await validarArquivosCentral({ pdf, xls, cnpjTomador: rec.cnpj_tomador, tipoAnalise: tipo }); }
  catch { return falhar("validacao_inconclusiva", "PDF ou planilha ilegível."); }

  const v = avaliarValidacao({
    cnpjTomador: rec.cnpj_tomador, cnpjPagador: await ad.cnpjPagador(mov.empresa_id, rec.cnpj_tomador),
    emitidaEm: rec.emitida_em, faturado: true, leituraOk: arq.leituraOk,
    comparacao: arq.comparacao as any, valorExcel: arq.valorExcel, valorPdf: arq.valorPdf,
  });
  const motivo = [arq.motivo, ...v.motivos].filter(Boolean).join(" ") || null;
  const base = {
    movimentacao_destino_id: mov.id, status_observado: "Faturado", faturamento_revisao: revisao,
    valor_excel_centavos: v.valorExcelCentavos, valor_pdf_centavos: v.valorPdfCentavos, diferenca_centavos: v.diferencaCentavos,
    validacao: { comparacao: arq.comparacao, motivos: v.motivos, tomador_pdf: arq.tomadorPdf, planilha_id: planilhas[0].id },
    validador_versao: VALIDADOR_VERSAO, validado_em: new Date().toISOString(),
  };
  if (!v.aprovado) { await ad.salvar(rec.id, { ...base, estado: v.estado, motivo }); return { estado: v.estado, motivo }; }

  // Mudança do faturamento durante a leitura → reavaliar no próximo ciclo
  if ((await ad.revisaoAtual(mov.id)) !== revisao) {
    const m = "Faturamento alterado durante a análise; será reavaliado.";
    await ad.salvar(rec.id, { ...base, faturamento_revisao: null, estado: "aguardando_validacao", motivo: m });
    return { estado: "aguardando_validacao", motivo: m };
  }
  if (rec.homologacao || !(await ad.autoAnexarReais())) {
    const m = rec.homologacao ? "Aprovado em homologação; não é anexado." : "Aprovado. Anexação automática desligada até a homologação.";
    await ad.salvar(rec.id, { ...base, estado: "aprovado_aguardando_liberacao", motivo: m });
    return { estado: "aprovado_aguardando_liberacao", motivo: m };
  }
  await ad.salvar(rec.id, { ...base, estado: "aprovado_aguardando_liberacao", motivo: "Anexando…" });
  const path = await ad.copiarParaAnexos(rec, mov.empresa_id, mov.id);
  if (!path) return falhar("aprovado_aguardando_liberacao", "Falha ao copiar o PDF; nova tentativa no próximo ciclo.");
  const r = await ad.vincular(rec.id, revisao, path, rec.nome_arquivo ?? "nota.pdf", rec.pdf_tamanho_bytes);
  return { estado: r.estado, motivo: r.motivo ?? null };
}
