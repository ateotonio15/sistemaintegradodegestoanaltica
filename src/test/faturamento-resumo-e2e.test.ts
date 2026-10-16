/**
 * Validação item 2: layout RESUMO de ponta a ponta com o parser real.
 * Planilha fictícia no formato suportado: cabeçalho "Empresa/Módulo | Qtd |
 * Mensalidade | Valor", bloco por CNPJ, linhas de módulo, complemento,
 * coparticipação (pivot por Tipo de Cobrança) e linha TOTAL.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
import { somarTotalFaturamento } from "../lib/faturamento-totais";

const CNPJ = "11.222.333/0001-81";

async function workbookResumo(comAbaDetalhe: boolean): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RESUMO");
  ws.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Valor"]);
  ws.addRow([`EMPRESA TESTE LTDA CNPJ: ${CNPJ}`]);
  ws.addRow(["M.Empresarial", 10, 100, 1000]);
  ws.addRow(["Complemento Outubro/2026", 1, null, 20]);
  ws.addRow(["Co-participação", 5, null, 80]);
  ws.addRow(["TOTAL", null, null, 1100]);
  if (comAbaDetalhe) {
    // Mesma relação de beneficiários em aba detalhada (mesmos valores).
    const det = wb.addWorksheet("Beneficiários");
    det.addRow(["Nome", "Plano", "Valor"]);
    for (let i = 1; i <= 10; i++) det.addRow([`Beneficiário ${i}`, "M.Empresarial", 100]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer;
}

describe("Layout RESUMO de ponta a ponta", () => {
  it("mensalidade 1.000 + coparticipação 80 + complemento 20 = 1.100", async () => {
    const [bloco] = await analisarExcelFinanceiroPorCnpj(await workbookResumo(false));
    // Campos extraídos pelo parser:
    expect(bloco.cnpj).toBe("11222333000181");
    expect(bloco.enfermaria.beneficiarios).toBe(10);
    expect(bloco.enfermaria.total).toBe(1000);
    expect(bloco.coparticipacao?.quantidade).toBe(5);
    expect(bloco.coparticipacao?.total).toBe(80);
    expect(bloco.complemento?.quantidade).toBe(1);
    expect(bloco.complemento?.total).toBe(20);
    expect(bloco.totalDeclaradoExcel).toBe(1100);
    // Total calculado pela função central:
    expect(somarTotalFaturamento(bloco)).toBe(1100);
  });

  it("RESUMO + aba detalhada do mesmo arquivo não contam duas vezes", async () => {
    const [bloco] = await analisarExcelFinanceiroPorCnpj(await workbookResumo(true));
    expect(bloco.enfermaria.total).toBe(1000); // não 2.000
    expect(somarTotalFaturamento(bloco)).toBe(1100);
  });
});
