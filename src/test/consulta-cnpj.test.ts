import { describe, it, expect } from "vitest";
import { normalizarCnpjConsulta, mapearDadosCnpj } from "@/lib/consulta-cnpj";
describe("Consulta pública de CNPJ", () => {
  it("remove pontos, barras e hífens antes da consulta", () => {
    expect(normalizarCnpjConsulta("12.345.678/0001-90")).toBe("12345678000190");
  });
  it("aceita somente exatamente 14 dígitos sem aceitar letras", () => {
    expect(normalizarCnpjConsulta("12345678000190")).toBe("12345678000190");
    for (const valor of ["", "1234567800019", "123456780001900", "a12345678000190"]) expect(normalizarCnpjConsulta(valor)).toBeNull();
  });
  it("retorna identificação e endereço sem alterar dados recebidos", () => {
    const source = { razao_social: "Empresa de conferência", estabelecimento: { tipo_logradouro: "Rua", logradouro: "Teste", numero: "10", cidade: { nome: "Manaus" }, estado: { sigla: "AM" } } };
    const original = structuredClone(source);
    expect(mapearDadosCnpj(source)?.endereco.logradouro).toBe("Rua Teste");
    expect(mapearDadosCnpj(source)?.endereco.cidade).toBe("Manaus");
    expect(source).toEqual(original);
  });
  it("rejeita resposta sem dados da empresa", () => {
    expect(mapearDadosCnpj({ status: 429 })).toBeNull();
  });
});