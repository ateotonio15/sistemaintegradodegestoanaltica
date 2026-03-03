import type { Tables } from "@/integrations/supabase/types";

export type Movimentacao = Tables<"movimentacoes"> & {
  empresas?: { nome: string; codigo_contrato: string | null; tipo_movimentacao: string | null; periodo_movimentacao: string | null } | null;
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

  const foraDoParzo = isForaDoPrazo(mov);
  if (foraDoParzo) return "Fora do prazo";

  return "Aguardando envio";
}

function isForaDoPrazo(mov: Tables<"movimentacoes">): boolean {
  try {
    const endDay = parseInt(mov.periodo.split("-")[1]);
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

/**
 * Get current period based on today's day.
 * Day 01-05 → 01-05, Day 06-10 → 05-10, Day 11-15 → 10-15,
 * Day 16-20 → 15-20, Day 21-25 → 20-25, Day 26-31 → 25-30
 */
export function getCurrentPeriodo(): string {
  const day = new Date().getDate();
  if (day <= 5) return "01-05";
  if (day <= 10) return "05-10";
  if (day <= 15) return "10-15";
  if (day <= 20) return "15-20";
  if (day <= 25) return "20-25";
  return "25-30";
}

/**
 * Map a data_corte value to a period.
 * Corte 05 → 01-05, Corte 10 → 05-10, etc.
 */
export function periodoDaDataCorte(dataCorte: number): string {
  if (dataCorte <= 5) return "01-05";
  if (dataCorte <= 10) return "05-10";
  if (dataCorte <= 15) return "10-15";
  if (dataCorte <= 20) return "15-20";
  if (dataCorte <= 25) return "20-25";
  return "25-30";
}

/**
 * Determine if an empresa is "Em período" or "Fora do período"
 * based on current period vs the empresa's configured period.
 */
export function calcularStatusPeriodoEmpresa(empresa: Tables<"empresas">): "Em período" | "Fora do período" {
  if (empresa.status_empresa !== "Ativa") return "Fora do período";

  const periodoAtual = getCurrentPeriodo();

  if (empresa.tipo_movimentacao === "Diária" && empresa.data_corte) {
    const periodoEmpresa = periodoDaDataCorte(empresa.data_corte);
    return periodoEmpresa === periodoAtual ? "Em período" : "Fora do período";
  }

  if (empresa.periodo_movimentacao) {
    return empresa.periodo_movimentacao === periodoAtual ? "Em período" : "Fora do período";
  }

  return "Fora do período";
}

/** Calculate period from a date (for Diária type) */
export function calcularPeriodoPorData(dateStr: string): string {
  try {
    const day = new Date(dateStr + "T12:00:00").getDate();
    if (day <= 5) return "01-05";
    if (day <= 10) return "05-10";
    if (day <= 15) return "10-15";
    if (day <= 20) return "15-20";
    if (day <= 25) return "20-25";
    return "25-30";
  } catch {
    return "01-05";
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

/** Formats a date string (YYYY-MM-DD) to DD/MM/YYYY for display */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
