import { describe, expect, it } from "vitest";
import { variaveisNaoReconhecidas, substituirVariaveis, corpoParaHtml, DADOS_DEMONSTRACAO } from "./email-modelos";

describe("Modelos de E-mail", () => {
  it("avisa variável escrita errada", () => expect(variaveisNaoReconhecidas("Olá {{empresaa}} {{contrato}}")).toEqual(["{{empresaa}}"]));
  it("aceita {{justificativa_envio}}", () => expect(variaveisNaoReconhecidas("{{justificativa_envio}}")).toEqual([]));
  it("monta o assunto da prévia", () => expect(substituirVariaveis("Validação de vidas | {{empresa}} | {{competencia}}", DADOS_DEMONSTRACAO)).toBe("Validação de vidas | EMPRESA EXEMPLO LTDA | Novembro/2026"));
  it("não executa HTML digitado", () => expect(corpoParaHtml("<script>x</script>")).not.toContain("<script>"));
});
