/**
 * Validação dos arquivos de uma nota da Central (PDF × faturamento anexado),
 * usando exatamente os parsers e o cálculo central do SIGA.
 * Este módulo é empacotado para o servidor (supabase/functions/_shared/siga-validador.generated.js).
 */
import { analisarExcelFinanceiroPorCnpj, compararExcelComPdf } from "./excel-analysis-utils";
import { analisarPdfFinanceiro } from "./pdf-analysis-utils";
import { somarTotalFaturamento } from "./faturamento-totais";
import { sumPdfTotal } from "./pdf-total";

export interface ResultadoArquivosCentral {
  leituraOk: boolean;
  motivo: string | null;
  valorExcel: number | null;
  valorPdf: number | null;
  comparacao: ReturnType<typeof compararExcelComPdf> | null;
  tomadorPdf: string | null;
}

const vazio = (motivo: string, extra: Partial<ResultadoArquivosCentral> = {}): ResultadoArquivosCentral => ({
  leituraOk: false, motivo, valorExcel: null, valorPdf: null, comparacao: null, tomadorPdf: null, ...extra,
});

export async function validarArquivosCentral(i: {
  pdf: ArrayBuffer; xls: ArrayBuffer; cnpjTomador: string; tipoAnalise?: string | null;
}): Promise<ResultadoArquivosCentral> {
  let blocos: Awaited<ReturnType<typeof analisarExcelFinanceiroPorCnpj>>;
  try { blocos = await analisarExcelFinanceiroPorCnpj(i.xls); } catch { return vazio("Planilha de faturamento ilegível."); }
  const doPagador = blocos.filter((b) => (b.cnpj ?? "").replace(/\D/g, "") === i.cnpjTomador);
  if (doPagador.length !== 1)
    return vazio(doPagador.length ? "Mais de um bloco do mesmo CNPJ na planilha." : "CNPJ do tomador não encontrado na planilha.");
  const excel = doPagador[0];

  const pdf = await analisarPdfFinanceiro(i.pdf);
  if (pdf.avisos.some((a) => /falha ao abrir/i.test(a))) return vazio("PDF ilegível.");
  const cmp = compararExcelComPdf(excel as any, { ...pdf, arquivo: "central.pdf" } as any, i.tipoAnalise);
  cmp.tomadorCnpj = pdf.tomadorCnpj ?? null;
  const valorPdf = sumPdfTotal(cmp);
  const valorExcel = somarTotalFaturamento(excel as any);
  const leituraOk = valorPdf != null && !!pdf.tomadorCnpj;
  return {
    leituraOk, motivo: leituraOk ? null : "PDF incompleto: tomador ou valores não encontrados.",
    valorExcel, valorPdf, comparacao: cmp, tomadorPdf: pdf.tomadorCnpj ?? null,
  };
}
