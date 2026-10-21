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
  return data as T;
}

export const listarAgendamentos = (filtros: FiltrosAgenda) => chamar<RespostaAgenda>({ acao: "listar", filtros });
export const detalharAgendamento = (nr: number | string) => chamar<any>({ acao: "detalhe", nr_sequencia: String(nr) });
export const healthAgenda = () => chamar<any>({ acao: "health" });

/** AAAA-MM-DD → DD/MM/AAAA */
export const isoParaBr = (s: string) => (s ? s.split("-").reverse().join("/") : "");

// ---------------------------------------------------------------------------
// Modo DIRETO: o navegador chama a API da Samel sem passar pelo nosso servidor.
// Só funciona dentro da rede interna da Samel ou com a VPN ligada.
// A chave é informada na tela e guardada apenas na sessão do navegador
// (sessionStorage) — nunca no código nem no banco.
// ---------------------------------------------------------------------------

export const AGENDA_API_BASE_DIRETO = "https://api-agenda-cirurgica.samel.com.br/api/integracao";
const CHAVE_SESSAO = "agenda_cirurgica_api_key";

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

export const listarAgendamentosDireto = (filtros: FiltrosAgenda, chave: string) =>
  chamarDireto<RespostaAgenda>(`${AGENDA_API_BASE_DIRETO}/agendamentos?${montarQueryListagem(filtros)}`, chave);

export const detalharAgendamentoDireto = (nr: number | string, chave: string) =>
  chamarDireto<any>(`${AGENDA_API_BASE_DIRETO}/agendamentos/${nr}`, chave);

export const healthAgendaDireto = () =>
  chamarDireto<any>(`${AGENDA_API_BASE_DIRETO}/health`, lerChaveDireta());
