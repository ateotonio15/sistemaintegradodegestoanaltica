// Estrutura lógica do processo único de análise de contratos.
// Etapa 1: apenas tipos, rótulos e helpers — não altera as telas existentes.

export type ProcessoSetor =
  | "comercial"
  | "documentos"
  | "analise_automatica"
  | "juridico"
  | "cadastro"
  | "financeiro"
  | "diretoria"
  | "concluido";

/** Status detalhado do fluxo de análise entre setores. */
export type ProcessoStatus =
  | "recebido"
  | "em_extracao"
  | "analise_automatica"
  | "aguardando_juridico"
  | "analise_juridica"
  | "pendencia_juridica"
  | "aguardando_cadastro"
  | "analise_cadastro"
  | "pendencia_cadastral"
  | "aguardando_financeiro"
  | "analise_financeira"
  | "pendencia_financeira"
  | "aguardando_documento_empresa"
  | "em_revisao"
  | "aprovado"
  | "aprovado_ressalva"
  | "reprovado"
  | "implantado";

export type ProcessoStatusGeral =
  | "aberto"
  | "em_andamento"
  | "aguardando_pendencia"
  | "concluido"
  | "cancelado";

export type ProcessoResultado =
  | "Em análise"
  | "Aprovado"
  | "Aprovado com ressalva"
  | "Reprovado"
  | "Implantado";

export interface ContratoProcesso {
  id: string;
  codigo: string;
  implantacao_id: string | null;
  empresa_id: string | null;
  nome_empresa: string | null;
  cnpj: string | null;
  status_geral: ProcessoStatusGeral;
  status: ProcessoStatus;
  setor_atual: ProcessoSetor;
  data_entrada_setor: string;
  proxima_acao: string | null;
  responsavel_atual_id: string | null;
  responsavel_atual_nome: string | null;
  pendencias_abertas: number;
  ultima_movimentacao_em: string;
  resultado_final: ProcessoResultado;
  observacao: string | null;
  created_by: string | null;
  created_by_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContratoProcessoMovimentacao {
  id: string;
  processo_id: string;
  acao: string;
  setor_origem: string | null;
  setor_destino: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  status_detalhado_anterior: string | null;
  status_detalhado_novo: string | null;
  resultado_anterior: string | null;
  resultado_novo: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  observacao: string | null;
  detalhes: Record<string, unknown>;
  user_id: string | null;
  user_nome: string | null;
  created_at: string;
}

export interface ContratoProcessoPendencia {
  id: string;
  processo_id: string;
  setor: ProcessoSetor;
  descricao: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  resolvida: boolean;
  resolvida_em: string | null;
  resolvida_por: string | null;
  resolvida_por_nome: string | null;
  created_by: string | null;
  created_by_nome: string | null;
  created_at: string;
  updated_at: string;
}

export const SETOR_LABEL: Record<ProcessoSetor, string> = {
  documentos: "Documentos",
  analise_automatica: "Análise automática",
  juridico: "Análise jurídica",
  cadastro: "Análise cadastral",
  financeiro: "Análise financeira",
  diretoria: "Diretoria",
  concluido: "Concluído",
};

export const SETOR_ORDEM: ProcessoSetor[] = [
  "documentos",
  "analise_automatica",
  "juridico",
  "cadastro",
  "financeiro",
  "diretoria",
  "concluido",
];

export const STATUS_GERAL_LABEL: Record<ProcessoStatusGeral, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_pendencia: "Aguardando pendência",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const RESULTADOS_FINAIS: ProcessoResultado[] = [
  "Em análise",
  "Aprovado",
  "Aprovado com ressalva",
  "Reprovado",
  "Implantado",
];

/** Classes de badge no padrão visual do sistema. */
export const RESULTADO_BADGE: Record<ProcessoResultado, string> = {
  "Em análise": "bg-blue-500/15 text-blue-600 border-blue-500/30",
  Aprovado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  "Aprovado com ressalva": "bg-amber-500/15 text-amber-600 border-amber-500/30",
  Reprovado: "bg-red-500/15 text-red-600 border-red-500/30",
  Implantado: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
};

export const STATUS_GERAL_BADGE: Record<ProcessoStatusGeral, string> = {
  aberto: "bg-muted text-muted-foreground border-border",
  em_andamento: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  aguardando_pendencia: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  concluido: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelado: "bg-red-500/15 text-red-600 border-red-500/30",
};

export function setorLabel(setor?: string | null) {
  return SETOR_LABEL[(setor || "") as ProcessoSetor] ?? "—";
}

export function statusGeralLabel(status?: string | null) {
  return STATUS_GERAL_LABEL[(status || "") as ProcessoStatusGeral] ?? "—";
}

/** Progresso (0-100) baseado na posição do setor atual no fluxo. */
export function progressoProcesso(setor?: string | null) {
  const idx = SETOR_ORDEM.indexOf((setor || "documentos") as ProcessoSetor);
  if (idx < 0) return 0;
  return Math.round((idx / (SETOR_ORDEM.length - 1)) * 100);
}

export const ACAO_LABEL: Record<string, string> = {
  processo_criado: "Processo criado",
  documento_anexado: "Documento anexado",
  analise_automatica: "Análise automática executada",
  encaminhado: "Encaminhado para outro setor",
  pendencia_aberta: "Pendência registrada",
  pendencia_resolvida: "Pendência resolvida",
  parecer_juridico: "Parecer jurídico registrado",
  parecer_cadastro: "Parecer cadastral registrado",
  parecer_financeiro: "Parecer financeiro registrado",
  aprovado: "Processo aprovado",
  aprovado_ressalva: "Aprovado com ressalva",
  reprovado: "Processo reprovado",
  implantado: "Contrato implantado",
};

export function acaoLabel(acao?: string | null) {
  if (!acao) return "—";
  return ACAO_LABEL[acao] ?? acao;
}
