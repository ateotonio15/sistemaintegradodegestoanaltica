// Constantes do formulário de Demandas / Reclamações
// Cascata: Setor responsável → Tipo de reclamação → Reclamação

export const SETORES = [
  "Agenda Cirúrgica",
  "Atendimento",
  "Auditoria",
  "Cadastro",
  "Clínica Externa",
  "Direção Clínica",
  "Financeiro",
  "T.I",
];

export const TIPOS = [
  "Aplicativo Samel",
  "Aprazamento",
  "Cancelamento",
  "Assistencial",
  "Conduta Médica",
  "Falha Cadastral",
  "Nota Fiscal",
  "Portal",
  "Reclamação",
  "T.I",
];

// Lista geral (fallback final)
export const RECLAMACOES = [
  "Aprazamento cirúrgico",
  "Aprazamento de consulta",
  "Aprazamento de exame",
  "Aprazamento de medicação",
  "Aprazamento de neuro pediatra",
  "Aprazamento de ortopedista",
  "Aprazamento de terapia adulto",
  "Aprazamento de terapia infantil",
  "Aprazamento fisioterapia ortopédica",
  "Aprazamento fisioterapia pediátrica",
  "Cancelamento cirúrgico",
  "Cancelamento de consulta",
  "Cancelamento de exame",
  "Cancelamento de terapia adulto",
  "Atraso na emissão da nota",
  "Atraso na medicação",
  "Despreparo assistencial",
  "Falha de processo",
  "Indisponibilidade de dados",
  "Telemedicina",
  "Aplicativo",
];

// Fallback por tipo (chave = tipo)
export const RECLAMACOES_POR_TIPO: Record<string, string[]> = {
  "Aprazamento": [
    "Aprazamento cirúrgico",
    "Aprazamento de consulta",
    "Aprazamento de exame",
    "Aprazamento de neuro pediatra",
    "Aprazamento de ortopedista",
    "Aprazamento de terapia adulto",
    "Aprazamento de terapia infantil",
    "Aprazamento fisioterapia ortopédica",
    "Aprazamento fisioterapia pediátrica",
  ],
  "Cancelamento": [
    "Cancelamento cirúrgico",
    "Cancelamento de consulta",
    "Cancelamento de exame",
    "Cancelamento de terapia adulto",
  ],
  "Nota Fiscal": ["Atraso na emissão da nota"],
  "Assistencial": ["Atraso na medicação", "Despreparo assistencial"],
  "Conduta Médica": ["Despreparo assistencial"],
  "Aplicativo Samel": ["Aplicativo", "Indisponibilidade de dados"],
  "Portal": ["Indisponibilidade de dados", "Falha de processo"],
  "Falha Cadastral": ["Falha de processo"],
  "T.I": ["Indisponibilidade de dados", "Telemedicina"],
  "Reclamação": [...RECLAMACOES],
};

// Lista mais específica (chave = setor → tipo)
export const RECLAMACOES_POR_SETOR_TIPO: Record<string, Record<string, string[]>> = {
  "Agenda Cirúrgica": {
    "Aprazamento": ["Aprazamento cirúrgico"],
    "Cancelamento": ["Cancelamento cirúrgico"],
  },
  "Atendimento": {
    "Aprazamento": [
      "Aprazamento de consulta",
      "Aprazamento de exame",
      "Aprazamento de terapia adulto",
      "Aprazamento de terapia infantil",
    ],
    "Cancelamento": [
      "Cancelamento de consulta",
      "Cancelamento de exame",
      "Cancelamento de terapia adulto",
    ],
  },
  "Clínica Externa": {
    "Aprazamento": [
      "Aprazamento de consulta",
      "Aprazamento de neuro pediatra",
      "Aprazamento de ortopedista",
      "Aprazamento fisioterapia ortopédica",
      "Aprazamento fisioterapia pediátrica",
    ],
  },
  "Financeiro": {
    "Nota Fiscal": ["Atraso na emissão da nota"],
  },
  "Direção Clínica": {
    "Assistencial": ["Despreparo assistencial", "Atraso na medicação"],
    "Conduta Médica": ["Despreparo assistencial"],
  },
  "Cadastro": {
    "Falha Cadastral": ["Falha de processo"],
  },
  "T.I": {
    "T.I": ["Indisponibilidade de dados", "Telemedicina"],
    "Aplicativo Samel": ["Aplicativo", "Indisponibilidade de dados"],
    "Portal": ["Indisponibilidade de dados", "Falha de processo"],
  },
};

/**
 * Resolve as opções de Reclamação seguindo a prioridade:
 * 1) RECLAMACOES_POR_SETOR_TIPO[setor][tipo]
 * 2) RECLAMACOES_POR_TIPO[tipo]
 * 3) RECLAMACOES (lista geral)
 */
export function getReclamacoesDisponiveis(setor?: string | null, tipo?: string | null): string[] {
  if (setor && tipo) {
    const especifica = RECLAMACOES_POR_SETOR_TIPO[setor]?.[tipo];
    if (especifica && especifica.length) return especifica;
  }
  if (tipo) {
    const porTipo = RECLAMACOES_POR_TIPO[tipo];
    if (porTipo && porTipo.length) return porTipo;
  }
  return [...RECLAMACOES];
}

/** Normaliza variações textuais comuns para o valor canônico. */
export function normalizarReclamacao(v: string | null | undefined): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const canonical = RECLAMACOES.find(
    (r) =>
      r
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "") === key,
  );
  return canonical ?? raw;
}

export const RECLAMACOES_CIRURGICAS = ["Aprazamento cirúrgico", "Cancelamento cirúrgico"];
export function isReclamacaoCirurgica(reclamacao: string | null | undefined): boolean {
  const norm = normalizarReclamacao(reclamacao);
  return RECLAMACOES_CIRURGICAS.includes(norm);
}
