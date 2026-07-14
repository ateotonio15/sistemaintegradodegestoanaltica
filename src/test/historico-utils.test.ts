import { describe, expect, it } from "vitest";
import { detectarCompetencia } from "../lib/historico-utils";

describe("detectarCompetencia", () => {
  it("prioriza arquivo com ano em 2 dígitos antes do mês da movimentação", () => {
    expect(detectarCompetencia("2026-06", "FATURAMENTO JABIL - JULHO26.xlsx")?.label).toBe("Julho/2026");
  });
});