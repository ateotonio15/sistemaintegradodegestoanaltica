// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const empresaId = "c126d472-e57e-4b44-99ed-75edc0457fe6";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
    CREATE TABLE public.empresas(id uuid, nome text, tipo_movimentacao text,
      responsavel_contrato text, responsavel_user_id uuid, tipo_contrato text,
      primeira_competencia_financeira text, status_implantacao text,
      status_empresa text, data_rescisao date, contrato_suspenso boolean);
    CREATE TABLE public.movimentacoes(id uuid, empresa_id uuid, mes_referencia text,
      periodo text, data_envio_empresa date, data_envio_financeiro date);
    SET test.user_id = '${empresaId}';
    INSERT INTO public.empresas VALUES ('${empresaId}', 'CARTORIO 3 OFICIO DO REG DE IMOVEIS',
      'Diária', 'Vivian Lohana', null, 'EMPRESARIAL', '2026-11', 'ativo', 'Ativa', null, false);
    INSERT INTO public.movimentacoes VALUES
      ('8396611f-0449-424a-936d-49eceacb573b','${empresaId}','2026-10','01-05',null,null),
      ('55396822-23ae-4a6c-8522-671edf6b2257','${empresaId}','2026-11','01-05',null,null);
  `);
  await db.exec(readFileSync("drizzle/migrations/0067_dashboard_respeitar_primeira_competencia.sql", "utf8"));
}, 30000);

afterAll(async () => { await db.close(); });

describe("Dashboard Geral — contrato 2548 implantado em 10/10 após corte 05", () => {
  it("não conta a movimentação de outubro, mesmo com contrato ativo", async () => {
    expect((await db.query("SELECT * FROM dashboard_movimentacoes('2026-10', '2026-10')")).rows).toEqual([]);
  });

  it("conta novembro e exclui outubro também na série mensal", async () => {
    expect((await db.query("SELECT mes_referencia, periodo FROM dashboard_movimentacoes('2026-10', null)")).rows)
      .toEqual([{ mes_referencia: "2026-11", periodo: "01-05" }]);
  });

  it("preserva os dois registros originais", async () => {
    expect((await db.query<{ total: number }>("SELECT count(*)::int AS total FROM movimentacoes")).rows[0]?.total).toBe(2);
  });

  it("mantém a exigência de sessão autenticada", async () => {
    await db.exec("SET test.user_id = ''");
    expect((await db.query("SELECT * FROM dashboard_movimentacoes('2026-11', '2026-11')")).rows).toEqual([]);
    await db.exec(`SET test.user_id = '${empresaId}'`);
  });
});