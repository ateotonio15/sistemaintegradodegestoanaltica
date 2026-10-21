import { supabase } from "@/integrations/supabase/client";

export type AgendamentoCirurgico = {
  nr_sequencia: number;
  dt_agenda: string;
  hr_inicio: string;
  hr_fim: string;
  status?: { codigo?: string; descricao?: string } | null;
  sala?: { ds_agenda?: string } | null;
  paciente?: { nm_paciente?: string; nr_cpf?: string; dt_nascimento?: string; nr_idade?: number; ie_sexo?: string; nr_celular?: string } | null;
  medico?: { nm_medico?: string; nr_crm?: string; uf_crm?: string; nm_anestesista?: string } | null;
  procedimento_principal?: { codigo?: string | number; descricao?: string } | null;
  procedimentos?: Array<{ codigo?: string | number; descricao?: string }> | null;
  convenio?: { ds_convenio?: string; ds_plano?: string; cd_senha_autorizacao?: string } | null;
  atendimento?: { nr_atendimento?: string | number } | null;
  acomodacao?: { ds_tipo_acomodacao?: string } | null;
};

export type FiltrosAgenda = {
  dt_inicio?: string; dt_fim?: string; cd_agenda?: string; cd_medico?: string; cd_convenio?: string;
  cd_estabelecimento?: string; nm_paciente?: string; nm_empresa?: string; ie_status_agenda?: string;
  page?: number; limit?: number;
};

export type RespostaAgenda = {
  sucesso: boolean; total: number; pagina: number; limite: number; total_paginas: number;
  filtros_aplicados: Record<string, unknown>; dados: AgendamentoCirurgico[];
};

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("agenda-cirurgica-proxy", { body });
  if (error) {
    let msg = "Não foi possível consultar a agenda cirúrgica.";
    try { const j = await (error as any).context?.json?.(); if (j?.mensagem || j?.message) msg = j.mensagem ?? j.message; } catch { /* ignore */ }
    throw new Error(msg);
  }
  // Falhas controladas do proxy (ex.: API inalcançável) chegam com HTTP 200 e sucesso=false.
  if (data && typeof data === "object" && (data as any).sucesso === false) {
    throw new Error((data as any).mensagem ?? "Não foi possível consultar a agenda cirúrgica.");
  }
  return data as T;
}

export const listarAgendamentos = (filtros: FiltrosAgenda) => chamar<RespostaAgenda>({ acao: "listar", filtros });
export const detalharAgendamento = (nr: number | string) => chamar<any>({ acao: "detalhe", nr_sequencia: String(nr) });
export const healthAgenda = () => chamar<any>({ acao: "health" });

export interface PendenteProcedimentoItem {
  cd_pessoa_fisica: string;
  nm_paciente: string;
  cd_procedimento: number;
  ds_procedimento: string;
  nr_atendimento: number | null;
  dt_agenda: string;
  dt_agendamento: string;
  ie_autorizacao: string;
  ie_status_agenda: string;
  dias_para_execucao: number;
  empresa: string;
  cd_cgc_estipulante: string | null;
}
export interface FiltrosPendentes { dt_inicio: string; dt_final: string; cd_cgc?: string; cd_procedimento?: string }
export interface RelatorioPendentesResponse {
  sucesso: boolean;
  dados: PendenteProcedimentoItem[];
  total: number;
  media_dias_geral: string;
  filtros: { dt_inicio: string; dt_final: string; cd_cgc: string; cd_procedimento: string };
}
export const listarProcedimentosPendentes = (filtros: FiltrosPendentes) =>
  chamar<RelatorioPendentesResponse>({ acao: "pendentes", filtros });

/** AAAA-MM-DD → DD/MM/AAAA */
export const isoParaBr = (s: string) => (s ? s.split("-").reverse().join("/") : "");

// ---------------------------------------------------------------------------
// Modo DIRETO: o navegador chama a API da Samel sem passar pelo nosso servidor.
// Só funciona dentro da rede interna da Samel ou com a VPN ligada.
// A chave é informada na tela e guardada apenas na sessão do navegador
// (sessionStorage) — nunca no código nem no banco.
// ---------------------------------------------------------------------------

export type ServidorAgenda = "producao" | "localhost" | "personalizada";
export const SERVIDORES_AGENDA: Record<Exclude<ServidorAgenda, "personalizada">, string> = {
  producao: "https://api-agenda-cirurgica.samel.com.br/api",
  localhost: "http://localhost:5000/api",
};
const SERVIDOR_KEY = "agenda_cirurgica_servidor";
const CHAVE_SESSAO = "agenda_cirurgica_api_key";

export interface ConfigServidorAgenda { tipo: ServidorAgenda; url: string }

export const normalizarBaseAgenda = (url: string): string => url.trim().replace(/\/+$/, "").replace(/\/integracao$/, "");

export const lerServidorAgenda = (): ConfigServidorAgenda => {
  try {
    const c = JSON.parse(localStorage.getItem(SERVIDOR_KEY) ?? "null");
    if (c && (c.tipo === "producao" || c.tipo === "localhost" || c.tipo === "personalizada") && typeof c.url === "string") return c;
  } catch { /* ignore */ }
  return { tipo: "producao", url: SERVIDORES_AGENDA.producao };
};
export const salvarServidorAgenda = (c: ConfigServidorAgenda) => {
  try { localStorage.setItem(SERVIDOR_KEY, JSON.stringify({ tipo: c.tipo, url: normalizarBaseAgenda(c.url) })); } catch { /* ignore */ }
};
const baseDireta = () => `${normalizarBaseAgenda(lerServidorAgenda().url) || SERVIDORES_AGENDA.producao}/integracao`;

export const lerChaveDireta = (): string => {
  try { return sessionStorage.getItem(CHAVE_SESSAO) ?? ""; } catch { return ""; }
};
export const salvarChaveDireta = (chave: string) => {
  try {
    if (chave) sessionStorage.setItem(CHAVE_SESSAO, chave);
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch { /* ignore */ }
};

async function chamarDireto<T>(url: string, chave: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { headers: { Accept: "application/json", "x-api-key": chave } });
  } catch {
    throw new Error(
      "Sem resposta da API. Confirme se você está na rede interna da Samel ou com a VPN ligada. " +
      "Se estiver, a API pode estar bloqueando chamadas do navegador (CORS) — nesse caso avise a TI da Samel."
    );
  }
  const texto = await r.text();
  let corpo: any = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    const msg = corpo?.mensagem ?? corpo?.message ?? `A API respondeu com erro ${r.status}.`;
    throw new Error(r.status === 401 || r.status === 403 ? `${msg} Verifique a chave informada.` : msg);
  }
  return corpo as T;
}

function montarQueryListagem(f: FiltrosAgenda): string {
  const p = new URLSearchParams();
  const add = (k: string, v?: string) => { if (v && v.trim()) p.set(k, v.trim()); };
  add("dt_inicio", f.dt_inicio); add("dt_fim", f.dt_fim);
  add("cd_agenda", f.cd_agenda?.replace(/\s/g, "")); add("cd_medico", f.cd_medico);
  add("cd_convenio", f.cd_convenio); add("cd_estabelecimento", f.cd_estabelecimento);
  add("nm_paciente", f.nm_paciente); add("nm_empresa", f.nm_empresa);
  add("ie_status_agenda", f.ie_status_agenda);
  p.set("page", String(Math.max(1, f.page ?? 1)));
  p.set("limit", String(Math.min(500, Math.max(1, f.limit ?? 50))));
  return p.toString();
}

export const listarProcedimentosPendentesDireto = async (filtros: FiltrosPendentes, chave: string) => {
  const p = new URLSearchParams({
    dt_inicio: filtros.dt_inicio, dt_final: filtros.dt_final,
    cd_cgc: filtros.cd_cgc || "0", cd_procedimento: filtros.cd_procedimento || "0",
  });
  const base = normalizarBaseAgenda(lerServidorAgenda().url) || SERVIDORES_AGENDA.producao;
  const r = await chamarDireto<RelatorioPendentesResponse & { sucesso?: boolean; mensagem?: string }>(`${base}/relatorio/procedimentos-pendentes-empresa?${p}`, chave);
  if (r && r.sucesso === false) throw new Error(r.mensagem ?? "A API não retornou os pendentes.");
  return r;
};

export const listarAgendamentosDireto = (filtros: FiltrosAgenda, chave: string) =>
  chamarDireto<RespostaAgenda>(`${baseDireta()}/agendamentos?${montarQueryListagem(filtros)}`, chave);

export const detalharAgendamentoDireto = (nr: number | string, chave: string) =>
  chamarDireto<any>(`${baseDireta()}/agendamentos/${encodeURIComponent(String(nr))}`, chave);

export const healthAgendaDireto = () =>
  chamarDireto<any>(`${baseDireta()}/health`, lerChaveDireta());
