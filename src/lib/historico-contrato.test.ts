import { describe, it, expect } from "vitest";
import { formatarValorHistorico, tomDoEvento, eventoCombinaBusca } from "./historico-contrato";

describe("historico-contrato", () => {
  it("formata valores em centavos como reais", () => {
    expect(formatarValorHistorico("valor_enfermaria_centavos", 31550)).toBe("R$ 315,50");
  });
  it("mostra o nome do plano pelo código", () => {
    expect(formatarValorHistorico("produto_enfermaria_codigo", 163, [{ codigo_produto: 163, nome_produto: "Elite", acomodacao: "Enfermaria" }]))
      .toBe("163 - Elite - Enfermaria");
  });
  it("suspensão tem destaque próprio", () => {
    expect(tomDoEvento("Contrato suspenso", "Suspensão")).toBe("suspensao");
    expect(tomDoEvento("Contrato reativado", "Suspensão")).toBe("reativacao");
  });
  it("busca pelo valor alterado", () => {
    const ev = { acao: "Alteração cadastral", usuario_nome: "Maria", origem: "Editar Empresa",
      alteracoes: [{ campo: "periodo_movimentacao", rotulo: "Período", categoria: "Movimentação", valor_anterior: "20-25", valor_novo: "25-30" }] };
    expect(eventoCombinaBusca(ev, "25-30")).toBe(true);
    expect(eventoCombinaBusca(ev, "99-99")).toBe(false);
  });
});
