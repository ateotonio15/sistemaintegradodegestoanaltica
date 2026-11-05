// Regras operacionais de contratos suspensos na aba Movimentações.
export const TITULO_CONTRATO_SUSPENSO = "Contrato suspenso";
export const MENSAGEM_CONTRATO_SUSPENSO =
  "Esta empresa está com o contrato suspenso e não participa do processo de movimentação ou conferência de vidas.";

export function contratoSuspenso(m: { empresas?: unknown } | null | undefined): boolean {
  return !!(m?.empresas as { contrato_suspenso?: boolean | null } | null | undefined)?.contrato_suspenso;
}

/** Separa as linhas aptas das suspensas para os botões em lote. */
export function separarSuspensos<T extends { empresas?: unknown }>(rows: T[]): { aptos: T[]; suspensos: number } {
  const aptos = rows.filter((r) => !contratoSuspenso(r));
  return { aptos, suspensos: rows.length - aptos.length };
}

export function mensagemSuspensosIgnorados(n: number, acao: "envio" | "preparo"): string | null {
  if (n <= 0) return null;
  const alvo = acao === "envio" ? "no envio" : "no preparo";
  return n === 1 ? `1 contrato suspenso foi ignorado ${alvo}.` : `${n} contratos suspensos foram ignorados ${alvo}.`;
}
