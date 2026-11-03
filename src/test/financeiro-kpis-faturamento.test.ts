import { describe, expect, it } from "vitest";
import { contarContratosPorStatus, type StatusFinanceiro } from "@/lib/financeiro-utils";

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
