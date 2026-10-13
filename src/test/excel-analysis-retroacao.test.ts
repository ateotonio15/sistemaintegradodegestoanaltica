import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";

describe("RESUMO com blocos 'Retroação à <Mês>'", () => {
  it("classifica cada competência como retroativo, não como mensalidade", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RESUMO");
    ws.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Total"]);
    ws.addRow(["ELGIN INDUSTRIAL DA AMAZÔNIA LTDA  CNPJ:  14.200.166/0001-66"]);
    ws.addRow(["Retroação á Junho/26"]);
    ws.addRow(["M.Empresarial", 2393, 68.7, 164399.1]);
    ws.addRow(["Retroação á Julho/26"]);
    ws.addRow(["M.Empresarial", 2383, 68.7, 163712.1]);
    const r = await analisarExcelFinanceiroPorCnpj((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r).toHaveLength(1);
    expect(r[0].enfermaria.total).toBe(0);
    expect(r[0].retroativas?.total).toBeCloseTo(328111.2, 2);
    expect(r[0].retroativas?.mesesDetalhe?.map((d) => d.mes)).toEqual(["JUN/26", "JUL/26"]);
  });
});

describe("aba RESUMO_AUTOMATICO", () => {
  it("lê retroativos por competência com o nome RESUMO_AUTOMATICO", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RESUMO_AUTOMATICO");
    [[null, "WE CAN BR\nCONTRATO 2108 | CNPJ 02762632000118"],
     [null, "Competência Setembro/2026", "Soma de QTD", "Soma de Valor"],
     [null, "Total Geral", 59, 14016.63],
     [null, "Competência Outubro/2026", "Soma de QTD", "Soma de Valor"],
     [null, "Total Geral", 55, 13066.35]].forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    const [r] = await analisarExcelFinanceiroPorCnpj(new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer);
    expect(r.cnpj).toBe("02762632000118");
    expect(r.retroativas?.total).toBe(27082.98);
    expect(r.enfermaria.total).toBe(0);
  });
});
