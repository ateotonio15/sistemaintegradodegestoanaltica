import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { arquivoAnteriorAoCorte, contarVidasExcel } from "@/lib/repositorio-vidas";

describe("aviso de arquivo do Repositório anterior ao fim do período", () => {
  it("arquivo gerado no próprio dia de corte (30/10 10:45) recebe aviso", () => {
    expect(arquivoAnteriorAoCorte("Mensalidades_Contrato_2194_20261030_1045.xlsx", "25-30", "2026-10")).toBe(true);
  });
  it("arquivo gerado depois do fim do período não recebe aviso", () => {
    expect(arquivoAnteriorAoCorte("Mensalidades_Contrato_2194_20261103_1557.xlsx", "25-30", "2026-10")).toBe(false);
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
