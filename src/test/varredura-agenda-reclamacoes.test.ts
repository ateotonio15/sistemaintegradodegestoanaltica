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
  it("Executada significa que o paciente já realizou o procedimento", () => {
    expect(classificar(base, [ag("Executada", "01/10/2026")], hoje)).toMatchObject({ situacao: "realizado", data_procedimento: "2026-10-01" });
  });
  it("Marcada com data de hoje reconhece o agendamento mostrado na agenda", () => {
    expect(classificar(base, [ag("Marcada", "03/11/2026 15:00")], hoje)).toMatchObject({
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

import { classificar as classificarData } from "../../supabase/functions/verificar-agenda-reclamacoes/regras";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("procedimento anterior à reclamação", () => {
  const dem = { id: "1", cpf: "12345678901", nome_cliente: "MARIA", setor_responsavel: "Agenda Cirúrgica", tipo_reclamacao: null, reclamacao: "cirurgia", data_reclamacao: "2026-11-04", resolvido_setor: false, resolvido_executiva: false };
  const ag = (dt: string) => ({ nr_sequencia: 1, dt_agenda: dt, status: { descricao: "Executada" }, paciente: { nm_paciente: "MARIA", nr_cpf: "12345678901" }, medico: { nm_medico: "JOAO" }, procedimento_principal: { descricao: "COLECISTECTOMIA" } });
  i2("ignora executada antes da data da reclamação", () => {
    e2(classificarData(dem, [ag("27/01/2026")], "2026-11-04").situacao).toBe("aguardando");
  });
  i2("aceita executada depois e traz médico e procedimento", () => {
    const r = classificarData(dem, [ag("05/11/2026")], "2026-11-06");
    e2([r.situacao, r.nome_medico, r.nome_procedimento]).toEqual(["realizado", "JOAO", "COLECISTECTOMIA"]);
  });
});
