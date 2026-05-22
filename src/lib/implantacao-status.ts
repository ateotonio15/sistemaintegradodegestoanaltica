export type ImplStatus =
  | "em_implantacao"
  | "documentacao_pendente"
  | "em_analise_diretoria"
  | "aprovado_diretoria"
  | "enviado_cadastro"
  | "implantado"
  | "rejeitado"
  | "necessita_correcao"
  | "aguardando_documentos"
  | "em_validacao"
  | "pendente_ajuste";

export const STATUS_ORDER: ImplStatus[] = [
  "em_implantacao",
  "documentacao_pendente",
  "necessita_correcao",
  "em_analise_diretoria",
  "aprovado_diretoria",
  "enviado_cadastro",
  "implantado",
  "rejeitado",
];

export const STATUS_META: Record<string, { label: string; badge: string; gradient: string }> = {
  em_implantacao: {
    label: "Em implantação",
    badge: "bg-primary/10 text-primary border-primary/30",
    gradient: "from-primary to-primary/70",
  },
  documentacao_pendente: {
    label: "Documentação pendente",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    gradient: "from-amber-500 to-amber-600",
  },
  em_analise_diretoria: {
    label: "Contrato disponível para análise",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    gradient: "from-blue-500 to-blue-600",
  },
  aprovado_diretoria: {
    label: "Aprovado pela Diretoria",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    gradient: "from-emerald-500 to-emerald-600",
  },
  enviado_cadastro: {
    label: "Enviado ao Cadastro",
    badge: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
    gradient: "from-cyan-500 to-cyan-600",
  },
  implantado: {
    label: "Implantado",
    badge: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    gradient: "from-emerald-600 to-emerald-700",
  },
  rejeitado: {
    label: "Rejeitado",
    badge: "bg-red-500/10 text-red-600 border-red-500/30",
    gradient: "from-red-500 to-red-600",
  },
  necessita_correcao: {
    label: "Necessita correção",
    badge: "bg-amber-600/10 text-amber-700 border-amber-600/30",
    gradient: "from-amber-600 to-amber-700",
  },
  aguardando_documentos: {
    label: "Aguardando documentos",
    badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    gradient: "from-yellow-500 to-yellow-600",
  },
  em_validacao: {
    label: "Em validação",
    badge: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    gradient: "from-orange-500 to-orange-600",
  },
  pendente_ajuste: {
    label: "Pendente ajuste",
    badge: "bg-red-500/10 text-red-600 border-red-500/30",
    gradient: "from-red-500 to-red-600",
  },
};
