import { describe, expect, it } from "vitest";
import { contarContratosPorStatus, contarPagadoresPorStatus, type StatusFinanceiro } from "@/lib/financeiro-utils";

const linha = (id: string, codigo: string | null, status: StatusFinanceiro) => ({
  id,
  empresa_id: `emp-${id}`,
  empresa_codigo: codigo,
  status,
});

const linhas = [
  linha("1", "2171", "Em faturamento"),
  linha("2", "2171", "Em faturamento"), // movimentação duplicada da mesma empresa
  linha("3", "2548", "Faturado"),
  linha("4", "  2548  ", "Faturado"), // mesmo contrato, código com espaços
  linha("5", null, "Faturado"), // sem código: conta individualmente
  linha("6", "1000", "Fora do prazo"),
  linha("7", "1001", "Aguardando nota"),
];

describe("indicadores de faturamento do Financeiro", () => {
  it("inclui o pagador aguardando validação na soma de 119, antes incompleta em 118", () => {
    const distribuicao: [StatusFinanceiro, number][] = [
      ["Enviada", 84], ["Nota emitida", 10], ["Aguardando nota", 8],
      ["Pendente", 0], ["Em faturamento", 14], ["Faturado", 2],
      ["Aguardando validação", 1], ["Aguardando faturamento", 0],
    ];
    const rows = distribuicao.flatMap(([status, n]) => Array.from({ length: n }, (_, i) => linha(`${status}-${i}`, null, status)));
    const counts = distribuicao.map(([status]) => contarPagadoresPorStatus(rows, {}, "2026-10", [status]));
    expect(counts).toEqual([84, 10, 8, 0, 14, 2, 1, 0]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(119);
  });

  it("aguardando faturamento conta pagadores vigentes sem duplicar movimentações", () => {
    const rows = [linha("1", "1", "Aguardando faturamento"), linha("1", "1", "Aguardando faturamento")];
    const pagadores = { "emp-1": [
      { ativo: true, cnpj: "1" }, { ativo: true, cnpj: "2" },
      { ativo: true, cnpj: "3", inativo_a_partir_de: "2026-10" }, { ativo: false, cnpj: "4" },
    ] };
    expect(contarPagadoresPorStatus(rows, pagadores, "2026-10", ["Aguardando faturamento"])).toBe(2);
  });
  it("conta uma vez cada contrato em faturamento", () => {
    expect(contarContratosPorStatus(linhas, "Em faturamento")).toBe(1);
  });

  it("conta contratos faturados sem repetir o mesmo código", () => {
    expect(contarContratosPorStatus(linhas, "Faturado")).toBe(2);
  });

  it("não mistura os outros status nos contadores de faturamento", () => {
    expect(contarContratosPorStatus(linhas, "Fora do prazo")).toBe(1);
    expect(contarContratosPorStatus(linhas, "Pendente")).toBe(0);
  });
});
