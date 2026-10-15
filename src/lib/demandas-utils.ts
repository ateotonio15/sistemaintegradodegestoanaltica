import { differenceInCalendarDays, format, parse, parseISO } from "date-fns";

export type Demanda = {
  id: string;
  data_reclamacao: string;
  nome_cliente: string;
  empresa: string | null;
  setor_responsavel: string | null;
  tipo_reclamacao: string | null;
  reclamacao: string | null;
  detalhamento: string | null;
  observacao: string | null;
  executiva: string | null;
  cpf: string | null;
  data_entrada: string | null;
  nome_medico: string | null;
  nome_procedimento: string | null;
  encaminhado_setor: boolean;
  resolvido_setor: boolean;
  data_resolucao_setor: string | null;
  resolvido_executiva: boolean;
  data_resolucao_executiva: string | null;
  importacao_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportacaoLote = {
  id: string;
  nome_arquivo: string;
  total_registros: number;
  importado_por: string | null;
  importado_por_nome: string | null;
  created_at: string;
};

export type DemandaStatus = "Pendente" | "Resolvida" | "Finalizada";

/**
 * Regras:
 * - Resolvido pela executiva = SIM  -> Finalizada
 * - Resolvido pelo setor = SIM (e executiva NÃO) -> Resolvida
 * - Nenhum dos dois -> Pendente
 */
export function getStatus(
  d: Pick<Demanda, "resolvido_executiva" | "resolvido_setor">,
): DemandaStatus {
  if (d.resolvido_executiva) return "Finalizada";
  if (d.resolvido_setor) return "Resolvida";
  return "Pendente";
}

export function isOpen(d: Pick<Demanda, "resolvido_executiva" | "resolvido_setor">): boolean {
  return getStatus(d) !== "Finalizada";
}

export function isPendente(d: Pick<Demanda, "resolvido_executiva" | "resolvido_setor">): boolean {
  return getStatus(d) === "Pendente";
}

/**
 * Dias em aberto: conta da data da reclamação até a primeira data de resolução
 * preenchida (setor ou executiva); sem resolução, até hoje.
 */
export function getDiasAberto(d: Pick<Demanda, "data_reclamacao" | "resolvido_setor" | "data_resolucao_setor" | "resolvido_executiva" | "data_resolucao_executiva">): number {
  if (!d.data_reclamacao) return 0;
  const inicio = parseLocalDate(d.data_reclamacao);
  if (!inicio) return 0;
  const datas: Date[] = [];
  if (d.resolvido_setor && d.data_resolucao_setor) {
    const x = parseLocalDate(d.data_resolucao_setor); if (x) datas.push(x);
  }
  if (d.resolvido_executiva && d.data_resolucao_executiva) {
    const x = parseLocalDate(d.data_resolucao_executiva); if (x) datas.push(x);
  }
  const fim = datas.length ? new Date(Math.min(...datas.map((x) => x.getTime()))) : new Date();
  return Math.max(0, differenceInCalendarDays(fim, inicio));
}

/** SLA em dias: 7 para Agenda Cirúrgica, 5 para Crítica, 3 (72h) padrão. */
export function getSlaDias(d: Pick<Demanda, "setor_responsavel" | "tipo_reclamacao">): number {
  const setor = (d.setor_responsavel || "").toLowerCase();
  const tipo = (d.tipo_reclamacao || "").toLowerCase();
  if (setor.includes("agenda cir")) return 7;
  if (tipo.includes("crít") || tipo.includes("crit")) return 5;
  return 3;
}

export function isOverSla(d: Demanda): boolean {
  return isOpen(d) && getDiasAberto(d) > 5;
}


/** Converte "" para null antes de salvar em campos opcionais. */
export function emptyToNull<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    out[k] = v === "" ? null : v;
  }
  return out;
}

/** Construção manual de Date local (evita UTC offset). */
export function parseLocalDate(iso: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  return d ? format(d, "dd/MM/yyyy") : "—";
}

/** Aceita "2024-01-15", "15/01/2024" ou Excel serial; retorna "yyyy-mm-dd" ou null. */
export function parseFlexibleDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const utcDays = Math.floor(v - 25569);
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    return format(d, "yyyy-MM-dd");
  }
  const s = String(v).trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    return `${brMatch[3]}-${month}-${day}`;
  }
  try {
    const d = parseISO(s);
    if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  } catch {}
  return null;
}

export function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["sim", "s", "true", "1", "x", "yes"].includes(s);
}
