export const BE_FATOR = 0.7;

export interface LancamentoMensal {
  id: string;
  empresa_id: string;
  empresa_nome: string | null;
  periodo: string; // YYYY-MM-DD
  premio_empresa: number;
  premio_continuidade: number;
  sinistro: number;
  observacao?: string | null;
}

export interface LinhaEvolucao {
  periodo: string;
  empresaId: string;
  empresaNome: string;
  premioEmpresa: number;
  premioContinuidade: number;
  premioTotal: number;
  sinistro: number;
  sinistralidade: number; // fração (0.8064)
  be70: number;
  distorcao: number; // fração (0.1520)
  aporte: number; // R$
}

/**
 * Regras (validadas com abr/26 e mai/26 do controle manual):
 *  premio_total    = premio_empresa + premio_continuidade
 *  sinistralidade  = sinistro / premio_total
 *  be_70           = premio_total * 0,70
 *  distorcao       = (sinistralidade / 0,70) - 1
 *  aporte          = (sinistro - be_70) / 0,70
 *   > 0 → aporte a favor da operadora | < 0 → crédito para a empresa
 */
export function calcular(
  premioEmpresa: number,
  premioContinuidade: number,
  sinistro: number,
) {
  const premioTotal = (premioEmpresa || 0) + (premioContinuidade || 0);
  const be70 = premioTotal * BE_FATOR;
  const sinistralidade = premioTotal ? sinistro / premioTotal : 0;
  const distorcao = be70 ? sinistro / be70 - 1 : 0;
  const aporte = (sinistro - be70) / BE_FATOR;
  return { premioTotal, be70, sinistralidade, distorcao, aporte };
}

export function toLinha(l: LancamentoMensal): LinhaEvolucao {
  const premioEmpresa = Number(l.premio_empresa) || 0;
  const premioContinuidade = Number(l.premio_continuidade) || 0;
  const sinistro = Number(l.sinistro) || 0;
  const c = calcular(premioEmpresa, premioContinuidade, sinistro);
  return {
    periodo: l.periodo,
    empresaId: l.empresa_id,
    empresaNome: l.empresa_nome || "—",
    premioEmpresa,
    premioContinuidade,
    sinistro,
    ...c,
  };
}

/** Consolida várias linhas (grupo) somando valores e recalculando indicadores. */
export function consolidar(linhas: LinhaEvolucao[], periodo: string): LinhaEvolucao {
  const premioEmpresa = linhas.reduce((s, l) => s + l.premioEmpresa, 0);
  const premioContinuidade = linhas.reduce((s, l) => s + l.premioContinuidade, 0);
  const sinistro = linhas.reduce((s, l) => s + l.sinistro, 0);
  const c = calcular(premioEmpresa, premioContinuidade, sinistro);
  return {
    periodo,
    empresaId: "__grupo__",
    empresaNome: "Grupo (consolidado)",
    premioEmpresa,
    premioContinuidade,
    sinistro,
    ...c,
  };
}

export function agruparPorPeriodo(linhas: LinhaEvolucao[]): LinhaEvolucao[] {
  const map = new Map<string, LinhaEvolucao[]>();
  linhas.forEach((l) => {
    const arr = map.get(l.periodo) || [];
    arr.push(l);
    map.set(l.periodo, arr);
  });
  return [...map.entries()]
    .map(([periodo, arr]) => consolidar(arr, periodo))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-05-01" → "mai/26" */
export function labelPeriodo(periodo: string): string {
  const [y, m] = periodo.split("-");
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
}

export function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function fmtPct(v: number, casas = 1): string {
  return `${(v * 100).toFixed(casas).replace(".", ",")}%`;
}

export function fmtPctSinal(v: number, casas = 1): string {
  return `${v > 0 ? "+" : ""}${fmtPct(v, casas)}`;
}

export function fmtMoedaSinal(v: number): string {
  return `${v > 0 ? "+" : ""}${fmtMoeda(v)}`;
}

/** Primeiro dia do mês em ISO a partir de "YYYY-MM". */
export function periodoISO(anoMes: string): string {
  return `${anoMes}-01`;
}

export function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    d.setMonth(d.getMonth() - 1);
  }
  return out.reverse();
}

/** Parser de colagem em lote: empresa;periodo;premio_empresa;premio_continuidade;sinistro */
export function parseColagem(texto: string): {
  empresa: string;
  periodo: string;
  premioEmpresa: number;
  premioContinuidade: number;
  sinistro: number;
}[] {
  const num = (s: string) => {
    const clean = (s || "")
      .replace(/[R$\s.]/g, "")
      .replace(",", ".")
      .replace(/[^0-9.\-]/g, "");
    const n = Number(clean);
    return isNaN(n) ? 0 : n;
  };
  const per = (s: string) => {
    const t = (s || "").trim();
    let m = /^(\d{4})-(\d{2})/.exec(t);
    if (m) return `${m[1]}-${m[2]}-01`;
    m = /^(\d{2})\/(\d{4})$/.exec(t);
    if (m) return `${m[2]}-${m[1]}-01`;
    m = /^([a-zç]{3})\/?(\d{2,4})$/i.exec(t.replace(/\./g, ""));
    if (m) {
      const idx = MESES.indexOf(m[1].toLowerCase());
      if (idx >= 0) {
        const ano = m[2].length === 2 ? `20${m[2]}` : m[2];
        return `${ano}-${String(idx + 1).padStart(2, "0")}-01`;
      }
    }
    return "";
  };

  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha) => {
      const cols = linha.split(/\t|;/).map((c) => c.trim());
      return {
        empresa: cols[0] || "",
        periodo: per(cols[1] || ""),
        premioEmpresa: num(cols[2] || ""),
        premioContinuidade: num(cols[3] || ""),
        sinistro: num(cols[4] || ""),
      };
    })
    .filter((r) => r.empresa && r.periodo);
}
