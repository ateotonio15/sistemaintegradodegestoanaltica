import { describe, expect, it } from "vitest";
import { detectarCompetencia } from "../lib/historico-utils";

describe("detectarCompetencia", () => {
  it("prioriza arquivo com ano em 2 dígitos antes do mês da movimentação", () => {
    expect(detectarCompetencia("2026-06", "FATURAMENTO JABIL - JULHO26.xlsx")?.label).toBe("Julho/2026");
  });
});
import { gerarHistoricoRetroativoTexto } from "@/lib/historico-utils";
describe("gerarHistoricoRetroativoTexto", () => {
  const res: any[] = [{ retroativas: { quantidade: 3, total: 1588.42, mesesDetalhe: [{ mes: "SET/26", quantidade: 3, total: 1588.42 }] } }];
  it("gera o padrão de boleto DDA", () => {
    const t = gerarHistoricoRetroativoTexto(res, { competenciaLabel: "Outubro/2026", dataVencimento: "20/10/2026", pagamentoViaDeposito: false } as any);
    expect(t).toContain("Período de: Outubro/2026.\nRetroativo Setembro26: 1.588,42\n\nData de Vencimento: 20/10/2026.");
    expect(t).toContain("OBS.: O boleto está disponível no sistema de DDA.");
  });
  it("usa dados de depósito quando a empresa paga por depósito", () => {
    const t = gerarHistoricoRetroativoTexto(res, { competenciaLabel: "Outubro/2026", dataVencimento: "20/10/2026", pagamentoViaDeposito: true } as any);
    expect(t).toContain("Dados bancários para depósito");
    expect(t).not.toContain("DDA");
  });
});
