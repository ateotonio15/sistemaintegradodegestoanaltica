// Regra: contratos isentos de reajuste (ex.: permuta) não entram na tela de
// Reajustes nem são importados da API da operadora.
export type SituacaoReajusteOperadora = "novo" | "registrado" | "nao_encontrado" | "isento";

export function empresaIsentaReajuste(
  empresa: { isento_reajuste?: boolean | null } | null | undefined,
): boolean {
  return !!empresa?.isento_reajuste;
}

/** Situação de um reajuste devolvido pela API da operadora. */
export function classificarReajusteOperadora(opts: {
  empresaId: string | null;
  isento: boolean;
  jaRegistrado: boolean;
}): SituacaoReajusteOperadora {
  if (!opts.empresaId) return "nao_encontrado";
  if (opts.isento) return "isento";
  return opts.jaRegistrado ? "registrado" : "novo";
}

/** true quando o reajuste da API deve ser registrado (o isento fica de fora). */
export function podeImportarReajusteOperadora(situacao: SituacaoReajusteOperadora): boolean {
  return situacao === "novo";
}
