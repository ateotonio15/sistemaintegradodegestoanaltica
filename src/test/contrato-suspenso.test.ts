import { describe, it, expect } from "vitest";
import { separarSuspensos, mensagemSuspensosIgnorados } from "@/lib/contrato-suspenso";

describe("contratos suspensos em Movimentações", () => {
  it("lote ignora suspensos: 25 no período, 22 aptos, 3 suspensos", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ empresas: { contrato_suspenso: i < 3 } }));
    const r = separarSuspensos(rows);
    expect(r.aptos.length).toBe(22);
    expect(r.suspensos).toBe(3);
  });
  it("mensagem do resumo de envio", () => {
    expect(mensagemSuspensosIgnorados(3, "envio")).toBe("3 contratos suspensos foram ignorados no envio.");
    expect(mensagemSuspensosIgnorados(0, "envio")).toBeNull();
  });
});
