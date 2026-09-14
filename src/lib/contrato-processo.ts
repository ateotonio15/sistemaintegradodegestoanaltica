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
  titulo: string;
  categoria: string;
  criticidade: string;
  status: string;
  observacao_resolucao: string | null;
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
  comercial: "Comercial",
  documentos: "Documentos",
  analise_automatica: "Análise automática",
  juridico: "Jurídico",
  cadastro: "Cadastro / Implantação",
  financeiro: "Financeiro",
  diretoria: "Diretoria",
  concluido: "Concluído",
};

export const SETOR_ORDEM: ProcessoSetor[] = [
  "comercial",
  "documentos",
  "analise_automatica",
  "juridico",
  "cadastro",
  "financeiro",
  "diretoria",
  "concluido",
];

/** Setores principais do fluxo (destinos de encaminhamento). */
export const SETORES_PRINCIPAIS: ProcessoSetor[] = [
  "comercial",
  "juridico",
  "cadastro",
  "financeiro",
  "concluido",
];

export const STATUS_LABEL: Record<ProcessoStatus, string> = {
  recebido: "Recebido",
  em_extracao: "Em extração",
  analise_automatica: "Em análise automática",
  aguardando_juridico: "Aguardando Jurídico",
  analise_juridica: "Em análise Jurídica",
  pendencia_juridica: "Pendência Jurídica",
  aguardando_cadastro: "Aguardando Cadastro",
  analise_cadastro: "Em análise pelo Cadastro",
  pendencia_cadastral: "Pendência Cadastral",
  aguardando_financeiro: "Aguardando Financeiro",
  analise_financeira: "Em análise Financeira",
  pendencia_financeira: "Pendência Financeira",
  aguardando_documento_empresa: "Aguardando documento da empresa",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  aprovado_ressalva: "Aprovado com ressalva",
  reprovado: "Reprovado",
  implantado: "Implantado",
};

export const STATUS_ORDEM: ProcessoStatus[] = Object.keys(STATUS_LABEL) as ProcessoStatus[];

/** Classes de badge por status, no padrão visual do sistema. */
export const STATUS_BADGE: Record<ProcessoStatus, string> = {
  recebido: "bg-muted text-muted-foreground border-border",
  em_extracao: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  analise_automatica: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  aguardando_juridico: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  analise_juridica: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  pendencia_juridica: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  aguardando_cadastro: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  analise_cadastro: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  pendencia_cadastral: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  aguardando_financeiro: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  analise_financeira: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  pendencia_financeira: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  aguardando_documento_empresa: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  em_revisao: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  aprovado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  aprovado_ressalva: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  reprovado: "bg-red-500/15 text-red-600 border-red-500/30",
  implantado: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
};

/** Status sugeridos para cada setor destino ao encaminhar. */
export const STATUS_POR_SETOR: Record<ProcessoSetor, ProcessoStatus[]> = {
  comercial: ["recebido", "em_extracao", "analise_automatica", "aguardando_documento_empresa"],
  documentos: ["recebido", "em_extracao", "aguardando_documento_empresa"],
  analise_automatica: ["analise_automatica", "em_extracao"],
  juridico: ["aguardando_juridico", "analise_juridica", "pendencia_juridica"],
  cadastro: ["aguardando_cadastro", "analise_cadastro", "pendencia_cadastral"],
  financeiro: ["aguardando_financeiro", "analise_financeira", "pendencia_financeira"],
  diretoria: ["em_revisao", "aprovado", "aprovado_ressalva", "reprovado"],
  concluido: ["aprovado", "aprovado_ressalva", "reprovado", "implantado"],
};

export function statusLabel(status?: string | null) {
  return STATUS_LABEL[(status || "") as ProcessoStatus] ?? "—";
}

export function statusBadge(status?: string | null) {
  return STATUS_BADGE[(status || "") as ProcessoStatus] ?? "bg-muted text-muted-foreground border-border";
}

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
  processo_criado: "Contrato criado",
  documento_anexado: "Documento anexado",
  documento_substituido: "Documento substituído",
  documento_complementar: "Documento complementar recebido",
  extracao_iniciada: "Extração iniciada",
  extracao_concluida: "Extração concluída",
  analise_ia_concluida: "Análise da IA concluída",
  analise_automatica: "Análise automática executada",
  validacao_cruzada: "Validação cruzada executada",
  divergencia_encontrada: "Divergência encontrada",
  encaminhado: "Encaminhado para outro setor",
  responsavel_alterado: "Responsável alterado",
  comentario: "Comentário registrado",
  observacao_cadastro: "Observação do Cadastro",

  correcao: "Correção registrada",
  pendencia_aberta: "Pendência criada",
  pendencia_atualizada: "Pendência atualizada",
  pendencia_resolvida: "Pendência resolvida",
  pendencia_cancelada: "Pendência cancelada",
  parecer_juridico: "Análise jurídica concluída",
  parecer_cadastro: "Análise cadastral concluída",
  parecer_financeiro: "Análise financeira concluída",
  resultado_alterado: "Resultado atualizado",
  aprovado: "Contrato aprovado",
  aprovado_ressalva: "Contrato aprovado com ressalva",
  reprovado: "Contrato reprovado",
  implantado: "Contrato implantado",
};

/** Cor do marcador da linha do tempo por tipo de evento. */
export const ACAO_TOM: Record<string, string> = {
  processo_criado: "bg-sky-500",
  documento_anexado: "bg-blue-500",
  documento_substituido: "bg-blue-500",
  documento_complementar: "bg-blue-500",
  extracao_iniciada: "bg-indigo-400",
  extracao_concluida: "bg-indigo-500",
  analise_ia_concluida: "bg-violet-500",
  analise_automatica: "bg-violet-500",
  validacao_cruzada: "bg-violet-500",
  divergencia_encontrada: "bg-red-500",
  encaminhado: "bg-primary",
  responsavel_alterado: "bg-cyan-500",
  comentario: "bg-muted-foreground",
  correcao: "bg-amber-500",
  pendencia_aberta: "bg-amber-500",
  pendencia_atualizada: "bg-amber-500",
  pendencia_resolvida: "bg-emerald-500",
  pendencia_cancelada: "bg-muted-foreground",
  parecer_juridico: "bg-emerald-500",
  parecer_cadastro: "bg-emerald-500",
  parecer_financeiro: "bg-emerald-500",
  aprovado: "bg-emerald-600",
  aprovado_ressalva: "bg-amber-500",
  reprovado: "bg-red-600",
  implantado: "bg-emerald-600",
};

export function acaoTom(acao?: string | null) {
  if (!acao) return "bg-muted-foreground";
  return ACAO_TOM[acao] ?? "bg-muted-foreground";
}

export function acaoLabel(acao?: string | null) {
  if (!acao) return "—";
  return ACAO_LABEL[acao] ?? acao;
}

// ============ Gestão de pendências ============

export type PendenciaCategoria =
  | "Jurídica"
  | "Cadastral"
  | "Financeira"
  | "Documental"
  | "Divergência de dados"
  | "Assinatura"
  | "Vigência"
  | "Elegibilidade"
  | "Outros";

export type PendenciaCriticidade = "Baixa" | "Média" | "Alta" | "Crítica";

export type PendenciaStatus =
  | "Aberta"
  | "Em análise"
  | "Aguardando documento"
  | "Resolvida"
  | "Cancelada";

export const PENDENCIA_CATEGORIAS: PendenciaCategoria[] = [
  "Jurídica",
  "Cadastral",
  "Financeira",
  "Documental",
  "Divergência de dados",
  "Assinatura",
  "Vigência",
  "Elegibilidade",
  "Outros",
];

export const PENDENCIA_CRITICIDADES: PendenciaCriticidade[] = ["Baixa", "Média", "Alta", "Crítica"];

export const PENDENCIA_STATUS_LISTA: PendenciaStatus[] = [
  "Aberta",
  "Em análise",
  "Aguardando documento",
  "Resolvida",
  "Cancelada",
];

export const PENDENCIA_CRITICIDADE_BADGE: Record<PendenciaCriticidade, string> = {
  Baixa: "bg-muted text-muted-foreground border-border",
  Média: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  Alta: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  Crítica: "bg-red-500/15 text-red-600 border-red-500/30",
};

export const PENDENCIA_STATUS_BADGE: Record<PendenciaStatus, string> = {
  Aberta: "bg-red-500/15 text-red-600 border-red-500/30",
  "Em análise": "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "Aguardando documento": "bg-orange-500/15 text-orange-600 border-orange-500/30",
  Resolvida: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Cancelada: "bg-muted text-muted-foreground border-border",
};

/** Setor responsável sugerido por categoria (regras de direcionamento). */
export const SETOR_POR_CATEGORIA: Record<PendenciaCategoria, ProcessoSetor> = {
  Jurídica: "juridico",
  Assinatura: "juridico",
  Vigência: "juridico",
  Elegibilidade: "juridico",
  Cadastral: "cadastro",
  "Divergência de dados": "cadastro",
  Financeira: "financeiro",
  Documental: "documentos",
  Outros: "comercial",
};

/** Motivos padronizados e o setor responsável (regras de direcionamento). */
export const MOTIVOS_PENDENCIA: {
  motivo: string;
  categoria: PendenciaCategoria;
  setor: ProcessoSetor;
}[] = [
  { motivo: "Vínculo não comprovado", categoria: "Jurídica", setor: "juridico" },
  { motivo: "Exclusividade não comprovada", categoria: "Jurídica", setor: "juridico" },
  { motivo: "Modalidade PJ duvidosa", categoria: "Jurídica", setor: "juridico" },
  { motivo: "Contrato vencido", categoria: "Vigência", setor: "juridico" },
  { motivo: "Vigência incompatível", categoria: "Vigência", setor: "juridico" },
  { motivo: "Assinatura ausente", categoria: "Assinatura", setor: "juridico" },
  { motivo: "Cláusula incompatível", categoria: "Jurídica", setor: "juridico" },
  { motivo: 'Modalidade "Pejotizada vinculada à Futura" não comprovada', categoria: "Elegibilidade", setor: "juridico" },
  { motivo: "CNPJ ausente", categoria: "Cadastral", setor: "cadastro" },
  { motivo: "Nome da empresa divergente", categoria: "Divergência de dados", setor: "cadastro" },
  { motivo: "Grupo/contrato ausente", categoria: "Cadastral", setor: "cadastro" },
  { motivo: "Início de atendimento ausente", categoria: "Cadastral", setor: "cadastro" },
  { motivo: "Quantidade de vidas ausente", categoria: "Cadastral", setor: "cadastro" },
  { motivo: "Informações cadastrais divergentes", categoria: "Divergência de dados", setor: "cadastro" },
  { motivo: "Valores divergentes", categoria: "Financeira", setor: "financeiro" },
  { motivo: "Honorários divergentes", categoria: "Financeira", setor: "financeiro" },
  { motivo: "Valor de plano incompatível", categoria: "Financeira", setor: "financeiro" },
  { motivo: "Necessidade de validação financeira", categoria: "Financeira", setor: "financeiro" },
  { motivo: "Documento ausente", categoria: "Documental", setor: "documentos" },
  { motivo: "Documento ilegível", categoria: "Documental", setor: "documentos" },
  { motivo: "Documento incompleto", categoria: "Documental", setor: "documentos" },
];

export function pendenciaEmAberto(status?: string | null) {
  return status !== "Resolvida" && status !== "Cancelada";
}
