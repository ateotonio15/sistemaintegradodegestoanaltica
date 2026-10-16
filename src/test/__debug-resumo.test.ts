import { it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("debug", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RESUMO");
  ws.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Valor"]);
  ws.addRow(["EMPRESA TESTE LTDA CNPJ: 11.222.333/0001-81"]);
  ws.addRow(["M.Empresarial", 10, 100, 1000]);
  ws.addRow(["Complemento Outubro/2026", 1, null, 20]);
  ws.addRow(["Co-participação", 5, null, 80]);
  ws.addRow(["TOTAL", null, null, 1100]);
  const det = wb.addWorksheet("Beneficiários");
  det.addRow(["Nome", "Plano", "Valor"]);
  for (let i = 1; i <= 10; i++) det.addRow([`Beneficiário ${i}`, "M.Empresarial", 100]);
  const buf = await wb.xlsx.writeBuffer();
  const r = await analisarExcelFinanceiroPorCnpj(new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer);
  console.log(JSON.stringify(r, null, 1));
});
