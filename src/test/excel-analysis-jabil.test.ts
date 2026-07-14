import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";

async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("análise financeira Jabil", () => {
  it("usa Subestipulante como pagador e mantém matriz e filial independentes", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    ws.addRow([
      "Contrato",
      "Contratante",
      "Familia",
      "Carteirinha",
      "Beneficiario",
      "Matricula",
      "Tipo",
      "Subestipulante",
      "Titular",
      "Tipo de cobrança",
      "Plano",
      "Mensalidade",
      "QTD",
    ]);
    ws.addRow(["1122", "JABIL INDUSTRIAL DO BRASIL LTDA", "1", "1", "A", "1", "Titular", "PJ - JABIL INDUSTRIAL DO BRASIL LTDA", "", "Mensalidade", "M. Empresarial", 100, 1]);
    ws.addRow(["1122", "JABIL INDUSTRIAL DO BRASIL LTDA", "2", "2", "B", "2", "Titular", "PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL", "", "Mensalidade", "M. Empresarial", 200, 1]);
    ws.addRow(["1122", "JABIL INDUSTRIAL DO BRASIL LTDA", "3", "3", "C", "3", "Titular", "PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL", "", "Inclusão", "M. Empresarial", 50, 1]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));

    expect(blocos).toHaveLength(2);
    const matriz = blocos.find((b) => b.nome.includes("LTDA") && !b.nome.includes("FILIAL"));
    const filial = blocos.find((b) => b.nome.includes("FILIAL"));
    expect(matriz?.enfermaria.beneficiarios).toBe(1);
    expect(matriz?.enfermaria.total).toBe(100);
    expect(filial?.enfermaria.beneficiarios).toBe(1);
    expect(filial?.enfermaria.total).toBe(200);
    expect(filial?.inclusoes.quantidade).toBe(1);
    expect(filial?.inclusoes.total).toBe(50);
  });
});