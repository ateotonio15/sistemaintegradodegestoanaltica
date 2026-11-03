import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/agendaCirurgicaApi", () => ({ listarAgendamentos: vi.fn(), listarAgendamentosDireto: vi.fn(), lerChaveDireta: () => "", lerModoAgenda: () => "servidor" }));
import { cirurgiaAgendadaAtiva, cirurgiaRealizada, escolherAgendamento, escolherProcedimentoRealizado, buscarAgendaPaciente } from "@/lib/agenda-paciente-lookup";
import { listarAgendamentos } from "@/lib/agendaCirurgicaApi";
import type { AgendamentoCirurgico } from "@/lib/agendaCirurgicaApi";

const cirurgia = (descricao = "Agendada", cpf = "123.456.789-01", data = "28/10/2026"): AgendamentoCirurgico => ({
  nr_sequencia: 10, dt_agenda: data, hr_inicio: "10:00", hr_fim: "11:00", status: { descricao },
  paciente: { nr_cpf: cpf }, medico: { nm_medico: "Médica Teste" }, procedimento_principal: { descricao: "Cirurgia teste" },
});

describe("Alerta de cirurgia ativa", () => {
  it("Marcada com data atual ativa o alerta; sem data, passada ou cancelada não ativa", () => {
    expect(cirurgiaAgendadaAtiva(cirurgia("Marcada", undefined, "03/11/2026"), "2026-11-03")).toBe(true);
    expect(cirurgiaAgendadaAtiva(cirurgia("Marcada", undefined, ""), "2026-11-03")).toBe(false);
    expect(cirurgiaAgendadaAtiva(cirurgia("Marcada", undefined, "02/11/2026"), "2026-11-03")).toBe(false);
    expect(cirurgiaAgendadaAtiva(cirurgia("Marcada - Cancelada", undefined, "03/11/2026"), "2026-11-03")).toBe(false);
  });
  it("reconhece cirurgia agendada com data e médico", () => {
    const a = cirurgia();
    expect(cirurgiaAgendadaAtiva(a, "2026-10-26")).toBe(true);
    expect(escolherAgendamento([a], "12345678901", "2026-10-26")).toEqual({ data_entrada: "2026-10-28", nome_medico: "Médica Teste", nome_procedimento: "Cirurgia teste" });
  });
  it("retira o alerta quando a cirurgia é cancelada", () => {
    expect(cirurgiaAgendadaAtiva(cirurgia("Agendada"), "2026-10-26")).toBe(true);
    expect(cirurgiaAgendadaAtiva(cirurgia("Cancelada"), "2026-10-26")).toBe(false);
  });
  it("não trata cirurgia realizada ou data passada como agendamento ativo", () => {
    expect(cirurgiaAgendadaAtiva(cirurgia("Realizada"), "2026-10-26")).toBe(false);
    expect(cirurgiaAgendadaAtiva(cirurgia("Agendada", undefined, "25/10/2026"), "2026-10-26")).toBe(false);
  });
  it("Executada sinaliza que o paciente já realizou o procedimento", () => {
    expect(cirurgiaRealizada(cirurgia("Executada"))).toBe(true);
    expect(cirurgiaRealizada(cirurgia("Realizada"))).toBe(true);
    expect(cirurgiaRealizada(cirurgia("Marcada"))).toBe(false);
    expect(cirurgiaRealizada(cirurgia("Marcada - Cancelada"))).toBe(false);
    expect(cirurgiaRealizada(cirurgia("Não realizada"))).toBe(false);
    expect(cirurgiaRealizada(cirurgia("Executada", undefined, ""))).toBe(false);
  });
  it("sinaliza o procedimento realizado mais recente do CPF", () => {
    const lista = [cirurgia("Executada", undefined, "20/10/2026"), cirurgia("Realizada", undefined, "25/10/2026"), cirurgia("Executada", "98765432100", "28/10/2026")];
    expect(escolherProcedimentoRealizado(lista, "12345678901")).toEqual({ data_entrada: "2026-10-25", nome_medico: "Médica Teste", nome_procedimento: "Cirurgia teste" });
    expect(escolherProcedimentoRealizado(lista, "")).toBeNull();
  });
  it("status desconhecido ou aguardando não comprova agendamento", () => {
    for (const status of ["", "N", "Aguardando agendamento", "Não agendada", "Pendente"]) expect(cirurgiaAgendadaAtiva(cirurgia(status), "2026-10-26")).toBe(false);
  });
  it("não associa homônimos nem CPF incompleto ao paciente", () => {
    expect(escolherAgendamento([cirurgia()], "98765432100", "2026-10-26")).toBeNull();
    expect(escolherAgendamento([cirurgia()], "", "2026-10-26")).toBeNull();
  });
  it("seleciona a próxima cirurgia ativa dentre vários procedimentos", () => {
    const lista = [cirurgia("Cancelada"), cirurgia("Confirmada", undefined, "01/11/2026"), cirurgia("Agendada", undefined, "30/10/2026")];
    expect(escolherAgendamento(lista.filter(a => cirurgiaAgendadaAtiva(a, "2026-10-26")), "12345678901", "2026-10-26")?.data_entrada).toBe("2026-10-30");
  });
  it("consulta CPF completo também nas páginas seguintes", async () => {
    vi.mocked(listarAgendamentos).mockResolvedValueOnce({ sucesso: true, dados: [cirurgia("Agendada", "98765432100")], total_paginas: 2 } as any)
      .mockResolvedValueOnce({ sucesso: true, dados: [cirurgia("Agendada", undefined, "28/10/2099")], total_paginas: 2 } as any);
    expect((await buscarAgendaPaciente("12345678901", "Paciente teste"))?.agendamentoAtivo?.data_entrada).toBe("2099-10-28");
    expect(listarAgendamentos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
  it("ausência de paciente não cria agendamento", async () => {
    vi.mocked(listarAgendamentos).mockResolvedValueOnce({ sucesso: true, dados: [], total_paginas: 1 } as any);
    expect(await buscarAgendaPaciente("12345678901", "Paciente teste")).toEqual({ cirurgia: null, agendamentoAtivo: null, procedimentoRealizado: null });
  });
});