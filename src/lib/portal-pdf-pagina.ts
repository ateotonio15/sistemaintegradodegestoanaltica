// Regra de navegação da prévia de PDF: a página digitada pelo usuário nunca
// sai do intervalo real do documento. Texto inválido mantém a página atual.
export function ajustarPaginaDigitada(texto: string, paginaAtual: number, total: number): number {
  const limpo = String(texto ?? "").trim();
  if (!/^\d+$/.test(limpo)) return paginaAtual;
  if (!Number.isFinite(total) || Math.trunc(total) < 1) return paginaAtual;
  const digitada = Number.parseInt(limpo, 10);
  if (digitada < 1) return 1;
  return Math.min(digitada, Math.trunc(total));
}
