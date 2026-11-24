import { describe, it, expect } from "vitest";
import { calcularRelatorio, periodoAnterior, validarPeriodo, nomeArquivo } from "@/lib/relatorio-atendimentos";
import { higienizarTexto } from "../../supabase/functions/_shared/lgpd-higienizar";

const base = { data: "2026-11-03", hora: "09:10", cpf: "111", tipo: "Consulta", canal: "Presencial", resolvido: true, motivo: "Consulta com especialista", especialidade: "Ortopedia" };

describe("relatório de atendimentos", () => {
  it("conta clientes únicos por CPF distinto", () => {
    const r = calcularRelatorio([base, { ...base, cpf: "111" }, { ...base, cpf: "222", resolvido: false }]);
    expect(r.clientesUnicos).toBe(2);
    expect(r.resolvidos).toBe(2);
    expect(r.abertos).toBe(1);
  });
  it("não classificado conta como Outros", () => {
    const r = calcularRelatorio([{ ...base, motivo: null }]);
    expect(r.motivos[0].nome).toBe("Outros");
    expect(r.naoClassificados).toBe(1);
  });
  it("período anterior tem o mesmo tamanho", () => {
    expect(periodoAnterior("2026-11-01", "2026-11-30")).toEqual({ de: "2026-10-02", ate: "2026-10-31" });
  });
  it("rejeita Até antes de De", () => {
    expect(validarPeriodo("2026-11-10", "2026-11-01")).not.toBeNull();
  });
  it("nome do arquivo", () => {
    expect(nomeArquivo("Mundial Ltda", "2026-11-01", "2026-11-30")).toBe("Relatorio_Atendimentos_Mundial_Ltda_2026-11-01_a_2026-11-30");
  });
  it("remove CPF, telefone e nome antes da IA", () => {
    const t = higienizarTexto("Maria Souza CPF 123.456.789-00 tel (92) 99294-8556 quer ortopedista", ["Maria Souza"]);
    expect(t).not.toMatch(/Maria|Souza|123\.456|99294/);
    expect(t).toMatch(/ortopedista/);
  });
});
