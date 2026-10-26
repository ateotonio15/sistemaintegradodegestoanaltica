// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { demandaCirurgicaPendente, eventosConfirmados, podeVerAvisosCirurgia, type DemandaCirurgia, type Cirurgia } from "../../supabase/functions/sincronizar-cirurgias-demandas/regras";

const d: DemandaCirurgia = { id: "10000000-0000-0000-0000-000000000001", cpf: "123.456.789-01", nome_cliente: "Paciente Teste", setor_responsavel: "Agenda Cirúrgica", tipo_reclamacao: null, reclamacao: null, resolvido_setor: false, resolvido_executiva: false };
const a: Cirurgia = { nr_sequencia: 42, dt_agenda: "30/10/2026", status: { descricao: "Confirmado" }, paciente: { nr_cpf: "12345678901" }, medico: { nm_medico: "Médico Teste" } };
describe("Avisos globais — regras da confirmação", () => {
  it("somente adm, executivo e executivo externo", () => {
    expect(["admin","executivo","executivo_externo"].map(podeVerAvisosCirurgia)).toEqual([true,true,true]);
    expect(["comum","financeiro","diretora","admin_interno","enfermeira","visualizacao",null].map(podeVerAvisosCirurgia)).toEqual([false,false,false,false,false,false,false]);
  });
  it("procedimento cirúrgico também é elegível fora do setor", () => {
    expect(demandaCirurgicaPendente({ ...d, setor_responsavel: "Atendimento", reclamacao: "Procedimento cirúrgico" })).toBe(true);
  });
  it("não avisa reclamações resolvidas", () => {
    expect(eventosConfirmados([{ ...d, resolvido_setor: true }, { ...d, resolvido_executiva: true }], [a], "2026-10-26")).toEqual([]);
  });
  it("confere CPF completo e ignora homônimo", () => {
    expect(eventosConfirmados([d], [{ ...a, paciente: { nr_cpf: "12345678902" } }], "2026-10-26")).toEqual([]);
  });
  it("somente data atual/futura e status explícito", () => {
    for (const descricao of ["Cancelado","Realizado","Pendente","Não agendado", ""]) expect(eventosConfirmados([d], [{ ...a, status: { descricao } }], "2026-10-26")).toEqual([]);
    expect(eventosConfirmados([d], [{ ...a, dt_agenda: "25/10/2026" }], "2026-10-26")).toEqual([]);
  });
  it("deduplica demanda/agendamento/data e preserva os dados da reclamação", () => {
    const before = JSON.stringify(d);
    expect(eventosConfirmados([d], [a,a], "2026-10-26")).toEqual([{ demanda_id: d.id, agendamento_id: "42", data_cirurgia: "2026-10-30", nome_paciente: "Paciente Teste", nome_medico: "Médico Teste" }]);
    expect(JSON.stringify(d)).toBe(before);
  });
});

let db: PGlite;
const user = "20000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${user}'::uuid $$;
    CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true)=r $$;
    CREATE TABLE public.demandas(id uuid PRIMARY KEY, created_by uuid);
    GRANT SELECT ON public.demandas TO authenticated;
    ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY leitura ON public.demandas FOR SELECT TO authenticated USING (current_setting('test.role',true) IN ('admin','executivo') OR created_by=auth.uid());`);
  const sql = readFileSync("drizzle/migrations/0055_avisos_globais_cirurgia.sql", "utf8").replace(/ALTER PUBLICATION[^;]+;/g, "");
  await db.exec(sql);
  await db.exec(`INSERT INTO demandas VALUES ('${d.id}', '${user}'), ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');
    INSERT INTO demandas_cirurgia_notificacoes(demanda_id,agendamento_id,data_cirurgia,nome_paciente,nome_medico) SELECT id,'42','2026-10-30','Paciente Teste','Médico Teste' FROM demandas;`);
},30000);
afterAll(async () => { await db.close(); });
describe("Avisos globais — proteção real das tabelas", () => {
  for (const role of ["admin","executivo","executivo_externo","comum","financeiro","diretora","enfermeira"]) it(`protege leitura para ${role}`, async () => {
    await db.exec(`RESET ROLE; SET test.role='${role}'; SET ROLE authenticated;`);
    const { rows } = await db.query("SELECT id FROM demandas_cirurgia_notificacoes");
    expect(rows.length).toBe(role === "admin" || role === "executivo" ? 2 : role === "executivo_externo" ? 1 : 0);
  });
  it("executivo não pode fabricar notificações", async () => {
    await db.exec("RESET ROLE; SET test.role='executivo'; SET ROLE authenticated;");
    await expect(db.exec(`INSERT INTO demandas_cirurgia_notificacoes(demanda_id,agendamento_id,data_cirurgia,nome_paciente,nome_medico) VALUES ('${d.id}','99','2026-10-30','Falso','Falso')`)).rejects.toThrow();
  });
  it("leitura é individual e não aceita ciência por outro usuário", async () => {
    await db.exec("RESET ROLE; SET test.role='executivo'; SET ROLE authenticated;");
    await expect(db.exec("INSERT INTO demandas_cirurgia_lidas(notificacao_id,user_id) SELECT id,'20000000-0000-0000-0000-000000000002' FROM demandas_cirurgia_notificacoes LIMIT 1")).rejects.toThrow();
    await db.exec(`INSERT INTO demandas_cirurgia_lidas(notificacao_id,user_id) SELECT id,'${user}' FROM demandas_cirurgia_notificacoes LIMIT 1`);
    expect((await db.query("SELECT * FROM demandas_cirurgia_lidas")).rows.length).toBe(1);
  });
});