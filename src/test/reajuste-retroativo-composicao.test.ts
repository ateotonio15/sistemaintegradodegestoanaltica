import { describe, it, expect } from "vitest";
import { comporRetroativo } from "@/lib/reajuste-retroativo-composicao";

describe("comporRetroativo", () => {
  it("lista os meses anteriores à aplicação e confere com o total salvo", () => {
    const c = comporRetroativo({ dataAplicacao: "2026-01-10", meses: 2, valorAtual: 100000, valorReajustado: 120896, totalSalvo: 41792 })!;
    expect(c.linhas.map((l) => l.competencia)).toEqual(["Novembro/2025", "Dezembro/2025"]);
    expect(c.linhas[0].diferenca).toBe(20896);
    expect(c.confere).toBe(true);
  });
  it("sinaliza quando o total salvo não bate com a soma", () => {
    const c = comporRetroativo({ dataAplicacao: "2026-05-01", meses: 1, valorAtual: 100, valorReajustado: 150, totalSalvo: 70 })!;
    expect(c.confere).toBe(false);
  });
  it("sem meses não há composição", () => {
    expect(comporRetroativo({ dataAplicacao: "2026-05-01", meses: 0, valorAtual: 1, valorReajustado: 2, totalSalvo: 0 })).toBeNull();
  });
});
