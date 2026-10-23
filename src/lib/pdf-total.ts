import type { ComparacaoResultado, ComparacaoSimplificada } from "./excel-analysis-utils";

/**
 * Total do PDF preservando ausência e falha de leitura (item 6):
 * - categoria explicitamente `null` = não aplicável; valor `pdf: null`
 *   em categoria presente = desconhecido, NÃO zero;
 * - se qualquer componente relevante for desconhecido, o total é null
 *   (inconclusivo) — ausência nunca produz um "total confirmado de zero";
 * - zero explícito em todos os componentes continua sendo zero válido.
 */
export function sumPdfTotal(c: ComparacaoResultado | ComparacaoSimplificada | null): number | null {
  if (!c) return null;
  if ("beneficiarios" in c && !("enfermaria" in (c as any))) {
    // simplificada: inclusões/exclusões desconhecidas (pdf null) tornam o
    // total inconclusivo; zero explícito permanece zero.
    const s = c as ComparacaoSimplificada;
    const partes = [s.inclusoes, s.exclusoes].filter(p => p !== null).map(p => p?.pdf ?? null);
    if (!partes.length) return null;
    if (partes.some((p) => p === null)) return null;
    return Number((partes as number[]).reduce((a, b) => a + b, 0).toFixed(2));
  }
  const cr = c as ComparacaoResultado;
  const partes = [
    cr.enfermaria,
    cr.apartamento,
    cr.inclusoes,
    cr.exclusoes,
    cr.devolucoes,
    cr.taxaAdesao ?? null,
  ].filter(p => p !== null).map(p => p?.total?.pdf ?? null);
  if (!partes.length) return null;
  if (partes.some((p) => p === null)) return null;
  const soma = (partes as number[]).reduce((acc, v) => acc + v, 0);
  return Number(soma.toFixed(2));
}

