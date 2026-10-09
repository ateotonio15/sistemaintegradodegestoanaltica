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

  it("não duplica cobrança retroativa repetida com quantidades diferentes", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    dados.addRow(["CNPJ", "Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    dados.addRow(["12.345.678/0001-90", "OESA", "Mensalidade", "M. Empresarial", 57257.81]);
    const resumo = wb.addWorksheet("TABELAS");
    resumo.addRow(["Cobrança Retroativa JUL/26", 1, 430.28]);
    resumo.addRow(["Cobrança Retroativa", "", 430.28]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));

    expect(blocos).toHaveLength(1);
    expect(blocos[0].retroativas?.total).toBeCloseTo(430.28, 2);
  });

  it("não soma o detalhamento do rodapé ao total retroativo consolidado", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    dados.addRow(["CNPJ", "Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    dados.addRow(["04.817.052/0001-06", "YAMAHA MOTOR DA AMAZONIA LTDA - MATRIZ", "Mensalidade", "M. Empresarial", 1726921.77]);
    dados.addRow(["04.817.052/0001-06", "YAMAHA MOTOR DA AMAZONIA LTDA - MATRIZ", "Cobrança Retroativa", "M. Empresarial", 659.70]);
    const resumo = wb.addWorksheet("TABELAS");
    resumo.addRow(["Cobrança Retroativa JUL/26", 1, 206.01]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));

    expect(blocos).toHaveLength(1);
    expect(blocos[0].retroativas?.total).toBeCloseTo(659.70, 2);
  });

  it("inclui lançamentos no fim da planilha quando o RESUMO não os consolidou", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    dados.addRow(["Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    dados.addRow(["PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL", "Mensalidade", "M. Empresarial", 258.36]);
    [155.02, 155.02, 103.34, 103.34].forEach((valor, index) => {
      dados.getRow(1596 + index).values = [
        "PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL",
        "Inclusão",
        "Coletivo Empresarial Master",
        valor,
      ];
    });

    const resumo = wb.addWorksheet("RESUMO");
    resumo.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Valor"]);
    resumo.addRow(["PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL 12.345.678/0001-90"]);
    resumo.addRow(["M. Empresarial", 216, 258.36, 55805.76]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));

    expect(blocos).toHaveLength(1);
    expect(blocos[0].enfermaria.beneficiarios).toBe(216);
    expect(blocos[0].inclusoes.quantidade).toBe(4);
    expect(blocos[0].inclusoes.total).toBeCloseTo(516.72, 2);
  });

  it("conta somente Tipo de cobrança Inclusão e separa pelo pagador", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    ws.addRow(["Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    for (let i = 0; i < 75; i++) ws.addRow(["PJ - JABIL INDUSTRIAL DO BRASIL LTDA", "Inclusão", "M. Empresarial", 50]);
    for (let i = 0; i < 11; i++) ws.addRow(["PJ - JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL", "Inclusão", "M. Empresarial", 40]);
    for (let i = 0; i < 20; i++) ws.addRow(["PJ - JABIL INDUSTRIAL DO BRASIL LTDA", "Mensalidade", "M. Empresarial", 100]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));
    const matriz = blocos.find((b) => !b.nome.includes("FILIAL"));
    const filial = blocos.find((b) => b.nome.includes("FILIAL"));

    expect(matriz?.inclusoes).toEqual({ quantidade: 75, total: 3750 });
    expect(filial?.inclusoes).toEqual({ quantidade: 11, total: 440 });
  });

  it("lê linhas 'Retroativo <Mês>/<Ano>' e ignora o total consolidado", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    dados.addRow(["CNPJ", "Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    dados.addRow(["12.345.678/0001-90", "EMPRESA X", "Mensalidade", "M. Empresarial", 1000]);
    const resumo = wb.addWorksheet("TABELAS");
    resumo.addRow(["", "Soma de QTD", "Soma de Valor"]);
    resumo.addRow(["Retroativo Julho/2026", 56, 813.68]);
    resumo.addRow(["Total Geral", 56, 813.68]);
    resumo.addRow(["", "Soma de QTD", "Soma de Valor"]);
    resumo.addRow(["Retroativo  Agosto/2026", 54, 784.62]);
    resumo.addRow(["Total Geral", 54, 784.62]);
    resumo.addRow(["", "Soma de QTD", "Soma de Valor"]);
    resumo.addRow(["Retroativo Setembro/2026", 54, 784.62]);
    resumo.addRow(["Total Geral", 54, 784.62]);
    resumo.addRow(["Valor Total Retroativo - Julho/2026 a Setembro/2026", "", 2382.92]);

    const blocos = await analisarExcelFinanceiroPorCnpj(await workbookToBuffer(wb));

    expect(blocos[0].retroativas?.total).toBeCloseTo(2382.92, 2);
    expect(blocos[0].retroativas?.quantidade).toBe(164);
  });
});
describe("retroativo com rótulo digitado errado", () => {
  it("não soma 'Reatroativo Agosto26' e avisa o erro de digitação", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("RELATORIO BENEFICIARIOS");
    dados.addRow(["CNPJ", "Subestipulante", "Tipo de cobrança", "Plano", "Mensalidade"]);
    dados.addRow(["12.345.678/0001-90", "TRANSPORTES BERTOLIN", "Mensalidade", "M. Empresarial", 18227.43]);
    const r = wb.addWorksheet("TABELAS");
    for (const l of ["Retroativo Julho26", "Reatroativo Agosto26", "Retroativo Setembro26"]) {
      r.addRow(["Rótulos de Linha", "Soma de QTD", "Soma de Valor"]);
      r.addRow([l, 9, 8651.43]);
      r.addRow(["Total Geral", 9, 8651.43]);
    }
    const blocos = await analisarExcelFinanceiroPorCnpj((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(blocos[0].retroativas?.total).toBeCloseTo(17302.86, 2);
    expect(blocos[0].avisos.some((a) => a.includes("Reatroativo Agosto26") && a.includes("Erro de digitação"))).toBe(true);
  });
});
