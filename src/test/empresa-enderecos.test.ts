import { describe, expect, it } from "vitest";
import { carregarEnderecos, novoEndereco, prepararEnderecos, alterarEndereco, removerEnderecoSecundario } from "@/lib/empresa-enderecos";
describe("Endereços da empresa", () => {
  it("editar secundário preserva o principal e os outros sem duplicar", () => {
    const data = carregarEnderecos("Principal antigo", null);
    data.secundarios = [{ ...novoEndereco("Filial"), cidade: "Manaus" }, { ...novoEndereco("Financeiro"), cidade: "Belém" }];
    const resultado = alterarEndereco(data, 0, { ...data.secundarios[0], numero: "20" });
    expect(resultado.principal).toEqual(data.principal);
    expect(resultado.secundarios).toHaveLength(2);
    expect(resultado.secundarios[0].numero).toBe("20");
    expect(resultado.secundarios[1]).toEqual(data.secundarios[1]);
    expect(data.secundarios[0].numero).toBe("");
  });
  it("excluir secundário não exclui nem altera o principal", () => {
    const data = carregarEnderecos("Rua Principal, 10", null);
    data.secundarios = [novoEndereco("Filial"), novoEndereco("Financeiro")];
    const resultado = removerEnderecoSecundario(data, 0);
    expect(resultado.principal.endereco_livre).toBe("Rua Principal, 10");
    expect(resultado.secundarios).toEqual([data.secundarios[1]]);
  });
  it("não permite apagar silenciosamente um principal preenchido", () => {
    expect(() => alterarEndereco(carregarEnderecos("Rua Principal, 10", null), "principal", novoEndereco())).toThrow("não pode ser apagado");
  });
  it("editar principal preserva os secundários e mantém somente um principal", () => {
    const data = carregarEnderecos("Rua antiga", null);
    data.secundarios = [novoEndereco("Filial")];
    const resultado = alterarEndereco(data, "principal", { ...novoEndereco(), endereco_livre: "Rua nova" });
    expect(resultado.principal.endereco_livre).toBe("Rua nova");
    expect(resultado.principal.tipo).toBe("Principal");
    expect(resultado.secundarios).toEqual(data.secundarios);
  });
  it("preserva integralmente o endereço antigo como único principal", () => {
    const data = carregarEnderecos("Rua antiga, 10 — fundos", null);
    expect(prepararEnderecos(data).endereco).toBe("Rua antiga, 10 — fundos");
    expect(data.principal.tipo).toBe("Principal");
    expect(data.secundarios).toEqual([]);
  });
  it("permite vários secundários com campos incompletos e preserva o principal", () => {
    const data = carregarEnderecos("Principal antigo", null);
    data.secundarios = [novoEndereco("Filial"), { ...novoEndereco("Financeiro"), cidade: "Manaus" }];
    const salvo = prepararEnderecos(data);
    expect(carregarEnderecos(salvo.endereco, salvo.enderecos)).toEqual(data);
    expect(salvo.enderecos.secundarios).toHaveLength(2);
  });
  it("impede principal na lista de secundários", () => {
    const data = carregarEnderecos("A", null);
    data.secundarios = [novoEndereco("Principal")];
    expect(() => prepararEnderecos(data)).toThrow("apenas um endereço principal");
  });
  it("exige descrição para Outro", () => {
    const data = carregarEnderecos("A", null);
    data.secundarios = [novoEndereco("Outro")];
    expect(() => prepararEnderecos(data)).toThrow("descrição");
    data.secundarios[0].descricao_tipo = "Depósito";
    expect(prepararEnderecos(data).enderecos.secundarios[0].descricao_tipo).toBe("Depósito");
  });
});