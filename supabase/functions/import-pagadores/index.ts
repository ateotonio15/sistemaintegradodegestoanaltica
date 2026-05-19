import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LinhaImport = { empresa: string; contrato: string; cnpj: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRow(row: any): LinhaImport | null {
  const empresa = String(row?.empresa ?? "").trim();
  const contrato = String(row?.contrato ?? "").trim();
  const rawCnpj = row?.cnpj == null ? "" : String(row.cnpj).replace(/\D/g, "");
  const cnpj = rawCnpj ? (rawCnpj.length <= 14 ? rawCnpj.padStart(14, "0") : rawCnpj) : null;
  if (!empresa || !contrato) return null;
  return { empresa, contrato, cnpj };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "Configuração do servidor incompleta" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) return json({ error: "Não autorizado" }, 401);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "financeiro"])
      .maybeSingle();
    if (!roleData) return json({ error: "Sem permissão para importar pagadores" }, 403);

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? body.rows.map(normalizeRow).filter(Boolean) as LinhaImport[] : [];
    if (rows.length === 0) return json({ error: "Nenhuma linha válida para importar" }, 400);
    if (rows.length > 5000) return json({ error: "Limite de 5000 linhas por importação" }, 400);

    const { data: job, error: jobError } = await adminClient
      .from("process_jobs")
      .insert({
        user_id: callerId,
        job_type: "import_pagadores",
        status: "pending",
        progress: 0,
        message: `Importação recebida: ${rows.length} pagador(es)`,
        payload: { total_rows: rows.length, file_name: body?.fileName ?? null },
      })
      .select("id")
      .single();
    if (jobError) throw jobError;

    const run = processImport(adminClient, job.id, rows);
    EdgeRuntime.waitUntil(run);

    return json({ jobId: job.id, status: "pending" }, 202);
  } catch (err: any) {
    return json({ error: String(err?.message || "Erro inesperado") }, 400);
  }
});

async function updateJob(adminClient: any, jobId: string, patch: Record<string, unknown>) {
  await adminClient.from("process_jobs").update(patch).eq("id", jobId);
}

async function processImport(adminClient: any, jobId: string, rows: LinhaImport[]) {
  let criados = 0;
  let atualizados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  try {
    await updateJob(adminClient, jobId, {
      status: "processing",
      progress: 5,
      started_at: new Date().toISOString(),
      message: "Buscando contratos e pagadores existentes",
    });

    const contratos = Array.from(new Set(rows.map((r) => r.contrato)));
    const { data: empresasContrato, error: empError } = await adminClient
      .from("empresas")
      .select("id, nome, codigo_contrato")
      .in("codigo_contrato", contratos);
    if (empError) throw empError;

    const ancoraPorContrato = new Map<string, { id: string; nome: string }>();
    (empresasContrato || []).forEach((e: any) => {
      if (!ancoraPorContrato.has(e.codigo_contrato)) ancoraPorContrato.set(e.codigo_contrato, { id: e.id, nome: e.nome });
    });

    const ancoraIds = Array.from(ancoraPorContrato.values()).map((a) => a.id);
    const { data: pagsExist, error: pagsError } = ancoraIds.length
      ? await adminClient.from("financeiro_pagadores").select("id, empresa_id, nome_pagador, cnpj").in("empresa_id", ancoraIds)
      : { data: [], error: null };
    if (pagsError) throw pagsError;

    const chaveExist = new Set<string>();
    const cnpjPorChave = new Map<string, { id: string; cnpj: string | null }>();
    (pagsExist || []).forEach((p: any) => {
      const k = `${p.empresa_id}|${String(p.nome_pagador || "").trim().toLowerCase()}`;
      chaveExist.add(k);
      cnpjPorChave.set(k, { id: p.id, cnpj: p.cnpj });
    });

    for (let i = 0; i < rows.length; i += 1) {
      const linha = rows[i];
      try {
        const ancora = ancoraPorContrato.get(linha.contrato);
        if (!ancora) {
          erros.push(`${linha.empresa} (${linha.contrato}): contrato não encontrado em Empresas`);
          continue;
        }
        const k = `${ancora.id}|${linha.empresa.trim().toLowerCase()}`;
        if (chaveExist.has(k)) {
          const ex = cnpjPorChave.get(k)!;
          if (linha.cnpj && !ex.cnpj) {
            const { error } = await adminClient.from("financeiro_pagadores").update({ cnpj: linha.cnpj }).eq("id", ex.id);
            if (error) throw error;
            atualizados += 1;
          } else {
            ignorados += 1;
          }
        } else {
          const { error } = await adminClient.from("financeiro_pagadores").insert({
            empresa_id: ancora.id,
            nome_pagador: linha.empresa,
            cnpj: linha.cnpj,
            ativo: true,
          });
          if (error) throw error;
          criados += 1;
          chaveExist.add(k);
        }
      } catch (err: any) {
        erros.push(`${linha.empresa} (${linha.contrato}): ${err.message}`);
      }

      if (i % 25 === 0 || i === rows.length - 1) {
        const progress = Math.min(95, 10 + Math.round(((i + 1) / rows.length) * 85));
        await updateJob(adminClient, jobId, { progress, message: `Processando ${i + 1}/${rows.length}` });
      }
    }

    await updateJob(adminClient, jobId, {
      status: erros.length ? "error" : "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
      message: erros.length ? `Concluído com ${erros.length} erro(s)` : "Importação concluída",
      result: { criados, atualizados, ignorados, erros },
      error: erros.length ? erros.slice(0, 20).join("\n") : null,
    });
  } catch (err: any) {
    await updateJob(adminClient, jobId, {
      status: "error",
      progress: 100,
      completed_at: new Date().toISOString(),
      message: "Importação interrompida por erro",
      error: String(err?.message || err),
      result: { criados, atualizados, ignorados, erros },
    });
  }
}