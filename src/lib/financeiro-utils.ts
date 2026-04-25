import type { Tables } from "@/integrations/supabase/types";

export type FinanceiroMovimentacao = Tables<"financeiro_movimentacoes">;
export type Cobranca = Tables<"cobrancas">;
export type AnexoFinanceiro = Tables<"anexos_financeiro">;

export const PERIODOS_FIN = ["01-05", "05-10", "10-15", "15-20", "20-25", "25-30"] as const;

export type StatusFinanceiro = "Enviada" | "Aguardando nota" | "Pendente" | "Fora do prazo";

/**
 * Calcula o status financeiro de uma movimentação (NÃO persistido no banco).
 * - Enviada: tem `data_envio_nota`
 * - Fora do prazo: `dentro_prazo === false` e sem nota
 * - Aguardando nota: existe envio operacional ao financeiro mas sem `data_envio_nota`
 * - Pendente: nenhum envio ainda
 */
export function calcularStatusFinanceiro(
  mov: Pick<FinanceiroMovimentacao, "data_envio_nota" | "dentro_prazo">,
  envioOperacionalFeito: boolean,
): StatusFinanceiro {
  if (mov.data_envio_nota) return "Enviada";
  if (mov.dentro_prazo === false) return "Fora do prazo";
  if (envioOperacionalFeito) return "Aguardando nota";
  return "Pendente";
}

export function statusFinanceiroColor(status: StatusFinanceiro): string {
  switch (status) {
    case "Enviada":
      return "bg-success text-success-foreground";
    case "Aguardando nota":
      return "bg-warning text-warning-foreground";
    case "Fora do prazo":
      return "bg-destructive text-destructive-foreground";
    case "Pendente":
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getCurrentMesReferencia(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMesReferencia(mes: string): string {
  const [year, month] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year}`;
}

export function buildStoragePath(
  empresaId: string,
  movimentacaoId: string,
  fileName: string,
): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const uuid = crypto.randomUUID();
  return `${empresaId}/${movimentacaoId}/${uuid}.${ext}`;
}

export const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.csv";
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lista os meses dos últimos 12 + próximos 1 para o filtro */
export function getMesesOptions(): string[] {
  const now = new Date();
  const meses: string[] = [];
  for (let i = -1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}
