// Apresentação somente leitura das faixas etárias salvas na empresa.
// Não recalcula, não altera e não persiste valores: apenas organiza a exibição.

export type FaixaEtariaValor = {
  ini: number;
  fim: number | null | undefined;
  centavos: number | null | undefined;
};

/** Ordena por idade inicial e remove faixas sem valor preenchido. */
export function ordenarFaixasEtarias(
  faixas: FaixaEtariaValor[] | null | undefined,
): FaixaEtariaValor[] {
  return (Array.isArray(faixas) ? faixas : [])
    .filter((f) => f && Number(f.centavos ?? 0) > 0)
    .sort(
      (a, b) =>
        Number(a.ini) - Number(b.ini) ||
        (Number(a.fim ?? 999) - Number(b.fim ?? 999)),
    );
}

/** Primeira faixa (a mais nova) ou null quando não há faixas com valor. */
export function primeiraFaixaEtaria(
  faixas: FaixaEtariaValor[] | null | undefined,
): FaixaEtariaValor | null {
  return ordenarFaixasEtarias(faixas)[0] ?? null;
}

/** Quantas faixas com valor existem. */
export function totalFaixasEtarias(
  faixas: FaixaEtariaValor[] | null | undefined,
): number {
  return ordenarFaixasEtarias(faixas).length;
}
