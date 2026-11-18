import { describe, it, expect } from "vitest";
import { compararVidas } from "./vidas-contrato-comparacao";
const v = (c: string) => ({ chave: c, cpf: c, nome: null });
describe("comparação de vidas por contrato", () => {
  it("conta entradas e saídas entre o relatório do período e o atualizado", () => {
    const r = compararVidas([v("1"), v("2"), v("3")], [v("2"), v("3"), v("4"), v("5")]);
    expect(r.periodo).toBe(3);
    expect(r.atualizado).toBe(4);
    expect(r.entradas.map((x) => x.chave)).toEqual(["4", "5"]);
    expect(r.saidas.map((x) => x.chave)).toEqual(["1"]);
  });
  it("adesão fora do mês e do anterior conta como reativação", () => {
    const n = (c: string, adesao: string | null) => ({ chave: c, cpf: c, nome: null, adesao });
    const r = compararVidas([], [n("a", "2026-11-03"), n("b", "2026-10-20"), n("c", "2025-04-01"), n("d", null)], "2026-11");
    expect(r.entradas.map((x) => x.chave)).toEqual(["a", "b", "d"]);
    expect(r.reativacoes.map((x) => x.chave)).toEqual(["c"]);
  });
});
