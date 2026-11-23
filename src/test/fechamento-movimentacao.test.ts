import { describe, it, expect } from "vitest";
import { decidirFechamentoMovimentacao } from "@/lib/fechamento-movimentacao";

const BASE = {
  isEdicao: true,
  dataEnvioFinanceiro: "2026-11-23",
  dataRetornoEmpresa: null,
  jaFechado: false,
};

describe("fechamento de movimentação x janela de e-mail", () => {
  it("Salvar (sem o botão) não abre o e-mail e grava a data digitada", () => {
    const r = decidirFechamentoMovimentacao({ ...BASE, fecharSemOk: false });
    expect(r.abrirEmail).toBe(false);
    expect(r.dataAserGravada).toBe("2026-11-23");
  });

  it("Fechar sem ok da empresa abre o e-mail e adia a gravação da data", () => {
    const r = decidirFechamentoMovimentacao({ ...BASE, fecharSemOk: true });
    expect(r.abrirEmail).toBe(true);
    expect(r.dataAserGravada).toBeNull();
  });

  it("contrato já fechado não reabre o e-mail", () => {
    const r = decidirFechamentoMovimentacao({ ...BASE, fecharSemOk: true, jaFechado: true });
    expect(r.abrirEmail).toBe(false);
    expect(r.dataAserGravada).toBe("2026-11-23");
  });

  it("empresa deu o ok: nenhum caminho abre o e-mail", () => {
    const comOk = { ...BASE, dataRetornoEmpresa: "2026-11-20" };
    expect(decidirFechamentoMovimentacao({ ...comOk, fecharSemOk: true }).abrirEmail).toBe(false);
    expect(decidirFechamentoMovimentacao({ ...comOk, fecharSemOk: false }).abrirEmail).toBe(false);
  });

  it("sem data de envio financeiro não há fechamento a confirmar", () => {
    const r = decidirFechamentoMovimentacao({ ...BASE, fecharSemOk: true, dataEnvioFinanceiro: null });
    expect(r.abrirEmail).toBe(false);
    expect(r.dataAserGravada).toBeNull();
  });
});
