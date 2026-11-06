import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";

const H = ["Carteirinha", "Competência", "Contr", "Beneficiário", "Titularidade", "Titular", "Familia", "Dt Adesão", "Matricula", "Fx Etária", "CPF", "Dt ", "Idade", "Tipo Cobrança", "CNPJ", "Pagador", "Plano", "Valor", "QTD"];
const linha = (tipo: string, valor: number, i: number) => [`'${i}`, new Date(2026, 10, 1), 2492, `Pessoa ${i}`, "Titular", null, i, new Date(2025, 7, 1), null, "0 à 999", "'98478311220", new Date(1990, 0, 1), 36, tipo, "05299463000110", "MITSUBA DO BRASIL LTDA", "Coletivo Empresarial Master", valor, 1];

describe("aba 'RetroaçãoAgo26' (caso MITSUBA)", () => {
  it("não soma uma linha da aba de retroação como se fosse pivot do RESUMO", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    ws.addRow(H);
    ws.addRow(linha("Mensalidade", 300, 1));
    ws.addRow(linha("Mensalidade", 300, 2));
    ws.addRow(linha("Mensalidade", 300, 3));
    const r = wb.addWorksheet("RESUMO");
    r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
    r.addRow(["Mensalidade", 3, 900]);
    r.addRow(["Total Geral", 3, 900]);
    r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
    r.addRow(["Retroativo Agosto26", 3, 28.53]);
    r.addRow(["Total Geral", 3, 28.53]);
    r.addRow([null, "Total", 928.53]);
    const s = wb.addWorksheet("RetroaçãoAgo26");
    s.addRow(H);
    for (let i = 1; i <= 3; i++) s.addRow(linha("Retroativo Agosto26", 9.51, i));
    const [b] = await analisarExcelFinanceiroPorCnpj((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(b.retroativas?.quantidade).toBe(3);
    expect(b.retroativas?.total).toBeCloseTo(28.53, 2);
  });
});
