import { describe, it, expect } from "vitest";
import { temProdutoContratado, produtoPorCodigo, vinculosDaOperadora, selecionarProdutoContrato, type ProdutoPlano } from "@/lib/empresa-produtos";
const catalogo: ProdutoPlano[] = [
  { codigo_produto: 14, nome_produto: "Class - Enfermaria", acomodacao: "Enfermaria", ativo: true },
  { codigo_produto: 15, nome_produto: "Class Plus - Apartamento", acomodacao: "Apartamento", ativo: true },
  { codigo_produto: 57, nome_produto: "Class", acomodacao: "Não definida", ativo: true },
];
describe("produtos do contrato", () => {
  it("encaminha código 14 para Enfermaria independentemente da lista aberta", () => expect(selecionarProdutoContrato(catalogo[0])).toEqual({ produto_enfermaria_codigo: 14 }));
  it("encaminha código 15 para Apartamento independentemente da lista aberta", () => expect(selecionarProdutoContrato(catalogo[1])).toEqual({ produto_apartamento_codigo: 15 }));
  it("mantém código 57 sem acomodação definida independentemente da lista aberta", () => expect(selecionarProdutoContrato(catalogo[2])).toEqual({ produto_nao_definido_codigo: 57 }));
  it("identifica Class por código sem inferir acomodação", () => { expect(produtoPorCodigo(57, catalogo)?.acomodacao).toBe("Não definida"); expect(produtoPorCodigo("Class", catalogo)).toBeUndefined(); });
  it("permite somente Enfermaria", () => expect(temProdutoContratado({ produto_enfermaria_codigo: 14 })).toBe(true));
  it("permite somente Apartamento", () => expect(temProdutoContratado({ produto_apartamento_codigo: 15 })).toBe(true));
  it("permite duas acomodações", () => expect(temProdutoContratado({ produto_enfermaria_codigo: 14, produto_apartamento_codigo: 15 })).toBe(true));
  it("preserva plano legado e rejeita contrato sem produto nem legado", () => { expect(temProdutoContratado({ plano: "Plano antigo" })).toBe(true); expect(temProdutoContratado({ plano: " " })).toBe(false); });
  it("operadora propõe vínculo apenas por código comercial", () => { expect(vinculosDaOperadora([{ CODIGO_PRODUTO: 14 }, { CD_PRODUTO: 15 }], catalogo)).toEqual({ produto_enfermaria_codigo: 14, produto_apartamento_codigo: 15 }); });
  it("nome e sequência interna não comprovam código comercial", () => expect(vinculosDaOperadora([{ NM_FANTASIA: "Class - Enfermaria", NR_SEQ_PLANO: 14 }], catalogo)).toEqual({}));
  it("seleção não produz ou duplica valores", () => expect(Object.keys(vinculosDaOperadora([{ codigo_produto: 14 }], catalogo))).toEqual(["produto_enfermaria_codigo"]));
});