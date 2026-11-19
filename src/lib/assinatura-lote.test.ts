import { describe, expect, it } from "vitest";
import { emParalelo, posicoesParecidas, statusLote } from "./assinatura-lote";

describe("assinatura-lote", () => {
  it("status do lote", () => {
    expect(statusLote(5, 5)).toBe("concluido");
    expect(statusLote(5, 3)).toBe("parcial");
    expect(statusLote(5, 0)).toBe("falhou");
  });
  it("paralelo mantém a ordem e respeita o limite", async () => {
    let ativos = 0, max = 0;
    const r = await emParalelo([1, 2, 3, 4, 5, 6], 2, async (n) => {
      ativos++; max = Math.max(max, ativos); await new Promise((s) => setTimeout(s, 5)); ativos--; return n * 2;
    });
    expect(r).toEqual([2, 4, 6, 8, 10, 12]);
    expect(max).toBe(2);
  });
  it("posições parecidas", () => {
    expect(posicoesParecidas({ pagina: 1, x: 0.5, y: 0.8 }, { pagina: 1, x: 0.52, y: 0.79 })).toBe(true);
    expect(posicoesParecidas({ pagina: 1, x: 0.5, y: 0.8 }, { pagina: 2, x: 0.5, y: 0.8 })).toBe(false);
  });
});
