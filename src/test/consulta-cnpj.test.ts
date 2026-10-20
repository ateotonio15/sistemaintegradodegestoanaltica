import { describe, it, expect } from "vitest";
import { normalizarCnpjConsulta, mapearDadosCnpj, camposFormularioCnpj, enderecosComDadosCnpj, rotuloSituacaoCnpj, formatarDataSituacaoCnpj } from "@/lib/consulta-cnpj";
import { enderecoDivergente, divergenciaCnpj } from "@/lib/consulta-cnpj";
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
    expect(resultado.situacaoDesde).toBe("");
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
  it("mapeia a data da situação cadastral da fonte", () => {
    expect(dados({ situacao_cadastral: "Ativa", data_situacao_cadastral: "2018-03-15" })).toMatchObject({ situacao: "Ativa", situacaoDesde: "2018-03-15" });
  });
  it("identifica a situação do CNPJ sempre com a palavra CNPJ e a cor correta", () => {
    expect(rotuloSituacaoCnpj("Ativa")).toEqual({ rotulo: "CNPJ ATIVA", tom: "verde" });
    expect(rotuloSituacaoCnpj("Suspensa")).toEqual({ rotulo: "CNPJ SUSPENSA", tom: "amarelo" });
    expect(rotuloSituacaoCnpj("Baixada")).toEqual({ rotulo: "CNPJ BAIXADA", tom: "vermelho" });
    expect(rotuloSituacaoCnpj("Inapta")).toEqual({ rotulo: "CNPJ INAPTA", tom: "vermelho" });
    expect(rotuloSituacaoCnpj("Nula")).toEqual({ rotulo: "CNPJ NULA", tom: "vermelho" });
    expect(rotuloSituacaoCnpj("Outra situação")).toEqual({ rotulo: "CNPJ OUTRA SITUAÇÃO", tom: "neutro" });
    expect(rotuloSituacaoCnpj("")).toBeNull();
  });
  it("formata a data da situação no padrão brasileiro sem deslocar o dia", () => {
    expect(formatarDataSituacaoCnpj("2018-03-15")).toBe("15/03/2018");
    expect(formatarDataSituacaoCnpj("")).toBe("");
    expect(formatarDataSituacaoCnpj("15/03/2018")).toBe("");
  });
});
describe("enderecoDivergente", () => {
  const principal = { ...novoEndereco(), cep: "69000-000", cidade: "Manaus", uf: "AM" };
  it("acusa divergência quando o CEP difere", () => {
    expect(enderecoDivergente({ cep: "69010-000", cidade: "Manaus", uf: "AM" }, principal)).toBe(true);
  });
  it("não acusa quando o CEP é igual", () => {
    expect(enderecoDivergente({ cep: "69000000", cidade: "Manaus", uf: "AM" }, principal)).toBe(false);
  });
  it("sem CEP dos dois lados, compara cidade e UF", () => {
    const semCep = { ...principal, cep: "" };
    expect(enderecoDivergente({ cep: "", cidade: "São Paulo", uf: "SP" }, semCep)).toBe(true);
    expect(enderecoDivergente({ cep: "", cidade: "manaus", uf: "AM" }, semCep)).toBe(false);
  });
  it("não acusa sem dados suficientes", () => {
    expect(enderecoDivergente(null, principal)).toBe(false);
    expect(enderecoDivergente({ cep: "", cidade: "", uf: "" }, principal)).toBe(false);
  });
});

describe("divergenciaCnpj", () => {
  const principal = { ...novoEndereco(), cep: "69000-000", cidade: "Manaus", uf: "AM" };
  const base = { empresa_id: "1", cnpj: "123", situacao_desde: "", endereco: null, erro: null, consultado_em: "" };
  it("sem registro não há divergência", () => {
    expect(divergenciaCnpj(null, principal)).toBeNull();
  });
  it("erro de consulta é divergência", () => {
    expect(divergenciaCnpj({ ...base, situacao: "", erro: "Empresa não encontrada para este CNPJ." }, principal)).toContain("não encontrada");
  });
  it("situação não ativa é divergência", () => {
    expect(divergenciaCnpj({ ...base, situacao: "Baixada" }, principal)).toContain("CNPJ BAIXADA");
  });
  it("situação ativa sem divergência de endereço passa", () => {
    expect(divergenciaCnpj({ ...base, situacao: "Ativa", endereco: { cep: "69000-000", cidade: "Manaus", uf: "AM" } }, principal)).toBeNull();
  });
  it("endereço divergente é divergência mesmo com CNPJ ativo", () => {
    expect(divergenciaCnpj({ ...base, situacao: "Ativa", endereco: { cep: "69010-000", cidade: "Manaus", uf: "AM" } }, principal)).toBe("Endereço divergente do cadastro");
  });
});
