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

// ---- Tempo de suspensão (somente exibição; nunca altera status) ----
function dataLocal(v: string | Date): Date {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dias entre a data da suspensão e a data de referência (hoje por padrão). */
export function diasSuspenso(dataSuspensao: string | null | undefined, ref: string | Date = new Date()): number | null {
  if (!dataSuspensao) return null;
  const ms = dataLocal(ref).getTime() - dataLocal(dataSuspensao).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export type NivelSuspensao = "normal" | "atencao" | "critico";
export function nivelSuspensao(dias: number | null): NivelSuspensao {
  if (dias == null || dias < 20) return "normal";
  return dias >= 30 ? "critico" : "atencao";
}

/** Ordena: críticos, atenção, demais; dentro do nível, mais dias primeiro. */
export function ordenarPorSuspensao<T>(itens: T[], dias: (i: T) => number | null): T[] {
  const peso = { critico: 0, atencao: 1, normal: 2 } as const;
  return [...itens].sort((a, b) => {
    const da = dias(a), db = dias(b);
    const p = peso[nivelSuspensao(da)] - peso[nivelSuspensao(db)];
    return p !== 0 ? p : (db ?? -1) - (da ?? -1);
  });
}

export const rotuloDias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/**
 * Só contratos ainda suspensos aparecem no quadro.
 * Reativados (dentro ou fora do período) saem da lista: fora do período a
 * movimentação ocorre no mês seguinte, sem aviso pendente.
 */
export function itensEmSuspensaoAtiva<T extends { status: string }>(itens: T[]): T[] {
  return itens.filter((i) => i.status === "encaminhado");
}
