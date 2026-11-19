import { describe, it, expect } from "vitest";
import { retanguloPdf } from "./assinatura-cartas";

describe("retanguloPdf", () => {
  it("posição clicada na prévia vira coordenada do PDF (origem embaixo)", () => {
    const r = retanguloPdf({ x: 0.5, y: 0.8, largura: 0.2 }, 600, 800, 200, 100);
    expect(r.width).toBe(120);
    expect(r.height).toBe(60);
    expect(r.x).toBe(240);
    expect(r.y).toBe(800 - 640 - 30);
  });
  it("não deixa a assinatura sair da página", () => {
    const r = retanguloPdf({ x: 1, y: 1, largura: 0.2 }, 600, 800, 200, 100);
    expect(r.x).toBe(480);
    expect(r.y).toBe(0);
  });
});
