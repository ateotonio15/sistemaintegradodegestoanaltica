import type { Tables } from "@/integrations/supabase/types";

export type Movimentacao = Tables<"movimentacoes"> & {
  empresas?: { nome: string; codigo_contrato: string | null } | null;
};

export const PERIODOS = ["01-05", "05-10", "10-15", "15-20", "20-25", "25-30"] as const;

export type StatusMovimentacao =
  | "Aguardando envio"
  | "Enviado para empresa"
  | "Retornado pela empresa"
  | "Enviado ao financeiro"
  | "Fora do prazo";

export function calcularStatus(mov: Tables<"movimentacoes">): StatusMovimentacao {
  if (mov.data_envio_financeiro) return "Enviado ao financeiro";
  if (mov.data_retorno_empresa) return "Retornado pela empresa";
  if (mov.data_envio_empresa) return "Enviado para empresa";

  // Check if fora do prazo: current date past the period end day in the reference month
  const foraDoParzo = isForaDoPrazo(mov);
  if (foraDoParzo) return "Fora do prazo";

  return "Aguardando envio";
}

function isForaDoPrazo(mov: Tables<"movimentacoes">): boolean {
  try {
    const endDay = parseInt(mov.periodo.split("-")[1]);
    // mes_referencia format: "2026-02" (YYYY-MM)
    const [year, month] = mov.mes_referencia.split("-").map(Number);
    if (!year || !month) return false;
    const deadlineDate = new Date(year, month - 1, endDay);
    return new Date() > deadlineDate;
  } catch {
    return false;
  }
}

export function statusColor(status: StatusMovimentacao) {
  switch (status) {
    case "Enviado ao financeiro":
      return "bg-success text-success-foreground";
    case "Retornado pela empresa":
      return "bg-info text-info-foreground";
    case "Enviado para empresa":
      return "bg-warning text-warning-foreground";
    case "Fora do prazo":
      return "bg-destructive text-destructive-foreground";
    case "Aguardando envio":
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getCurrentPeriodo(): string {
  const day = new Date().getDate();
  for (const p of PERIODOS) {
    const [start, end] = p.split("-").map(Number);
    if (day >= start && day < end) return p;
  }
  return "25-30";
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
