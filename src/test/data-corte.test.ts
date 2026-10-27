import { describe, expect, it } from "vitest";
import { dataCorteMovimentacao } from "../../supabase/functions/_shared/data-corte";

describe("dataCorteMovimentacao (prazo do e-mail de conferência)", () => {
  it("usa o último dia do período dentro da competência", () => {
    expect(dataCorteMovimentacao("25-30", "2026-10")).toBe("30/10/2026");
    expect(dataCorteMovimentacao("01-05", "2026-10")).toBe("05/10/2026");
    expect(dataCorteMovimentacao("20-25", "2026-11")).toBe("25/11/2026");
  });

  it("nunca passa do último dia do mês", () => {
    expect(dataCorteMovimentacao("20-31", "2026-02")).toBe("28/02/2026");
    expect(dataCorteMovimentacao("20-31", "2028-02")).toBe("29/02/2028");
  });

  it("sem período usa o último dia do mês da competência", () => {
    expect(dataCorteMovimentacao(null, "2026-11")).toBe("30/11/2026");
    expect(dataCorteMovimentacao("", "2026-12")).toBe("31/12/2026");
  });

  it("sem competência válida não inventa data", () => {
    expect(dataCorteMovimentacao("25-30", null)).toBeNull();
    expect(dataCorteMovimentacao("25-30", "outubro")).toBeNull();
    expect(dataCorteMovimentacao("25-30", "2026-13")).toBeNull();
  });
});
