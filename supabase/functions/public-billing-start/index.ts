import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ORBIT_BILLING_API_KEY");
  if (!apiKey) return json({ ok: false, error: "Endpoint não configurado" }, 500);

  const sent = req.headers.get("x-api-key") || "";
  if (sent !== apiKey) return json({ ok: false, error: "Unauthorized" }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }

  const { source, action, date, user, task_id, company, contract } = payload || {};
  if (action !== "start_billing") {
    return json({ ok: false, error: `Ação não suportada: ${action ?? "(vazio)"}` }, 400);
  }
  if (!company && !contract) {
    return json({ ok: false, error: "Informe company e/ou contract" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const temData = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
  const dataRef = temData ? String(date) : new Date().toISOString().slice(0, 10);
  const mesRef = dataRef.slice(0, 7);
  const mesAtual = new Date().toISOString().slice(0, 7);


  try {
    // ---------- empresa ----------
    let empresa: any = null;
    if (contract) {
      const { data } = await admin
        .from("empresas")
        .select("id,nome,codigo_contrato")
        .eq("codigo_contrato", String(contract).trim())
        .limit(1)
        .maybeSingle();
      empresa = data;
    }
    if (!empresa && company) {
      const { data } = await admin
        .from("empresas")
        .select("id,nome,codigo_contrato")
        .ilike("nome", String(company).trim())
        .limit(1)
        .maybeSingle();
      empresa = data;
    }
    if (!empresa && company) {
      const { data } = await admin
        .from("empresas")
        .select("id,nome,codigo_contrato")
        .ilike("nome", `%${String(company).trim()}%`)
        .limit(2);
      if (data && data.length === 1) empresa = data[0];
    }
    if (!empresa) {
      return json(
        { ok: false, error: "Empresa/contrato não encontrado no Siga", company, contract },
        404,
      );
    }

    // ---------- usuário ----------
    let perfil: any = null;
    if (user) {
      const u = String(user).trim();
      const { data } = await admin
        .from("profiles")
        .select("user_id,username,display_name")
        .or(`username.ilike.${u},display_name.ilike.${u}`)
        .limit(1)
        .maybeSingle();
      perfil = data;
    }
    const nomeUsuario = perfil?.display_name || perfil?.username || String(user || "Orbit");

    // ---------- movimentação alvo ----------
    // Se o payload traz mes_referencia (ou date), respeita essa competência.
    // Caso contrário, resolve a competência ABERTA (aguardando emissão) mais
    // recente que não seja futura — nunca assume o mês corrente às cegas.
    const mesPayload = /^\d{4}-\d{2}$/.test(String(payload?.mes_referencia || ""))
      ? String(payload.mes_referencia)
      : null;
    const mesExplicito = mesPayload ?? (temData ? mesRef : null);
    const COLS =
      "id,empresa_id,mes_referencia,periodo,faturamento_iniciado_em,faturamento_iniciado_por_nome,data_envio_nota";

    let mov: any = null;

    if (mesExplicito) {
      const { data } = await admin
        .from("financeiro_movimentacoes")
        .select(COLS)
        .eq("empresa_id", empresa.id)
        .eq("mes_referencia", mesExplicito)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      mov = data;
    } else {
      // 1) competência aberta (sem faturamento iniciado e sem nota) mais recente não futura
      const { data: aberta } = await admin
        .from("financeiro_movimentacoes")
        .select(COLS)
        .eq("empresa_id", empresa.id)
        .lte("mes_referencia", mesAtual)
        .is("faturamento_iniciado_em", null)
        .is("data_envio_nota", null)
        .order("mes_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();
      mov = aberta;
    }

    if (!mov) {
      const { data: anterior } = await admin
        .from("financeiro_movimentacoes")
        .select(COLS)
        .eq("empresa_id", empresa.id)
        .lte("mes_referencia", mesExplicito ?? mesAtual)
        .order("mes_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();
      mov = anterior;
    }
    if (!mov) {
      return json(
        { ok: false, error: "Nenhuma movimentação financeira encontrada para a empresa", mes: mesExplicito ?? mesAtual },
        404,
      );
    }

    const statusAtual = mov.data_envio_nota
      ? "Nota enviada"
      : mov.faturamento_iniciado_em
        ? "Em faturamento"
        : mov.mes_referencia > mesAtual
          ? "Competência não liberada"
          : "Aguardando Emissão";

    const somenteSeAguardando =
      payload?.only_if_awaiting_emission === true || payload?.only_if_awaiting_emission === "true";

    if (somenteSeAguardando && statusAtual !== "Aguardando Emissão") {
      return json({
        ok: false,
        reason: "not_awaiting_emission",
        status: statusAtual,
        mes_referencia: mov.mes_referencia,
        empresa: empresa.nome,
        contrato: empresa.codigo_contrato,
        periodo: mov.periodo,
        task_id: task_id ?? null,
      });
    }

    // already_started SOMENTE quando a linha alvo já está de fato em faturamento
    // (ou em estágio posterior: nota já enviada).
    if (mov.faturamento_iniciado_em || mov.data_envio_nota) {
      return json({
        ok: true,
        already_started: true,
        status: mov.data_envio_nota ? "Enviada" : "Em faturamento",
        message: mov.data_envio_nota
          ? "Nota já enviada para esta competência"
          : "Faturamento já estava iniciado",
        empresa: empresa.nome,
        contrato: empresa.codigo_contrato,
        mes_referencia: mov.mes_referencia,
        periodo: mov.periodo,
        iniciado_por: mov.faturamento_iniciado_por_nome ?? null,
        task_id: task_id ?? null,
      });
    }



    // Empresas do mesmo grupo financeiro (replica o comportamento do Siga)
    const { data: vinculo } = await admin
      .from("grupos_financeiros_contratos")
      .select("grupo_id")
      .eq("empresa_id", empresa.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    let empresaIds = [empresa.id];
    if (vinculo?.grupo_id) {
      const { data: membros } = await admin
        .from("grupos_financeiros_contratos")
        .select("empresa_id")
        .eq("grupo_id", vinculo.grupo_id)
        .eq("ativo", true);
      empresaIds = [...new Set([empresa.id, ...(membros || []).map((m: any) => m.empresa_id)])];
    }

    const agora = new Date().toISOString();
    const patch = {
      faturamento_iniciado_por: perfil?.user_id ?? null,
      faturamento_iniciado_por_nome: nomeUsuario,
      faturamento_iniciado_em: agora,
      updated_at: agora,
    };

    const { data: atualizadas, error: upErr } = await admin
      .from("financeiro_movimentacoes")
      .update(patch)
      .in("empresa_id", empresaIds)
      .eq("mes_referencia", mov.mes_referencia)
      .eq("periodo", mov.periodo)
      .is("faturamento_iniciado_em", null)
      .select("id");
    if (upErr) throw upErr;

    // Garante que a linha alvo foi realmente marcada (ex.: período divergente).
    let total = atualizadas?.length ?? 0;
    if (!atualizadas?.some((r: any) => r.id === mov!.id)) {
      const { data: alvo, error: alvoErr } = await admin
        .from("financeiro_movimentacoes")
        .update(patch)
        .eq("id", mov.id)
        .is("faturamento_iniciado_em", null)
        .select("id");
      if (alvoErr) throw alvoErr;
      total += alvo?.length ?? 0;
    }

    console.log("[billing-start]", {
      source: source ?? null,
      task_id: task_id ?? null,
      empresa: empresa.nome,
      contrato: empresa.codigo_contrato,
      mes_referencia: mov.mes_referencia,
      periodo: mov.periodo,
      usuario: nomeUsuario,
      atualizadas: total,
    });

    return json({
      ok: true,
      already_started: false,
      status: "Em faturamento",
      empresa: empresa.nome,
      contrato: empresa.codigo_contrato,
      mes_referencia: mov.mes_referencia,
      periodo: mov.periodo,
      usuario: nomeUsuario,
      movimentacoes_iniciadas: total,

      task_id: task_id ?? null,
    });
  } catch (e) {
    console.error("[billing-start] erro", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
