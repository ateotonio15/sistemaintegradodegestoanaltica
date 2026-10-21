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
