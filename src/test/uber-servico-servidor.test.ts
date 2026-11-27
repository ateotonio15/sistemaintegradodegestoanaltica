// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";

let db: PGlite;
const uid = "00000000-0000-0000-0000-000000000001";
const lote = "00000000-0000-0000-0000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${uid}'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.allowed',true),'true')='true' $$;
    CREATE TABLE public.profiles(user_id uuid,display_name text,username text);
    INSERT INTO public.profiles VALUES('${uid}','Teste','teste');
    CREATE TABLE public.uber_passageiros(id uuid,nome text,ativo boolean);
    CREATE TABLE public.uber_corridas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),data date,horario time,colaborador text NOT NULL DEFAULT '',passageiro_id uuid,origem text,destino text,motivo text,tipo text,empresa text,forma_pagamento text,responsavel text,criado_por text,created_by uuid,valor numeric,cancelada boolean DEFAULT false,observacao text,tem_reembolso boolean DEFAULT false,valor_reembolso numeric DEFAULT 0,reembolso numeric DEFAULT 0,updated_at timestamptz DEFAULT '2026-11-01T00:00:00Z');
    CREATE FUNCTION public.test_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
    CREATE TRIGGER trg_uber_corridas_updated_at BEFORE UPDATE ON public.uber_corridas FOR EACH ROW EXECUTE FUNCTION public.test_updated_at();`);
  await db.exec(readFileSync("drizzle/migrations/0112_uber_business_importacoes.sql","utf8"));
  await db.exec(readFileSync("drizzle/migrations/0116_uber_servico_e_status.sql","utf8"));
  await db.exec(`INSERT INTO public.uber_importacoes(id,usuario_id,usuario_nome,arquivos) VALUES('${lote}','${uid}','Teste','[]');`);
}, 20000);
afterAll(async () => { await db.close(); });

async function criar(trip: string, cancelada=false) {
  await db.query(`INSERT INTO public.uber_corridas(data,colaborador,empresa,motivo,tipo,forma_pagamento,valor,uber_trip_id,importacao_id,cancelada) VALUES('2026-11-03','Passageiro','Empresa','Plantão de Atendimento','Ida','Cartão',29.95,$1,$2,$3)`, [trip,lote,cancelada]);
}
async function corrida(trip:string) { return (await db.query<Record<string,unknown>>("SELECT * FROM public.uber_corridas WHERE uber_trip_id=$1",[trip])).rows[0]; }
it("fica completa com os cinco campos e volta a pendente ao esvaziar cada um",async () => {
  await criar("status");
  expect((await corrida("status"))?.status_importacao).toBe("completa");
  for(const [campo,valor] of Object.entries({colaborador:"Passageiro",empresa:"Empresa",motivo:"Plantão de Atendimento",tipo:"Ida",forma_pagamento:"Cartão"})) {
    await db.exec(`UPDATE public.uber_corridas SET ${campo}='' WHERE uber_trip_id='status'`);
    expect((await corrida("status"))?.status_importacao).toBe("pendente");
    await db.query(`UPDATE public.uber_corridas SET ${campo}=$1 WHERE uber_trip_id='status'`,[valor]);
    expect((await corrida("status"))?.status_importacao).toBe("completa");
  }
});
it("canceladas preservam status ao completar ou limpar campos",async () => {
  await criar("cancelada",true);
  const antes=await corrida("cancelada");
  await db.exec("UPDATE public.uber_corridas SET colaborador='' WHERE uber_trip_id='cancelada'");
  expect((await corrida("cancelada"))?.status_importacao).toBe(antes?.status_importacao);
  expect((await corrida("cancelada"))?.cancelada).toBe(true);
});
it("corridas manuais mantêm serviço vazio e não ganham status de importação",async () => {
  const {rows}=await db.query("INSERT INTO public.uber_corridas(data,colaborador,valor) VALUES('2026-11-03','Manual',10) RETURNING servico_uber,status_importacao");
  expect(rows).toEqual([{servico_uber:null,status_importacao:null}]);
});
it("preenchimento exclusivo de serviço preserva TODOS os demais campos inclusive datas e status",async () => {
  await criar("isolada");
  const antes=await corrida("isolada");
  await db.exec("UPDATE public.uber_corridas SET servico_uber='UberX' WHERE uber_trip_id='isolada'");
  expect(await corrida("isolada")).toEqual({...antes,servico_uber:"UberX"});
});
it("reenvia ID existente, preenche apenas serviço e não duplica nem sobrescreve",async () => {
  await criar("reenvio");
  const antes=await corrida("reenvio");
  const arquivos=JSON.stringify([{nome:"teste.csv",viagens:1}]);
  const linhas=JSON.stringify([{uber_trip_id:"reenvio",servico_uber:"Travel | Moto Priority",colaborador:"Errado",valor:9999,arquivos:["teste.csv"]}]);
  const id="00000000-0000-0000-0000-000000000003";
  const result=await db.query<{resultado:unknown}>("SELECT public.uber_confirmar_importacao($1,$2,$3) AS resultado",[id,arquivos,linhas]);
  expect(result.rows[0]?.resultado).toEqual({importadas:0,ignoradas:0,servicos_atualizados:1});
  expect(await corrida("reenvio")).toEqual({...antes,servico_uber:"Moto Priority"});
  expect((await db.query("SELECT count(*)::integer AS qtd FROM public.uber_corridas WHERE uber_trip_id='reenvio'")).rows).toEqual([{qtd:1}]);
  expect((await db.query("SELECT public.uber_confirmar_importacao($1,$2,$3) AS resultado",[id,arquivos,linhas])).rows).toEqual(result.rows);
  const novo="00000000-0000-0000-0000-000000000004";
  expect((await db.query("SELECT public.uber_confirmar_importacao($1,$2,$3) AS resultado",[novo,arquivos,linhas])).rows).toEqual([{resultado:{importadas:0,ignoradas:1,servicos_atualizados:0}}]);
  expect(await corrida("reenvio")).toEqual({...antes,servico_uber:"Moto Priority"});
});
it("nova importação grava Serviço separado do Tipo e mantém Cartão e pendência",async () => {
  const linhas=JSON.stringify([{uber_trip_id:"nova",servico_uber:"Travel | UberX",data:"2026-11-03",valor:10,colaborador:"",tipo:"Volta",forma_pagamento:"Cartão",arquivos:["nova.csv"]}]);
  await db.query("SELECT public.uber_confirmar_importacao($1,$2,$3)",["00000000-0000-0000-0000-000000000005",JSON.stringify([{nome:"nova.csv",viagens:1}]),linhas]);
  const r=await corrida("nova");
  expect(r?.servico_uber).toBe("UberX"); expect(r?.tipo).toBe("Volta"); expect(r?.forma_pagamento).toBe("Cartão"); expect(r?.status_importacao).toBe("pendente");
});
it("nega preenchimento por quem não tem permissão de importação",async () => {
  await db.exec("SET test.allowed='false'");
  try { await expect(db.query("SELECT public.uber_confirmar_importacao($1,$2,$3)",["00000000-0000-0000-0000-000000000006",'[]','[]'])).rejects.toThrow("Sem permissão"); }
  finally { await db.exec("SET test.allowed='true'"); }
});