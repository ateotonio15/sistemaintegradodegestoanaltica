// Regras clínicas — sincronizadas com public.classificar_pa / classificar_glicemia / calcular_imc.

export type PaCategoria =
  | "Ótima"
  | "Normal"
  | "PA Elevada"
  | "Hipertensão Estágio 1"
  | "Hipertensão Estágio 2"
  | "Hipertensão Estágio 3"
  | "Não realizado";

export type GlicemiaCategoria =
  | "Normal"
  | "Pré-Diabetes"
  | "Alterada pós-prandial"
  | "Diabetes";

export type ImcCategoria =
  | "Baixo peso"
  | "Normal"
  | "Sobrepeso"
  | "Obesidade I"
  | "Obesidade II"
  | "Obesidade III";

export type RiscoGeral = "alto" | "medio" | "baixo";

// Diretrizes Brasileiras (Ministério da Saúde). Quando PAS e PAD caem em faixas
// diferentes, prevalece a categoria mais alta — por isso avaliamos de cima para baixo.
export function classificarPa(pas?: number | null, pad?: number | null): PaCategoria {
  if (pas == null || pad == null || pas <= 0 || pad <= 0) return "Não realizado";
  if (pas >= 180 || pad >= 110) return "Hipertensão Estágio 3";
  if (pas >= 160 || pad >= 100) return "Hipertensão Estágio 2";
  if (pas >= 140 || pad >= 90) return "Hipertensão Estágio 1";
  if (pas >= 130 || pad >= 85) return "PA Elevada";
  if (pas >= 120 || pad >= 80) return "Normal";
  return "Ótima";
}

export function classificarGlicemia(valor?: number | null, jejum?: boolean): GlicemiaCategoria | null {
  if (valor == null || valor <= 0) return null;
  if (jejum) {
    if (valor < 100) return "Normal";
    if (valor < 126) return "Pré-Diabetes";
    return "Diabetes";
  }
  if (valor < 140) return "Normal";
  if (valor < 200) return "Alterada pós-prandial";
  return "Diabetes";
}

export const PA_ALTERADAS: PaCategoria[] = ["PA Elevada", "Hipertensão Estágio 1", "Hipertensão Estágio 2", "Hipertensão Estágio 3"];
export const PA_GRAVE: PaCategoria[] = ["Hipertensão Estágio 2", "Hipertensão Estágio 3"];

export function calcularImc(pesoKg?: number | null, alturaCm?: number | null): number | null {
  if (!pesoKg || !alturaCm) return null;
  const m = alturaCm / 100;
  return Number((pesoKg / (m * m)).toFixed(2));
}

export function classificarImc(imc?: number | null): ImcCategoria | null {
  if (imc == null) return null;
  if (imc < 18.5) return "Baixo peso";
  if (imc < 25) return "Normal";
  if (imc < 30) return "Sobrepeso";
  if (imc < 35) return "Obesidade I";
  if (imc < 40) return "Obesidade II";
  return "Obesidade III";
}

export function corPa(cat?: PaCategoria | null): string {
  switch (cat) {
    case "Ótima":
    case "Normal":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PA Elevada":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "Hipertensão Estágio 1":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "Hipertensão Estágio 2":
    case "Hipertensão Estágio 3":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 animate-pulse";
    case "Não realizado":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function corGlicemia(cat?: GlicemiaCategoria | null): string {
  switch (cat) {
    case "Normal":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "Pré-Diabetes":
    case "Alterada pós-prandial":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "Diabetes":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function corImc(cat?: ImcCategoria | null): string {
  switch (cat) {
    case "Normal":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "Baixo peso":
    case "Sobrepeso":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "Obesidade I":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "Obesidade II":
    case "Obesidade III":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function corRisco(r?: RiscoGeral | null): string {
  switch (r) {
    case "baixo":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "medio":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "alto":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function calcularRisco(input: {
  pa?: PaCategoria | null;
  glicemia?: GlicemiaCategoria | null;
  imc?: number | null;
  tem_has?: boolean;
  tem_dm?: boolean;
}): RiscoGeral {
  const { pa, glicemia, imc, tem_has, tem_dm } = input;
  if (
    pa === "Hipertensão Estágio 2" ||
    pa === "Hipertensão Estágio 3" ||
    glicemia === "Diabetes" ||
    (imc != null && imc >= 30) ||
    (tem_has && tem_dm)
  ) return "alto";
  if (
    pa === "PA Elevada" ||
    pa === "Hipertensão Estágio 1" ||
    glicemia === "Pré-Diabetes" ||
    glicemia === "Alterada pós-prandial" ||
    (imc != null && imc >= 25) ||
    tem_has ||
    tem_dm
  ) return "medio";
  return "baixo";
}

export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
