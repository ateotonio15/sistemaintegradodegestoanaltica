/** Textos e números agregados da apresentação "Resultados da Campanha de Saúde". Sem dados individuais (LGPD). */
export interface ContagensApresentacao {
  total: number;
  paCounts: Record<string, number>;
  gliCounts: Record<string, number>;
  encaminhamentos: number;
}

export const pctDe = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
export const emCada10 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10) : 0);

export function frasePorDez(x: number, sujeito: string, verboSing: string, verboPlural: string) {
  if (x === 5) return `Metade dos ${sujeito} ${verboSing}`;
  if (x === 10) return `Todos os ${sujeito} ${verboPlural}`;
  return `${x} em cada 10 ${sujeito} ${x === 1 ? verboSing : verboPlural}`;
}

export function resumoApresentacao(c: ContagensApresentacao) {
  const pa = (k: string) => c.paCounts[k] ?? 0;
  const gl = (k: string) => c.gliCounts[k] ?? 0;
  const paNR = pa("Não realizado");
  const gliNR = gl("Não realizado");
  const basePa = c.total - paNR;
  const baseGli = c.total - gliNR;
  const paOk = pa("Ótima") + pa("Normal");
  const paAtencao = pa("PA Elevada") + pa("Hipertensão Estágio 1");
  const paGrave = pa("Hipertensão Estágio 2") + pa("Hipertensão Estágio 3");
  const paAlt = paAtencao + paGrave;
  const gliAlt = gl("Pré-Diabetes") + gl("Alterada pós-prandial") + gl("Diabetes");
  const pctPaAlt = pctDe(paAlt, basePa);
  const pctGliAlt = pctDe(gliAlt, baseGli);

  const tituloNumeros = c.total > 0
    ? `${frasePorDez(emCada10(c.encaminhamentos, c.total), "colaboradores triados", "precisa de acompanhamento", "precisam de acompanhamento")}`
    : "Nenhum colaborador foi triado nesta ação";
  const tituloGlicemia = baseGli > 0
    ? frasePorDez(emCada10(gliAlt, baseGli), "colaboradores", "tem glicemia fora do ideal", "têm glicemia fora do ideal")
    : "A glicemia não foi aferida nesta ação";
  const tituloPa = basePa > 0
    ? `${emCada10(paOk, basePa)} em cada 10 estão com a pressão em dia; ${emCada10(paAlt, basePa)} em cada 10 precisam de atenção`
    : "A pressão arterial não foi aferida nesta ação";

  return {
    basePa, baseGli, paNR, gliNR, paOk, paAtencao, paGrave, paAlt, gliAlt, pctPaAlt, pctGliAlt,
    pctEnc: pctDe(c.encaminhamentos, c.total),
    tituloNumeros, tituloGlicemia, tituloPa,
    /** PA vem antes da glicemia quando é o principal ponto de atenção. */
    paPrimeiro: pctPaAlt > pctGliAlt,
  };
}

// ---------- Contagem agregada e grupos (filtros) ----------
import { classificarPa, classificarGlicemia, PA_ALTERADAS } from "./saude-rules";

export interface TriagemAgregavel {
  pas_mmhg: number | null; pad_mmhg: number | null; glicemia_mg_dl: number | null; jejum?: boolean | null;
  setor?: string | null; sexo?: string | null; idade?: number | null;
}

/** Contagens agregadas (sem nenhum dado individual). */
export function contarTriagens(triagens: TriagemAgregavel[]): ContagensApresentacao {
  const paCounts: Record<string, number> = { "Ótima": 0, Normal: 0, "PA Elevada": 0, "Hipertensão Estágio 1": 0, "Hipertensão Estágio 2": 0, "Hipertensão Estágio 3": 0, "Não realizado": 0 };
  const gliCounts: Record<string, number> = { Normal: 0, "Pré-Diabetes": 0, "Alterada pós-prandial": 0, Diabetes: 0, "Não realizado": 0 };
  let encaminhamentos = 0;
  triagens.forEach((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    paCounts[pa] = (paCounts[pa] ?? 0) + 1;
    const gli = classificarGlicemia(t.glicemia_mg_dl, !!t.jejum);
    gliCounts[gli ?? "Não realizado"]++;
    if (PA_ALTERADAS.includes(pa) || (gli && gli !== "Normal")) encaminhamentos++;
  });
  return { total: triagens.length, paCounts, gliCounts, encaminhamentos };
}

/** Grupos com menos colaboradores que isto nunca são exibidos (anonimato). */
export const GRUPO_MINIMO = 5;
export type DimensaoGrupo = "setor" | "sexo" | "faixa";

export function faixaEtaria(idade?: number | null): string | null {
  if (idade == null || !Number.isFinite(idade)) return null;
  if (idade < 30) return "Até 29 anos";
  if (idade < 40) return "30 a 39 anos";
  if (idade < 50) return "40 a 49 anos";
  if (idade < 60) return "50 a 59 anos";
  return "60 anos ou mais";
}

export function valorGrupo(t: TriagemAgregavel, d: DimensaoGrupo): string | null {
  const v = d === "faixa" ? faixaEtaria(t.idade) : d === "setor" ? t.setor : t.sexo;
  const s = (v ?? "").toString().trim();
  return s ? s.toUpperCase() : null;
}

/** Opções de grupo disponíveis; dimensões sem nenhum valor preenchido são omitidas. */
export function opcoesGrupo(triagens: TriagemAgregavel[]) {
  const out: Partial<Record<DimensaoGrupo, { valor: string; n: number }[]>> = {};
  (["setor", "sexo", "faixa"] as DimensaoGrupo[]).forEach((d) => {
    const m = new Map<string, number>();
    triagens.forEach((t) => { const v = valorGrupo(t, d); if (v) m.set(v, (m.get(v) ?? 0) + 1); });
    if (m.size) out[d] = [...m.entries()].map(([valor, n]) => ({ valor, n })).sort((a, b) => a.valor.localeCompare(b.valor));
  });
  return out;
}

export function filtrarGrupo<T extends TriagemAgregavel>(triagens: T[], d: DimensaoGrupo | null, valor: string | null) {
  if (!d || !valor) return { triagens, pequeno: false };
  const sel = triagens.filter((t) => valorGrupo(t, d) === valor);
  return { triagens: sel, pequeno: sel.length < GRUPO_MINIMO };
}
