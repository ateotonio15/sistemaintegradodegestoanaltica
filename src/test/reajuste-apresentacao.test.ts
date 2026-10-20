import { describe, expect, it } from "vitest";
import { valoresModalidadeReajuste, type FaixaReajusteSalva } from "@/lib/reajuste-apresentacao";

const faixa = (idade: number, modalidade = "enfermaria", valor = 21924): FaixaReajusteSalva => ({
  reajuste_id: "r2026", modalidade, idade_inicial: idade, idade_final: idade === 0 ? 18 : 43,
  valor_atual_centavos: 18900, valor_reajustado_centavos: valor,
  valor_retroativo_centavos: 0, valor_final_centavos: valor, percentual: 16,
});

describe("Apresentação de reajustes por faixa", () => {
  it("usa a primeira faixa reajustada mesmo com valor único zerado", () => {
    const resultado = valoresModalidadeReajuste({ usa_faixa_etaria_enfermaria: true, valor_final_enfermaria_centavos: 0 }, "enfermaria", [faixa(19, "enfermaria", 28536), faixa(0)]);
    expect(resultado.reajustado).toBe(21924);
    expect(resultado.final).toBe(21924);
    expect(resultado.primeira?.idade_inicial).toBe(0);
  });
  it("mantém modalidades separadas e todas as faixas disponíveis", () => {
    const resultado = valoresModalidadeReajuste({}, "enfermaria", [faixa(0, "apartamento", 30694), faixa(19), faixa(0)]);
    expect(resultado.faixas).toHaveLength(2);
    expect(resultado.faixas.map((f) => f.idade_inicial)).toEqual([0, 19]);
    expect(resultado.reajustado).toBe(21924);
  });
  it("não pula primeira faixa com zero válido nem modifica a ordem da origem", () => {
    const origem = [faixa(19), faixa(0, "enfermaria", 0)];
    expect(valoresModalidadeReajuste({}, "enfermaria", origem).reajustado).toBe(0);
    expect(origem[0].idade_inicial).toBe(19);
  });
  it("não apresenta zero inventado quando faixas não estão disponíveis", () => {
    expect(valoresModalidadeReajuste({ usa_faixa_etaria_enfermaria: true, valor_final_enfermaria_centavos: 0 }, "enfermaria", []).final).toBeNull();
  });
  it("preserva valores de contratos com preço único", () => {
    expect(valoresModalidadeReajuste({ valor_reajustado_apartamento_centavos: 45000, valor_final_apartamento_centavos: 45000 }, "apartamento", []).final).toBe(45000);
  });
});