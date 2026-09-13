// Nível de risco e indicadores visuais da listagem de contratos.
// Calculado pelos dados do processo (pendências, divergências, status),
// nunca pela aparência.

export type NivelRisco = "nao_analisado" | "baixo" | "medio" | "alto";

export const RISCO_LABEL: Record<NivelRisco, string> = {
  nao_analisado: "Não analisado",
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const RISCO_BADGE: Record<NivelRisco, string> = {
  nao_analisado: "bg-muted text-muted-foreground border-border",
  baixo: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  medio: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  alto: "bg-red-500/15 text-red-600 border-red-500/30",
};

export const RISCO_DOT: Record<NivelRisco, string> = {
  nao_analisado: "bg-muted-foreground/50",
  baixo: "bg-emerald-500",
  medio: "bg-amber-500",
  alto: "bg-red-500",
};

export const RISCOS: NivelRisco[] = ["baixo", "medio", "alto", "nao_analisado"];

const STATUS_PENDENCIA = new Set([
  "pendencia_juridica",
  "pendencia_cadastral",
  "pendencia_financeira",
]);

export interface EntradaRisco {
  status?: string | null;
  analisado: boolean;
  pendenciasAbertas: number;
  pendenciasCriticas: number;
  divergencias: number;
  divergenciasCriticas: number;
  camposFaltando: number;
}

export function calcularRisco(e: EntradaRisco): NivelRisco {
  if (!e.analisado && e.pendenciasAbertas === 0 && e.camposFaltando === 0) return "nao_analisado";
  if (
    e.divergenciasCriticas > 0 ||
    e.pendenciasCriticas > 0 ||
    e.status === "reprovado" ||
    STATUS_PENDENCIA.has(e.status || "")
  ) {
    return "alto";
  }
  if (
    e.pendenciasAbertas > 0 ||
    e.divergencias > 0 ||
    e.camposFaltando > 0 ||
    e.status === "aguardando_documento_empresa"
  ) {
    return "medio";
  }
  return "baixo";
}

/** Setor do processo correspondente ao perfil do usuário logado. */
export function setorDoPerfil(role?: string | null): string | null {
  switch (role) {
    case "vendas":
      return "comercial";
    case "comum":
    case "administradoras":
      return "cadastro";
    case "financeiro":
      return "financeiro";
    case "diretora":
      return "diretoria";
    default:
      return null;
  }
}
