/**
 * Processamento de um recebimento da Central inteiramente no servidor:
 * resolve o destino, lê os arquivos armazenados com os parsers do SIGA,
 * decide com regras estritas e só então pede o vínculo transacional.
 * Nenhum valor vindo do navegador participa da decisão.
 */
import { avaliarValidacao, type ResultadoDestino } from "./nfse-central-regras.ts";
import { validarArquivosCentral } from "./siga-validador.generated.js";

export const VALIDADOR_VERSAO = "v10-danfse-rotulos-multilinha";
export const PENDENTES = [
  "recebido_pendente", "aguardando_faturado", "aguardando_faturamento_anexado",
  "destino_ambiguo", "aguardando_validacao", "validacao_inconclusiva", "divergencia", "aprovado_aguardando_liberacao",
];

export interface Recebimento {
  id: string; estado: string; cnpj_tomador: string; emitida_em: string; storage_path: string | null;
  movimentacao_sugerida_id: string | null; movimentacao_destino_id: string | null;
  faturamento_revisao: string | null; chave_validacao?: string | null; homologacao: boolean; pdf_sha256: string;
  nome_arquivo: string | null; pdf_tamanho_bytes: number;
  chave_acesso?: string | null; numero_nfse?: string | null; cnpj_prestador?: string | null;
}
export interface AnexoArmazenado { id: string; mime_type: string | null; nome_arquivo: string | null; storage_path: string; bucket: string | null; origem: string | null }

export interface Adaptador {
  resolverDestino(rec: Recebimento): Promise<ResultadoDestino>;
  anexosDaMov(movId: string): Promise<AnexoArmazenado[]>;
  revisaoAtual(movId: string): Promise<string>;
  tipoAnalise(movId: string): Promise<string | null>;
  /** Outras versões (PDF diferente) da mesma nota no mesmo modo. */
  outrasVersoes(rec: Recebimento): Promise<number>;
  cnpjPagador(empresaId: string, cnpjTomador: string): Promise<string | null>;
  baixar(bucket: string, path: string): Promise<ArrayBuffer | null>;
  autoAnexarReais(): Promise<boolean>;
  salvar(id: string, patch: Record<string, unknown>): Promise<void>;
  copiarParaAnexos(rec: Recebimento, empresaId: string, movId: string): Promise<string | null>;
  vincular(recId: string, revisao: string, path: string, nome: string, tamanho: number): Promise<{ estado: string; motivo?: string }>;
}

const isXls = (a: AnexoArmazenado) =>
  /spreadsheet|excel|csv/i.test(a.mime_type ?? "") || /\.(xlsx|xlsm|xls|csv)$/i.test(a.nome_arquivo ?? "");
/** Seleção para validação (≠ regra de status): retroativos entram e são classificados pelo conteúdo; reajuste não compõe a cobrança. */
const entraNaValidacao = (a: AnexoArmazenado) => (a.origem ?? "normal").toLowerCase() !== "reajuste";

/** Atraso até a próxima tentativa quando nada mudou (gatilhos de anexos/movimentações antecipam). */
export const ESPERA_SEM_MUDANCA_MS = 60 * 60 * 1000;
const proxima = () => new Date(Date.now() + ESPERA_SEM_MUDANCA_MS).toISOString();

/** Chave de entrada da análise: revisão forte dos arquivos + tipo de análise + versão + PDF. */
export async function chaveEntrada(revisao: string, tipo: string | null, pdfSha: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode([VALIDADOR_VERSAO, (tipo ?? "").toLowerCase(), revisao, pdfSha].join("|")));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function processarRecebimento(rec: Recebimento, ad: Adaptador): Promise<{ estado: string; motivo: string | null }> {
  if (!PENDENTES.includes(rec.estado)) return { estado: rec.estado, motivo: null };
  const destino = await ad.resolverDestino(rec);
  if (!destino.destino) {
    await ad.salvar(rec.id, { estado: destino.estado, motivo: destino.motivo, movimentacao_destino_id: null, status_observado: null, proxima_tentativa_em: proxima() });
    return { estado: destino.estado, motivo: destino.motivo };
  }
  const mov = destino.destino;
  const revisao = await ad.revisaoAtual(mov.id);
  const tipo = await ad.tipoAnalise(mov.id);
  const chave = await chaveEntrada(revisao, tipo, rec.pdf_sha256);
  // Mesma entrada (arquivos, tipo, versão, PDF e destino): não reanalisa e sai da frente da fila.
  const mesma = rec.movimentacao_destino_id === mov.id && rec.chave_validacao === chave;
  if (mesma && ["divergencia", "validacao_inconclusiva"].includes(rec.estado)) {
    await ad.salvar(rec.id, { proxima_tentativa_em: proxima() });
    return { estado: rec.estado, motivo: null };
  }
  if (mesma && rec.estado === "aprovado_aguardando_liberacao" && (rec.homologacao || !(await ad.autoAnexarReais()))) {
    await ad.salvar(rec.id, { proxima_tentativa_em: proxima() });
    return { estado: rec.estado, motivo: null };
  }

  const falhar = async (estado: string, motivo: string) => {
    await ad.salvar(rec.id, { estado, motivo, movimentacao_destino_id: mov.id, status_observado: "Faturado", faturamento_revisao: revisao, chave_validacao: chave, validador_versao: VALIDADOR_VERSAO, validado_em: new Date().toISOString(), proxima_tentativa_em: proxima() });
    return { estado, motivo };
  };
  const planilhas = (await ad.anexosDaMov(mov.id)).filter((a) => entraNaValidacao(a) && isXls(a));
  if (!planilhas.length) return falhar("validacao_inconclusiva", "Faturamento não anexado.");
  if ((tipo ?? "").toLowerCase().includes("honda")) return falhar("validacao_inconclusiva", "Análise simplificada não participa da anexação automática.");
  if (!rec.storage_path) return falhar("validacao_inconclusiva", "PDF da fila indisponível.");

  const [pdf, ...xlss] = await Promise.all([
    ad.baixar("nfse-entrada", rec.storage_path),
    ...planilhas.map((p) => ad.baixar(p.bucket || "anexos-financeiro", p.storage_path)),
  ]);
  if (!pdf || xlss.some((x) => !x)) return falhar("validacao_inconclusiva", "Não foi possível baixar o PDF ou alguma planilha.");

  let arq;
  try {
    arq = await validarArquivosCentral({
      pdf, cnpjTomador: rec.cnpj_tomador, tipoAnalise: tipo,
      contexto: { competencia: mov.mes_referencia ?? null, periodo: mov.periodo ?? null },
      identidade: { chaveAcesso: rec.chave_acesso ?? null, numeroNfse: rec.numero_nfse ?? null, cnpjPrestador: rec.cnpj_prestador ?? null, cnpjTomador: rec.cnpj_tomador, emitidaEm: rec.emitida_em },
      planilhas: planilhas.flatMap((p, i) => { const dados = xlss[i]; return dados ? [{ id: p.id, nome: p.nome_arquivo ?? p.id, dados }] : []; }),
    });
  } catch { return falhar("validacao_inconclusiva", "PDF ou planilha ilegível."); }

  // Identidade fiscal do conteúdo: ausente/ilegível → inconclusivo; divergente → divergência.
  const idf = arq.identidade;
  if (!idf || !idf.ok) {
    const estado = idf?.estado === "divergencia" ? "divergencia" : "validacao_inconclusiva";
    const motivo = ["Identidade fiscal do PDF não comprovada.", ...(idf?.motivos ?? ["Conferência não executada."])].join(" ");
    await ad.salvar(rec.id, { estado, motivo, movimentacao_destino_id: mov.id, status_observado: "Faturado", faturamento_revisao: revisao, chave_validacao: chave,
      proxima_tentativa_em: proxima(), validador_versao: VALIDADOR_VERSAO, validado_em: new Date().toISOString(),
      valor_excel_centavos: null, valor_pdf_centavos: null, diferenca_centavos: null,
      validacao: { identidade: idf, arquivos: arq.arquivos, conferido: { identidade_fiscal: false, competencia: false, periodo: false } } });
    return { estado, motivo };
  }
  const v = avaliarValidacao({
    cnpjTomador: rec.cnpj_tomador, cnpjPagador: await ad.cnpjPagador(mov.empresa_id, rec.cnpj_tomador),
    emitidaEm: rec.emitida_em, faturado: true, leituraOk: arq.leituraOk,
    comparacao: arq.comparacao as any, valorExcel: arq.valorExcel, valorPdf: arq.valorPdf, valorServico: arq.valorServico ?? null,
  });
  const motivo = [arq.motivo, ...v.motivos].filter(Boolean).join(" ") || null;
  const base = {
    movimentacao_destino_id: mov.id, status_observado: "Faturado", faturamento_revisao: revisao, chave_validacao: chave,
    proxima_tentativa_em: proxima(),
    valor_excel_centavos: v.valorExcelCentavos, valor_pdf_centavos: v.valorPdfCentavos, diferenca_centavos: v.diferencaCentavos,
    validacao: {
      valor_descritivo_centavos: arq.valorPdf != null ? Math.round(arq.valorPdf * 100) : null,
      valor_servico_centavos: arq.valorServico != null ? Math.round(arq.valorServico * 100) : null,
      identidade: idf,
      contexto_documento: arq.contextoDocumento ?? null,
      comparacao: arq.comparacao, motivos: v.motivos, tomador_pdf: arq.tomadorPdf, arquivos: arq.arquivos, ambiguidade: arq.comparacao ? null : arq.motivo,
      // Contexto vem da movimentação escolhida (CNPJ + "Faturado"); competência e período não são lidos da nota nem dos arquivos.
      // Campos preservados separadamente; nenhum é deduzido de outro.
      contexto: {
        cnpj_tomador: rec.cnpj_tomador, competencia: mov.mes_referencia ?? null, periodo: mov.periodo ?? null,
        referencia_servico: arq.contextoDocumento?.competenciaDescricao ?? null,
        competencia_fiscal: (rec as any).competencia ?? null, emitida_em: rec.emitida_em,
        origem: "unica_movimentacao_faturado_cnpj_completo",
      },
      conferido: { identidade_fiscal: true, cnpj_tomador: true, status_faturado: true, valores: v.diferencaCentavos === 0 && !!arq.comparacao, competencia: false, periodo: false, referencia_servico: false },
    },
    validador_versao: VALIDADOR_VERSAO, validado_em: new Date().toISOString(),
  };
  if (!v.aprovado) { await ad.salvar(rec.id, { ...base, estado: v.estado, motivo }); return { estado: v.estado, motivo }; }
  if (arq.contextoDocumento?.impedimento) {
    const m = arq.contextoDocumento.impedimento;
    await ad.salvar(rec.id, { ...base, estado: "validacao_inconclusiva", motivo: m });
    return { estado: "validacao_inconclusiva", motivo: m };
  }

  // Mudança do faturamento durante a leitura → reavaliar no próximo ciclo
  if ((await ad.revisaoAtual(mov.id)) !== revisao) {
    const m = "Faturamento alterado durante a análise; será reavaliado.";
    await ad.salvar(rec.id, { ...base, faturamento_revisao: null, chave_validacao: null, proxima_tentativa_em: new Date().toISOString(), estado: "aguardando_validacao", motivo: m });
    return { estado: "aguardando_validacao", motivo: m };
  }
  if ((await ad.outrasVersoes(rec)) > 0) {
    const m = "Aprovado, mas existe outra versão de PDF para esta nota; a versão anterior é preservada e nenhuma é anexada sem revisão humana.";
    await ad.salvar(rec.id, { ...base, estado: "revisao_versao_pdf", motivo: m });
    return { estado: "revisao_versao_pdf", motivo: m };
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
