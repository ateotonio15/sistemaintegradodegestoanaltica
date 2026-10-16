/**
 * Soma do total previsto da Previsão Financeira com deduplicação de
 * documentos compartilhados (item 3 do pacote).
 *
 * Contexto: movimentações de um mesmo Grupo Financeiro compartilham anexos
 * (expandirAnexosPorGrupo). Sem dedup, a mesma planilha apareceria na linha
 * de cada movimentação do grupo e o total contaria o documento duas vezes.
 *
 * Chave de dedup:
 * - conjunto ordenado de storage_path das planilhas + CNPJ do filtro de
 *   pagador da linha. Linhas da mesma movimentação com pagadores diferentes
 *   (linha-mãe × linha por pagador) têm filtros diferentes e NÃO são
 *   deduplicadas entre si — são fatias complementares do mesmo documento.
 * - Planilhas sem coluna de pagador (semSeparacaoPorPagador) devolvem o
 *   total agregado do documento para cada pagador: a chave ignora o filtro
 *   e o total conta uma única vez por conjunto de planilhas.
 *
 * Limites da chave:
 * - Dois anexos com o mesmo storage_path são o mesmo arquivo físico; se o
 *   usuário anexar intencionalmente o mesmo arquivo duas vezes como
 *   documentos distintos, o sistema contará uma vez só.
 * - Documentos legítimos distintos (paths diferentes) sempre somam.
 */

export interface ItemTotalPrevisto {
  xlsPaths: string[];
  /** CNPJ do filtro de pagador da linha (null = sem filtro/agregado). */
  cnpjFiltro: string | null;
  semSeparacaoPorPagador: boolean;
  totalGeral: number;
}

export function chaveDedupDocumento(item: ItemTotalPrevisto): string {
  const paths = [...item.xlsPaths].sort().join("|");
  if (item.semSeparacaoPorPagador) return `agregado::${paths}`;
  return `${paths}::${item.cnpjFiltro ?? ""}`;
}

/**
 * Soma os totais das linhas contando cada documento uma única vez por
 * pagador. Documentos compartilhados por movimentações do mesmo grupo
 * entram uma vez; documentos distintos somam normalmente.
 */
export function somarTotalPrevisto(itens: ItemTotalPrevisto[]): number {
  const vistos = new Set<string>();
  let total = 0;
  for (const item of itens) {
    const chave = chaveDedupDocumento(item);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    total += item.totalGeral;
  }
  return Number(total.toFixed(2));
}
