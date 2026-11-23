import { describe, expect, it } from "vitest";
import { sugerirCenario, validarEscolhaCenario, montarEmailCenario } from "../../supabase/functions/_shared/cenario-envio";

describe("Motor de Cenários de Envio", () => {
  it("sugere Dentro do período até o dia de corte", () => expect(sugerirCenario("2026-11-30", "30/11/2026")).toBe("dentro_periodo"));
  it("sugere Fora do período depois do corte", () => expect(sugerirCenario("2026-12-01", "30/11/2026")).toBe("fora_periodo"));
  it("exige justificativa no envio direto ao Financeiro", () => expect(validarEscolhaCenario({ sugerido: "dentro_periodo", escolhido: "financeiro", justificativa: "" })).not.toBeNull());
  it("exige motivo ao trocar o cenário sugerido", () => expect(validarEscolhaCenario({ sugerido: "fora_periodo", escolhido: "dentro_periodo" })).not.toBeNull());
  it("Fora do período usa modelo diferente do normal", () => expect(montarEmailCenario("fora_periodo", { codigo: 1, nome: "x", corte: null }).assunto).not.toBe(montarEmailCenario("dentro_periodo", { codigo: 1, nome: "x", corte: null }).assunto));
});

import { montarVariaveis, renderizarModelo } from "../../supabase/functions/_shared/email-modelo-render";
describe("preenchimento do modelo", () => {
  const dados = montarVariaveis({ empresa: "Empresa Exemplo Ltda", contrato: 2461, mesReferencia: "2026-11", periodo: "20-25", corte: "25/11/2026", hojeISO: "2026-11-23" });
  it("troca as variáveis pelos dados reais", () => {
    const r = renderizarModelo({ assunto: "Validação | {{empresa}} | {{competencia}}", corpo: "Contrato {{contrato}}, de {{data_inicio_periodo}} a {{data_fim_periodo}}" }, dados);
    expect(r.assunto).toBe("Validação | EMPRESA EXEMPLO LTDA | Novembro/2026");
    expect(r.corpo).toBe("Contrato 2461, de 20/11/2026 a 25/11/2026");
  });
  it("variável sem dado nunca aparece como código e é listada", () => {
    const r = renderizarModelo({ assunto: "x", corpo: "Resp: {{responsavel_contrato}}" }, dados);
    expect(r.corpo).toBe("Resp: ");
    expect(r.faltando).toEqual(["responsavel_contrato"]);
  });
});
