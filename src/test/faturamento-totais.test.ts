/**
 * Pacote 1 da auditoria financeira (F1, F2, F9, F11, F13).
 * Testes com planilhas fictícias usando os parsers reais do projeto,
 * além de testes unitários das regras de totalização.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  analisarExcelFinanceiroPorCnpj,
  analisarExcelFinanceiroPorPagador,
} from "../lib/excel-analysis-utils";
import {
  calcularTotalFaturamento,
  classificarValorCampo,
  somarTotalFaturamento,
} from "../lib/faturamento-totais";
import { valorAnalise } from "../lib/financeiro-relatorio-analise-data";

const CNPJ_A = "11222333000181"; // matriz ALFA
const CNPJ_B = "44555666000196"; // filial ALFA

async function planilha(rows: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Beneficiários");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer;
}

const CABECALHO_COMPLETO = ["Plano", "Tipo Cobrança", "Valor", "CNPJ", "Pagador"];
const CABECALHO_SEM_PAGADOR = ["Plano", "Tipo Cobrança", "Valor"];

function linha(plano: string, tipo: string, valor: number, cnpj = CNPJ_A, pagador = "ALFA") {
  return [plano, tipo, valor, cnpj, pagador];
}

describe("F1 — total de faturamento centralizado (parser real)", () => {
  it("A. Mensalidade 1.000 + adesão 100 − devolução 50 − permuta 20 = 1.030", async () => {
    const buf = await planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Mensalidade", 500),
      linha("Enfermaria", "Mensalidade", 500),
      linha("Enfermaria", "Taxa de Adesão", 100),
      linha("Enfermaria", "Devolução", 50),
      linha("Enfermaria", "Permuta", 20),
    ]);
    const [bloco] = await analisarExcelFinanceiroPorCnpj(buf);
    expect(bloco.enfermaria.total).toBe(1000);
    expect(bloco.taxaAdesao?.total).toBe(100);
    expect(bloco.devolucoes?.total).toBe(-50);
    expect(bloco.permuta?.total).toBe(-20);
    expect(somarTotalFaturamento(bloco)).toBe(1030);
  });

  it("B. Mensalidade 1.000 + coparticipação 80 + complemento 20 = 1.100", () => {
    // Coparticipação e complemento vêm do layout RESUMO (pivot), não da
    // relação linha-a-linha; aqui a regra é validada na função central.
    const t = calcularTotalFaturamento({
      enfermaria: { beneficiarios: 10, total: 1000 },
      coparticipacao: { quantidade: 5, total: 80 },
      complemento: { quantidade: 1, total: 20 },
    });
    expect(t.total).toBe(1100);
    expect(t.completo).toBe(true);
  });

  it("C. Inclusões de 200 com 50 retroativas: retroativo não é somado de novo", async () => {
    const buf = await planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Inclusão", 150),
      linha("Enfermaria", "Inclusão Retroativa", 50),
    ]);
    const [bloco] = await analisarExcelFinanceiroPorCnpj(buf);
    expect(bloco.inclusoes.total).toBe(200); // já inclui os 50 retroativos
    expect(bloco.retroativas?.total).toBe(50);
    expect(somarTotalFaturamento(bloco)).toBe(200); // não 250
  });

  it("reconcilia: soma dos pagadores = total do documento sem filtro", async () => {
    const buf = await planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Mensalidade", 100, CNPJ_A, "ALFA"),
      linha("Apartamento", "Mensalidade", 200, CNPJ_B, "ALFA FILIAL"),
      linha("Enfermaria", "Inclusão", 50, CNPJ_B, "ALFA FILIAL"),
    ]);
    const blocos = await analisarExcelFinanceiroPorCnpj(buf);
    const somaPagadores = blocos.reduce((s, b) => s + somarTotalFaturamento(b), 0);
    const agregado = await analisarExcelFinanceiroPorPagador(buf);
    expect(somaPagadores).toBeCloseTo(somarTotalFaturamento(agregado), 2);
    expect(somaPagadores).toBe(350);
  });
});

describe("F11 — correspondência de pagadores", () => {
  const planilhaMatrizFilial = () =>
    planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Mensalidade", 100, CNPJ_A, "ALFA"),
      linha("Enfermaria", "Mensalidade", 200, CNPJ_B, "ALFA FILIAL"),
    ]);

  it("filtrar pelo CNPJ A traz só 100 — CNPJ válido divergente não é aceito pelo nome", async () => {
    const r = await analisarExcelFinanceiroPorPagador(await planilhaMatrizFilial(), {
      cnpj: CNPJ_A,
      nome: "ALFA",
    });
    expect(r.enfermaria.total).toBe(100);
    expect(r.enfermaria.beneficiarios).toBe(1);
  });

  it("filtro só por nome com dois CNPJs válidos registra ambiguidade", async () => {
    const r = await analisarExcelFinanceiroPorPagador(await planilhaMatrizFilial(), {
      nome: "ALFA",
    });
    // Os dois pagadores casam pelo nome, mas o sistema avisa da ambiguidade.
    expect(r.enfermaria.total).toBe(300);
    expect(r.avisos.some((a) => a.toLowerCase().includes("ambiguidade"))).toBe(true);
  });

  it("filtro só por nome com um único CNPJ não registra ambiguidade", async () => {
    const buf = await planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Mensalidade", 100, CNPJ_A, "ALFA"),
    ]);
    const r = await analisarExcelFinanceiroPorPagador(buf, { nome: "ALFA" });
    expect(r.enfermaria.total).toBe(100);
    expect(r.avisos.some((a) => a.toLowerCase().includes("ambiguidade"))).toBe(false);
  });
});

describe("F2 — planilha sem coluna de pagador não repete o total por pagador", () => {
  it("marca semSeparacaoPorPagador e preserva o total agregado conhecido", async () => {
    const buf = await planilha([
      CABECALHO_SEM_PAGADOR,
      ["Enfermaria", "Mensalidade", 1000],
    ]);
    const r = await analisarExcelFinanceiroPorPagador(buf, { cnpj: CNPJ_A, nome: "ALFA" });
    expect(r.semSeparacaoPorPagador).toBe(true);
    expect(r.enfermaria.total).toBe(1000); // total agregado preservado, não zero
    expect(r.avisos.some((a) => a.includes("Não foi possível separar por pagador"))).toBe(true);
  });

  it("sem filtro, a mesma planilha não recebe a marca", async () => {
    const buf = await planilha([
      CABECALHO_SEM_PAGADOR,
      ["Enfermaria", "Mensalidade", 1000],
    ]);
    const r = await analisarExcelFinanceiroPorPagador(buf);
    expect(r.semSeparacaoPorPagador).toBeFalsy();
    expect(r.enfermaria.total).toBe(1000);
  });
});

describe("F9/F13 — zero válido diferente de ausência", () => {
  it("classifica zero, ausente, inválido e valor", () => {
    expect(classificarValorCampo(0)).toBe("zero");
    expect(classificarValorCampo(null)).toBe("ausente");
    expect(classificarValorCampo(undefined)).toBe("ausente");
    expect(classificarValorCampo("abc")).toBe("invalido");
    expect(classificarValorCampo(123.45)).toBe("valor");
  });

  it("Excel 100 + ajuste −100 = 0 é zero válido, não ausência", async () => {
    const buf = await planilha([
      CABECALHO_COMPLETO,
      linha("Enfermaria", "Inclusão", 100),
      linha("Enfermaria", "Devolução", 100),
    ]);
    const [bloco] = await analisarExcelFinanceiroPorCnpj(buf);
    expect(somarTotalFaturamento(bloco)).toBe(0);
    const t = calcularTotalFaturamento(bloco);
    expect(t.completo).toBe(true); // zero calculado, sem pendência
  });

  it("valorAnalise usa o Excel mesmo quando o total é zero — não cai no PDF", () => {
    const row = {
      valor_excel_enfermaria: 100,
      valor_excel_apartamento: 0,
      valor_excel_inclusoes: -100,
      valor_excel_exclusoes: 0,
      valor_pdf_enfermaria: 999,
      valor_pdf_apartamento: 0,
      valor_pdf_inclusoes: 0,
      valor_pdf_exclusoes: 0,
    };
    expect(valorAnalise(row)).toBe(0); // zero do Excel é válido
  });

  it("valorAnalise só usa o PDF quando não há nenhum valor de Excel", () => {
    const row = {
      valor_excel_enfermaria: null,
      valor_excel_apartamento: null,
      valor_excel_inclusoes: null,
      valor_excel_exclusoes: null,
      valor_pdf_enfermaria: 700,
      valor_pdf_apartamento: 300,
      valor_pdf_inclusoes: 0,
      valor_pdf_exclusoes: 0,
    };
    expect(valorAnalise(row)).toBe(1000);
  });

  it("lançamento com quantidade e valor ausente gera pendência de validação", () => {
    const t = calcularTotalFaturamento({
      enfermaria: { beneficiarios: 10, total: 1000 },
      devolucoes: { quantidade: 2, total: null },
    });
    expect(t.total).toBe(1000); // total parcial, sem presumir zero
    expect(t.completo).toBe(false);
    expect(t.pendencias).toEqual([
      { categoria: "devolucoes", rotulo: "Devoluções", quantidade: 2, motivo: "valor ausente" },
    ]);
  });
});
