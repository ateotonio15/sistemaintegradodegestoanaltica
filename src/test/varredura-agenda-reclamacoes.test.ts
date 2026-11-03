import { describe, it, expect } from "vitest";
import { classificar, elegivel, type DemandaVarredura } from "../../supabase/functions/verificar-agenda-reclamacoes/regras";

const base: DemandaVarredura = { id: "1", cpf: "123.456.789-01", nome_cliente: "Maria Souza", setor_responsavel: "Agenda Cirúrgica",
  tipo_reclamacao: "Aprazamento", reclamacao: "Aprazamento cirúrgico", resolvido_setor: false, resolvido_executiva: false };
const ag = (status: string, dt: string, cpf = "12345678901", nome = "MARIA SOUZA") =>
  ({ nr_sequencia: 9, dt_agenda: dt, status: { descricao: status }, paciente: { nr_cpf: cpf, nm_paciente: nome } });
const hoje = "2026-11-03";

describe("varredura da agenda nas reclamações", () => {
  it("só pendentes que mencionam cirurgia", () => {
    expect(elegivel(base)).toBe(true);
    expect(elegivel({ ...base, resolvido_executiva: true })).toBe(false);
    expect(elegivel({ ...base, setor_responsavel: "Rede", tipo_reclamacao: "x", reclamacao: "Demora na cirurgia" })).toBe(true);
    expect(elegivel({ ...base, setor_responsavel: "Rede", tipo_reclamacao: "x", reclamacao: "Consulta" })).toBe(false);
  });
  it("agendada exige status confirmado e data futura", () => {
    expect(classificar(base, [ag("Agendado", "10/12/2026")], hoje)).toMatchObject({ situacao: "agendada", data_procedimento: "2026-12-10" });
    expect(classificar(base, [ag("Aguardando autorização", "10/12/2026")], hoje).situacao).toBe("aguardando");
  });
  it("realizado e cancelado vêm do status da agenda", () => {
    expect(classificar(base, [ag("Realizada", "01/10/2026")], hoje).situacao).toBe("realizado");
    expect(classificar(base, [ag("Cancelado", "10/12/2026")], hoje).situacao).toBe("cancelado");
  });
  it("Marcada com data de hoje reconhece o agendamento mostrado na agenda", () => {
    expect(classificar(base, [ag("Marcada", "03/11/2026 15:00")], hoje)).toEqual({
      situacao: "agendada", data_procedimento: "2026-11-03", status_api: "Marcada", agendamento_id: "9",
    });
  });
  it("Marcada exige data e CPF compatível e não aceita cancelamento", () => {
    expect(classificar(base, [ag("Marcada", "")], hoje).situacao).toBe("aguardando");
    expect(classificar(base, [ag("Marcada", "02/11/2026")], hoje).situacao).toBe("aguardando");
    expect(classificar(base, [ag("Marcada", "03/11/2026", "99999999999")], hoje).situacao).toBe("validar");
    expect(classificar(base, [ag("Marcada - Cancelada", "03/11/2026")], hoje).situacao).toBe("cancelado");
  });
  it("homônimo com outro CPF pede validação", () => {
    expect(classificar(base, [ag("Agendado", "10/12/2026", "99999999999")], hoje).situacao).toBe("validar");
    expect(classificar({ ...base, cpf: null }, [ag("Agendado", "10/12/2026")], hoje).situacao).toBe("validar");
    expect(classificar(base, [], hoje).situacao).toBe("aguardando");
  });
});
