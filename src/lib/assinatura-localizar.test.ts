import { describe, it, expect } from "vitest";
import { localizarAssinatura, criarModelo, MARGEM_SUPERIOR_PADRAO, type PaginaTexto } from "./assinatura-localizar";

const linha = (texto: string, y: number, pagina = 1) => ({ texto, pagina, x: 0.4, y, w: 0.2, h: 0.02 });
const carta = (extra: ReturnType<typeof linha>[]): PaginaTexto[] => [{ linhas: [linha("Manaus, 10 de novembro", 0.1), linha("Prezados senhores", 0.2), ...extra] }];

describe("localizarAssinatura", () => {
  it("'Assinatura' tem confiança alta e posiciona logo acima do texto", () => {
    const l = localizarAssinatura(carta([linha("Assinatura do responsável", 0.85)]));
    expect(l.confianca).toBe("alta");
    expect(l.pagina).toBe(1);
    expect(l.y).toBeCloseTo(0.85 - MARGEM_SUPERIOR_PADRAO);
    expect(l.x).toBeCloseTo(0.5);
  });
  it("'Setor de Cadastro Samel' tem confiança média", () => {
    expect(localizarAssinatura(carta([linha("Setor de Cadastro Samel", 0.9)])).confianca).toBe("media");
  });
  it("sem referência a confiança é baixa", () => {
    const l = localizarAssinatura(carta([]));
    expect(l.confianca).toBe("baixa");
    expect(l.origem).toBe("padrao");
  });
  it("modelo salvo é reaplicado em carta parecida com o mesmo ajuste", () => {
    const a = carta([linha("Atenciosamente", 0.7)]);
    const auto = localizarAssinatura(a);
    const modelo = criarModelo("Cancelamento", a, { ...auto, x: auto.x + 0.1, origem: "manual" });
    const b = carta([linha("Atenciosamente", 0.72)]);
    const l = localizarAssinatura(b, [modelo]);
    expect(l.origem).toBe("modelo");
    expect(l.confianca).toBe("alta");
    expect(l.x).toBeCloseTo(auto.x + 0.1);
  });
});
