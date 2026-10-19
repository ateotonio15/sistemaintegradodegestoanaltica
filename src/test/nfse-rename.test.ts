import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/pdf-analysis-utils", () => ({ extrairTextoPdf: vi.fn(), extrairTomador: vi.fn() }));
import { montarNomeArquivoNfse } from "@/lib/nfse-rename";

describe("final do CNPJ no nome automático da nota", () => {
  it("diferencia Apoema pelos dois últimos dígitos, como na referência", () => {
    expect(montarNomeArquivoNfse("APOEMA", "16149", "12.345.678/0001-40")).toBe("NF APOEMA 16149 - 40.pdf");
    expect(montarNomeArquivoNfse("APOEMA", "16150", "12345678000107")).toBe("NF APOEMA 16150 - 07.pdf");
    expect(montarNomeArquivoNfse("APOEMA", "16151", "12345678000169")).toBe("NF APOEMA 16151 - 69.pdf");
  });
  it("diferencia Mar Rio e sua grafia sem espaço", () => {
    expect(montarNomeArquivoNfse("MAR RIO", "12345", "12.345.678/0001-07")).toBe("NF MAR RIO 12345 - 07.pdf");
    expect(montarNomeArquivoNfse("MARRIO", "12345", "12345678000140")).toBe("NF MARRIO 12345 - 40.pdf");
  });
  it("preserva o padrão das demais empresas", () => {
    expect(montarNomeArquivoNfse("OUTRA EMPRESA LTDA", "12345", "12345678000140")).toBe("NF OUTRA EMPRESA LTDA 12345.pdf");
  });
  it("não inventa o final quando não há CNPJ completo do tomador", () => {
    expect(montarNomeArquivoNfse("APOEMA", "16149", null)).toBe("NF APOEMA 16149.pdf");
    expect(montarNomeArquivoNfse("MAR RIO", "16149", "40")).toBe("NF MAR RIO 16149.pdf");
  });
});