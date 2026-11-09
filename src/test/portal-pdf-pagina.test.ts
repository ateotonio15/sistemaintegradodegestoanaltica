import { describe, expect, it } from "vitest";
import { ajustarPaginaDigitada } from "@/lib/portal-pdf-pagina";

describe("Página digitada na prévia de PDF do relatório", () => {
  it("aceita um número dentro do documento", () => {
    expect(ajustarPaginaDigitada("2", 1, 3)).toBe(2);
    expect(ajustarPaginaDigitada("3", 1, 3)).toBe(3);
    expect(ajustarPaginaDigitada(" 2 ", 1, 3)).toBe(2);
  });

  it("limita ao número de páginas quando digita além do fim", () => {
    expect(ajustarPaginaDigitada("9", 1, 3)).toBe(3);
    expect(ajustarPaginaDigitada("999", 2, 3)).toBe(3);
  });

  it("não deixa voltar para antes da primeira página", () => {
    expect(ajustarPaginaDigitada("0", 2, 3)).toBe(1);
  });

  it("mantém a página atual quando o texto não é um número", () => {
    expect(ajustarPaginaDigitada("", 2, 3)).toBe(2);
    expect(ajustarPaginaDigitada("  ", 2, 3)).toBe(2);
    expect(ajustarPaginaDigitada("abc", 2, 3)).toBe(2);
    expect(ajustarPaginaDigitada("2,5", 2, 3)).toBe(2);
  });

  it("mantém a página atual enquanto o documento ainda não carregou", () => {
    expect(ajustarPaginaDigitada("5", 1, 0)).toBe(1);
  });
});
