import { describe, expect, it } from "vitest";
import { permiteCompetenciaMovimentacao } from "@/lib/movimentacao-primeira-competencia";

describe("primeira movimentação do Cartório 3 Ofício (2548)", () => {
  const empresa = { status_implantacao: "ativo", primeira_competencia_financeira: "2026-11" };

  it("não exibe outubro: implantação 10/10 após corte 05", () => {
    expect(permiteCompetenciaMovimentacao(empresa, "2026-10")).toBe(false);
  });

  it("permite novembro, primeira competência válida", () => {
    expect(permiteCompetenciaMovimentacao(empresa, "2026-11")).toBe(true);
  });

  it("mantém meses anteriores ocultos após ativação", () => {
    expect(permiteCompetenciaMovimentacao({ ...empresa, status_implantacao: "aguardando_primeiro_fechamento" }, "2026-10")).toBe(false);
    expect(permiteCompetenciaMovimentacao(empresa, "2026-10")).toBe(false);
  });

  it("preserva empresas antigas sem primeira competência", () => {
    expect(permiteCompetenciaMovimentacao({ status_implantacao: "ativo" }, "2026-10")).toBe(true);
    expect(permiteCompetenciaMovimentacao({ status_implantacao: "aguardando_primeiro_fechamento" }, "2026-10")).toBe(false);
  });
});