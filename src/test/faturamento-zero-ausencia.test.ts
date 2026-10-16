/**
 * Validação: zero, ausência e falha de leitura no PDF simplificado.
 * Distinção estruturada (sem depender do texto do aviso):
 * - total = 0     → zero efetivamente identificado no documento (válido);
 * - total = null  → valor não encontrado (comparação inconclusiva);
 * - falhaLeitura  → PDF ilegível (comparação inconclusiva).
 * Cenários (a)–(e) do pedido de validação.
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
  falhaLeitura: false,
  avisos: [],
});

describe("PDF simplificado — ausência estruturada", () => {
  it("(a) zero explícito no PDF é zero válido e comparável", () => {
    const excel = excelBase();
    excel.inclusoes = { quantidade: 0, total: 0 };
    const pdf = pdfBase();
    pdf.inclusoes = { quantidade: 0, total: 0 };
    const cmp = compararExcelComPdfSimplificado(excel, pdf);
    expect(cmp.inclusoes?.pdf).toBe(0);
    expect(cmp.inclusoes?.ok).toBe(true);
  });

  it("(a2) zero explícito no PDF contra Excel com valor gera divergência (d)", () => {
    const pdf = pdfBase();
    pdf.inclusoes = { quantidade: 0, total: 0 };
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    expect(cmp.inclusoes?.pdf).toBe(0);
    expect(cmp.inclusoes?.ok).toBe(false);
    const msg = cmp.divergencias.find((d) => d.startsWith("Inclusões"));
    expect(msg).toContain("× PDF");
  });

  it("(b) categoria ausente no PDF (total null) fica inconclusiva", () => {
    const pdf = pdfBase();
    pdf.inclusoes = { quantidade: null, total: null };
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    expect(cmp.inclusoes?.pdf).toBeNull();
    expect(cmp.inclusoes?.ok).toBe(false);
    const msg = cmp.divergencias.find((d) => d.startsWith("Inclusões"));
    expect(msg).toContain("inconclusiva");
    expect(msg).not.toContain("× PDF");
  });

  it("(c) PDF ilegível (falhaLeitura) deixa todas as comparações inconclusivas", () => {
    const pdf = pdfBase();
    pdf.falhaLeitura = true;
    pdf.inclusoes = { quantidade: null, total: null };
    pdf.exclusoes = { quantidade: null, total: null };
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    expect(cmp.inclusoes?.pdf).toBeNull();
    expect(cmp.exclusoes?.pdf).toBeNull();
    expect(
      cmp.divergencias.every((d) => d.includes("inconclusiva") || d.startsWith("Total de beneficiários")),
    ).toBe(true);
  });

  it("(d) Excel zero e PDF com valor positivo: divergência", () => {
    const excel = excelBase();
    excel.inclusoes = { quantidade: 0, total: 0 };
    const cmp = compararExcelComPdfSimplificado(excel, pdfBase());
    expect(cmp.inclusoes?.ok).toBe(false);
    expect(cmp.inclusoes?.pdf).toBe(150);
    const msg = cmp.divergencias.find((d) => d.startsWith("Inclusões"));
    expect(msg).toContain("× PDF");
  });

  it("(e) Excel com valor e PDF desconhecido: comparação inconclusiva", () => {
    const pdf = pdfBase();
    pdf.exclusoes = { quantidade: null, total: null };
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdf);
    expect(cmp.exclusoes?.pdf).toBeNull();
    expect(cmp.exclusoes?.ok).toBe(false);
    const msg = cmp.divergencias.find((d) => d.startsWith("Exclusões"));
    expect(msg).toContain("inconclusiva");
  });

  it("valores presentes no PDF conferem normalmente", () => {
    const cmp = compararExcelComPdfSimplificado(excelBase(), pdfBase());
    expect(cmp.inclusoes?.ok).toBe(true);
    expect(cmp.exclusoes?.ok).toBe(true);
    expect(cmp.divergencias).toHaveLength(0);
  });
});
