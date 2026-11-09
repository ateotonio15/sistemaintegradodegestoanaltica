/** Classificações comerciais aceitas para um contrato. Fonte única da lista. */
export const CLASSIFICACAO_OPTIONS = [
  "Empresarial",
  "Empresarial Copart. - Total",
  "Empresarial Copart. - Parcial",
] as const;

export type ClassificacaoContrato = (typeof CLASSIFICACAO_OPTIONS)[number];

/** Valor de reserva para a opção "Sem classificação": Radix não aceita item com valor vazio. */
export const SEM_CLASSIFICACAO = "__sem_classificacao__";

/**
 * Converte o valor do formulário no que vai para o banco:
 * escolha vazia (ou "Sem classificação") guarda nulo, nunca texto vazio.
 */
export function normalizarClassificacao(valor: unknown): ClassificacaoContrato | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto || texto === SEM_CLASSIFICACAO) return null;
  return CLASSIFICACAO_OPTIONS.find((opt) => opt === texto) ?? null;
}
