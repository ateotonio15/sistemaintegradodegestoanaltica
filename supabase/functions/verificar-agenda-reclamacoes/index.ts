import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { assinatura, classificar, elegivel, type DemandaVarredura, type Resultado } from "./regras.ts";

// Usa a mesma API e a mesma chave do servidor da integração existente da Agenda Cirúrgica.
const upstream = "https://api-agenda-cirurgica.samel.com.br/api/integracao/agendamentos";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const CAMPOS = "id,cpf,nome_cliente,setor_responsavel,tipo_reclamacao,reclamacao,resolvido_setor,resolvido_executiva,updated_at";
const LOTE_MAX = 5;

function hojeManaus() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
const br = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

async function buscarAgenda(nome: string, hoje: string, key: string) {
  const [y, m, d] = hoje.split("-").map(Number);
  const dados: any[] = [];
  let total = 1;
  for (let page = 1; page <= total && page <= 10; page++) {
    const params = new URLSearchParams({ nm_paciente: nome, dt_inicio: br(new Date(y - 1, m - 1, d)), dt_fim: br(new Date(y + 1, m - 1, d)), limit: "200", page: String(page) });
    const r = await fetch(`${upstream}?${params}`, { headers: { "x-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { await r.text(); throw new Error("Agenda indisponível"); }
    const body = await r.json();
    if (!body?.sucesso || !Array.isArray(body.dados)) throw new Error("Resposta inválida");
    dados.push(...body.dados);
    total = Number(body.total_paginas) || 1;
  }
  return dados;
}

type Obter = (d: DemandaVarredura, hoje: string) => Promise<any[]>;

async function processar(db: any, demandas: DemandaVarredura[], obter: Obter, contagem: Record<string, number>) {
  const hoje = hojeManaus();
  const { data: atuais } = await db.from("demandas_cirurgia_situacao").select("demanda_id,assinatura").in("demanda_id", demandas.map((d) => d.id));
  const anterior = new Map((atuais ?? []).map((a: any) => [a.demanda_id, a.assinatura]));
  for (const d of demandas) {
    let r: Resultado;
    try {
      const nome = d.nome_cliente?.trim() ?? "";
      r = nome.length < 3 ? classificar(d, [], hoje) : classificar(d, await obter(d, hoje), hoje);
    } catch (e) {
      console.error("varredura: falha na consulta", d.id, (e as Error).message);
      r = { situacao: "erro", data_procedimento: null, status_api: null, agendamento_id: null };
    }
    contagem[r.situacao] = (contagem[r.situacao] ?? 0) + 1;
    const ass = assinatura(r);
    const agora = new Date().toISOString();
    const linha: Record<string, unknown> = { demanda_id: d.id, consultado_em: agora };
    if (anterior.get(d.id) !== ass) {
      Object.assign(linha, r, { assinatura: ass, alterado_em: agora });
      contagem.atualizadas = (contagem.atualizadas ?? 0) + 1;
    }
    const { error } = anterior.has(d.id)
      ? await db.from("demandas_cirurgia_situacao").update(linha).eq("demanda_id", d.id)
      : await db.from("demandas_cirurgia_situacao").insert({ ...r, ...linha, assinatura: ass });
    if (error) console.error("varredura: falha ao gravar", d.id, error.message);
  }
}

// Mantém só os campos usados na classificação, como texto curto.
const txt = (v: unknown, max = 200) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : undefined);
function limparAgendamento(a: any) {
  return {
    nr_sequencia: Number.isFinite(Number(a?.nr_sequencia)) ? Number(a.nr_sequencia) : undefined,
    dt_agenda: txt(a?.dt_agenda, 30),
    status: { codigo: txt(a?.status?.codigo, 50), descricao: txt(a?.status?.descricao) },
    paciente: { nm_paciente: txt(a?.paciente?.nm_paciente), nr_cpf: txt(a?.paciente?.nr_cpf, 20) },
  };
}

async function registrarLog(db: any, id: string, c: Record<string, number>, analisadas: number, erro: string | null, fim: boolean) {
  await db.from("demandas_cirurgia_varreduras").update({
    analisadas, agendadas: c.agendada ?? 0, aguardando: c.aguardando ?? 0, realizados: c.realizado ?? 0,
    cancelados: c.cancelado ?? 0, validar: c.validar ?? 0, erros: c.erro ?? 0, ignoradas: c.ignoradas ?? 0,
    atualizadas: c.atualizadas ?? 0, erro, ...(fim ? { concluido_em: new Date().toISOString() } : {}),
  }).eq("id", id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const key = Deno.env.get("AGENDA_CIRURGICA_API_KEY");
  if (!key) return json({ error: "Agenda não configurada" }, 500);
  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  // ---- Varredura diária (agendada): autenticada pelo token interno ----
  const { data: config } = await db.from("config_sync").select("valor").eq("chave", "sync_cnpj_token").maybeSingle();
  const interno = req.headers.get("x-sync-token");
  if (interno && config?.valor && interno === config.valor) {
    const { data: log } = await db.from("demandas_cirurgia_varreduras").insert({ origem: "diaria" }).select("id").single();
    const todas: DemandaVarredura[] = [];
    for (let off = 0; ; off += 500) {
      const { data, error } = await db.from("demandas").select(CAMPOS).eq("resolvido_setor", false).eq("resolvido_executiva", false).order("id").range(off, off + 499);
      if (error) { await registrarLog(db, log.id, {}, 0, "Falha ao ler reclamações", true); return json({ ok: false }, 500); }
      todas.push(...((data ?? []) as any[]).filter(elegivel));
      if ((data?.length ?? 0) < 500) break;
    }
    // Evita consultas desnecessárias: pula as consultadas nas últimas 20h sem alteração na reclamação.
    const { data: sit } = await db.from("demandas_cirurgia_situacao").select("demanda_id,consultado_em,situacao");
    const mapa = new Map((sit ?? []).map((s: any) => [s.demanda_id, s]));
    const limite = Date.now() - 20 * 3600 * 1000;
    const c: Record<string, number> = {};
    const pendentes = todas.filter((d: any) => {
      const s: any = mapa.get(d.id);
      const recente = s && s.situacao !== "erro" && new Date(s.consultado_em).getTime() > limite && new Date(s.consultado_em) >= new Date(d.updated_at);
      if (recente) c.ignoradas = (c.ignoradas ?? 0) + 1;
      return !recente;
    });
    const prazo = Date.now() + 120000;
    let feitas = 0;
    for (const d of pendentes) {
      if (Date.now() > prazo) break;
      await processar(db, [d], (x, h) => buscarAgenda(x.nome_cliente.trim(), h, key), c);
      feitas++;
    }
    await registrarLog(db, log.id, c, feitas, feitas < pendentes.length ? "Tempo esgotado; restantes ficam para a próxima execução" : null, true);
    return json({ ok: true, analisadas: feitas });
  }

  // ---- Varredura manual: usuário autenticado, respeitando o que ele pode ver ----
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: claimErr } = await user.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (claimErr || !uid) return json({ error: "Não autorizado" }, 401);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", uid).in("role", ["admin", "executivo", "executivo_externo"]);
  if (!roles?.length) return json({ error: "Acesso restrito" }, 403);

  if (body.acao === "iniciar") {
    const ids: string[] = [];
    const itens: { id: string; nome: string }[] = [];
    for (let off = 0; ; off += 500) {
      const { data, error } = await user.from("demandas").select(CAMPOS).eq("resolvido_setor", false).eq("resolvido_executiva", false).order("id").range(off, off + 499);
      if (error) return json({ error: "Falha ao ler reclamações" }, 500);
      for (const d of ((data ?? []) as any[]).filter(elegivel)) { ids.push(d.id); itens.push({ id: d.id, nome: d.nome_cliente ?? "" }); }
      if ((data?.length ?? 0) < 500) break;
    }
    const { data: log } = await db.from("demandas_cirurgia_varreduras").insert({ origem: "manual", usuario_id: uid }).select("id").single();
    return json({ ok: true, varredura_id: log?.id, ids, itens });
  }

  // "gravar": o navegador (rede interna Samel/VPN) consultou a agenda e envia os agendamentos
  // brutos; o servidor reclassifica com as mesmas regras e grava. "verificar": o servidor consulta.
  if (body.acao === "verificar" || body.acao === "gravar") {
    const gravar = body.acao === "gravar";
    const brutos = new Map<string, any[] | null>();
    if (gravar) {
      for (const it of (Array.isArray(body.itens) ? body.itens : []).slice(0, LOTE_MAX)) {
        if (typeof it?.id !== "string") continue;
        brutos.set(it.id, Array.isArray(it.agenda) ? it.agenda.slice(0, 2000).map(limparAgendamento) : null);
      }
    }
    const ids = gravar ? [...brutos.keys()]
      : Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, LOTE_MAX) : [];
    if (!ids.length) return json({ error: "Nenhuma reclamação informada" }, 400);
    // Relê pelo acesso do próprio usuário: só processa o que ele pode ver.
    const { data, error } = await user.from("demandas").select(CAMPOS).in("id", ids);
    if (error) return json({ error: "Falha ao ler reclamações" }, 500);
    const alvo = ((data ?? []) as any[]).filter(elegivel);
    const c: Record<string, number> = {};
    const obter: Obter = gravar
      ? async (d) => { const a = brutos.get(d.id); if (!a) throw new Error("Consulta no navegador falhou"); return a; }
      : (d, h) => buscarAgenda(d.nome_cliente.trim(), h, key);
    await processar(db, alvo, obter, c);
    if (typeof body.varredura_id === "string") {
      const { data: atual } = await db.from("demandas_cirurgia_varreduras").select("*").eq("id", body.varredura_id).eq("usuario_id", uid).maybeSingle();
      if (atual) {
        const soma = (k: string, v: string) => (atual[k] ?? 0) + (c[v] ?? 0);
        await db.from("demandas_cirurgia_varreduras").update({
          analisadas: atual.analisadas + alvo.length, agendadas: soma("agendadas", "agendada"), aguardando: soma("aguardando", "aguardando"),
          realizados: soma("realizados", "realizado"), cancelados: soma("cancelados", "cancelado"), validar: soma("validar", "validar"),
          erros: soma("erros", "erro"), atualizadas: soma("atualizadas", "atualizadas"),
          ...(body.ultimo ? { concluido_em: new Date().toISOString() } : {}),
        }).eq("id", body.varredura_id);
      }
    }
    return json({ ok: true, analisadas: alvo.length, contagem: c });
  }
  return json({ error: "Ação inválida" }, 400);
});
