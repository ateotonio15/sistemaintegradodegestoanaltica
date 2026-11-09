import { describe, it, expect } from "vitest";
import {
  ordenarFaixasEtarias,
  primeiraFaixaEtaria,
  totalFaixasEtarias,
} from "@/lib/faixas-apresentacao";

// Contrato por faixa: o quadro "Faturamento" mostra só a primeira faixa e o
// "Ver faixas" lista as demais em ordem de idade.
describe("faixas-apresentacao", () => {
  const faixas = [
    { ini: 19, fim: 23, centavos: 33429 },
    { ini: 0, fim: 18, centavos: 25325 },
    { ini: 59, fim: 999, centavos: 151821 },
    { ini: 24, fim: 28, centavos: 0 },
    { ini: 24, fim: 28, centavos: null },
  ];

  it("ordena as faixas da mais nova para a mais antiga", () => {
    expect(ordenarFaixasEtarias(faixas).map((f) => f.ini)).toEqual([0, 19, 59]);
  });

  it("descarta faixas sem valor preenchido", () => {
    expect(totalFaixasEtarias(faixas)).toBe(3);
  });

  it("usa a faixa 0-18 como primeira faixa", () => {
    expect(primeiraFaixaEtaria(faixas)).toEqual({ ini: 0, fim: 18, centavos: 25325 });
  });

  it("não inventa primeira faixa quando não há valores", () => {
    expect(primeiraFaixaEtaria([])).toBeNull();
    expect(primeiraFaixaEtaria(null)).toBeNull();
    expect(primeiraFaixaEtaria(undefined)).toBeNull();
    expect(totalFaixasEtarias(undefined)).toBe(0);
  });
});
