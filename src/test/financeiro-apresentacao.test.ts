import { describe, expect, it } from "vitest";
import { linhasRetroativo, selecionarResultadoHistorico } from "@/lib/financeiro-apresentacao";
import type { AnaliseResultado } from "@/lib/excel-analysis-utils";

describe("históricos individuais", () => {
  const resultados = [
    { pagador: "Empresa A", retroativas: { quantidade: 1, total: 1588.42 } },
    { pagador: "Empresa B", retroativas: { quantidade: 2, total: 300 } },
  ] as AnaliseResultado[];
  it("seleciona somente a cobrança do pagador escolhido", () => {
    expect(selecionarResultadoHistorico(resultados, 1)).toEqual([resultados[1]]);
    expect(selecionarResultadoHistorico(resultados, 1)?.[0].retroativas?.total).toBe(300);
  });
  it("preserva a análise agregada quando não há seleção individual", () => {
    expect(selecionarResultadoHistorico(resultados)).toBe(resultados);
  });
});

describe("detalhamento mensal sem alteração de valores", () => {
  it("preserva os valores de junho, julho e agosto na ordem cronológica", () => {
    const linhas = linhasRetroativo({ quantidade: 6, total: 600, mesesDetalhe: [
      { mes: "AGO/26", quantidade: 3, total: 300 },
      { mes: "JUN/26", quantidade: 1, total: 100 },
      { mes: "JUL/26", quantidade: 2, total: 200 },
    ] });
    expect(linhas.map(l => l.total)).toEqual([100, 200, 300]);
    expect(linhas.map(l => l.beneficiarios)).toEqual([1, 2, 3]);
    expect(linhas.reduce((s, l) => s + l.total, 0)).toBe(600);
  });
  it("não substitui o total por um detalhamento incompleto", () => {
    expect(linhasRetroativo({ quantidade: 6, total: 600, mesesDetalhe: [
      { mes: "JUN/26", quantidade: 1, total: 100 },
    ] })[0].total).toBe(600);
  });
});