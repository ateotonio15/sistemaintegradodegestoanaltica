import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { demandaCirurgicaPendente, eventosConfirmados, type DemandaCirurgia, type Cirurgia } from "./regras.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const upstream = "https://api-agenda-cirurgica.samel.com.br/api/integracao/agendamentos";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: config } = await db.from("config_sync").select("valor").eq("chave", "sync_cnpj_token").maybeSingle();
  const internal = req.headers.get("x-sync-token");
  if (!internal || !config?.valor || internal !== config.valor) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getClaims(auth.slice(7));
    if (error || !data?.claims?.sub) return json({ error: "Não autorizado" }, 401);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", data.claims.sub).in("role", ["admin", "executivo", "executivo_externo"]);
    if (!roles?.length) return json({ error: "Acesso restrito" }, 403);
  }
  const { data: reserved, error: reserveError } = await db.rpc("reservar_sync_cirurgias");
  if (reserveError) return json({ error: "Não foi possível iniciar a consulta" }, 500);
  if (!reserved) return json({ ok: true, em_andamento: true });
  try {
    const demandas: DemandaCirurgia[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("demandas")
        .select("id,cpf,nome_cliente,setor_responsavel,tipo_reclamacao,reclamacao,resolvido_setor,resolvido_executiva")
        .eq("resolvido_setor", false).eq("resolvido_executiva", false).order("id").range(offset, offset + 499);
      if (error) throw error;
      demandas.push(...(data ?? []).filter(demandaCirurgicaPendente));
      if ((data?.length ?? 0) < 500) break;
    }
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    const local = `${part("year")}-${part("month")}-${part("day")}`;
    const [y,m,d] = local.split("-").map(Number);
    const end = new Date(y, m - 1 + 6, d);
    const br = (date: Date) => `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
    const agenda: Cirurgia[] = [];
    if (demandas.length) {
      const key = Deno.env.get("AGENDA_CIRURGICA_API_KEY");
      if (!key) throw new Error("Agenda não configurada");
      let totalPages = 1;
      const deadline = Date.now() + 65000;
      for (let page = 1; page <= totalPages; page++) {
        if (Date.now() > deadline) throw new Error("Consulta incompleta");
        const params = new URLSearchParams({ dt_inicio: br(new Date(y,m-1,d)), dt_fim: br(end), limit: "500", page: String(page) });
        const response = await fetch(`${upstream}?${params}`, { headers: { "x-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) { await response.text(); throw new Error("Agenda indisponível"); }
        const result = await response.json();
        if (!result.sucesso || !Array.isArray(result.dados) || !Number.isInteger(result.total_paginas) || result.total_paginas < 0 || result.total_paginas > 50) throw new Error("Consulta incompleta");
        totalPages = result.total_paginas;
        agenda.push(...result.dados);
      }
    }
    const eventos = eventosConfirmados(demandas, agenda, local);
    for (let i = 0; i < eventos.length; i += 100) {
      const { error } = await db.from("demandas_cirurgia_notificacoes").upsert(eventos.slice(i,i+100), { onConflict: "demanda_id,agendamento_id,data_cirurgia", ignoreDuplicates: true });
      if (error) throw error;
    }
    await db.from("demandas_cirurgia_sync").update({ ultimo_sucesso_em: new Date().toISOString(), erro: null, reservado_ate: null }).eq("id",true);
    return json({ ok: true, confirmados: eventos.length });
  } catch {
    await db.from("demandas_cirurgia_sync").update({ erro: "Agenda indisponível ou consulta incompleta. A verificação será tentada novamente.", reservado_ate: null }).eq("id",true);
    return json({ ok: false, error: "Não foi possível conferir a agenda. Nenhuma reclamação foi alterada." });
  }
});