import { describe, expect, it } from "vitest";
import { sugerirCenario, validarEscolhaCenario, montarEmailCenario } from "../../supabase/functions/_shared/cenario-envio";

describe("Motor de Cenários de Envio", () => {
  it("sugere Dentro do período até o dia de corte", () => expect(sugerirCenario("2026-11-30", "30/11/2026")).toBe("dentro_periodo"));
  it("sugere Fora do período depois do corte", () => expect(sugerirCenario("2026-12-01", "30/11/2026")).toBe("fora_periodo"));
  it("exige justificativa no envio direto ao Financeiro", () => expect(validarEscolhaCenario({ sugerido: "dentro_periodo", escolhido: "financeiro", justificativa: "" })).not.toBeNull());
  it("exige motivo ao trocar o cenário sugerido", () => expect(validarEscolhaCenario({ sugerido: "fora_periodo", escolhido: "dentro_periodo" })).not.toBeNull());
  it("Fora do período usa modelo diferente do normal", () => expect(montarEmailCenario("fora_periodo", { codigo: 1, nome: "x", corte: null }).assunto).not.toBe(montarEmailCenario("dentro_periodo", { codigo: 1, nome: "x", corte: null }).assunto));
});
