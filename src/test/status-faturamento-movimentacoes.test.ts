// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const empresa = "3ce1b149-e00b-4ac2-b26c-daa6d49937be";
const normal = "a9ab689c-b0ce-46df-b8aa-1f91a85204fd";
const primeira = "0adeaeea-59b7-4dcb-bf23-f63cbf9e9286";
const sql = readFileSync("drizzle/migrations/0054_separar_primeira_mensalidade_status_movimentacoes.sql", "utf8");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
    CREATE TABLE empresas(id uuid, exige_po_pc boolean);
    CREATE TABLE financeiro_movimentacoes(id uuid, empresa_id uuid, mes_referencia text,
      periodo text, tipo_lancamento text, data_envio_nota date, dentro_prazo boolean,
      faturamento_iniciado_em timestamptz, faturamento_iniciado_por_nome text);
    CREATE TABLE grupos_financeiros_contratos(empresa_id uuid, grupo_id uuid, ativo boolean);
    CREATE TABLE anexos_financeiro(financeiro_movimentacao_id uuid, mime_type text, nome_arquivo text, origem text);
    CREATE TABLE movimentacoes(empresa_id uuid, mes_referencia text, periodo text, data_envio_financeiro date);
  `);
  await db.exec(sql);
}, 30000);

beforeEach(async () => {
  await db.exec(`TRUNCATE empresas, financeiro_movimentacoes, grupos_financeiros_contratos, anexos_financeiro, movimentacoes;
    SET test.user_id = '${empresa}';
    INSERT INTO empresas VALUES ('${empresa}', false);
    INSERT INTO financeiro_movimentacoes VALUES
      ('${normal}', '${empresa}', '2026-10', '25-30', 'normal', null, true, null, null),
      ('${primeira}', '${empresa}', '2026-10', '25-30', 'primeira_mensalidade', '2026-10-26', true, now(), 'Financeiro');`);
});

afterAll(async () => { await db.close(); });

async function resultado() {
  return (await db.query<{ status: string; data_envio_nota: string | null }>(
    "SELECT status, data_envio_nota::text FROM status_faturamento_competencia('2026-10')",
  )).rows;
}

describe("Nota da primeira mensalidade separada da movimentação", () => {
  it("contrato 2544: nota inicial de 26/10 não indica envio da movimentação 25-30", async () => {
    expect(await resultado()).toEqual([{ status: "Pendente", data_envio_nota: null }]);
  });

  it("sem lançamento normal não usa a primeira mensalidade como substituta", async () => {
    await db.exec(`DELETE FROM financeiro_movimentacoes WHERE id = '${normal}'`);
    expect(await resultado()).toEqual([]);
  });

  it("preserva a nota enviada do lançamento normal", async () => {
    await db.exec(`UPDATE financeiro_movimentacoes SET data_envio_nota = '2026-10-30' WHERE id = '${normal}'`);
    expect(await resultado()).toEqual([{ status: "Enviada", data_envio_nota: "2026-10-30" }]);
  });

  it("PDF da primeira mensalidade não muda o status normal, mesmo em grupo", async () => {
    await db.exec(`INSERT INTO grupos_financeiros_contratos VALUES ('${empresa}', '${empresa}', true);
      INSERT INTO anexos_financeiro VALUES ('${primeira}', 'application/pdf', 'nota.pdf', 'normal')`);
    expect(await resultado()).toEqual([{ status: "Pendente", data_envio_nota: null }]);
  });

  it("lançamento legado sem tipo continua sendo normal", async () => {
    await db.exec(`UPDATE financeiro_movimentacoes SET tipo_lancamento = null, data_envio_nota = '2026-10-29' WHERE id = '${normal}'`);
    expect(await resultado()).toEqual([{ status: "Enviada", data_envio_nota: "2026-10-29" }]);
  });

  it("consulta sem sessão não retorna dados", async () => {
    await db.exec("SET test.user_id = ''");
    expect(await resultado()).toEqual([]);
  });
});