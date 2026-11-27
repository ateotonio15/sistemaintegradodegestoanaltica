// Read-only aggregations for the Uber dashboard. Dates/times are used exactly as stored (Manaus local).
import type { UberCorrida } from "@/hooks/useUberCorridas";
import { nomeUnificadoColaborador } from "@/lib/uber-colaborador";

export const NAO_INFORMADO = "Não informado";
export const SEM_SERVICO = "Histórico sem tipo";
export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export type StatusCorrida = "ativa" | "pendente" | "cancelada";
export const statusCorrida = (c: Pick<UberCorrida, "cancelada" | "status_importacao">): StatusCorrida =>
  c.cancelada ? "cancelada" : c.status_importacao === "pendente" ? "pendente" : "ativa";

export const liquido = (c: UberCorrida) =>
  Number(c.valor || 0) - (c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0);
export const reembolsoDe = (c: UberCorrida) => (c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0);

export const horaDe = (h: string | null | undefined): number | null => {
  if (!h) return null;
  const n = parseInt(h.split(":")[0], 10);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : null;
};
/** Night window 19:00–04:59. */
export const ehNoturna = (h: number | null) => h !== null && (h >= 19 || h <= 4);
/** 0 = Monday … 6 = Sunday, parsed without UTC shift. */
export const diaSemanaDe = (data: string) => {
  const [y, m, d] = data.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
};

export const PERIODOS = [
  { key: "madrugada", label: "Madrugada", range: "00h – 05h", from: 0, to: 5 },
  { key: "manha", label: "Manhã", range: "06h – 11h", from: 6, to: 11 },
  { key: "tarde", label: "Tarde", range: "12h – 17h", from: 12, to: 17 },
  { key: "noite", label: "Noite", range: "18h – 23h", from: 18, to: 23 },
] as const;
export type PeriodoKey = (typeof PERIODOS)[number]["key"];
export const periodoDe = (h: number | null): PeriodoKey | null =>
  h === null ? null : PERIODOS.find((p) => h >= p.from && h <= p.to)!.key;

export const servicoDe = (c: UberCorrida) => (c.servico_uber?.trim() || SEM_SERVICO);
export const colabDe = (c: UberCorrida) => nomeUnificadoColaborador(c.colaborador) || NAO_INFORMADO;

export interface FiltrosDash {
  de: string; ate: string;
  colab?: string; motivo?: string; tipo?: string; empresa?: string; criadoPor?: string;
  servico?: string; periodo?: PeriodoKey; hora?: number; dia?: number;
}

/** Facet filters except date. */
export function passaFacetas(c: UberCorrida, f: FiltrosDash) {
  if (f.colab && colabDe(c) !== f.colab) return false;
  if (f.motivo && (c.motivo || NAO_INFORMADO) !== f.motivo) return false;
  if (f.tipo && (c.tipo ?? "") !== f.tipo) return false;
  if (f.empresa && (c.empresa || NAO_INFORMADO) !== f.empresa) return false;
  if (f.criadoPor && (c.criado_por ?? "") !== f.criadoPor) return false;
  if (f.servico && servicoDe(c) !== f.servico) return false;
  const h = horaDe(c.horario);
  if (f.periodo && periodoDe(h) !== f.periodo) return false;
  if (f.hora !== undefined && h !== f.hora) return false;
  if (f.dia !== undefined && diaSemanaDe(c.data) !== f.dia) return false;
  return true;
}
export const noPeriodo = (c: UberCorrida, de: string, ate: string) => (!de || c.data >= de) && (!ate || c.data <= ate);

/** Rides counted on the panel: active, plus pending when included. */
export const contaNoPainel = (c: UberCorrida, incluirPendentes: boolean) => {
  const s = statusCorrida(c);
  return s === "ativa" || (incluirPendentes && s === "pendente");
};

export interface Linha { nome: string; qtd: number; valor: number; naoInformado: boolean }
/** Group and sort by value desc, "Não informado"/"sem tipo" always last. */
export function agrupar(rows: UberCorrida[], key: (c: UberCorrida) => string, vazios: string[] = [NAO_INFORMADO]): Linha[] {
  const m = new Map<string, Linha>();
  for (const c of rows) {
    const k = key(c);
    const cur = m.get(k) ?? { nome: k, qtd: 0, valor: 0, naoInformado: vazios.includes(k) };
    cur.qtd += 1; cur.valor += liquido(c); m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => Number(a.naoInformado) - Number(b.naoInformado) || b.valor - a.valor);
}

export function totais(rows: UberCorrida[]) {
  const liq = rows.reduce((s, c) => s + liquido(c), 0);
  const bruto = rows.reduce((s, c) => s + Number(c.valor || 0), 0);
  const reemb = rows.reduce((s, c) => s + reembolsoDe(c), 0);
  return { qtd: rows.length, liq, bruto, reemb, ticket: rows.length ? liq / rows.length : 0 };
}

/** Same-length period right before [de, ate]. */
export function periodoAnterior(de: string, ate: string) {
  const p = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ini = p(de), fim = p(ate);
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86400000);
  const antFim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() - 1);
  const antIni = new Date(antFim.getFullYear(), antFim.getMonth(), antFim.getDate() - dias);
  return { de: ymd(antIni), ate: ymd(antFim) };
}
