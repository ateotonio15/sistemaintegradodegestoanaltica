import { describe, it, expect } from "vitest";
import {
  empresaIsentaReajuste,
  classificarReajusteOperadora,
  podeImportarReajusteOperadora,
} from "@/lib/reajuste-isento";

// TVLANDIA (contrato 2120) é permuta: não sofre reajuste.
describe("contratos isentos de reajuste (permuta)", () => {
  it("reconhece a TVLANDIA como isenta quando a marcação está ativa", () => {
    expect(
      empresaIsentaReajuste({ isento_reajuste: true }),
    ).toBe(true);
  });

  it("não considera isento um contrato sem a marcação", () => {
    expect(
      empresaIsentaReajuste({ isento_reajuste: false }),
    ).toBe(false);
    expect(empresaIsentaReajuste(undefined)).toBe(false);
  });

  it("mantém o contrato isento fora da importação, mesmo sem reajuste registrado", () => {
    const situacao = classificarReajusteOperadora({
      empresaId: "ee976d1b-ae61-4bba-8c13-ed829ba76a0a",
      isento: true,
      jaRegistrado: false,
    });
    expect(situacao).toBe("isento");
    expect(podeImportarReajusteOperadora(situacao)).toBe(false);
  });

  it("classifica os demais casos normalmente", () => {
    expect(
      classificarReajusteOperadora({ empresaId: null, isento: false, jaRegistrado: false }),
    ).toBe("nao_encontrado");
    expect(
      classificarReajusteOperadora({ empresaId: "e1", isento: false, jaRegistrado: false }),
    ).toBe("novo");
    expect(
      classificarReajusteOperadora({ empresaId: "e1", isento: false, jaRegistrado: true }),
    ).toBe("registrado");
    expect(
      podeImportarReajusteOperadora("novo"),
    ).toBe(true);
    expect(
      podeImportarReajusteOperadora("registrado"),
    ).toBe(false);
  });
});
