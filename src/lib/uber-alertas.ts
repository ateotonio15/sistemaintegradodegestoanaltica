// Read-only ride alerts for the Uber dashboard. Never mutates rides.
import type { UberCorrida } from "@/hooks/useUberCorridas";
import { diaSemanaDe } from "@/lib/uber-dashboard";

export interface AlertasConfig {
  custo_ativo: boolean; custo_limite: number;
  rota_preco_ativo: boolean; rota_preco_pct: number; rota_preco_min: number;
  noturno_ativo: boolean; noturno_inicio: string; noturno_fim: string;
  fds_ativo: boolean; repetida_ativo: boolean; repetida_min: number;
}
export const ALERTAS_PADRAO: AlertasConfig = {
  custo_ativo: true, custo_limite: 60, rota_preco_ativo: true, rota_preco_pct: 50, rota_preco_min: 3,
  noturno_ativo: true, noturno_inicio: "19:00", noturno_fim: "05:00", fds_ativo: true, repetida_ativo: true, repetida_min: 5,
};

export type AlertaTipo = "custo" | "rota_preco" | "noturno" | "fds" | "repetida";
export const ALERTA_INFO: Record<AlertaTipo, { label: string; grave: boolean }> = {
  custo: { label: "Custo elevado", grave: true },
  rota_preco: { label: "Preço alto para a rota", grave: true },
  noturno: { label: "Horário noturno", grave: false },
  fds: { label: "Fim de semana ou feriado", grave: false },
  repetida: { label: "Rota repetida", grave: false },
};
export const ALERTA_ORDEM: AlertaTipo[] = ["custo", "rota_preco", "noturno", "fds", "repetida"];

const minutos = (hhmm: string | null | undefined): number | null => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
};
/** Night window [inicio, fim), wrapping past midnight when inicio > fim. */
export function ehNoturnoCfg(horario: string | null | undefined, cfg: Pick<AlertasConfig, "noturno_inicio" | "noturno_fim">) {
  const t = minutos(horario), ini = minutos(cfg.noturno_inicio), fim = minutos(cfg.noturno_fim);
  if (t === null || ini === null || fim === null) return false;
  return ini > fim ? t >= ini || t < fim : t >= ini && t < fim;
}
export const horaNoturna = (h: number, cfg: Pick<AlertasConfig, "noturno_inicio" | "noturno_fim">) =>
  ehNoturnoCfg(`${String(h).padStart(2, "0")}:00`, cfg);

/** Street + number: text before the first " - ", no accents/case/punctuation. */
export function normalizarEndereco(s: string | null | undefined): { chave: string; incompleto: boolean } | null {
  const raw = (s ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const idx = raw.indexOf(" - ");
  const parte = idx >= 0 ? raw.slice(0, idx) : raw;
  const resto = idx >= 0 ? raw.slice(idx + 3) : "";
  const incompleto = !parte.includes(",") && /^[A-Z]{2}\b/.test(resto.trim());
  const chave = parte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return chave ? { chave, incompleto } : null;
}

export interface Rota { chave: string; rotulo: string; incompleto: boolean }
/** Origin/destination pair; A→B and B→A are the same route. */
export function rotaDe(c: Pick<UberCorrida, "origem" | "destino">): Rota | null {
  const o = normalizarEndereco(c.origem), d = normalizarEndereco(c.destino);
  if (!o || !d) return null;
  const parte = (s: string | null) => { const r = (s ?? "").trim(); const i = r.indexOf(" - "); return i >= 0 ? r.slice(0, i) : r; };
  const [a, b] = [{ k: o.chave, t: parte(c.origem) }, { k: d.chave, t: parte(c.destino) }].sort((x, y) => x.k.localeCompare(y.k));
  return { chave: `${a.k} <> ${b.k}`, rotulo: `${a.t} ↔ ${b.t}`, incompleto: o.incompleto || d.incompleto };
}

export interface FeriadoAtivo { data: string; nome: string }
export interface CorridaAlerta { corrida: UberCorrida; alertas: AlertaTipo[]; rota: Rota | null; feriado: string | null; mediaRota: number | null }
export interface RotaRepetida { chave: string; rotulo: string; incompleto: boolean; qtd: number; valor: number; colaboradores: string[] }

/**
 * @param historico all non-cancelled rides (route price baseline)
 * @param periodo non-cancelled rides inside the dashboard's period/company/collaborator filters
 */
export function calcularAlertas(historico: UberCorrida[], periodo: UberCorrida[], cfg: AlertasConfig, feriados: FeriadoAtivo[]) {
  const fer = new Map(feriados.map((f) => [f.data, f.nome]));
  const rotaHist = new Map<string, { n: number; soma: number }>();
  const rotaCache = new Map<string, Rota | null>();
  const rotaC = (c: UberCorrida) => { if (!rotaCache.has(c.id)) rotaCache.set(c.id, rotaDe(c)); return rotaCache.get(c.id)!; };
  for (const c of historico) {
    const r = rotaC(c); if (!r) continue;
    const cur = rotaHist.get(r.chave) ?? { n: 0, soma: 0 }; cur.n += 1; cur.soma += Number(c.valor || 0); rotaHist.set(r.chave, cur);
  }
  const histIds = new Set(historico.map((c) => c.id));
  const rep = new Map<string, RotaRepetida>();
  for (const c of periodo) {
    const r = rotaC(c); if (!r) continue;
    const cur = rep.get(r.chave) ?? { chave: r.chave, rotulo: r.rotulo, incompleto: false, qtd: 0, valor: 0, colaboradores: [] };
    cur.qtd += 1; cur.valor += Number(c.valor || 0); cur.incompleto ||= r.incompleto;
    const col = c.colaborador?.trim(); if (col && !cur.colaboradores.includes(col)) cur.colaboradores.push(col);
    rep.set(r.chave, cur);
  }
  const repetidas = [...rep.values()].filter((r) => r.qtd >= cfg.repetida_min).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
  const repSet = new Set(repetidas.map((r) => r.chave));

  const corridas: CorridaAlerta[] = [];
  for (const c of periodo) {
    const v = Number(c.valor || 0);
    const r = rotaC(c);
    const al: AlertaTipo[] = [];
    let media: number | null = null;
    if (cfg.custo_ativo && v >= cfg.custo_limite) al.push("custo");
    if (r) {
      const h = rotaHist.get(r.chave);
      const inHist = histIds.has(c.id) ? 1 : 0;
      const outras = h ? h.n - inHist : 0;
      if (h && outras >= cfg.rota_preco_min) {
        media = (h.soma - (inHist ? v : 0)) / outras;
        if (cfg.rota_preco_ativo && media > 0 && v >= media * (1 + cfg.rota_preco_pct / 100)) al.push("rota_preco");
      }
    }
    if (cfg.noturno_ativo && ehNoturnoCfg(c.horario, cfg)) al.push("noturno");
    const feriado = fer.get(c.data) ?? null;
    if (cfg.fds_ativo && (diaSemanaDe(c.data) >= 5 || feriado)) al.push("fds");
    if (cfg.repetida_ativo && r && repSet.has(r.chave)) al.push("repetida");
    if (al.length) corridas.push({ corrida: c, alertas: al, rota: r, feriado, mediaRota: media });
  }
  corridas.sort((a, b) => (a.corrida.data === b.corrida.data
    ? (b.corrida.horario ?? "").localeCompare(a.corrida.horario ?? "") : b.corrida.data.localeCompare(a.corrida.data)));
  return { corridas, repetidas: cfg.repetida_ativo ? repetidas : [] };
}
