import { nomeMes } from "@/lib/reajuste-utils";
// Apenas apresentação: detalha como o retroativo já salvo foi formado.
// Não recalcula nem altera valores salvos.

export interface LinhaComposicaoRetro {
  competencia: string; // "Fev/2026"
  valorAtual: number;
  valorReajustado: number;
  diferenca: number;
}

export interface ComposicaoRetro {
  linhas: LinhaComposicaoRetro[];
  somaLinhas: number;
  totalSalvo: number;
  confere: boolean;
}

/** Competências = os N meses imediatamente anteriores ao mês de aplicação. */
export function comporRetroativo(params: {
  dataAplicacao: string | null | undefined;
  meses: number | null | undefined;
  valorAtual: number;
  valorReajustado: number;
  totalSalvo: number;
}): ComposicaoRetro | null {
  const n = Number(params.meses) || 0;
  const m = String(params.dataAplicacao ?? "").match(/^(\d{4})-(\d{2})/);
  if (n <= 0 || !m) return null;
  const idxAplic = parseInt(m[1], 10) * 12 + (parseInt(m[2], 10) - 1);
  const diferenca = Math.max(0, (params.valorReajustado || 0) - (params.valorAtual || 0));
  const linhas: LinhaComposicaoRetro[] = [];
  for (let i = n; i >= 1; i--) {
    const idx = idxAplic - i;
    const ano = Math.floor(idx / 12);
    const mes = (idx % 12) + 1;
    linhas.push({ competencia: `${nomeMes(mes)}/${ano}`, valorAtual: params.valorAtual, valorReajustado: params.valorReajustado, diferenca });
  }
  const somaLinhas = diferenca * n;
  return { linhas, somaLinhas, totalSalvo: params.totalSalvo || 0, confere: somaLinhas === (params.totalSalvo || 0) };
}
