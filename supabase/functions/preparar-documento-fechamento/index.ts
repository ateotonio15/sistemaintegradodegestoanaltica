import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { baixarRelatorioPortal, validarContratoPortal, validarArquivoContrato } from "../_shared/portal-empresa-relatorios.ts";

const Body = z.object({
  movimentacao_id: z.string().uuid(), empresa_id: z.string().uuid(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/), periodo: z.string().nullable(),
  contrato: z.string().regex(/^\d+$/), tipo: z.enum(["pdf", "xlsx"]),
  job_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/).optional(),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !key) throw new Error("Serviço indisponível.");
    const auth = req.headers.get("Authorization") ?? "";
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, key);
    const { data: usuario, error: authError } = await client.auth.getUser();
    if (authError || !usuario.user) return json({ error: "Sessão inválida." }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados da movimentação inválidos." }, 400);
    const body = parsed.data;
    const { data: roles, error: rolesError } = await admin.from("user_roles").select("role").eq("user_id", usuario.user.id);
    if (rolesError) throw rolesError;
    if (!(roles ?? []).some(r => ["admin", "comum", "administradoras", "financeiro", "executivo_externo"].includes(r.role))) return json({ error: "Sem permissão para preparar fechamento." }, 403);
    const { data: mov, error: movError } = await client.from("movimentacoes")
      .select("empresa_id, mes_referencia, periodo, empresas(codigo_contrato)")
      .eq("id", body.movimentacao_id).single();
    if (movError || !mov) return json({ error: "Movimentação não encontrada." }, 404);
    const empresa = Array.isArray(mov.empresas) ? mov.empresas[0] : mov.empresas;
    const contrato = validarContratoPortal(empresa?.codigo_contrato);
    if (mov.empresa_id !== body.empresa_id || mov.mes_referencia !== body.competencia || mov.periodo !== body.periodo || String(contrato) !== body.contrato) return json({ error: "A movimentação mudou. Salve e tente novamente." }, 409);
    const categoria = body.tipo === "pdf" ? "Relatório de Vidas" : "OPS Mensalidades";
    let query = client.from("envios_empresa_arquivos").select("*")
      .eq("empresa_id", mov.empresa_id).eq("contrato", String(contrato))
      .eq("competencia", mov.mes_referencia).eq("tipo_relatorio", categoria)
      .ilike("status", "atual").order("versao", { ascending: false }).limit(1);
    query = mov.periodo === null ? query.is("periodo", null) : query.eq("periodo", mov.periodo);
    const { data: atual, error: repoError } = await query.maybeSingle();
    if (repoError) throw repoError; // Falha de consulta não significa documento ausente.
    let registro = atual;
    if (!registro && !body.job_id) return json({ ausente: true });
    if (!registro && body.job_id) {
      const arquivo = await baixarRelatorioPortal(contrato, { nr_contrato: contrato, tipo: body.tipo, job_id: body.job_id }, AbortSignal.timeout(60_000));
      const path = `envios/${body.movimentacao_id}/${crypto.randomUUID()}/${arquivo.nome_arquivo}`;
      const { error: uploadError } = await admin.storage.from("arquivos-envios").upload(path, arquivo.blob, { contentType: arquivo.blob.type });
      if (uploadError) throw uploadError;
      const { data: id, error: registroError } = await admin.rpc("registrar_documento_fechamento", {
        p_movimentacao: body.movimentacao_id, p_usuario: usuario.user.id,
        p_empresa: body.empresa_id, p_contrato: body.contrato, p_competencia: body.competencia, p_periodo: body.periodo,
        p_tipo: categoria, p_nome: arquivo.nome_arquivo, p_path: path,
        p_mime: arquivo.blob.type, p_tamanho: arquivo.blob.size,
      });
      if (registroError) {
        await admin.storage.from("arquivos-envios").remove([path]);
        throw registroError;
      }
      const { data: salvo, error: salvoError } = await client.from("envios_empresa_arquivos").select("*").eq("id", id).single();
      if (salvoError) throw salvoError;
      registro = salvo;
      if (registro.storage_path !== path) await admin.storage.from("arquivos-envios").remove([path]);
    }
    if (!registro) throw new Error("Documento indisponível.");
    validarArquivoContrato(contrato, { nr_contrato: contrato, tipo: body.tipo, job_id: registro.id }, registro.nome_arquivo);
    const { data: signed, error: signedError } = await client.storage.from(registro.bucket).createSignedUrl(registro.storage_path, 120);
    if (signedError) throw signedError;
    return json({ ausente: false, id: registro.id, nome_arquivo: registro.nome_arquivo, url: signed.signedUrl, versao: registro.versao, origem: registro.origem });
  } catch {
    return json({ error: "Não foi possível consultar ou registrar o documento do fechamento. Tente novamente." }, 502);
  }
});