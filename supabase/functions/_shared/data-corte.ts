/**
 * Data-limite de conferência ("dia de corte") de uma movimentação.
 *
 * Regra: o último dia do período da movimentação, dentro do mês da competência.
 * Ex.: período "25-30" + competência "2026-10" → "30/10/2026".
 * Sem período informado, usa o último dia do mês da competência.
 * Sem competência válida, devolve null (nunca inventa uma data).
 *
 * Formata DD/MM/AAAA montando as partes manualmente: nada depende do fuso do servidor.
 */
export function dataCorteMovimentacao(
  periodo: string | null | undefined,
  mesReferencia: string | null | undefined,
): string | null {
  const mes = /^(\d{4})-(\d{2})$/.exec(String(mesReferencia ?? "").trim());
  if (!mes) return null;
  const ano = Number(mes[1]);
  const mesNum = Number(mes[2]);
  if (!Number.isFinite(ano) || mesNum < 1 || mesNum > 12) return null;

  const ultimoDiaMes = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const fim = /-(\d{1,2})\s*$/.exec(String(periodo ?? "").trim());
  let dia = fim ? Number(fim[1]) : ultimoDiaMes;
  if (!Number.isFinite(dia) || dia < 1) dia = ultimoDiaMes;
  if (dia > ultimoDiaMes) dia = ultimoDiaMes;

  return `${String(dia).padStart(2, "0")}/${String(mesNum).padStart(2, "0")}/${ano}`;
}
