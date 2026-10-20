import { describe, it, expect } from "vitest";
import { normalizarCnpjConsulta, mapearDadosCnpj, camposFormularioCnpj, enderecosComDadosCnpj } from "@/lib/consulta-cnpj";
import { carregarEnderecos, novoEndereco, prepararEnderecos } from "@/lib/empresa-enderecos";
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
  const dados = (estabelecimento: Record<string, unknown>) => {
    const resultado = mapearDadosCnpj({ razao_social: "EMPRESA EXEMPLO LTDA", estabelecimento });
    if (!resultado) throw new Error("Resposta fictícia inválida");
    return resultado;
  };
  it("mapeia situação cadastral, fantasia, telefone e e-mail da fonte", () => {
    expect(dados({ cnpj: "12345678000100", nome_fantasia: "EXEMPLO", situacao_cadastral: "Ativa", ddd1: "92", telefone1: "999999999", email: "contato@empresa.com" })).toMatchObject({ cnpj: "12345678000100", fantasia: "EXEMPLO", situacao: "Ativa", telefone: "92 999999999", email: "contato@empresa.com" });
  });
  it("não inventa contatos ausentes nem apaga campos atuais", () => {
    const resultado = dados({ ddd1: "92", telefone1: null, email: null });
    expect(resultado.telefone).toBe("");
    const atual = { nome: "Anterior", telefone_empresa: "9233334444", email_empresa: "anterior@empresa.com" };
    expect({ ...atual, ...camposFormularioCnpj(resultado, true) }).toEqual({ ...atual, nome: "EMPRESA EXEMPLO LTDA", razao_social: "EMPRESA EXEMPLO LTDA" });
  });
  it("preenche Razão Social e Nome Fantasia quando a API informa", () => {
    expect(camposFormularioCnpj(dados({ nome_fantasia: "EXEMPLO" }), true)).toEqual({ nome: "EMPRESA EXEMPLO LTDA", razao_social: "EMPRESA EXEMPLO LTDA", nome_fantasia: "EXEMPLO" });
  });
  it("não inventa nome fantasia ausente e deixa o campo para preenchimento manual", () => {
    expect(camposFormularioCnpj(dados({}), true)).toEqual({ nome: "EMPRESA EXEMPLO LTDA", razao_social: "EMPRESA EXEMPLO LTDA" });
  });
  it("preserva a restrição de identificação no formulário Executivo", () => {
    expect(camposFormularioCnpj(dados({ telefone1: "33334444", email: "contato@empresa.com" }), false)).toEqual({ telefone_empresa: "33334444", email_empresa: "contato@empresa.com" });
  });
  it("aplica endereço confirmado ao principal sem tocar nos secundários ou campos ausentes", () => {
    const atual = carregarEnderecos("Endereço anterior", null);
    atual.principal.complemento = "Sala 2";
    atual.principal.referencia = "Referência atual";
    atual.secundarios = [{ ...novoEndereco("Filial"), logradouro: "Rua secundária" }];
    const original = structuredClone(atual);
    const novo = enderecosComDadosCnpj(atual, dados({ tipo_logradouro: "Av.", logradouro: "Exemplo", numero: "500", complemento: null, cep: "69000000", cidade: { nome: "Manaus" }, estado: { sigla: "AM" } }));
    expect(novo.principal).toMatchObject({ tipo: "Principal", logradouro: "Av. Exemplo", numero: "500", complemento: "Sala 2", referencia: "Referência atual" });
    expect(novo.secundarios).toEqual(original.secundarios);
    expect(prepararEnderecos(novo).endereco).toContain("Av. Exemplo");
    expect(atual).toEqual(original);
  });
  it("resposta sem endereço preserva integralmente o principal", () => {
    const atual = carregarEnderecos("Endereço anterior", null);
    expect(enderecosComDadosCnpj(atual, dados({ cep: null, logradouro: null }))).toEqual(atual);
  });
});