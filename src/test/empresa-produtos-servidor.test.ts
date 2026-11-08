import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("servidor aceita códigos 16 e 29 nas colunas manuais sem alterar valores", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE public.produtos_planos(codigo_produto integer PRIMARY KEY, ativo boolean);
      CREATE TABLE public.empresas(id integer PRIMARY KEY, produto_enfermaria_codigo integer, produto_apartamento_codigo integer, produto_nao_definido_codigo integer, valor_enfermaria_centavos integer, valor_apartamento_centavos integer);
      INSERT INTO public.produtos_planos VALUES(16,true),(29,true);
      INSERT INTO public.empresas VALUES(1,NULL,NULL,NULL,29100,40600);`);
    await db.exec(readFileSync("drizzle/migrations/0084_produtos_acomodacao_manual.sql", "utf8"));
    await db.exec("CREATE TRIGGER validar_produtos_empresa BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.validar_produtos_empresa();");
    await db.exec("UPDATE public.empresas SET produto_enfermaria_codigo=16,produto_apartamento_codigo=29 WHERE id=1;");
    const { rows } = await db.query("SELECT produto_enfermaria_codigo,produto_apartamento_codigo,valor_enfermaria_centavos,valor_apartamento_centavos FROM public.empresas WHERE id=1");
    expect(rows).toEqual([{ produto_enfermaria_codigo:16, produto_apartamento_codigo:29, valor_enfermaria_centavos:29100, valor_apartamento_centavos:40600 }]);
  } finally { await db.close(); }
});