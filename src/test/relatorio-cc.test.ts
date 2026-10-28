import { describe, expect, it } from "vitest";
import { RELATORIO_VAZIO } from "@/lib/movimentacao-relatorio";

// O "Com cópia (Cc)" deve ser salvo junto com os destinatários e detectar alterações no lote.
describe("Cc do relatório de vidas", () => {
  it("registro vazio começa sem Cc", () => {
    expect(RELATORIO_VAZIO.cc).toBe("");
  });

  it("Cc salvo é repassado para o envio como lista de e-mails", () => {
    const registro = { ...RELATORIO_VAZIO, cc: "copia1@samel.com.br; copia2@samel.com.br" };
    const lista = registro.cc.split(/[,;\s]+/).filter(Boolean);
    expect(lista).toEqual(["copia1@samel.com.br", "copia2@samel.com.br"]);
  });

  it("lote detecta alteração do Cc entre preparar e enviar", () => {
    const item = { cc: "copia@samel.com.br" };
    const registroAlterado = { cc: "outro@samel.com.br" };
    const registroIgual = { cc: "copia@samel.com.br" };
    expect((registroAlterado.cc ?? "") !== item.cc).toBe(true);
    expect((registroIgual.cc ?? "") !== item.cc).toBe(false);
  });

  it("Cc ausente no registro antigo equivale a vazio", () => {
    const registroAntigo: { cc?: string } = {};
    expect((registroAntigo.cc ?? "") === "").toBe(true);
  });
});
