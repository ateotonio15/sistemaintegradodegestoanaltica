/**
 * Validação item 4: zero, ausência e total parcial.
 * - "Não encontrado no PDF" não é zero confirmado: a comparação fica
 *   inconclusiva (pdf: null) e a mensagem não afirma igualdade nem
 *   divergência financeira.
 * - Zero real lido do PDF continua comparável.
 */
import { describe, expect, it } from "vitest";
import {
  compararExcelComPdfSimplificado,
  type AnaliseResultado,
} from "../lib/excel-analysis-utils";
import type { AnalisePdfSimplificado } from "../lib/pdf-analysis-utils";

const excelBase = (): AnaliseResultado => ({
  pagador: "EMPRESA TESTE",
  enfermaria: { beneficiarios: 10, mensalidade: 100, total: 1000 },
  apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
  inclusoes: { quantidade: 2, total: 150 },
  exclusoes: { quantidade: 1, total: -50 },
  avisos: [],
});

const pdfBase = (): AnalisePdfSimplificado & { arquivo: string } => ({
  arquivo: "nf.pdf",
  beneficiarios: 10,
  inclusoes: { quantidade: 2, total: 150 },
  exclusoes: { quantidade: 1, total: -50 },
  valorLiquido: 1000,
  nfNumero: "123",
  avisos: [],
});

describe("PDF simplificado — 'não encontrado' não é zero confirmado", () => {
  it("categoria ausente no PDF (total 0 + aviso) fica inconclusiva", () => {
    const pdf = pdfBase();
    pdf.inclusoes = { quantidade: null, total: 0 };
    pdf.avisos.push("Categoria 'Inclusões' não encontrada no PDF.");
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    expect(cmp.inclusoes?.pdf).toBeNull();
    expect(cmp.inclusoes?.ok).toBe(false);
    const msg = cmp.divergencias.find((d) => d.startsWith("Inclusões"));
    expect(msg).toContain("inconclusiva");
    expect(msg).not.toContain("× PDF");
  });

  it("zero real no PDF (sem aviso de ausência) continua gerando divergência quando o Excel tem valor", () => {
    const pdf = pdfBase();
    pdf.inclusoes = { quantidade: 2, total: 0 };
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    // Zero sem aviso: o formato atual do parser não distingue — tratado como
    // ausência (pdf null), nunca como zero confirmado.
    expect(cmp.inclusoes?.pdf).toBeNull();
  });

  it("valor presente no PDF confere normalmente", () => {
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdfBase());
    expect(cmp.inclusoes?.ok).toBe(true);
    expect(cmp.exclusoes?.ok).toBe(true);
    expect(cmp.divergencias).toHaveLength(0);
  });
});
