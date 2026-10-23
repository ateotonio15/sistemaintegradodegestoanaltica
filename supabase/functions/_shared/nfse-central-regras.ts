/**
 * Regras puras da integração Central de NFS-e → SIGA.
 * Sem dependências: usadas pelas funções do servidor e pelos testes/validador do SIGA.
 */

/** 22/10/2026 00:00 em Manaus (UTC-4). */
export const CORTE_EMISSAO_MS = Date.parse("2026-10-22T04:00:00Z");

export const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function emitidaNoPeriodo(emitidaEm: string | null | undefined): boolean {
  if (!emitidaEm || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(emitidaEm)) return false;
  const t = Date.parse(emitidaEm);
  return !isNaN(t) && t >= CORTE_EMISSAO_MS;
}

export function cnpjExato(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digits(a);
  return x.length === 14 && x === digits(b);
}

export interface AnexoInfo {
  id?: string;
  financeiro_movimentacao_id: string;
  mime_type?: string | null;
  nome_arquivo?: string | null;
  origem?: string | null;
}
export interface MovInfo {
  id: string;
  empresa_id: string;
  mes_referencia?: string | null;
  periodo?: string | null;
  data_envio_nota?: string | null;
}
export interface EmpresaInfo {
  id: string;
  cnpj?: string | null;
  exige_po_pc?: boolean | null;
  aguarda_faturamento_excel?: boolean | null;
}

const isPdf = (a: AnexoInfo) =>
  (a.mime_type ?? "").toLowerCase().includes("pdf") || (a.nome_arquivo ?? "").toLowerCase().endsWith(".pdf");
const isXls = (a: AnexoInfo) =>
  /spreadsheet|excel|csv/i.test(a.mime_type ?? "") || /\.(xlsx|xlsm|xls|csv)$/i.test(a.nome_arquivo ?? "");
const contaStatus = (a: AnexoInfo) => !["retroativo", "reajuste"].includes((a.origem ?? "normal").toLowerCase());

/**
 * "Faturado" exatamente como `calcularStatusFinanceiro`, mas só com os anexos
 * PRÓPRIOS da movimentação (nunca herdados do grupo).
 */
export function statusFaturado(mov: MovInfo, anexosDaMov: AnexoInfo[], empresa?: EmpresaInfo | null): boolean {
  if (mov.data_envio_nota) return false;
  const ax = anexosDaMov.filter((a) => a.financeiro_movimentacao_id === mov.id && contaStatus(a));
  if (ax.some(isPdf) || !ax.some(isXls)) return false;
  return !empresa?.exige_po_pc && !empresa?.aguarda_faturamento_excel;
}

export type EstadoRecebimento =
  | "recebido_pendente" | "aguardando_faturado" | "aguardando_faturamento_anexado" | "destino_ambiguo"
  | "aguardando_validacao" | "validacao_inconclusiva" | "divergencia" | "fora_do_periodo"
  | "aprovado_aguardando_liberacao" | "vinculado" | "ja_recebido" | "conflito";

export interface ResultadoDestino { estado: EstadoRecebimento; motivo: string | null; destino?: MovInfo }

export function resolverDestino(input: {
  cnpjTomador: string;
  empresas: EmpresaInfo[];
  pagadores: Array<{ empresa_id: string; cnpj?: string | null }>;
  movs: MovInfo[];
  anexos: AnexoInfo[];
  sugerida?: string | null;
}): ResultadoDestino {
  const empresaIds = new Set<string>();
  input.empresas.forEach((e) => cnpjExato(e.cnpj, input.cnpjTomador) && empresaIds.add(e.id));
  input.pagadores.forEach((p) => cnpjExato(p.cnpj, input.cnpjTomador) && empresaIds.add(p.empresa_id));
  if (!empresaIds.size) return { estado: "destino_ambiguo", motivo: "Nenhum pagador com este CNPJ completo do tomador." };
  const empMap = new Map(input.empresas.map((e) => [e.id, e]));
  const movs = input.movs.filter((m) => empresaIds.has(m.empresa_id));
  const comXls = movs.filter((m) => input.anexos.some((a) => a.financeiro_movimentacao_id === m.id && contaStatus(a) && isXls(a)));
  let faturados = movs.filter((m) => statusFaturado(m, input.anexos, empMap.get(m.empresa_id)));
  if (!faturados.length) {
    return comXls.length
      ? { estado: "aguardando_faturado", motivo: "Nenhuma movimentação deste pagador está exatamente em “Faturado”." }
      : { estado: "aguardando_faturamento_anexado", motivo: "Nenhum faturamento anexado para este pagador." };
  }
  if (faturados.length > 1)
    return { estado: "destino_ambiguo", motivo: `${faturados.length} movimentações em “Faturado” para este CNPJ; nenhuma é escolhida automaticamente.` };
  // A sugestão da Central nunca escolhe destino: só é aceita se coincidir com o único candidato.
  if (input.sugerida && faturados[0].id !== input.sugerida)
    return { estado: "destino_ambiguo", motivo: "Movimentação sugerida pela Central difere da única em “Faturado” para este CNPJ; nenhuma é escolhida automaticamente." };
  return { estado: "aguardando_validacao", motivo: null, destino: faturados[0] };
}

/** Mesma ordenação da função do banco `nfse_central_revisao`. */
export function revisaoFaturamento(anexoIds: string[]): string {
  return [...anexoIds].sort().join(",");
}

export function decidirReenvio(existente: { pdf_sha256: string } | null, hash: string): "novo" | "mesmo" | "conflito" {
  if (!existente) return "novo";
  return existente.pdf_sha256 === hash ? "mesmo" : "conflito";
}

export const centavos = (v: number) => Math.round(v * 100);

/** Comparação já calculada pelos parsers do SIGA (formato de `compararExcelComPdf`). */
export interface CampoCmp { excel: number; pdf: number | null; ok: boolean }
export interface ComparacaoCmp {
  enfermaria: { beneficiarios: CampoCmp; mensalidade: CampoCmp; total: CampoCmp } | null;
  apartamento: { beneficiarios: CampoCmp; mensalidade: CampoCmp; total: CampoCmp } | null;
  inclusoes: { total: CampoCmp } | null;
  exclusoes: { total: CampoCmp } | null;
  devolucoes: { total: CampoCmp } | null;
  taxaAdesao?: { total: CampoCmp } | null;
  divergencias: string[];
  tomadorCnpj?: string | null;
}

export interface ResultadoValidacao {
  aprovado: boolean;
  estado: EstadoRecebimento;
  motivos: string[];
  valorExcelCentavos: number | null;
  valorPdfCentavos: number | null;
  diferencaCentavos: number | null;
}

/** Decisão estrita: leitura completa, CNPJ exato, "Faturado" e diferença de zero centavos. */
export function avaliarValidacao(i: {
  cnpjTomador: string;
  cnpjPagador: string | null;
  emitidaEm: string;
  faturado: boolean;
  leituraOk: boolean;
  comparacao: ComparacaoCmp | null;
  valorExcel: number | null;
  /** Soma do descritivo da nota (categorias lidas pelo SIGA). */
  valorPdf: number | null;
  /** Valor fiscal bruto do serviço (nunca o líquido). Obrigatório para aprovar. */
  valorServico: number | null;
}): ResultadoValidacao {
  const motivos: string[] = [];
  const vE = i.valorExcel != null && isFinite(i.valorExcel) ? centavos(i.valorExcel) : null;
  const vD = i.valorPdf != null && isFinite(i.valorPdf) ? centavos(i.valorPdf) : null;
  const vS = i.valorServico != null && isFinite(i.valorServico) ? centavos(i.valorServico) : null;
  // O valor comparado com o faturamento é o fiscal bruto; o descritivo precisa conciliar com ele.
  const vP = vS;
  const dif = vE != null && vP != null ? vP - vE : null;
  const fim = (estado: EstadoRecebimento): ResultadoValidacao => ({
    aprovado: estado === "aprovado_aguardando_liberacao", estado, motivos,
    valorExcelCentavos: vE, valorPdfCentavos: vP, diferencaCentavos: dif,
  });

  if (!emitidaNoPeriodo(i.emitidaEm)) { motivos.push("Emissão anterior a 22/10/2026 ou sem data com fuso."); return fim("fora_do_periodo"); }
  if (!i.faturado) { motivos.push("Movimentação não está exatamente em “Faturado”."); return fim("aguardando_faturado"); }
  if (!cnpjExato(i.cnpjTomador, i.cnpjPagador)) { motivos.push("CNPJ do tomador diferente do CNPJ do pagador."); return fim("divergencia"); }
  if (!i.leituraOk || !i.comparacao) { motivos.push("Não foi possível ler o PDF ou o faturamento por completo."); return fim("validacao_inconclusiva"); }
  const c = i.comparacao;
  if (!cnpjExato(c.tomadorCnpj, i.cnpjTomador)) { motivos.push("CNPJ do tomador no PDF não confere com o informado."); return fim("divergencia"); }

  const cats: Array<[string, CampoCmp[]]> = [];
  if (c.enfermaria) cats.push(["Enfermaria", [c.enfermaria.beneficiarios, c.enfermaria.mensalidade, c.enfermaria.total]]);
  if (c.apartamento) cats.push(["Apartamento", [c.apartamento.beneficiarios, c.apartamento.mensalidade, c.apartamento.total]]);
  if (c.inclusoes) cats.push(["Inclusões", [c.inclusoes.total]]);
  if (c.exclusoes) cats.push(["Exclusões", [c.exclusoes.total]]);
  if (c.devolucoes) cats.push(["Devoluções", [c.devolucoes.total]]);
  if (c.taxaAdesao) cats.push(["Taxa de adesão", [c.taxaAdesao.total]]);
  if (!cats.length) { motivos.push("Nenhuma categoria comparável encontrada."); return fim("validacao_inconclusiva"); }
  let parcial = false;
  for (const [nome, campos] of cats) {
    for (const f of campos) {
      if (f.pdf == null || !isFinite(f.pdf)) { parcial = true; motivos.push(`${nome}: valor não encontrado no PDF.`); }
      else if (centavos(f.excel) !== centavos(f.pdf)) motivos.push(`${nome}: planilha ${f.excel.toFixed(2)} × PDF ${f.pdf.toFixed(2)}.`);
    }
  }
  if (vS == null) { motivos.push("Valor do serviço (bruto) não encontrado na NFS-e."); return fim("validacao_inconclusiva"); }
  if (parcial || vE == null || vD == null) {
    if (vE == null || vD == null) motivos.push("Total incompleto; valores parciais não são aprovados.");
    return fim("validacao_inconclusiva");
  }
  if (vD !== vS) motivos.push(`Descritivo da nota ${(vD / 100).toFixed(2).replace(".", ",")} × valor do serviço ${(vS / 100).toFixed(2).replace(".", ",")}.`);
  if (c.divergencias.length) motivos.push(...c.divergencias);
  if (dif !== 0) motivos.push(`Diferença de ${(Math.abs(dif!) / 100).toFixed(2).replace(".", ",")} entre PDF e faturamento.`);
  return fim(motivos.length ? "divergencia" : "aprovado_aguardando_liberacao");
}
