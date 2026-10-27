import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";

const H = ["Carteirinha", "Competência", "Contr", "Beneficiário", "Titularidade", "Titular", "Familia", "Dt Adesão", "Matricula", "Fx Etária", "CPF", "Dt ", "Idade", "Tipo Cobrança", "CNPJ", "Pagador", "Plano", "Valor", "QTD"];
const linha = (tipo: string, valor: number) => ["'1", new Date(2026, 7, 1), 2193, "Fulano", "Titular", null, 1, new Date(2024, 5, 1), null, "29 à 33", "'60481706291", new Date(1990, 0, 1), 36, tipo, "33011601000159", "NAVEGAM PORTAIS", "Coletivo Empresarial Master", valor, 1];

async function montar(totalDeclarado: number) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RELATORIO BENEFICIARIOS");
  ws.addRow(H);
  ws.addRow(linha("Mensalidade", 1000));
  ws.addRow(linha("Cobrança retroativa", 200));
  for (const [nome, v] of [["RETROATIVO JUNHO", 30], ["RETROATIVO JULHO", 20]] as const) {
    const s = wb.addWorksheet(nome);
    s.addRow(H);
    s.addRow(linha("Cobrança retroativa", v));
  }
  const r = wb.addWorksheet("RESUMO");
  r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
  r.addRow(["Cobrança retroativa", 1, 200]);
  r.addRow(["Mensalidade", 1, 1000]);
  r.addRow(["Total Geral", 2, 1200]);
  r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
  r.addRow(["Cobrança retroativa Junho/26", 1, 30]);
  r.addRow(["Total Geral", 1, 30]);
  r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
  r.addRow(["Cobrança retroativa Julho/26", 1, 20]);
  r.addRow(["Total Geral", 1, 20]);
  r.addRow([null, "Total", totalDeclarado]);
  return analisarExcelFinanceiroPorCnpj((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("abas de retroativo adicionais (caso NAVEGAM)", () => {
  it("soma as abas de retroativo quando o Total do RESUMO comprova", async () => {
    const [b] = await montar(1250);
    expect(b.retroativas?.total).toBeCloseTo(250, 2);
    expect(b.inclusoes.total).toBeCloseTo(250, 2);
  });
  it("sem o Total do RESUMO conferindo, as abas continuam só detalhamento", async () => {
    const [b] = await montar(1200);
    expect(b.retroativas?.total).toBeCloseTo(200, 2);
  });
});
