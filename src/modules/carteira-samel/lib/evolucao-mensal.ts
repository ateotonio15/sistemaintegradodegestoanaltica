export const META_PADRAO = 0.7;
/** @deprecated use META_PADRAO / meta configurável por empresa */
export const BE_FATOR = META_PADRAO;

export interface LancamentoMensal {
  id: string;
  empresa_id: string;
  empresa_nome: string | null;
  periodo: string; // YYYY-MM-DD
  premio_empresa: number;
  premio_continuidade: number;
  sinistro: number | null;
  meta_sinistralidade?: number | null;
  hm_in_company?: number | null;
  fisioterapia_in_company?: number | null;
  administrativo_in_company?: number | null;
  observacao?: string | null;
}

export interface LinhaEvolucao {
  periodo: string;
  empresaId: string;
  empresaNome: string;
  premioEmpresa: number;
  premioContinuidade: number;
  premioTotal: number;
  sinistro: number; // sinistro puro (operadora)
  hmInCompany: number;
  fisioInCompany: number;
  adminInCompany: number;
  inCompanyTotal: number;
  sinistroTotal: number;
  meta: number; // fração (0.70 / 0.75)
  sinistralidade: number; // fração (0.8064)
  beMeta: number;
  /** @deprecated alias de beMeta */
  be70: number;
  distorcao: number; // fração (0.1520)
  aporte: number; // R$
  sinistroPendente?: boolean;
}

/**
 * Regras:
 *  premio_total    = premio_empresa + premio_continuidade
 *  sinistro_total  = sinistro + hm + fisioterapia + administrativo (in company)
 *  sinistralidade  = sinistro_total / premio_total
 *  be_meta         = premio_total * meta
 *  distorcao       = (sinistralidade / meta) - 1
 *  aporte          = (sinistro_total - be_meta) / meta
 *   > 0 → aporte a favor da operadora | < 0 → crédito para a empresa
 */
export function calcular(
  premioEmpresa: number,
  premioContinuidade: number,
  sinistro: number,
  meta: number = META_PADRAO,
  inCompany: { hm?: number; fisio?: number; admin?: number } = {},
) {
  const m = meta > 0 ? meta : META_PADRAO;
  const hm = inCompany.hm || 0;
  const fisio = inCompany.fisio || 0;
  const admin = inCompany.admin || 0;
  const inCompanyTotal = hm + fisio + admin;
  const sinistroTotal = (sinistro || 0) + inCompanyTotal;
  const premioTotal = (premioEmpresa || 0) + (premioContinuidade || 0);
  const beMeta = premioTotal * m;
  const sinistralidade = premioTotal ? sinistroTotal / premioTotal : 0;
  const distorcao = beMeta ? sinistroTotal / beMeta - 1 : 0;
  const aporte = (sinistroTotal - beMeta) / m;
  return {
    premioTotal,
    hmInCompany: hm,
    fisioInCompany: fisio,
    adminInCompany: admin,
    inCompanyTotal,
    sinistroTotal,
    meta: m,
    beMeta,
    be70: beMeta,
    sinistralidade,
    distorcao,
    aporte,
  };
}

export function toLinha(l: LancamentoMensal): LinhaEvolucao {
  const sinistroPendente = l.sinistro === null || l.sinistro === undefined;
  const premioEmpresa = Number(l.premio_empresa) || 0;
  const premioContinuidade = Number(l.premio_continuidade) || 0;
  const sinistro = Number(l.sinistro) || 0;
  const meta = Number(l.meta_sinistralidade) || META_PADRAO;
  const c = calcular(premioEmpresa, premioContinuidade, sinistro, meta, {
    hm: Number(l.hm_in_company) || 0,
    fisio: Number(l.fisioterapia_in_company) || 0,
    admin: Number(l.administrativo_in_company) || 0,
  });
  return {
    periodo: l.periodo,
    empresaId: l.empresa_id,
    empresaNome: l.empresa_nome || "—",
    premioEmpresa,
    premioContinuidade,
    sinistro,
    ...c,
    sinistroPendente,
  };
}

/** Consolida várias linhas (grupo) somando valores e recalculando indicadores. */
export function consolidar(linhas: LinhaEvolucao[], periodo: string): LinhaEvolucao {
  const premioEmpresa = linhas.reduce((s, l) => s + l.premioEmpresa, 0);
  const premioContinuidade = linhas.reduce((s, l) => s + l.premioContinuidade, 0);
  const sinistro = linhas.reduce((s, l) => s + l.sinistro, 0);
  const hm = linhas.reduce((s, l) => s + l.hmInCompany, 0);
  const fisio = linhas.reduce((s, l) => s + l.fisioInCompany, 0);
  const admin = linhas.reduce((s, l) => s + l.adminInCompany, 0);
  // meta consolidada: média ponderada pelo prêmio total (idêntica quando todos usam a mesma meta)
  const premioTot = linhas.reduce((s, l) => s + l.premioTotal, 0);
  const meta = premioTot
    ? linhas.reduce((s, l) => s + l.meta * l.premioTotal, 0) / premioTot
    : linhas[0]?.meta || META_PADRAO;
  const c = calcular(premioEmpresa, premioContinuidade, sinistro, meta, { hm, fisio, admin });
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

export function fmtPct(v: number, casas = 2): string {
  return `${(v * 100).toFixed(casas).replace(".", ",")}%`;
}

export function fmtPctSinal(v: number, casas = 2): string {
  return `${v > 0 ? "+" : ""}${fmtPct(v, casas)}`;
}

export function fmtMoedaSinal(v: number): string {
  return `${v > 0 ? "+" : ""}${fmtMoeda(v)}`;
}

/** Rótulo do break even conforme a meta: "BE 75%" */
export function labelMeta(meta: number): string {
  return `BE ${(meta * 100).toFixed(meta * 100 % 1 === 0 ? 0 : 2).replace(".", ",")}%`;
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

/** Parser de colagem em lote: empresa;periodo;premio_empresa;premio_continuidade;sinistro[;hm;fisio;adm] */
export function parseColagem(texto: string): {
  empresa: string;
  periodo: string;
  premioEmpresa: number;
  premioContinuidade: number;
  sinistro: number;
  hm: number;
  fisio: number;
  admin: number;
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
        hm: num(cols[5] || ""),
        fisio: num(cols[6] || ""),
        admin: num(cols[7] || ""),
      };
    })
    .filter((r) => r.empresa && r.periodo);
}

/* ==================== Importação em lote via CSV ==================== */

export const CSV_CABECALHO = [
  "empresa",
  "periodo",
  "premio_empresa",
  "premio_continuidade",
  "premio_total",
  "fisioterapia_in_company",
  "sinistro",
  "meta_sinistralidade",
] as const;

export const CSV_MODELO = `${CSV_CABECALHO.join(",")}
Empresa Exemplo,2026-05,5013457.56,18431.92,5031889.48,33777.25,3669951.12,0.75
Empresa Exemplo,2026-06,5020000.00,18431.92,,0,,0.75
`;

export interface LinhaCsv {
  indice: number;
  empresaTexto: string;
  empresaId: string | null;
  empresaNome: string;
  periodo: string; // YYYY-MM-01
  periodoTexto: string;
  premioEmpresa: number;
  premioContinuidade: number;
  premioTotalCsv: number | null;
  fisio: number;
  sinistro: number | null;
  meta: number | null;
  erros: string[];
  avisos: string[];
  duplicada: boolean;
}

function normalizaNome(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numeroCsv(s: string | undefined): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  // aceita "1.234,56" (pt-BR) e "1234.56"
  const ptBR = /,\d{1,2}$/.test(t);
  const clean = ptBR ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\s/g, "");
  const n = Number(clean.replace(/[R$\s]/g, ""));
  return isNaN(n) ? null : n;
}

function splitLinhaCsv(linha: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else aspas = !aspas;
    } else if ((c === "," || c === ";") && !aspas) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Faz o parse do CSV de lançamentos mensais, validando empresa/período. */
export function parseCsvLancamentos(
  texto: string,
  empresas: { id: string; nome: string }[],
  existentes: { empresa_id: string; periodo: string }[] = [],
): LinhaCsv[] {
  const linhas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (!linhas.length) return [];

  const header = splitLinhaCsv(linhas[0]).map((h) => normalizaNome(h).replace(/ /g, "_"));
  const temHeader = header.includes("empresa") && header.includes("periodo");
  const idx = (nome: string) => {
    const i = header.indexOf(nome);
    return i >= 0 ? i : CSV_CABECALHO.indexOf(nome as any);
  };
  const col = {
    empresa: temHeader ? idx("empresa") : 0,
    periodo: temHeader ? idx("periodo") : 1,
    premioEmpresa: temHeader ? idx("premio_empresa") : 2,
    premioContinuidade: temHeader ? idx("premio_continuidade") : 3,
    premioTotal: temHeader ? idx("premio_total") : 4,
    fisio: temHeader ? idx("fisioterapia_in_company") : 5,
    sinistro: temHeader ? idx("sinistro") : 6,
    meta: temHeader ? idx("meta_sinistralidade") : 7,
  };

  const mapaEmpresas = new Map(empresas.map((e) => [normalizaNome(e.nome), e]));
  const chavesExistentes = new Set(
    existentes.map((e) => `${e.empresa_id}|${String(e.periodo).slice(0, 7)}`),
  );

  const corpo = temHeader ? linhas.slice(1) : linhas;
  const vistas = new Set<string>();

  return corpo.map((linha, i) => {
    const cols = splitLinhaCsv(linha);
    const get = (c: number) => (c >= 0 ? cols[c] : undefined);
    const erros: string[] = [];
    const avisos: string[] = [];

    const empresaTexto = (get(col.empresa) || "").trim();
    const emp = mapaEmpresas.get(normalizaNome(empresaTexto)) || null;
    if (!empresaTexto) erros.push("Empresa não informada");
    else if (!emp) erros.push("Empresa não encontrada na carteira");

    const periodoTexto = (get(col.periodo) || "").trim();
    let periodo = "";
    const m = /^(\d{4})-(\d{1,2})/.exec(periodoTexto) || null;
    const m2 = /^(\d{1,2})\/(\d{4})$/.exec(periodoTexto);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      periodo = `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-01`;
    } else if (m2 && Number(m2[1]) >= 1 && Number(m2[1]) <= 12) {
      periodo = `${m2[2]}-${String(Number(m2[1])).padStart(2, "0")}-01`;
    } else {
      erros.push("Período inválido (use AAAA-MM)");
    }

    const premioEmpresa = numeroCsv(get(col.premioEmpresa)) ?? 0;
    const premioContinuidade = numeroCsv(get(col.premioContinuidade)) ?? 0;
    const premioTotalCsv = numeroCsv(get(col.premioTotal));
    const fisio = numeroCsv(get(col.fisio)) ?? 0;
    const sinistro = numeroCsv(get(col.sinistro));
    const meta = numeroCsv(get(col.meta));

    if (premioTotalCsv != null) {
      const soma = premioEmpresa + premioContinuidade;
      if (Math.abs(soma - premioTotalCsv) > 0.02) {
        avisos.push(
          `Prêmio total do CSV (${fmtMoeda(premioTotalCsv)}) difere da soma (${fmtMoeda(soma)})`,
        );
      }
    }
    if (sinistro == null) avisos.push("Sinistro em branco — será importado sem sinistro");

    const chave = emp ? `${emp.id}|${periodo.slice(0, 7)}` : "";
    let duplicada = false;
    if (chave) {
      if (chavesExistentes.has(chave)) duplicada = true;
      if (vistas.has(chave)) avisos.push("Linha repetida dentro do próprio CSV");
      vistas.add(chave);
    }

    return {
      indice: i + 1,
      empresaTexto,
      empresaId: emp?.id ?? null,
      empresaNome: emp?.nome ?? empresaTexto,
      periodo,
      periodoTexto,
      premioEmpresa,
      premioContinuidade,
      premioTotalCsv,
      fisio,
      sinistro,
      meta: meta != null ? (meta > 1 ? meta / 100 : meta) : null,
      erros,
      avisos,
      duplicada,
    };
  });
}
