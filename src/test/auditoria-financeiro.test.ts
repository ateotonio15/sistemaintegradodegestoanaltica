/**
 * AUDITORIA TEMPORÁRIA (diagnóstico, dados fictícios).
 * Verifica hipóteses da revisão do módulo financeiro. Não altera produção.
 */
import { describe, expect, it } from "vitest";
import { calcularStatusFinanceiro } from "../lib/financeiro-utils";
import { valorAnalise } from "../lib/financeiro-relatorio-analise-data";

describe("AUD-1: zero do Excel vs valor ausente (valorAnalise)", () => {
  it("Excel 100 + (-100) = 0 cai no fallback do PDF, sem sinalizar diferença", () => {
    const a = {
      valor_excel_apartamento: 100,
      valor_excel_enfermaria: 0,
      valor_excel_inclusoes: -100,
      valor_excel_exclusoes: 0,
      valor_pdf_apartamento: 100,
      valor_pdf_enfermaria: 0,
      valor_pdf_inclusoes: 0,
      valor_pdf_exclusoes: 0,
    };
    // Esperado pela auditoria: 0 confirmado, com sinalização da divergência Excel≠PDF.
    // Observado: retorna o valor do PDF (100), tratando zero legítimo como ausente.
    expect(valorAnalise(a)).toBe(100);
  });

  it("Excel realmente ausente (null) usa o PDF — comportamento correto", () => {
    const a = {
      valor_excel_apartamento: null,
      valor_excel_enfermaria: null,
      valor_excel_inclusoes: null,
      valor_excel_exclusoes: null,
      valor_pdf_apartamento: 100,
      valor_pdf_enfermaria: null,
      valor_pdf_inclusoes: null,
      valor_pdf_exclusoes: null,
    };
    expect(valorAnalise(a)).toBe(100);
  });
});

describe("AUD-4: classificação de documentos (calcularStatusFinanceiro)", () => {
  const base = { data_envio_nota: null, dentro_prazo: true };
  it("Boleto em PDF é classificado como 'Nota emitida'", () => {
    const s = calcularStatusFinanceiro(base, true, [
      { mime_type: "application/pdf", nome_arquivo: "BOLETO-123.pdf", origem: "normal" },
    ]);
    expect(s).toBe("Nota emitida"); // observado; esperado: sinalizar tipo não identificado
  });
  it("Comprovante em PDF é classificado como 'Nota emitida'", () => {
    const s = calcularStatusFinanceiro(base, true, [
      { mime_type: "application/pdf", nome_arquivo: "comprovante-pagamento.pdf", origem: "normal" },
    ]);
    expect(s).toBe("Nota emitida");
  });
  it("Carta de cancelamento em PDF é classificada como 'Nota emitida'", () => {
    const s = calcularStatusFinanceiro(base, true, [
      { mime_type: "application/pdf", nome_arquivo: "carta-cancelamento.pdf", origem: "normal" },
    ]);
    expect(s).toBe("Nota emitida");
  });
});

describe("AUD-3: prazo 24/48h com data sem hora", () => {
  it("início usa o horário bruto de aguardando_nota_em; data_envio_nota é presumida fim do dia", async () => {
    const { calcularPrazoFinanceiro } = await import("../lib/financeiro-utils");
    // aguardando às 23:59 do dia 11 → janela 24h; envio no dia seguinte (sem hora → 23:59:59)
    const r = calcularPrazoFinanceiro({
      aguardando_nota_em: "2026-10-11T23:59:00",
      data_envio_nota: "2026-10-12",
      dia_emissao: null,
    });
    // limite = 12/10 23:59; envio presumido 12/10 23:59:59.999 → 1ms além → Fora do prazo
    expect(r.categoria).toBe("Fora do prazo");
  });
});
