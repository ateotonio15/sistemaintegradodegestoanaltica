import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { arquivoAnteriorAoCorte, avisoGeracaoArquivos, contarVidasExcel } from "@/lib/repositorio-vidas";

describe("aviso de arquivo do Repositório em relação ao fim do período", () => {
  it("arquivo gerado no próprio dia de corte (30/10 10:45) recebe aviso", () => {
    expect(arquivoAnteriorAoCorte("Mensalidades_Contrato_2194_20261030_1045.xlsx", "25-30", "2026-10")).toBe(true);
  });
  it("arquivo gerado depois do fim do período não é tratado como anterior ao corte", () => {
    expect(arquivoAnteriorAoCorte("Mensalidades_Contrato_2194_20261103_1557.xlsx", "25-30", "2026-10")).toBe(false);
  });
  it("aviso aparece para arquivo gerado dentro do período (03/11, corte 05/11)", () => {
    expect(avisoGeracaoArquivos(["Mensalidades_Contrato_2123_20261103_0900.xlsx"], "01-05", "2026-11")).toBe(
      "Arquivo gerado antes do fim do período (05/11/2026). Desligamentos ou inclusões feitos depois podem não estar nele.",
    );
  });
  it("aviso aparece para arquivo gerado fora do período (09/11, corte 05/11)", () => {
    expect(avisoGeracaoArquivos(["Mensalidades_Contrato_2123_20261109_0900.xlsx"], "01-05", "2026-11")).toBe(
      "Arquivo gerado depois do fim do período (05/11/2026). Confira se esta é a versão mais recente — se houver uma nova, busque no Portal.",
    );
  });
  it("quando há arquivo anterior ao corte, o aviso mais grave vence", () => {
    const aviso = avisoGeracaoArquivos(
      ["Mensalidades_Contrato_2123_20261109_0900.xlsx", "Vidas_Contrato_2123_20261103_0900.pdf"],
      "01-05",
      "2026-11",
    );
    expect(aviso).toContain("antes do fim do período");
  });
  it("sem data de geração ou sem competência não inventa aviso", () => {
    expect(avisoGeracaoArquivos(["Mensalidades_Contrato_2123.xlsx"], "01-05", "2026-11")).toBeNull();
    expect(avisoGeracaoArquivos(["Mensalidades_Contrato_2123_20261109_0900.xlsx"], "01-05", null)).toBeNull();
  });
});

describe("contagem de vidas na planilha", () => {
  it("conta só as linhas com beneficiário", async () => {
    const ws = XLSX.utils.aoa_to_sheet([["Contrato", "Beneficiario"], [2194, "A"], [2194, "B"], [2194, ""]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "x");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    expect(await contarVidasExcel({ arrayBuffer: async () => buf } as unknown as Blob)).toBe(2);
  });
});
