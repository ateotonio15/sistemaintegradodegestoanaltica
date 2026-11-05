import { describe, expect, it } from "vitest";
import { exibirContratoNoAnoReajuste } from "@/lib/reajuste-utils";

describe("Exibição de contratos por ano de adesão em Reajustes", () => {
  it("oculta adesões de 2026 em 2026, inclusive no primeiro e último dia do ano", () => {
    expect(exibirContratoNoAnoReajuste("2026-01-01", 2026)).toBe(false);
    expect(exibirContratoNoAnoReajuste("2026-11-05", 2026)).toBe(false);
    expect(exibirContratoNoAnoReajuste("2026-12-31", 2026)).toBe(false);
  });

  it("exibe adesões de 2026 a partir de 2027", () => {
    expect(exibirContratoNoAnoReajuste("2026-11-05", 2027)).toBe(true);
    expect(exibirContratoNoAnoReajuste("2026-12-31", 2027)).toBe(true);
    expect(exibirContratoNoAnoReajuste("2026-11-05", 2028)).toBe(true);
  });

  it("não exibe o contrato em anos anteriores à adesão", () => {
    expect(exibirContratoNoAnoReajuste("2026-11-05", 2025)).toBe(false);
  });

  it("preserva contratos antigos e não inventa o ano quando a data não está disponível", () => {
    expect(exibirContratoNoAnoReajuste("2025-11-05", 2026)).toBe(true);
    expect(exibirContratoNoAnoReajuste(null, 2026)).toBe(true);
    expect(exibirContratoNoAnoReajuste("2026-02-30", 2026)).toBe(true);
  });
});