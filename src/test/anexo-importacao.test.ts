import { describe, expect, it } from "vitest";
import { identificarAnexoImportado, mesmoAnexoImportado } from "@/lib/anexo-importacao";
const nome = "Vidas_Ativas_Contrato_2487_20261030.pdf";
const existente = { nome_arquivo: nome, empresa_id: "sabin", movimentacao_id: "outubro" };
const novo = { nome, contrato: 2487, empresaId: "sabin", movimentacaoId: "outubro" };
describe("identificação e duplicatas de anexos", () => {
  it("identifica o relatório real sem confundir geração com competência", () => {
    expect(identificarAnexoImportado(nome)).toMatchObject({ tipo: "Relatório de Vidas", extensao: "pdf", contrato: "2487", geradoEm: "30/10/2026" });
  });
  it("não inventa uma data quando o nome não a informa", () => {
    expect(identificarAnexoImportado("OPS_Mensalidades_Contrato_2487_atual.xlsx").geradoEm).toBeNull();
  });
  it("ignora mesmo nome, contrato, competência e tipo", () => {
    expect(mesmoAnexoImportado(existente, novo)).toBe(true);
  });
  it("não considera o arquivo de outra competência como duplicata", () => {
    expect(mesmoAnexoImportado(existente, { ...novo, movimentacaoId: "novembro" })).toBe(false);
  });
  it("não considera outro contrato ou outro nome como duplicata", () => {
    expect(mesmoAnexoImportado(existente, { ...novo, contrato: 2490 })).toBe(false);
    expect(mesmoAnexoImportado(existente, { ...novo, nome: "Outro_Contrato_2487_20261030.pdf" })).toBe(false);
  });
  it.each(["pdf", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "webp", "gif"])("aceita %s quando realmente disponível", extensao => {
    expect(identificarAnexoImportado(`arquivo.${extensao}`).aceito).toBe(true);
  });
  it("não aceita executáveis", () => expect(identificarAnexoImportado("arquivo.exe").aceito).toBe(false));
});