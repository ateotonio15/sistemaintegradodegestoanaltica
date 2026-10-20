import { describe, expect, it } from "vitest";
import { carregarEnderecos, novoEndereco, prepararEnderecos } from "@/lib/empresa-enderecos";
describe("Endereços da empresa", () => {
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