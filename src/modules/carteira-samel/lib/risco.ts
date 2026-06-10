import { EmpresaCarteira } from "../data/mockData";

export type Semaforo = "Verde" | "Amarelo" | "Vermelho";
export type ClassificacaoFinal = "Saudavel" | "Atencao" | "Alto Risco";

export function classificarSinistralidade(pct: number | null | undefined): Semaforo {
  if (pct == null || isNaN(pct)) return "Verde";
  if (pct <= 75) return "Verde";
  if (pct <= 85) return "Amarelo";
  return "Vermelho";
}

export function proximoAniversario(vigenciaISO: string, ref: Date = new Date()): Date {
  const v = new Date(vigenciaISO + "T00:00:00");
  const next = new Date(ref.getFullYear(), v.getMonth(), v.getDate());
  if (next.getTime() <= ref.getTime()) next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function diasAteReajuste(vigenciaISO: string, ref: Date = new Date()): number {
  const next = proximoAniversario(vigenciaISO, ref);
  return Math.ceil((next.getTime() - ref.getTime()) / 86_400_000);
}

export function classificarRenovacao(vigenciaISO: string, ref: Date = new Date()): Semaforo {
  const d = diasAteReajuste(vigenciaISO, ref);
  if (d > 120) return "Verde";
  if (d >= 91) return "Amarelo";
  return "Vermelho";
}

export const pontuacaoSemaforo: Record<Semaforo, number> = { Verde: 1, Amarelo: 2, Vermelho: 3 };

export interface DimensoesScore {
  sinistralidade: Semaforo;
  reclamacoes: Semaforo;
  relacionamento: Semaforo;
  satisfacao: Semaforo;
  renovacao: Semaforo;
}

export function scoreCompleto(d: DimensoesScore): { total: number; classificacao: ClassificacaoFinal } {
  const total =
    pontuacaoSemaforo[d.sinistralidade] +
    pontuacaoSemaforo[d.reclamacoes] +
    pontuacaoSemaforo[d.relacionamento] +
    pontuacaoSemaforo[d.satisfacao] +
    pontuacaoSemaforo[d.renovacao];
  let classificacao: ClassificacaoFinal = "Saudavel";
  if (total >= 7) classificacao = "Alto Risco";
  else if (total >= 5) classificacao = "Atencao";
  return { total, classificacao };
}

// Score simplificado da página /score (2 dimensões)
export function scoreSimplificado(
  reclamacoes30d: number,
  vigenciaISO: string,
  ref: Date = new Date()
): { total: number; semaforo: Semaforo; dimReclamacoes: Semaforo; dimReajuste: Semaforo; diasReajuste: number } {
  const dimReclamacoes: Semaforo = reclamacoes30d === 0 ? "Verde" : reclamacoes30d <= 3 ? "Amarelo" : "Vermelho";
  const diasReajuste = diasAteReajuste(vigenciaISO, ref);
  const dimReajuste: Semaforo = diasReajuste < 30 ? "Vermelho" : diasReajuste <= 60 ? "Amarelo" : "Verde";
  const total = pontuacaoSemaforo[dimReclamacoes] + pontuacaoSemaforo[dimReajuste];
  const semaforo: Semaforo = total <= 2 ? "Verde" : total <= 4 ? "Amarelo" : "Vermelho";
  return { total, semaforo, dimReclamacoes, dimReajuste, diasReajuste };
}

export function proximosAniversarios(vigenciaISO: string, n = 4, ref: Date = new Date()): Date[] {
  const arr: Date[] = [];
  let cur = proximoAniversario(vigenciaISO, ref);
  for (let i = 0; i < n; i++) {
    arr.push(new Date(cur));
    cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate());
  }
  return arr;
}

export function classificarProximidadeReajuste(dias: number): Semaforo {
  if (dias <= 30) return "Vermelho";
  if (dias <= 60) return "Amarelo";
  return "Verde";
}

export function acoesRecomendadas(s: Semaforo): string[] {
  if (s === "Verde") return ["Acompanhamento mensal", "Reforço de valor", "Prevenção de reajuste"];
  if (s === "Amarelo") return ["Reunião técnica", "Plano de ação", "Revisão operacional", "Visita comercial"];
  return ["Reunião com diretoria", "Plano emergencial", "Retenção prioritária", "Negociação estratégica"];
}

export function corSemaforoClasses(s: Semaforo) {
  if (s === "Verde") return { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/40", dot: "bg-emerald-500" };
  if (s === "Amarelo") return { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/40", dot: "bg-amber-500" };
  return { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", border: "border-red-500/40", dot: "bg-red-500" };
}

export function empresaProximidadeSemaforo(e: EmpresaCarteira): Semaforo {
  return classificarProximidadeReajuste(diasAteReajuste(e.vigenciaInicio));
}
