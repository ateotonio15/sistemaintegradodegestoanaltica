// Regras e constantes do módulo Passageiros Uber.
// A lista de motivos é a ÚNICA fonte — o formulário de corridas e o cadastro
// de passageiros importam daqui para nunca divergir.

export const UBER_MOTIVOS = [
  "Plantão de Atendimento",
  "Envio de Material",
  "Técnica Honda",
  "Coleta de Preventivo",
  "Coleta de PSA",
  "Ação de Saúde",
  "Palestra",
  "Coleta de sangue",
  "Taxa cancelamento",
  "Implantação",
  "Treinamento Portal",
  "Integração",
  "Gravação da Palestra",
] as const;

export const UBER_TIPOS_PADRAO = ["Ida", "Volta"] as const;

export interface UberPassageiro {
  id: string;
  nome: string;
  setor: string;
  endereco: string;
  whatsapp: string;
  funcao_id: string | null;
  ativo: boolean;
  tem_corrida_padrao: boolean;
  usar_endereco_origem: boolean;
  origem_padrao: string | null;
  tipo_padrao: string | null;
  motivo_padrao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PassageiroForm = Partial<
  Pick<
    UberPassageiro,
    | "nome"
    | "setor"
    | "endereco"
    | "whatsapp"
    | "funcao_id"
    | "ativo"
    | "tem_corrida_padrao"
    | "usar_endereco_origem"
    | "origem_padrao"
    | "tipo_padrao"
    | "motivo_padrao"
  >
>;

/** Retorna a mensagem de erro (pt-BR) ou null quando o cadastro é válido. */
export function validarPassageiro(p: PassageiroForm): string | null {
  if (!p.nome?.trim()) return "Informe o nome completo do passageiro.";
  if (!p.setor?.trim()) return "Informe o setor do passageiro.";
  if (!p.endereco?.trim()) return "Informe o endereço do passageiro.";
  if (!p.whatsapp?.trim()) return "Informe o WhatsApp do passageiro.";
  if (p.tem_corrida_padrao) {
    if (!p.tipo_padrao) return "Com a corrida padrão ligada, informe o tipo padrão (Ida ou Volta).";
    if (!p.motivo_padrao) return "Com a corrida padrão ligada, informe o motivo padrão.";
    if (p.usar_endereco_origem === false && !p.origem_padrao?.trim()) {
      return "Informe a origem padrão ou marque \"Usar o endereço cadastrado como origem\".";
    }
  }
  return null;
}

/**
 * Prepara o objeto para salvar: com o toggle de corrida padrão desligado,
 * limpa todos os campos de padrão (voltando "usar endereço" ao padrão ligado).
 */
export function normalizarPassageiroParaSalvar(p: PassageiroForm): PassageiroForm {
  const base: PassageiroForm = {
    ...p,
    nome: p.nome?.trim(),
    setor: p.setor?.trim(),
    endereco: p.endereco?.trim(),
    whatsapp: p.whatsapp?.trim(),
    ativo: p.ativo !== false,
    funcao_id: p.funcao_id || null,
  };
  if (!base.tem_corrida_padrao) {
    return {
      ...base,
      usar_endereco_origem: true,
      origem_padrao: null,
      tipo_padrao: null,
      motivo_padrao: null,
    };
  }
  return {
    ...base,
    usar_endereco_origem: base.usar_endereco_origem !== false,
    origem_padrao: base.usar_endereco_origem === false ? base.origem_padrao?.trim() || null : null,
  };
}

/** Resumo curto da corrida padrão para a listagem (ex.: "Ida · Plantão de Atendimento"). */
export function resumoCorridaPadrao(p: Pick<UberPassageiro, "tem_corrida_padrao" | "tipo_padrao" | "motivo_padrao">): string {
  if (!p.tem_corrida_padrao) return "—";
  return [p.tipo_padrao, p.motivo_padrao].filter(Boolean).join(" · ") || "—";
}

/** Origem que a corrida padrão sugere para o formulário de nova corrida. */
export function origemSugeridaPeloPadrao(
  p: Pick<UberPassageiro, "tem_corrida_padrao" | "usar_endereco_origem" | "origem_padrao" | "endereco">,
): string | null {
  if (!p.tem_corrida_padrao) return null;
  return p.usar_endereco_origem ? p.endereco : p.origem_padrao;
}

export interface CorridaParaVolta {
  origem: string | null;
  destino: string | null;
  tipo: string | null;
}

/**
 * Monta os campos invertidos para o botão "Salvar e criar volta":
 * origem/destino trocados, Ida vira Volta e vice-versa, horário limpo.
 */
export function montarCorridaVolta(c: CorridaParaVolta): { origem: string | null; destino: string | null; tipo: string | null; horario: null } {
  const tipoInvertido = c.tipo === "Ida" ? "Volta" : c.tipo === "Volta" ? "Ida" : c.tipo;
  return {
    origem: c.destino,
    destino: c.origem,
    tipo: tipoInvertido,
    horario: null,
  };
}

/** Busca passageiro ativo pelo nome exato (ignorando maiúsculas e espaços). */
export function encontrarPassageiroPorNome(
  passageiros: Pick<UberPassageiro, "nome" | "ativo">[],
  nome: string | null | undefined,
): boolean {
  const alvo = (nome ?? "").trim().toLowerCase();
  if (!alvo) return false;
  return passageiros.some((p) => p.ativo && p.nome.trim().toLowerCase() === alvo);
}
