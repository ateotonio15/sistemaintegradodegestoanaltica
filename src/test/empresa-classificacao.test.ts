import { describe, expect, it } from "vitest";
import {
  CLASSIFICACAO_OPTIONS,
  SEM_CLASSIFICACAO,
  normalizarClassificacao,
} from "@/lib/empresa-classificacao";

describe("Classificação do contrato", () => {
  it("oferece exatamente as três opções ditadas pelo usuário", () => {
    expect([...CLASSIFICACAO_OPTIONS]).toEqual([
      "Empresarial",
      "Empresarial Copart. - Total",
      "Empresarial Copart. - Parcial",
    ]);
  });

  it("grava a escolha feita na janela", () => {
    expect(normalizarClassificacao("Empresarial Copart. - Total")).toBe("Empresarial Copart. - Total");
    expect(normalizarClassificacao("Empresarial Copart. - Parcial")).toBe("Empresarial Copart. - Parcial");
    expect(normalizarClassificacao("  Empresarial  ")).toBe("Empresarial");
  });

  it("guarda nulo quando nada é selecionado ou quando a opção não existe no catálogo", () => {
    expect(normalizarClassificacao("")).toBeNull();
    expect(normalizarClassificacao("   ")).toBeNull();
    expect(normalizarClassificacao(null)).toBeNull();
    expect(normalizarClassificacao(undefined)).toBeNull();
    expect(normalizarClassificacao("Coparticipação Total")).toBeNull();
  });

  it("a reserva 'Sem classificação' nunca vira valor gravado", () => {
    expect(CLASSIFICACAO_OPTIONS).not.toContain(SEM_CLASSIFICACAO);
    expect(normalizarClassificacao(SEM_CLASSIFICACAO)).toBeNull();
  });
});
