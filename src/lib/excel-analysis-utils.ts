import ExcelJS from "exceljs";
import { getForceGroupByNamePatterns } from "@/lib/regras-empresariais";

export interface CategoriaResultado {
  beneficiarios: number;
  mensalidade: number;
  total: number;
}

export interface RetroativaMesDetalhe {
  mes: string;         // "MAR/26"
  quantidade: number;
  total: number;
}

export interface InclusaoResultado {
  quantidade: number;
  total: number;
  /** Meses de referência (ex.: "MAR/26") detectados em abas/pivots de cobrança retroativa. */
  meses?: string[];
  /** Detalhe por mês com quantidade e valor. */
  mesesDetalhe?: RetroativaMesDetalhe[];
}

/** Item por sub-estipulante ("PJ - <NOME>") no pivot de Coparticipação. */
export interface CoparticipacaoSubstipulante {
  nome: string;
  quantidade: number;
  total: number;
}

/** Bloco de "Complemento" (proporcional cobrado à parte) da aba RESUMO. */
export interface ComplementoResultado {
  quantidade: number;
  total: number;
  /** Rótulo do período informado na planilha (ex.: "Agosto/2026"). */
  periodoLabel?: string | null;
  /** Descrições das linhas de complemento encontradas. */
  itens?: { nome: string; quantidade: number; total: number }[];
}

/** Bloco de Coparticipação — Empresarial extraído do pivot da aba RESUMO. */
export interface CoparticipacaoResultado {
  quantidade: number;
  total: number;
  substipulantes?: CoparticipacaoSubstipulante[];
}



/**
 * Quando o retroativo do bloco veio de abas dedicadas ("C.RETROATIVA MAI26"),
 * ele é de reajuste — não de beneficiários específicos.
 */
function reclassificarRetroComoReajuste(b: {
  retroativas?: InclusaoResultado;
  retroativasReajuste?: InclusaoResultado;
  retroativasBeneficiarios?: InclusaoResultado;
}) {
  if (!b.retroativas) return;
  b.retroativasReajuste = { ...b.retroativas };
  b.retroativasBeneficiarios = undefined;
}

export interface AnaliseResultado {
  pagador: string;
  /** CNPJ normalizado (14 dígitos) do pagador da planilha, quando identificado. */
  cnpj?: string;
  /** Nome formatado para UI no formato "NOME — 0001-69". */
  nomeExibicao?: string;
  enfermaria: CategoriaResultado;
  apartamento: CategoriaResultado;
  /** Inclusões — total agregado (inclui retroativas, p/ comparação com PDF). */
  inclusoes: InclusaoResultado;
  /** Cobrança Retroativa — subset de inclusoes, exibido como linha própria. */
  retroativas?: InclusaoResultado;
  /** Parte do retroativo vinda de abas dedicadas (ex.: "C.RETROATIVA MAI26") — reajuste. */
  retroativasReajuste?: InclusaoResultado;
  /** Parte do retroativo vinda de linhas do relatório de beneficiários. */
  retroativasBeneficiarios?: InclusaoResultado;
  /** Apenas Análise Moto Honda — total geralmente negativo. */
  exclusoes?: InclusaoResultado;
  /** Devoluções — categoria própria com valor negativo (crédito). */
  devolucoes?: InclusaoResultado;
  /** Permuta — categoria própria com valor negativo (abatimento). */
  permuta?: InclusaoResultado;
  /** Taxa de Adesão — cobrada uma única vez por adesão. */
  taxaAdesao?: InclusaoResultado;
  /** Detalhamento por faixa etária quando disponível na RESUMO. */
  faixasEtarias?: FaixaEtariaResumo[];
  /** Coparticipação — Empresarial (pivot da aba RESUMO). */
  coparticipacao?: CoparticipacaoResultado;
  /** Complemento/proporcional cobrado separadamente (aba RESUMO). */
  complemento?: ComplementoResultado;
  /** Valor total declarado pela própria planilha (linha TOTAL do bloco). */
  totalDeclaradoExcel?: number;
  avisos: string[];
}

/** Bloco analítico de uma planilha agrupado por CNPJ. */
export interface AnalisePorCnpj {
  cnpj: string;              // 14 dígitos, vazio se não houver coluna CNPJ
  nome: string;              // nome cru, vindo da coluna Pagador / Nome
  nomeExibicao: string;      // "NOME — 0001-69" (ou só nome se sem CNPJ)
  enfermaria: CategoriaResultado;
  apartamento: CategoriaResultado;
  inclusoes: InclusaoResultado;
  retroativas?: InclusaoResultado;
  /** Parte do retroativo vinda de abas dedicadas (reajuste). */
  retroativasReajuste?: InclusaoResultado;
  /** Parte do retroativo vinda do relatório de beneficiários. */
  retroativasBeneficiarios?: InclusaoResultado;
  exclusoes?: InclusaoResultado;
  devolucoes?: InclusaoResultado;
  permuta?: InclusaoResultado;
  taxaAdesao?: InclusaoResultado;
  /** Detalhamento por faixa etária (quando a aba RESUMO contém faixas). */
  faixasEtarias?: FaixaEtariaResumo[];
  /** Coparticipação — Empresarial (pivot da aba RESUMO). */
  coparticipacao?: CoparticipacaoResultado;
  /** Complemento/proporcional cobrado separadamente (aba RESUMO). */
  complemento?: ComplementoResultado;
  /** Valor total declarado pela própria planilha (linha TOTAL do bloco). */
  totalDeclaradoExcel?: number;
  avisos: string[];
}

/** Linha de detalhamento por faixa etária extraída da aba RESUMO. */
export interface FaixaEtariaResumo {
  label: string;
  idadeInicial: number;
  idadeFinal: number | null;
  quantidade: number;
  total: number;
}




/** Validação simplificada (Moto Honda PDF sem detalhamento por categoria). */
export interface ComparacaoSimplificada {
  pagador: string;
  arquivoPdf: string | null;
  beneficiarios: { excel: number; pdf: number | null; ok: boolean } | null;
  inclusoes: { excel: number; pdf: number | null; ok: boolean } | null;
  exclusoes: { excel: number; pdf: number | null; ok: boolean } | null;
  divergencias: string[];
  avisosPdf: string[];
}

/** Converte valores do ExcelJS em texto, incluindo rich text e fórmulas. */
function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString();
  if (Array.isArray(v)) return v.map(cellToText).join(" ");
  if (typeof v === "object") {
    const any = v as any;
    if (Array.isArray(any.richText)) return any.richText.map((p: any) => cellToText(p?.text)).join("");
    if ("result" in any && any.result !== undefined && any.result !== null) return cellToText(any.result);
    if ("text" in any) return cellToText(any.text);
    if ("formula" in any) return cellToText(any.formula);
  }
  return String(v ?? "");
}

/** Normaliza string: minúsculo, sem acentos, sem espaços nas pontas. */
function norm(s: unknown): string {
  return cellToText(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Converte qualquer célula em número (aceita "R$ 1.234,56"). */
function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in (v as any)) {
    return toNumber((v as any).result);
  }
  let s = cellToText(v).trim();
  // Remove símbolos de moeda e espaços
  s = s.replace(/[R$\s]/g, "");
  // Se tiver vírgula como decimal: "1.234,56" -> "1234.56"
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/** Variações aceitas para cada coluna. */
const COL_PLANO = ["plano", "planos", "tipo plano", "tipo de plano", "nome do plano"];
const COL_TIPO_COBRANCA = [
  "tipo cobranca",
  "tipo de cobranca",
  "tipo cobrança",
  "cobranca",
  "movimento",
  "tipo movimento",
];
const COL_VALOR = ["valor", "mensalidade", "valor mensalidade", "vlr", "preco", "valor total"];
const COL_CNPJ = ["cnpj", "cnpj pagador", "cnpj do pagador", "cnpj empresa"];
const COL_PAGADOR = ["subestipulante", "sub estipulante", "sub-estipulante", "pagador", "nome pagador", "nome do pagador", "razao social", "razão social", "empresa", "contratante", "nome empresa", "nome da empresa"];
const COL_FAIXA_ETARIA = ["fx etaria", "fx etária", "faixa etaria", "faixa etária", "grupo faixa etaria", "grupo faixa etária"];
const COL_DATA_ADESAO = ["dt adesao", "data adesao", "data de adesao", "adesao", "inclusao em", "data inclusao"];

/** Normalização "agressiva" para casamento de nomes: remove pontuação e colapsa espaços. */
function normMatch(s: unknown): string {
  return norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove tudo que não é dígito (para comparar CNPJs). */
export function normalizarCnpj(s: unknown): string {
  const d = String(s ?? "").replace(/\D/g, "");
  // Células numéricas perdem zeros à esquerda (ex.: 7448261000118 →
  // 07.448.261/0001-18). Reconstitui o CNPJ com 14 dígitos.
  if (d.length >= 12 && d.length < 14) return d.padStart(14, "0");
  return d;
}


/** Retorna "0001-69" a partir dos 14 dígitos do CNPJ (filial + DV). */
export function formatCnpjSufixo(cnpj: unknown): string {
  const d = normalizarCnpj(cnpj);
  if (d.length < 14) return "";
  return `${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Formata CNPJ completo: "00.000.000/0001-69". */
export function formatCnpjCompleto(cnpj: unknown): string {
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14) return String(cnpj ?? "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** "APOEMA RESTAURANTES LTDA — 0001-69" (cai para só nome se CNPJ ausente). */
export function formatNomeComCnpj(nome: unknown, cnpj: unknown): string {
  const sufixo = formatCnpjSufixo(cnpj);
  const n = String(nome ?? "").trim() || "Sem nome";
  return sufixo ? `${n} — ${sufixo}` : n;
}

/**
 * Varre todas as worksheets do workbook procurando padrões de CNPJ em qualquer
 * célula string. Constrói um mapa `nomeNormalizado → cnpj14d` usando o texto
 * que aparece antes do CNPJ na mesma célula (ex.: "GNL BRASIL LOGISTICA S.A 47.548.779/0001-48")
 * ou, como fallback, a célula imediatamente à esquerda.
 *
 * Prioriza a aba cujo nome contenha "resumo".
 */
function extrairCnpjsDoWorkbook(wb: ExcelJS.Workbook): { porNome: Map<string, string>; todos: Set<string> } {
  const porNome = new Map<string, string>();
  const todos = new Set<string>();
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g;

  const sheets = [...wb.worksheets].sort((a, b) => {
    const ra = norm(a.name).includes("resumo") ? 0 : 1;
    const rb = norm(b.name).includes("resumo") ? 0 : 1;
    return ra - rb;
  });

  for (const ws of sheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1);
      values.forEach((cell, i) => {
        const s = cellToText(cell);
        if (!s) return;
        let m: RegExpExecArray | null;
        reCnpj.lastIndex = 0;
        while ((m = reCnpj.exec(s)) !== null) {
          const cnpj = normalizarCnpj(m[1]);
          if (cnpj.length !== 14) continue;
          todos.add(cnpj);
          // Nome candidato: trecho antes do CNPJ na mesma célula
          let nome = s.slice(0, m.index).trim();
          // Limpa prefixos comuns ("EMPRESA :", "Pagador:", etc.)
          nome = nome.replace(/^(empresa|pagador|razao social|razão social)\s*[:\-]\s*/i, "").trim();
          // Fallback: célula à esquerda
          if (!nome && i > 0) nome = cellToText(values[i - 1]).trim();
          if (!nome) continue;
          const key = normMatch(nome);
          if (key && !porNome.has(key)) porNome.set(key, cnpj);
        }
      });
    });
  }

  return { porNome, todos };
}

export interface FiltroPagador {
  cnpj?: string | null;
  nome?: string | null;
}


function findColumnIndex(header: unknown[], aliases: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (!h) continue;
    for (const alias of aliases) {
      const aliasNorm = norm(alias);
      const hMatch = normMatch(h);
      const aliasMatch = normMatch(aliasNorm);
      if (
        h === aliasNorm ||
        h.includes(aliasNorm) ||
        hMatch === aliasMatch ||
        hMatch.includes(aliasMatch)
      ) return i;
    }
  }
  return -1;
}

/**
 * Coluna de pagador precisa priorizar Subestipulante quando existir.
 * Em alguns relatórios (ex.: Jabil) há também "Contratante" antes dela,
 * mas Contratante é o contrato-mãe e não separa matriz/filial.
 */
function findPagadorColumnIndex(header: unknown[]): number {
  for (const alias of COL_PAGADOR) {
    const idx = findColumnIndex(header, [alias]);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Classifica o nome do plano em "enfermaria" | "apartamento" | null. */
function classificarPlano(plano: string): "enfermaria" | "apartamento" | null {
  const p = norm(plano);
  if (!p) return null;
  // Apartamento (verificar antes pq "executivo" pode aparecer junto com "master")
  if (
    p.includes("master executivo") ||
    p.includes("coletivo executivo master") ||
    p.includes("apartamento") ||
    // Variações abreviadas de "M. Executivo" / "M Executivo" / "M.Executivo"
    /\bm[\s.\-_]*executivo\b/.test(p) ||
    /\bexecutivo\b/.test(p)
  ) {
    return "apartamento";
  }
  if (
    p.includes("coletivo empresarial master") ||
    p.includes("master empresarial") ||
    p.includes("enfermaria") ||
    // Variações abreviadas: "Enf CE", "Enf. CE", "ENF-CE"
    /\benf(\b|[\s.\-_])/i.test(p) ||
    // Variações abreviadas de "M. Empresarial" / "M Empresarial" / "M.Empresarial"
    /\bm[\s.\-_]*empresarial\b/.test(p) ||
    /\bempresarial\b/.test(p)
  ) {
    return "enfermaria";
  }
  // Classes sem acomodação no nome (ex.: Reflect "Gold" / "Gold Plus"):
  // a versão "Plus" equivale ao Apartamento; a base equivale à Enfermaria.
  if (/\b(gold|class|classic)\s*\+|\b(gold|class|classic)[\s.\-_]*plus\b/.test(p)) {
    return "apartamento";
  }
  if (/\b(gold|class|classic)\b/.test(p)) {
    return "enfermaria";
  }
  return null;
}

function parseFaixaEtariaLabel(raw: unknown): FaixaEtariaResumo | null {
  const original = cellToText(raw).trim();
  if (!original) return null;
  const s = norm(original)
    .replace(/anos?/g, "")
    .replace(/idade/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const faixa = s.match(/(\d{1,3})\s*(?:[àa]|-|–|—|ate|até)\s*(\d{1,3})/i);
  if (faixa) {
    const ini = parseInt(faixa[1], 10);
    const fim = parseInt(faixa[2], 10);
    return { label: `${ini} à ${fim}`, idadeInicial: ini, idadeFinal: fim, quantidade: 0, total: 0 };
  }
  const mais = s.match(/(\d{1,3})\s*(?:\+|mais|acima)/i);
  if (mais) {
    const ini = parseInt(mais[1], 10);
    return { label: `${ini}+`, idadeInicial: ini, idadeFinal: null, quantidade: 0, total: 0 };
  }
  return null;
}

function isInclusao(tipo: string): boolean {
  const t = norm(tipo);
  // Inclusão/Inclusões e Cobrança Retroativa (ex.: "C. RETROATIVA", "Cob. Retroativo")
  // são tratadas como acréscimos e somadas em Inclusões.
  // Aceita singular e plural: "inclusao", "inclusoes" (após norm remove acentos).
  return t.includes("inclus") || t.includes("retroativ");
}

function isRetroativa(tipo: string): boolean {
  return norm(tipo).includes("retroativ");
}

function isExclusao(tipo: string): boolean {
  const t = norm(tipo);
  // Aceita singular e plural: "exclusao", "exclusoes", "excluido(s)", "excluida(s)".
  return t.includes("exclus") || t.includes("excluid");
}

function isDevolucao(tipo: string): boolean {
  const t = norm(tipo);
  // Aceita singular e plural: "devolucao", "devolucoes", "devolvido(s)", "devolvida(s)".
  return t.includes("devolu") || t.includes("devolvid");
}

function isPermuta(tipo: string): boolean {
  return norm(tipo).includes("permuta");
}

export function isTaxaAdesao(tipo: string): boolean {
  const t = norm(tipo);
  // Casa "Taxa de Adesão", "TAXA ADESAO", "Adesão", "Adesao"
  return /\bades[aã]o\b/.test(t) || t.includes("taxa de adesao") || t.includes("taxa adesao");
}

function rowHasTaxaAdesao(row: unknown[], idxTipo: number): boolean {
  if (idxTipo >= 0 && isTaxaAdesao(String(row[idxTipo] ?? ""))) return true;
  return row.some((cell) => isTaxaAdesao(String(cell ?? "")));
}




/**
 * Versão com filtro opcional por pagador (CNPJ prioritário, nome como fallback).
 */
export async function analisarExcelFinanceiroPorPagador(
  buffer: ArrayBuffer,
  filtro?: FiltroPagador,
): Promise<Omit<AnaliseResultado, "pagador">> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  const avisos: string[] = [];

  const empty: CategoriaResultado = { beneficiarios: 0, mensalidade: 0, total: 0 };

  if (!ws) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { quantidade: 0, total: 0 },
      avisos: ["Planilha vazia ou ilegível."],
    };
  }

  // Coletar todas as linhas brutas (limite alto para suportar relatórios grandes)
  const MAX_ROWS = 200_000;
  const allRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length >= MAX_ROWS) return;
    const values = (row.values as unknown[]).slice(1); // ExcelJS é 1-indexed
    allRows.push(values);
  });

  // Procurar a linha de cabeçalho dentro das primeiras 10
  let headerRow: unknown[] | null = null;
  let headerIdx = -1;
  let idxPlano = -1;
  let idxTipo = -1;
  let idxValor = -1;
  let idxCnpj = -1;
  let idxPagador = -1;
  let idxFaixa = -1;

  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const r = allRows[i];
    const p = findColumnIndex(r, COL_PLANO);
    const t = findColumnIndex(r, COL_TIPO_COBRANCA);
    const v = findColumnIndex(r, COL_VALOR);
    if (p >= 0 || t >= 0) {
      headerRow = r;
      headerIdx = i;
      idxPlano = p;
      idxTipo = t;
      idxValor = v;
      idxCnpj = findColumnIndex(r, COL_CNPJ);
      idxPagador = findPagadorColumnIndex(r);
      idxFaixa = findColumnIndex(r, COL_FAIXA_ETARIA);
      break;
    }
  }

  if (!headerRow) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { quantidade: 0, total: 0 },
      avisos: [
        "Não foi possível identificar a linha de cabeçalho (esperado: 'Plano' e 'Tipo Cobrança').",
      ],
    };
  }

  if (idxPlano < 0) avisos.push("Coluna 'Plano' não encontrada.");
  if (idxTipo < 0) avisos.push("Coluna 'Tipo Cobrança' não encontrada.");
  if (idxValor < 0) avisos.push("Coluna 'Valor' / 'Mensalidade' não encontrada — totais serão 0.");

  // Filtro por pagador
  const temFiltro = !!(filtro && (filtro.cnpj || filtro.nome));
  const filtroCnpj = filtro?.cnpj ? normalizarCnpj(filtro.cnpj) : "";
  const filtroNome = filtro?.nome ? norm(filtro.nome) : "";

  if (temFiltro && idxCnpj < 0 && idxPagador < 0) {
    avisos.push(
      "Não foi possível separar por pagador: planilha sem coluna 'CNPJ' ou 'Pagador'. Mostrando totais agregados.",
    );
  }

  const podeFiltrar = temFiltro && (idxCnpj >= 0 || idxPagador >= 0);

  const enfValores: number[] = [];
  const aptValores: number[] = [];
  let incQtd = 0;
  let incTotal = 0;
  let retroQtd = 0;
  let retroTotal = 0;
  let excQtd = 0;
  let excTotal = 0;
  let devQtd = 0;
  let devTotal = 0;
  let permQtd = 0;
  let permTotal = 0;
  let adesaoQtd = 0;
  let adesaoTotal = 0;


  let linhasCasadas = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;

    // Aplicar filtro por pagador (CNPJ primeiro, nome como fallback)
    if (podeFiltrar) {
      let casou = false;
      if (idxCnpj >= 0 && filtroCnpj) {
        const cnpjLinha = normalizarCnpj(r[idxCnpj]);
        if (cnpjLinha && cnpjLinha === filtroCnpj) casou = true;
      }
      if (!casou && idxPagador >= 0 && filtroNome) {
        const nomeLinha = norm(r[idxPagador]);
        if (nomeLinha && (nomeLinha === filtroNome || nomeLinha.includes(filtroNome) || filtroNome.includes(nomeLinha))) {
          casou = true;
        }
      }
      if (!casou) continue;
      linhasCasadas++;
    }

    const planoCell = idxPlano >= 0 ? r[idxPlano] : "";
    const tipoCell = idxTipo >= 0 ? r[idxTipo] : "";
    const valorCell = idxValor >= 0 ? r[idxValor] : 0;

    const valor = toNumber(valorCell);
    const valorNum = isNaN(valor) ? 0 : valor;
    const valorValido = !isNaN(valor) && valor >= 0;

    if (rowHasTaxaAdesao(r, idxTipo)) {
      adesaoQtd += 1;
      if (valorValido) adesaoTotal += valor;
      continue;
    }

    if (idxTipo >= 0 && isPermuta(String(tipoCell))) {
      permQtd += 1;
      permTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }

    if (idxTipo >= 0 && isDevolucao(String(tipoCell))) {
      devQtd += 1;
      devTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }


    if (idxTipo >= 0 && isExclusao(String(tipoCell))) {
      excQtd += 1;
      excTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }


    if (idxTipo >= 0 && isInclusao(String(tipoCell))) {
      incQtd += 1;
      if (valorValido) incTotal += valor;
      if (isRetroativa(String(tipoCell))) {
        retroQtd += 1;
        if (valorValido) retroTotal += valor;
      }
      continue;
    }


    if (idxPlano < 0) continue;

    const cat = classificarPlano(String(planoCell));
    if (!cat) continue;

    if (cat === "enfermaria") {
      enfValores.push(valorValido ? valor : 0);
    } else {
      aptValores.push(valorValido ? valor : 0);
    }
  }

  if (podeFiltrar && linhasCasadas === 0) {
    avisos.push("Nenhuma linha encontrada para este pagador na planilha.");
  }

  const buildCategoria = (vals: number[]): CategoriaResultado => {
    const total = vals.reduce((s, v) => s + v, 0);
    const beneficiarios = vals.length;
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };

  const result: Omit<AnaliseResultado, "pagador"> = {
    enfermaria: buildCategoria(enfValores),
    apartamento: buildCategoria(aptValores),
    inclusoes: { quantidade: incQtd, total: incTotal },
    avisos,
  };
  if (retroQtd > 0 || retroTotal !== 0) {
    result.retroativas = { quantidade: retroQtd, total: retroTotal };
  }
  if (excQtd > 0 || excTotal !== 0) {
    result.exclusoes = { quantidade: excQtd, total: excTotal };
  }
  if (devQtd > 0 || devTotal !== 0) {
    result.devolucoes = { quantidade: devQtd, total: devTotal };
  }
  if (permQtd > 0 || permTotal !== 0) {
    result.permuta = { quantidade: permQtd, total: permTotal };
  }
  if (adesaoQtd > 0 || adesaoTotal !== 0) {
    result.taxaAdesao = { quantidade: adesaoQtd, total: adesaoTotal };
  }



  return result;
}

/**
 * Lê um buffer .xlsx/.xls e devolve análise: Enfermaria, Apartamento e Inclusões.
 * Wrapper sem filtro (compatibilidade) — chama analisarExcelFinanceiroPorPagador.
 */
export async function analisarExcelFinanceiro(
  buffer: ArrayBuffer,
): Promise<Omit<AnaliseResultado, "pagador">> {
  return analisarExcelFinanceiroPorPagador(buffer);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(n: number): string {
  if (!isFinite(n)) return "R$ 0,00";
  return brl.format(n);
}

// =====================================================================
// Comparação Excel × PDF (validação cruzada)
// =====================================================================

import type { AnalisePdfResultado } from "./pdf-analysis-utils";

export interface CampoValidacao {
  excel: number;
  pdf: number | null;
  ok: boolean;
}

export interface ComparacaoCategoria {
  beneficiarios: CampoValidacao;
  mensalidade: CampoValidacao;
  total: CampoValidacao;
}

export interface ComparacaoResultado {
  pagador: string;
  arquivoPdf: string | null;
  enfermaria: ComparacaoCategoria | null;
  apartamento: ComparacaoCategoria | null;
  inclusoes: { total: CampoValidacao } | null;
  /** Exclusões — comparação Excel × histórico da NFS-e (valor negativo). */
  exclusoes: { total: CampoValidacao } | null;
  /** Devoluções — comparação Excel × histórico da NFS-e (valor negativo). */
  devolucoes: { total: CampoValidacao } | null;
  divergencias: string[];
  avisosPdf: string[];
  /** CNPJ (14 dígitos) do bloco analisado, quando disponível. */
  cnpj?: string;
  /** Nome formatado para exibição ("NOME — 0001-69"). */
  nomeExibicao?: string;
  /** Motivo declarativo quando não há PDF casado (ex.: "NF não localizada para este CNPJ"). */
  motivoSemPdf?: string;
  /** CNPJ do tomador, conforme PDF casado. */
  tomadorCnpj?: string | null;
  /** Nome do tomador conforme PDF casado. */
  tomadorNome?: string | null;
  /** Número da NFS-e conforme PDF casado. */
  nfNumero?: string | null;
  /** Valor Líquido da NFS-e conforme PDF casado. */
  valorLiquido?: number | null;
  /** Tributos extraídos do PDF (parciais). */
  tributos?: import("./pdf-analysis-utils").PdfTributos | null;
}

/** Nota fiscal cujo CNPJ do tomador não aparece em nenhum bloco do Excel. */
export interface NotaOrfa {
  arquivo: string;
  tomadorCnpj: string;        // 14 dígitos, "" se não detectado
  tomadorNome: string | null;
  valorLiquido: number | null;
  nfNumero: string | null;
}


const eqMoney = (a: number, b: number) => Math.abs(a - b) < 0.01;
const eqInt = (a: number, b: number) => Math.round(a) === Math.round(b);

function campo(excel: number, pdf: number | null, kind: "money" | "int"): CampoValidacao {
  if (pdf === null || pdf === undefined || isNaN(pdf as number)) {
    return { excel, pdf: null, ok: false };
  }
  const ok = kind === "money" ? eqMoney(excel, pdf) : eqInt(excel, pdf);
  return { excel, pdf, ok };
}

export function obterDivergenciasNotaFiscal(
  dados: Pick<AnalisePdfResultado, "valorLiquido" | "tributos"> | null | undefined,
): string[] {
  const tributos = dados?.tributos;
  if (!tributos) return [];

  const divergencias: string[] = [];
  const aprox = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;
  const valorServico = tributos.valorServico;
  const valorLiquido = dados?.valorLiquido ?? null;
  const issqnDev = tributos.issqn;
  let issqnRet = tributos.issqnRetido;

  if (tributos.retencaoIssqn === "retido" && issqnRet == null && valorServico != null && valorLiquido != null) {
    const calculado = Number((valorServico - valorLiquido).toFixed(2));
    if (calculado > 0.01) issqnRet = calculado;
  }
  // Se ainda sem ISSQN Retido mas existe Apurado, assume igualdade (retido pelo tomador).
  if (tributos.retencaoIssqn === "retido" && issqnRet == null && issqnDev != null) {
    issqnRet = issqnDev;
  }

  if (tributos.retencaoIssqn === "retido" && issqnRet != null && issqnDev != null && !aprox(issqnRet, issqnDev)) {
    divergencias.push(
      `ISSQN Retido (${formatBRL(issqnRet)}) deveria ser igual ao ISSQN Apurado (${formatBRL(issqnDev)}).`,
    );
  }

  if (valorLiquido != null && valorServico != null) {
    if (tributos.retencaoIssqn === "retido" && issqnRet != null) {
      const esperado = Number((valorServico - issqnRet).toFixed(2));
      if (!aprox(esperado, valorLiquido)) {
        divergencias.push(
          `Valor Líquido (${formatBRL(valorLiquido)}) deveria ser Valor do Serviço − ISSQN Retido = ${formatBRL(esperado)}.`,
        );
      }
    } else if (tributos.retencaoIssqn === "nao_retido" && !aprox(valorServico, valorLiquido)) {
      divergencias.push(
        `ISSQN não retido: Valor Líquido (${formatBRL(valorLiquido)}) deveria ser igual ao Valor do Serviço (${formatBRL(valorServico)}).`,
      );
    }
  }

  return divergencias;
}

export function compararExcelComPdf(
  excel: AnaliseResultado,
  pdf: AnalisePdfResultado | null,
  tipoAnalise?: string | null,
): ComparacaoResultado {
  const divergencias: string[] = [];
  const isFaixaEtaria = String(tipoAnalise ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_") === "faixa_etaria";
  const tem = (c: { beneficiarios: number; total: number }) =>
    c.beneficiarios > 0 || c.total > 0;

  // Enfermaria
  let enfermaria: ComparacaoCategoria | null = null;
  if (tem(excel.enfermaria)) {
    const e = excel.enfermaria;
    const p = pdf?.enfermaria;
    const pdfEnc = p && (p.beneficiarios !== null || p.total > 0);
    enfermaria = {
      beneficiarios: campo(e.beneficiarios, pdfEnc ? p!.beneficiarios : null, "int"),
      mensalidade: campo(e.mensalidade, pdfEnc ? p!.mensalidade : null, "money"),
      total: campo(e.total, pdfEnc ? p!.total : null, "money"),
    };
    if (isFaixaEtaria) enfermaria.mensalidade.ok = true;
    if (pdf && !pdfEnc) divergencias.push("Categoria Enfermaria não encontrada no PDF.");
    else if (pdfEnc) {
      if (!enfermaria.beneficiarios.ok)
        divergencias.push(
          `Divergência nos beneficiários da enfermaria (Excel ${e.beneficiarios} × PDF ${p!.beneficiarios ?? "—"}).`,
        );
      if (!isFaixaEtaria && !enfermaria.mensalidade.ok)
        divergencias.push(
          `Divergência na mensalidade da enfermaria (Excel ${formatBRL(e.mensalidade)} × PDF ${p!.mensalidade !== null ? formatBRL(p!.mensalidade) : "—"}).`,
        );
      if (!enfermaria.total.ok)
        divergencias.push(
          `Total da enfermaria não confere com o PDF (Excel ${formatBRL(e.total)} × PDF ${formatBRL(p!.total)}).`,
        );
    }
  }

  // Apartamento
  let apartamento: ComparacaoCategoria | null = null;
  if (tem(excel.apartamento)) {
    const e = excel.apartamento;
    const p = pdf?.apartamento;
    const pdfEnc = p && (p.beneficiarios !== null || p.total > 0);
    apartamento = {
      beneficiarios: campo(e.beneficiarios, pdfEnc ? p!.beneficiarios : null, "int"),
      mensalidade: campo(e.mensalidade, pdfEnc ? p!.mensalidade : null, "money"),
      total: campo(e.total, pdfEnc ? p!.total : null, "money"),
    };
    if (isFaixaEtaria) apartamento.mensalidade.ok = true;
    if (pdf && !pdfEnc) divergencias.push("Categoria Apartamento não encontrada no PDF.");
    else if (pdfEnc) {
      if (!apartamento.beneficiarios.ok)
        divergencias.push(
          `Divergência nos beneficiários do apartamento (Excel ${e.beneficiarios} × PDF ${p!.beneficiarios ?? "—"}).`,
        );
      if (!isFaixaEtaria && !apartamento.mensalidade.ok)
        divergencias.push(
          `Divergência na mensalidade do apartamento (Excel ${formatBRL(e.mensalidade)} × PDF ${p!.mensalidade !== null ? formatBRL(p!.mensalidade) : "—"}).`,
        );
      if (!apartamento.total.ok)
        divergencias.push(
          `Total do apartamento não confere com o PDF (Excel ${formatBRL(e.total)} × PDF ${formatBRL(p!.total)}).`,
        );
    }
  }


  // Inclusões — só compara o total
  let inclusoes: { total: CampoValidacao } | null = null;
  if (excel.inclusoes.quantidade > 0 || excel.inclusoes.total > 0) {
    const pdfTotal = pdf ? pdf.inclusoes.total : null;
    const c = campo(excel.inclusoes.total, pdfTotal && pdfTotal > 0 ? pdfTotal : null, "money");
    inclusoes = { total: c };
    if (pdf && (!pdfTotal || pdfTotal <= 0))
      divergencias.push("Valor de inclusões não encontrado no PDF.");
    else if (pdf && !c.ok)
      divergencias.push(
        `Valor de inclusões divergente (Excel ${formatBRL(excel.inclusoes.total)} × PDF ${formatBRL(pdfTotal!)}).`,
      );
  }

  // Exclusões — só compara o total (valor sempre negativo)
  let exclusoes: { total: CampoValidacao } | null = null;
  if (excel.exclusoes && (excel.exclusoes.quantidade > 0 || excel.exclusoes.total !== 0)) {
    const pdfTotal = pdf && pdf.exclusoes.total !== null ? pdf.exclusoes.total : null;
    const c = campo(excel.exclusoes.total, pdfTotal, "money");
    exclusoes = { total: c };
    if (pdf && pdfTotal === null)
      divergencias.push("Valor de exclusões não encontrado no PDF.");
    else if (pdf && !c.ok)
      divergencias.push(
        `Valor de exclusões divergente (Excel ${formatBRL(excel.exclusoes.total)} × PDF ${formatBRL(pdfTotal!)}).`,
      );
  }

  // Devoluções — só compara o total (valor sempre negativo)
  let devolucoes: { total: CampoValidacao } | null = null;
  const excelTemDevolucao = !!excel.devolucoes && (excel.devolucoes.quantidade > 0 || excel.devolucoes.total !== 0);
  const pdfDevolucaoTotal = pdf && pdf.devolucoes?.total !== null && pdf.devolucoes?.total !== undefined ? pdf.devolucoes.total : null;
  if (excelTemDevolucao || pdfDevolucaoTotal !== null) {
    const excelTotal = excel.devolucoes?.total ?? 0;
    const c = campo(excelTotal, pdfDevolucaoTotal, "money");
    devolucoes = { total: c };
    if (pdf && excelTemDevolucao && pdfDevolucaoTotal === null)
      divergencias.push("Valor de devolução não encontrado no PDF.");
    else if (pdf && !excelTemDevolucao && pdfDevolucaoTotal !== null)
      divergencias.push(`Devolução encontrada no PDF (${formatBRL(pdfDevolucaoTotal)}), mas não encontrada no Excel.`);
    else if (pdf && !c.ok)
      divergencias.push(
        `Valor de devolução divergente (Excel ${formatBRL(excelTotal)} × PDF ${formatBRL(pdfDevolucaoTotal!)}).`,
      );
  }

  divergencias.push(...obterDivergenciasNotaFiscal(pdf));

  return {
    pagador: excel.pagador,
    arquivoPdf: pdf?.arquivo ?? null,
    enfermaria,
    apartamento,
    inclusoes,
    exclusoes,
    devolucoes,
    divergencias,
    avisosPdf: pdf?.avisos ?? [],
    valorLiquido: pdf?.valorLiquido ?? null,
    tributos: pdf?.tributos ?? null,
  };
}

// =====================================================================
// Comparação simplificada (Moto Honda) — PDF sem categorias detalhadas
// =====================================================================

import type { AnalisePdfSimplificado } from "./pdf-analysis-utils";

export function compararExcelComPdfSimplificado(
  excel: AnaliseResultado,
  pdf: (AnalisePdfSimplificado & { arquivo: string }) | null,
): ComparacaoSimplificada {
  const divergencias: string[] = [];
  const totalBenefExcel =
    excel.enfermaria.beneficiarios + excel.apartamento.beneficiarios;

  const mkCmp = (e: number, p: number | null, kind: "money" | "int") => {
    if (p === null || p === undefined || isNaN(p)) {
      return { excel: e, pdf: null, ok: false };
    }
    const ok =
      kind === "money" ? Math.abs(e - p) < 0.01 : Math.round(e) === Math.round(p);
    return { excel: e, pdf: p, ok };
  };

  const beneficiarios =
    pdf && pdf.beneficiarios !== null
      ? mkCmp(totalBenefExcel, pdf.beneficiarios, "int")
      : pdf
        ? { excel: totalBenefExcel, pdf: null, ok: false }
        : null;

  const inclusoes = pdf
    ? mkCmp(excel.inclusoes.total, pdf.inclusoes.total > 0 ? pdf.inclusoes.total : null, "money")
    : null;

  const exclusoes =
    pdf && excel.exclusoes
      ? mkCmp(excel.exclusoes.total, pdf.exclusoes.total !== 0 ? pdf.exclusoes.total : null, "money")
      : null;

  if (beneficiarios && !beneficiarios.ok) {
    divergencias.push(
      `Total de beneficiários (Excel ${beneficiarios.excel} × PDF ${beneficiarios.pdf ?? "—"}).`,
    );
  }
  if (inclusoes && !inclusoes.ok) {
    divergencias.push(
      `Valor de inclusões (Excel ${formatBRL(inclusoes.excel)} × PDF ${inclusoes.pdf !== null ? formatBRL(inclusoes.pdf) : "—"}).`,
    );
  }
  if (exclusoes && !exclusoes.ok) {
    divergencias.push(
      `Valor de exclusões (Excel ${formatBRL(exclusoes.excel)} × PDF ${exclusoes.pdf !== null ? formatBRL(exclusoes.pdf) : "—"}).`,
    );
  }

  return {
    pagador: excel.pagador,
    arquivoPdf: pdf?.arquivo ?? null,
    beneficiarios,
    inclusoes,
    exclusoes,
    divergencias,
    avisosPdf: pdf?.avisos ?? [],
  };
}

// =====================================================================
// Análise por CNPJ (chave principal de validação)
// =====================================================================

/**
 * Tenta interpretar a aba RESUMO no formato:
 *   linha N:   "Empresa/Módulo" | "Qtd" | "Mensalidade" | "Valor"
 *   linha N+1: "<NOME EMPRESA> <CNPJ>"      (cabeçalho de bloco)
 *   linhas seguintes: módulos (Master Empresarial / Master Executivo /
 *                              Inclusões / Exclusões)
 *   ...repete para outras empresas, até "Total Geral" / "Contrato:".
 *
 * Quando a aba existe e tem pelo menos um bloco com CNPJ, devolve os blocos
 * direto desta aba (consolidados). Caso contrário, devolve `null` e o caller
 * cai no parser de beneficiários.
 */
/**
 * Extrai itens de "Coparticipação — Empresarial" do pivot da aba RESUMO.
 * Aceita rótulo do pivot e cabeçalhos Qtd/Valor em linhas diferentes.
 */
function parseCoparticipacaoRows(
  rows: unknown[][],
): { nome: string; quantidade: number; total: number }[] {
  const items: { nome: string; quantidade: number; total: number }[] = [];

  // Localiza qualquer célula com "coparticipação ... empresarial"
  let anchorRow = -1;
  let anchorCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length; c++) {
      const t = norm(r[c]);
      if (t && t.includes("copartic") && t.includes("empresarial")) {
        anchorRow = i;
        anchorCol = c;
        break;
      }
    }
    if (anchorRow >= 0) break;
  }
  if (anchorRow < 0) return items;

  // Descobre colunas de Qtd/Valor. Prioriza o cabeçalho do PRÓPRIO pivot
  // (linha acima da âncora, colunas à direita do rótulo) — cabeçalhos de
  // outras tabelas da planilha apontariam para colunas vazias aqui.
  let qtdCol = -1;
  let valCol = -1;
  const scanCols = (rr: unknown[], minCol: number) => {
    for (let c = minCol; c < rr.length; c++) {
      const t = norm(rr[c]);
      if (!t) continue;
      if (qtdCol < 0 && (t === "qtd" || t.includes("soma de qtd") || t.includes("quantidade"))) qtdCol = c;
      if (valCol < 0 && (t === "valor" || t.includes("soma de valor") || t.includes("valor total"))) valCol = c;
    }
  };
  for (let i = anchorRow; i >= 0 && i >= anchorRow - 10; i--) {
    scanCols(rows[i] || [], anchorCol + 1);
    if (valCol >= 0 || qtdCol >= 0) break;
  }
  // Sem cabeçalho próximo: varre a planilha inteira (comportamento antigo).
  if (qtdCol < 0 && valCol < 0) {
    for (const r of rows) scanCols(r || [], 0);
  }

  // Pivot com uma única coluna de valor: não há quantidade a ler.
  const semQtd = qtdCol < 0 && valCol >= 0;
  if (qtdCol < 0 && !semQtd) qtdCol = anchorCol + 1;
  if (valCol < 0) valCol = qtdCol >= 0 ? qtdCol + 1 : anchorCol + 2;
  if (qtdCol === valCol) qtdCol = -1;

  const readQtd = (rr: unknown[]) => (qtdCol < 0 ? 0 : Math.round(toNumber(rr[qtdCol])));

  const anchorQtd = readQtd(rows[anchorRow] || []);
  const anchorVal = toNumber((rows[anchorRow] || [])[valCol]);

  const anchorEhLeaf = (!isNaN(anchorQtd) && anchorQtd !== 0) || (!isNaN(anchorVal) && anchorVal !== 0);

  const pushItem = (label: string, qtd: number, val: number) => {
    const nomeLimpo = label.replace(/^\s*pj\s*[-–—:]?\s*/i, "").trim();
    if (!nomeLimpo) return;
    const qtdOk = !isNaN(qtd) && qtd !== 0;
    const valOk = !isNaN(val) && val !== 0;
    if (!qtdOk && !valOk) return;
    items.push({
      nome: nomeLimpo,
      quantidade: isNaN(qtd) ? 0 : qtd,
      total: isNaN(val) ? 0 : val,
    });
  };

  // Detecta se existem linhas PJ APÓS a âncora, na mesma coluna (Formato A —
  // âncora é título, mesmo que traga totais agregados).
  let temPjAposAncora = false;
  for (let j = anchorRow + 1; j < rows.length; j++) {
    const rr = rows[j] || [];
    const label = cellToText(rr[anchorCol]).trim();
    const norml = norm(label);
    if (!label) continue;
    if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
    if (norml.includes("copartic")) continue;
    if (/^\s*pj\s*[-–—:]/i.test(label)) {
      temPjAposAncora = true;
      break;
    }
  }

  if (temPjAposAncora) {
    // Formato A: âncora é título; filhos vêm nas linhas seguintes (PJ - ...).
    for (let j = anchorRow + 1; j < rows.length; j++) {
      const rr = rows[j] || [];
      const label = cellToText(rr[anchorCol]).trim();
      const norml = norm(label);
      if (!label) continue;
      if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
      if (norml.includes("copartic")) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
  } else if (anchorEhLeaf) {
    // Formato B: "Coparticipação - Empresarial" é linha-filha.
    // Cada linha PJ acima (na mesma coluna) tem a próxima linha "Coparticipação".
    for (let i = 0; i < rows.length; i++) {
      const rr = rows[i] || [];
      const label = cellToText(rr[anchorCol]).trim();
      if (!/^\s*pj\s*[-–—:]/i.test(label)) continue;
      let j = i + 1;
      while (j < rows.length) {
        const nx = cellToText((rows[j] || [])[anchorCol]).trim();
        if (nx) break;
        j++;
      }
      const proxLabel = norm((rows[j] || [])[anchorCol]);
      if (!(proxLabel && proxLabel.includes("copartic") && proxLabel.includes("empresarial"))) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
    if (items.length === 0) {
      pushItem("Coparticipação", anchorQtd, anchorVal);
    }
  } else {
    // Formato A puro (âncora sem totais).
    for (let j = anchorRow + 1; j < rows.length; j++) {
      const rr = rows[j] || [];
      const label = cellToText(rr[anchorCol]).trim();
      const norml = norm(label);
      if (!label) continue;
      if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
      if (norml.includes("copartic")) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
  }

  return items;
}

/**
 * Fallback para RESUMO no formato SECULUS:
 *   CNPJ: XX.XXX.XXX/XXXX-XX EMPRESA (FILIAL)
 *   plano | qtd | mensalidade | total
 *   ...
 *   TOTAL (subtotal mensalidade)
 *   CO-PARTICIPAÇÃO MMM/AA        ← anchor sem "empresarial"
 *   plano |     |            | valor
 *   ...
 *   TOTAL (subtotal coparticipação)
 *
 * Emite um item por bloco de CNPJ com nome = nome da empresa do CNPJ acima,
 * quantidade = 0 e total = soma dos planos (ou valor da linha TOTAL).
 */
function parseCoparticipacaoResumoPorCnpj(
  rows: unknown[][],
  idxLabel: number,
  idxValor: number,
): { nome: string; quantidade: number; total: number }[] {
  const items: { nome: string; quantidade: number; total: number }[] = [];
  if (idxLabel < 0 || idxValor < 0) return items;
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const lbl = cellToText(r[idxLabel]).trim();
    const lblNorm = norm(lbl);
    if (!lblNorm) continue;
    // Aceita "coparticipação", "co-participação", "co participação"…
    // Ignora quando é o pivot "Coparticipação - Empresarial" (parser antigo cuida).
    const lblSemSep = lblNorm.replace(/[^a-z0-9]/g, "");
    const isAnchor =
      lblSemSep.includes("coparticipacao") &&
      !lblNorm.includes("empresarial") &&
      !/^\s*pj\s*[-–—:]/i.test(lbl);
    if (!isAnchor) continue;

    // Localiza a empresa do CNPJ imediatamente acima da âncora.
    // Usa padrão estrito (com separadores formatados) para evitar falsos
    // positivos em valores numéricos de subtotais tipo "58198.064000000006".
    const reCnpjEstrito = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
    let empresaNome = "";
    const cleanupNome = (s: string) => s
      .replace(/\b(cnpj|c\.n\.p\.j\.?)\b\s*[:\-]?\s*/gi, "")
      .trim()
      .replace(/^[-–—:]\s*/, "")
      .replace(/[-–—:]\s*$/, "")
      .trim();
    for (let k = i - 1; k >= 0 && !empresaNome; k--) {
      const rk = rows[k] || [];
      const txt = cellToText(rk[idxLabel]);
      const m = txt.match(reCnpjEstrito);
      if (m) {
        let n = cleanupNome(txt.slice(0, m.index));
        if (!n) n = cleanupNome(txt.slice((m.index ?? 0) + m[1].length));
        empresaNome = n;
      }
    }
    if (!empresaNome) continue;



    // Varre até 25 linhas abaixo procurando:
    // - linhas de plano com valor → soma
    // - linha "TOTAL" → usa esse valor (prioritário)
    // Para se encontrar outra âncora, um novo CNPJ, "Total Geral" ou fim.
    let somaPlanos = 0;
    let totalDaLinha = NaN;
    for (let j = i + 1; j < Math.min(rows.length, i + 25); j++) {
      const rr = rows[j] || [];
      const lblJ = cellToText(rr[idxLabel]).trim();
      const lblJNorm = norm(lblJ);
      const lblJSemSep = lblJNorm.replace(/[^a-z0-9]/g, "");
      // Nova âncora ou próximo bloco de CNPJ → para
      if (lblJSemSep.includes("coparticipacao") && j > i + 1) break;
      if (reCnpj.test(lblJ)) break;
      // Verifica se qualquer célula é "total"
      let temTotal = false;
      let temTotalGeral = false;
      for (const c of rr) {
        const t = norm(c);
        if (!t) continue;
        if (t.startsWith("total geral")) { temTotalGeral = true; break; }
        if (t === "total" || t === "totais") temTotal = true;
      }
      if (temTotalGeral) break;
      const val = toNumber(rr[idxValor]);
      if (temTotal) {
        if (!isNaN(val) && val !== 0) totalDaLinha = val;
        break;
      }
      if (lblJNorm && !isNaN(val) && val !== 0) {
        somaPlanos += val;
      }
    }
    const total = !isNaN(totalDaLinha) ? totalDaLinha : somaPlanos;
    if (total !== 0) {
      items.push({ nome: empresaNome, quantidade: 0, total });
    }
  }
  return items;
}




/**
 * Fallback para RESUMO em formato de tabela dinâmica por Tipo de Cobrança
 * (ex.: faturamento formatado "Pagador | Tipo Cobrança | Soma de QTD | Soma de Valor"):
 *   EPER ENGENHARIA E ENERGIAS LTDA | 95 | 31.703,70
 *     Co-participação             | 10 |    298,75
 *     Mensalidade                 | 85 | 31.404,95
 *   Total Geral                   | 95 | 31.703,70
 * Não há CNPJ nem rótulo "Empresarial" — a empresa é a linha-mãe e a
 * coparticipação é a sub-linha logo abaixo dela.
 */
function parseCoparticipacaoPivotTipoCobranca(
  rows: unknown[][],
): { nome: string; quantidade: number; total: number }[] {
  const items: { nome: string; quantidade: number; total: number }[] = [];

  // Localiza o cabeçalho da pivot ("Soma de QTD" / "Soma de Valor").
  let headerRow = -1;
  let qtdCol = -1;
  let valCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    let q = -1;
    let v = -1;
    for (let c = 0; c < r.length; c++) {
      const t = norm(r[c]);
      if (!t) continue;
      if (q < 0 && (t.includes("soma de qtd") || t === "qtd")) q = c;
      if (v < 0 && (t.includes("soma de valor") || t === "valor")) v = c;
    }
    if (q >= 0 && v >= 0) {
      headerRow = i;
      qtdCol = q;
      valCol = v;
      break;
    }
  }
  if (headerRow < 0) return items;

  let empresaAtual = "";
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    // Rótulo = primeiro texto não vazio da linha (funciona com sub-linhas
    // indentadas na segunda coluna e com pivots de coluna única).
    let label = "";
    for (const c of r) {
      const t = cellToText(c).trim();
      if (t) {
        label = t;
        break;
      }
    }
    if (!label) continue;
    const lblNorm = norm(label);
    if (lblNorm.startsWith("total geral")) break;
    const lblSemSep = lblNorm.replace(/[^a-z0-9]/g, "");
    if (lblNorm.includes("soma de")) continue;
    if (lblSemSep.includes("coparticipacao")) {
      if (!empresaAtual) continue;
      const qtdN = Math.round(toNumber(r[qtdCol]));
      const valN = toNumber(r[valCol]);
      const qtdOk = !isNaN(qtdN) && qtdN !== 0;
      const valOk = !isNaN(valN) && valN !== 0;
      if (qtdOk || valOk) {
        items.push({
          nome: empresaAtual,
          quantidade: isNaN(qtdN) ? 0 : qtdN,
          total: isNaN(valN) ? 0 : valN,
        });
      }
      continue;
    }
    if (lblSemSep.includes("mensalidade")) continue;
    empresaAtual = label;
  }
  return items;
}

/**
 * Lê a aba RESUMO do workbook (se existir) e retorna as linhas como matriz.
 */
function lerRowsAbaResumo(wb: ExcelJS.Workbook): unknown[][] | null {
  const ws = wb.worksheets.find((s) => norm(s.name).includes("resumo"));
  if (!ws) return null;
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
}

function analisarResumoSheet(wb: ExcelJS.Workbook): AnalisePorCnpj[] | null {
  const ws = wb.worksheets.find((s) => norm(s.name).includes("resumo"));
  if (!ws) return null;

  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1));
  });

  let headerIdx = -1;
  let idxLabel = -1;
  let idxQtd = -1;
  let idxMens = -1;
  let idxValor = -1;
  let idxFaixa = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i] || [];
    let lbl = -1, qtd = -1, mens = -1, val = -1;
    for (let c = 0; c < r.length; c++) {
      const h = norm(r[c]);
      if (!h) continue;
      if (
        lbl < 0 &&
        (h.includes("empresa/modulo") ||
          h.includes("empresa / modulo") ||
          h.includes("modulo") ||
          h === "empresa")
      )
        lbl = c;
      else if (
        qtd < 0 &&
        (h === "qtd" || h.includes("quantidade") || h.includes("usuario"))
      )
        qtd = c;
      else if (
        mens < 0 &&
        (h.includes("mensalidade") || h.includes("valor unit") || h.includes("valor unitario"))
      )
        mens = c;
      else if (val < 0 && (h === "valor" || h === "total" || h.includes("valor total"))) val = c;
    }
    if (lbl >= 0 && val >= 0) {
      headerIdx = i; idxLabel = lbl; idxQtd = qtd; idxMens = mens; idxValor = val;
      idxFaixa = findColumnIndex(r, COL_FAIXA_ETARIA);
      break;
    }
  }
  if (headerIdx < 0) return null;

  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  type Acc = {
    cnpj: string; nome: string;
    enfValores: number[]; enfQtd: number; enfMens: number;
    aptValores: number[]; aptQtd: number; aptMens: number;
    incQtd: number; incTotal: number;
    retroQtd: number; retroTotal: number;
    excQtd: number; excTotal: number;
    devQtd: number; devTotal: number;
    permQtd: number; permTotal: number;
    adesaoQtd: number; adesaoTotal: number;
    compQtd: number; compTotal: number; compLabel: string | null;
    compItens: { nome: string; quantidade: number; total: number }[];
    /** Valor da linha "TOTAL" declarada na planilha para este bloco. */
    totalDecl: number | null;
    faixas: Map<string, { label: string; idadeInicial: number; idadeFinal: number | null; quantidade: number; total: number }>;
  };

  // Regex para faixa etária: "0 à 18", "19 a 23", "60+", "60 +"
  const reFaixa = /^\s*(\d{1,3})\s*(?:[àa]|-|–|—|até|ate)\s*(\d{1,3})\s*$/i;
  const reFaixaMais = /^\s*(\d{1,3})\s*\+\s*$/;



  const blocos: Acc[] = [];
  let cur: Acc | null = null;
  let breakIdx = rows.length;
  // Formato SECULUS: dentro do bloco "CO-PARTICIPAÇÃO MMM/AA" as mesmas
  // linhas de plano aparecem novamente com apenas o valor. Não devem
  // duplicar em enfermaria/apartamento — a coparticipação é somada à parte
  // pelo `parseCoparticipacaoResumoPorCnpj`.
  let inCoparticBlock = false;


  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const labelRaw = cellToText(r[idxLabel]).trim();
    if (!labelRaw) continue;
    const labelNorm = norm(labelRaw);
    const rowNorms = r.map((cell) => norm(cell)).filter(Boolean);
    if (
      labelNorm.startsWith("total geral") ||
      rowNorms.some((cell) => cell.startsWith("total geral")) ||
      labelNorm.startsWith("contrato:") ||
      labelNorm.startsWith("contrato ")
    ) { breakIdx = i; break; }

    // Entra em "CO-PARTICIPAÇÃO ..." → ignora linhas até o próximo TOTAL/CNPJ.
    const labelSemSep = labelNorm.replace(/[^a-z0-9]/g, "");
    if (
      labelSemSep.includes("coparticipacao") &&
      !labelNorm.includes("empresarial") &&
      !/^\s*pj\s*[-–—:]/i.test(labelRaw)
    ) {
      inCoparticBlock = true;
      continue;
    }


    // Pula linhas de subtotal/total de bloco (ex.: "TOTAL ENFERMARIA", "SUBTOTAL APARTAMENTO",
    // "TOTAL EMPRESA", "TOTAL CONTRATO"), que repetiriam valores já contabilizados nos módulos.
    // Guardamos o valor do "TOTAL" do bloco para conferir contra a soma calculada.
    if (
      /^sub[\s-]*total\b/.test(labelNorm) ||
      (/^total\b/.test(labelNorm) && !labelNorm.startsWith("total geral"))
    ) {
      if (cur && /^total\b/.test(labelNorm) && !/^sub/.test(labelNorm)) {
        const vTot = idxValor >= 0 ? toNumber(r[idxValor]) : NaN;
        if (!isNaN(vTot) && vTot !== 0) cur.totalDecl = vTot;
      }
      inCoparticBlock = false;
      continue;
    }


    // CNPJ header sempre finaliza o bloco de coparticipação anterior.
    const m = labelRaw.match(reCnpj);
    if (m) inCoparticBlock = false;

    if (inCoparticBlock) continue;

    if (m) {
      const cnpj = normalizarCnpj(m[1]);
      const cleanupNome = (s: string) => s
        .replace(/\b(cnpj|c\.n\.p\.j\.?)\b\s*[:\-]?\s*/gi, "")
        .trim()
        .replace(/^[-–—:]\s*/, "")
        .replace(/[-–—:]\s*$/, "")
        .trim();
      let nome = cleanupNome(labelRaw.slice(0, m.index));
      if (!nome) {
        // Formato SECULUS: "CNPJ: XX.XXX.XXX/XXXX-XX SECULUS (FÁBRICA)"
        nome = cleanupNome(labelRaw.slice((m.index ?? 0) + m[1].length));
      }
      cur = {
        cnpj, nome: nome || "Sem nome",
        enfValores: [], enfQtd: 0, enfMens: 0,
        aptValores: [], aptQtd: 0, aptMens: 0,
        incQtd: 0, incTotal: 0,
        retroQtd: 0, retroTotal: 0,
        excQtd: 0, excTotal: 0,
        devQtd: 0, devTotal: 0,
        permQtd: 0, permTotal: 0,
        adesaoQtd: 0, adesaoTotal: 0,
        compQtd: 0, compTotal: 0, compLabel: null, compItens: [],
        totalDecl: null,
        faixas: new Map(),
      };

      blocos.push(cur);
      inCoparticBlock = false;
      continue;
    }


    if (!cur) continue;

    const qtdN = idxQtd >= 0 ? Math.round(toNumber(r[idxQtd])) : NaN;
    const mensN = idxMens >= 0 ? toNumber(r[idxMens]) : NaN;
    const val = toNumber(r[idxValor]);
    const valNum = isNaN(val) ? 0 : val;
    const qtdNum = isNaN(qtdN) ? 0 : qtdN;
    const mensNum = isNaN(mensN) ? 0 : mensN;
    const hasValor = !isNaN(val) && val !== 0;
    const hasMensalidade = !isNaN(mensN) && mensN !== 0;

    if (labelNorm.includes("complemento")) {
      cur.compQtd += qtdNum;
      cur.compTotal += valNum;
      cur.compItens.push({ nome: labelRaw, quantidade: qtdNum, total: valNum });
      const mMes = /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[\/_-]?\s*(\d{4}|\d{2})(?!\d)/i.exec(labelRaw);
      if (mMes && !cur.compLabel) {
        const nomeMes = mMes[1].charAt(0).toUpperCase() + mMes[1].slice(1).toLowerCase();
        const anoRaw = parseInt(mMes[2], 10);
        const ano = mMes[2].length === 2 ? 2000 + anoRaw : anoRaw;
        cur.compLabel = `${nomeMes}/${ano}`;
      }
      continue;
    }

    if (labelNorm.includes("adesao") || labelNorm.includes("adesão")) {
      cur.adesaoQtd += qtdNum;
      cur.adesaoTotal += valNum;
      continue;
    }

    if (labelNorm.includes("inclus") || labelNorm.includes("inlus") || labelNorm.includes("retroativ")) {
      cur.incQtd += qtdNum;
      cur.incTotal += valNum;
      if (labelNorm.includes("retroativ")) {
        cur.retroQtd += qtdNum;
        cur.retroTotal += valNum;
      }
      continue;
    }


    if (labelNorm.includes("permuta")) {
      cur.permQtd += qtdNum;
      cur.permTotal += valNum;
      continue;
    }

    if (labelNorm.includes("devolu")) {
      cur.devQtd += qtdNum;
      cur.devTotal += valNum;
      continue;
    }

    if (labelNorm.includes("exclus")) {
      cur.excQtd += qtdNum;
      cur.excTotal += valNum;
      continue;
    }

    // Detecta faixa etária: "0 à 18", "19 a 23", "60+" no label ou coluna "Fx Etária".
    const faixaInfo = (idxFaixa >= 0 ? parseFaixaEtariaLabel(r[idxFaixa]) : null) ?? parseFaixaEtariaLabel(labelRaw);
    if (faixaInfo) {
      const ini = faixaInfo.idadeInicial;
      const fim = faixaInfo.idadeFinal;
      const label = faixaInfo.label;
      const key = `${ini}-${fim ?? "+"}`;
      const prev = cur.faixas.get(key) || { label, idadeInicial: ini, idadeFinal: fim, quantidade: 0, total: 0 };
      prev.quantidade += qtdNum;
      prev.total += valNum;
      cur.faixas.set(key, prev);
      // Soma também na enfermaria (categoria padrão para contratos faixa etária)
      cur.enfQtd += qtdNum;
      cur.enfValores.push(valNum);
      continue;
    }

    const cat = classificarPlano(labelRaw);
    // Algumas abas RESUMO repetem os módulos no rodapé antes de "Total Geral"
    // apenas com a quantidade (ex.: "M.Empresarial 395"), o que duplicava vidas.
    if (cat && qtdNum > 0 && !hasMensalidade && !hasValor) continue;
    if (cat === "enfermaria") {
      cur.enfQtd += qtdNum;
      cur.enfMens = mensNum || cur.enfMens;
      cur.enfValores.push(valNum);
    } else if (cat === "apartamento") {
      cur.aptQtd += qtdNum;
      cur.aptMens = mensNum || cur.aptMens;
      cur.aptValores.push(valNum);
    }
  }

  const comCnpj = blocos.filter((b) => b.cnpj.length === 14);
  if (comCnpj.length === 0) return null;

  // Varre o "rodapé" da aba RESUMO em busca de tabelas dinâmicas de
  // "Cobrança Retroativa <Mês>" (ex.: Março26, Abril26...) — que ficam
  // depois de "Total Geral"/"Contrato:" e não são capturadas no loop principal.
  let tailRetroQtd = 0;
  let tailRetroTotal = 0;
  // A mesma tabela dinâmica pode aparecer mais de uma vez no rodapé do RESUMO
  // (uma linha com quantidade + valor e outra repetição apenas com o valor).
  // O valor monetário é a identidade mais estável; a quantidade pode variar
  // entre essas representações e não deve fazer a cobrança ser somada novamente.
  const tailRetroValoresVistos = new Set<string>();
  // Índices das colunas do cabeçalho da pivot corrente ("Soma de QTD" /
  // "Soma de Valor"). São reatribuídos a cada novo cabeçalho encontrado.
  let pvQtdIdx = -1;
  let pvValIdx = -1;
  for (let i = breakIdx; i < rows.length; i++) {
    const r = rows[i] || [];
    // Cabeçalho de tabela dinâmica: guarda as colunas de QTD e de Valor
    const hQtd = r.findIndex((c) => {
      const t = norm(c);
      return t.includes("qtd") || t.includes("quantidade");
    });
    const hVal = r.findIndex((c) => {
      const t = norm(c);
      return t.includes("valor");
    });
    if (hVal >= 0 || hQtd >= 0) {
      pvQtdIdx = hQtd;
      pvValIdx = hVal;
      continue;
    }
    // Ignora cabeçalhos/totais das próprias pivots
    const anyTotalGeral = r.some((c) => norm(c).startsWith("total geral"));
    if (anyTotalGeral) continue;
    // Encontra a célula com "cobranca retroativa" e pega os dois próximos números
    let hitIdx = -1;
    let hitLabel = "";
    for (let c = 0; c < r.length; c++) {
      const t = norm(r[c]);
      if (t.includes("cobranca retroativa") || (t.includes("retroativ") && !t.startsWith("total"))) {
        hitIdx = c;
        hitLabel = String(r[c] ?? "");
        break;
      }
    }
    if (hitIdx < 0) continue;


    let qtd = 0;
    let total = NaN;
    // Preferência absoluta: colunas declaradas no cabeçalho da pivot.
    if (pvValIdx > hitIdx) {
      const v = toNumber(r[pvValIdx]);
      if (!isNaN(v)) total = v;
      if (pvQtdIdx > hitIdx) {
        const q = toNumber(r[pvQtdIdx]);
        if (!isNaN(q)) qtd = Math.round(q);
      }
    }
    if (isNaN(total)) {
      const nums: number[] = [];
      for (let c = hitIdx + 1; c < r.length && nums.length < 2; c++) {
        const n = toNumber(r[c]);
        if (!isNaN(n)) nums.push(n);
      }
      if (nums.length >= 2) {
        qtd = Math.round(nums[0]);
        total = nums[1];
      } else if (nums.length === 1) {
        // Só um número: se for inteiro pequeno é quantidade de beneficiários,
        // nunca o valor da cobrança.
        const n = nums[0];
        const ehQtd = Number.isFinite(n) && n >= 0 && n < 100000 && Math.abs(n - Math.round(n)) < 0.001;
        if (ehQtd) continue;
        total = n;
      } else {
        continue;
      }
    }
    if (isNaN(total)) continue;
    // Deduplica por rótulo + valor: meses diferentes podem ter exatamente o
    // mesmo valor (ex.: Maio26 e Junho26 = R$ 7.072,00) e não podem ser
    // tratados como repetição do mesmo pivot.
    const chaveValor = `${norm(hitLabel)}|${total.toFixed(2)}`;
    if (tailRetroValoresVistos.has(chaveValor)) continue;
    tailRetroValoresVistos.add(chaveValor);

    tailRetroQtd += qtd;
    tailRetroTotal += total;
  }


  // O valor consolidado dentro do bloco do CNPJ é a fonte oficial. As tabelas
  // no rodapé são detalhamentos e só devem preencher a retroativa quando o
  // RESUMO não trouxe nenhuma linha consolidada. Caso contrário, uma parcela
  // do detalhamento (ex.: R$ 206,01 da Yamaha) seria somada ao total já
  // declarado (R$ 659,70), produzindo incorretamente R$ 865,71.
  const resumoJaTemRetroativa = comCnpj.some(
    (b) => b.retroQtd !== 0 || Math.abs(b.retroTotal) > 0.001,
  );
  if (!resumoJaTemRetroativa && (tailRetroQtd !== 0 || tailRetroTotal !== 0)) {
    if (comCnpj.length === 1) {
      comCnpj[0].retroQtd += tailRetroQtd;
      comCnpj[0].retroTotal += tailRetroTotal;
      comCnpj[0].incQtd += tailRetroQtd;
      comCnpj[0].incTotal += tailRetroTotal;
    } else {
      // Múltiplos CNPJs: rateia proporcionalmente ao total de inclusões existentes,
      // ou distribui igualmente se não houver base.
      const base = comCnpj.map((b) => Math.abs(b.incTotal) || 0);
      const soma = base.reduce((s, v) => s + v, 0);
      comCnpj.forEach((b, idx) => {
        const w = soma > 0 ? base[idx] / soma : 1 / comCnpj.length;
        const q = Math.round(tailRetroQtd * w);
        const v = tailRetroTotal * w;
        b.retroQtd += q;
        b.retroTotal += v;
        b.incQtd += q;
        b.incTotal += v;
      });
    }
  }

  // ----- Coparticipação — Empresarial (pivot da aba RESUMO) -----
  let coparticipItems = parseCoparticipacaoRows(rows);
  // Fallback SECULUS: bloco "CO-PARTICIPAÇÃO MMM/AA" logo abaixo de cada CNPJ.
  if (coparticipItems.length === 0) {
    coparticipItems = parseCoparticipacaoResumoPorCnpj(rows, idxLabel, idxValor);
  }
  // Fallback pivot por Tipo de Cobrança (ex.: EPER — "Co-participação" como
  // sub-linha da empresa, sem CNPJ e sem rótulo "Empresarial").
  if (coparticipItems.length === 0) {
    coparticipItems = parseCoparticipacaoPivotTipoCobranca(rows);
  }

  // Distribui itens de coparticipação nos blocos por match de nome. Fallback:
  // se houver apenas um bloco, tudo vai para ele.
  const coparticPorBloco = new Map<string, { substipulantes: CoparticipacaoSubstipulante[]; quantidade: number; total: number }>();
  for (const item of coparticipItems) {
    const alvoKey = normMatch(item.nome);
    let match: Acc | null = null;
    if (comCnpj.length === 1) {
      match = comCnpj[0];
    } else {
      // Preferir match exato, senão contém-contém
      match =
        comCnpj.find((b) => normMatch(b.nome) === alvoKey) ||
        comCnpj.find((b) => {
          const bk = normMatch(b.nome);
          return bk && (alvoKey.includes(bk) || bk.includes(alvoKey));
        }) ||
        null;
    }
    if (!match) continue;
    const key = match.cnpj || match.nome;
    const acc = coparticPorBloco.get(key) || { substipulantes: [], quantidade: 0, total: 0 };
    acc.substipulantes.push(item);
    acc.quantidade += item.quantidade;
    acc.total += item.total;
    coparticPorBloco.set(key, acc);
  }


  return comCnpj.map((g) => {
    const buildFromResumo = (qtd: number, mens: number, vals: number[]): CategoriaResultado => {
      const total = vals.reduce((s, v) => s + v, 0);
      const beneficiarios = qtd || 0;
      const mensalidade = mens || (beneficiarios > 0 ? total / beneficiarios : 0);
      return { beneficiarios, mensalidade, total };
    };
    const bloco: AnalisePorCnpj = {
      cnpj: g.cnpj,
      nome: g.nome,
      nomeExibicao: formatNomeComCnpj(g.nome, g.cnpj),
      enfermaria: buildFromResumo(g.enfQtd, g.enfMens, g.enfValores),
      apartamento: buildFromResumo(g.aptQtd, g.aptMens, g.aptValores),
      inclusoes: { quantidade: g.incQtd, total: g.incTotal },
      avisos: ["Dados consolidados extraídos da aba RESUMO."],
    };
    if (g.totalDecl !== null) bloco.totalDeclaradoExcel = g.totalDecl;
    if (g.retroQtd > 0 || g.retroTotal !== 0) {
      bloco.retroativas = { quantidade: g.retroQtd, total: g.retroTotal };
    }
    if (g.excQtd > 0 || g.excTotal !== 0) {
      bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
    }
    if (g.devQtd > 0 || g.devTotal !== 0) {
      bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
    }
    if (g.permQtd > 0 || g.permTotal !== 0) {
      bloco.permuta = { quantidade: g.permQtd, total: g.permTotal };
    }
    if (g.adesaoQtd > 0 || g.adesaoTotal !== 0) {
      bloco.taxaAdesao = { quantidade: g.adesaoQtd, total: g.adesaoTotal };
    }
    if (g.faixas.size > 0) {
      bloco.faixasEtarias = Array.from(g.faixas.values()).sort(
        (a, b) => a.idadeInicial - b.idadeInicial,
      );
    }
    if (g.compQtd !== 0 || g.compTotal !== 0) {
      bloco.complemento = {
        quantidade: g.compQtd,
        total: g.compTotal,
        periodoLabel: g.compLabel,
        itens: g.compItens,
      };
    }
    const coparticAcc = coparticPorBloco.get(g.cnpj || g.nome);
    if (coparticAcc && (coparticAcc.quantidade !== 0 || coparticAcc.total !== 0)) {
      bloco.coparticipacao = {
        quantidade: coparticAcc.quantidade,
        total: coparticAcc.total,
        substipulantes: coparticAcc.substipulantes,
      };
    }

    return bloco;
  });
}

/**
 * Algumas planilhas trazem a aba RESUMO sem as inclusões que estão no fim da
 * relação de beneficiários. Completa somente blocos cujo RESUMO não informou
 * inclusões, evitando somar novamente valores já consolidados.
 */
function completarInclusoesDoDetalhe(
  wb: ExcelJS.Workbook,
  blocos: AnalisePorCnpj[],
): AnalisePorCnpj[] {
  if (blocos.length === 0 || blocos.every((b) => b.inclusoes.quantidade > 0 || b.inclusoes.total !== 0)) {
    return blocos;
  }

  const encontrados = new Map<string, InclusaoResultado>();
  const adicionar = (chave: string, valor: number) => {
    if (!chave) return;
    const atual = encontrados.get(chave) || { quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += valor;
    encontrados.set(chave, atual);
  };

  wb.worksheets.forEach((ws) => {
    if (norm(ws.name).includes("resumo")) return;

    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      rows.push((row.values as unknown[]).slice(1));
    });

    let headerIdx = -1;
    let idxTipo = -1;
    let idxValor = -1;
    let idxCnpj = -1;
    let idxPagador = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const tipo = findColumnIndex(rows[i], COL_TIPO_COBRANCA);
      const valor = findColumnIndex(rows[i], COL_VALOR);
      if (tipo >= 0 && valor >= 0) {
        headerIdx = i;
        idxTipo = tipo;
        idxValor = valor;
        idxCnpj = findColumnIndex(rows[i], COL_CNPJ);
        idxPagador = findPagadorColumnIndex(rows[i]);
        break;
      }
    }
    if (headerIdx < 0) return;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!isInclusao(String(row[idxTipo] ?? "")) || isRetroativa(String(row[idxTipo] ?? ""))) continue;
      const valor = toNumber(row[idxValor]);
      if (!Number.isFinite(valor) || valor < 0) continue;
      const cnpj = idxCnpj >= 0 ? normalizarCnpj(row[idxCnpj]) : "";
      const nome = idxPagador >= 0 ? normMatch(String(row[idxPagador] ?? "")) : "";
      adicionar(cnpj.length === 14 ? `cnpj:${cnpj}` : `nome:${nome}`, valor);
    }
  });

  return blocos.map((bloco) => {
    if (bloco.inclusoes.quantidade > 0 || bloco.inclusoes.total !== 0) return bloco;
    const porCnpj = bloco.cnpj ? encontrados.get(`cnpj:${bloco.cnpj}`) : undefined;
    const nomeBloco = normMatch(bloco.nome);
    const porNome = encontrados.get(`nome:${nomeBloco}`) || Array.from(encontrados.entries()).find(
      ([chave]) => chave.startsWith("nome:") && nomeBloco && (
        chave.slice(5).includes(nomeBloco) || nomeBloco.includes(chave.slice(5))
      ),
    )?.[1];
    const inclusoes = porCnpj || porNome;
    if (!inclusoes) return bloco;
    return {
      ...bloco,
      inclusoes: { ...inclusoes },
      avisos: [...bloco.avisos, "Inclusões complementadas pela relação detalhada de beneficiários."],
    };
  });
}

/**
 * Lê a planilha e devolve um array de blocos, um por CNPJ encontrado.
 * Preferência:
 *   1) Aba RESUMO consolidada (Empresa/Módulo | Qtd | Mensalidade | Valor)
 *   2) Aba de beneficiários (linha-a-linha, legado)
 */
export async function analisarExcelFinanceiroPorCnpj(
  buffer: ArrayBuffer,
): Promise<AnalisePorCnpj[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const viaResumo = analisarResumoSheet(wb);
  if (viaResumo && viaResumo.length > 0) {
    return dividirBlocosPorSubBlocosDeclarados(
      wb,
      mesclarBlocosPorNomeForcado(completarInclusoesDoDetalhe(wb, viaResumo)),
    );
  }

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const allRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length >= 200_000) return;
    const values = (row.values as unknown[]).slice(1);
    allRows.push(values);
  });

  let headerIdx = -1;
  let idxPlano = -1;
  let idxTipo = -1;
  let idxValor = -1;
  let idxCnpj = -1;
  let idxPagador = -1;
  let idxFaixa = -1;

  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const r = allRows[i];
    const p = findColumnIndex(r, COL_PLANO);
    const t = findColumnIndex(r, COL_TIPO_COBRANCA);
    const v = findColumnIndex(r, COL_VALOR);
    if (p >= 0 || t >= 0) {
      headerIdx = i;
      idxPlano = p;
      idxTipo = t;
      idxValor = v;
      idxCnpj = findColumnIndex(r, COL_CNPJ);
      idxPagador = findPagadorColumnIndex(r);
      idxFaixa = findColumnIndex(r, COL_FAIXA_ETARIA);
      break;
    }
  }

  if (headerIdx < 0) {
    return [
      {
        cnpj: "",
        nome: "Planilha",
        nomeExibicao: "Planilha",
        enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
        apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
        inclusoes: { quantidade: 0, total: 0 },
        avisos: [
          "Não foi possível identificar a linha de cabeçalho (esperado: 'Plano' e 'Tipo Cobrança').",
        ],
      },
    ];
  }

  type Acc = {
    cnpj: string;
    nome: string;
    enfValores: number[];
    aptValores: number[];
    incQtd: number;
    incTotal: number;
    retroQtd: number;
    retroTotal: number;
    excQtd: number;
    excTotal: number;
    devQtd: number;
    devTotal: number;
    permQtd: number;
    permTotal: number;
    adesaoQtd: number;
    adesaoTotal: number;
    faixas: Map<string, FaixaEtariaResumo>;
  };

  const grupos = new Map<string, Acc>();
  const ehCnpjPlaceholder = (c: string) => !c || c.length !== 14 || /0{6,}$/.test(c);
  // Regra especial: alguns pagadores têm múltiplos CNPJs (matriz + filiais)
  // mas a análise deve consolidar tudo num único bloco usando o nome.
  // Ex.: "PIONEIRO COMBUSTIVEIS LTD" — todos os beneficiários com esse
  // subestipulante contam como uma só empresa, independente do CNPJ.
  const FORCE_GROUP_BY_NAME = getForceGroupByNamePatterns();
  const forceByName = (nome: string) => {
    const n = norm(nome);
    return FORCE_GROUP_BY_NAME.some((p) => n.includes(p));
  };
  const getGrupo = (cnpj: string, nome: string): Acc => {
    // Chave preferencial: CNPJ válido. Pagadores distintos com a mesma
    // razão social (matriz + filial) ficam em blocos separados. Linhas
    // sem CNPJ válido (ex.: exclusões com placeholder) caem em chave por
    // nome — quando há ambiguidade entre múltiplos CNPJs com mesmo nome,
    // o agrupamento por nome só é usado como último recurso.
    const nomeKey = norm(nome);
    const cnpjValido = !ehCnpjPlaceholder(cnpj);
    const usarNome = forceByName(nome);
    const key = usarNome && nomeKey
      ? `__nome::${nomeKey}`
      : cnpjValido
      ? `__cnpj::${cnpj}`
      : nomeKey
      ? `__nome::${nomeKey}`
      : "__sem_id__";
    let g = grupos.get(key);
    if (!g) {
      g = {
        cnpj,
        nome,
        enfValores: [],
        aptValores: [],
        incQtd: 0,
        incTotal: 0,
        retroQtd: 0,
        retroTotal: 0,
        excQtd: 0,
        excTotal: 0,
        devQtd: 0,
        devTotal: 0,
        permQtd: 0,
        permTotal: 0,
        adesaoQtd: 0,
        adesaoTotal: 0,
        faixas: new Map(),
      };

      grupos.set(key, g);
    } else {
      if (!g.nome && nome) g.nome = nome;
      if (ehCnpjPlaceholder(g.cnpj) && !ehCnpjPlaceholder(cnpj)) {
        g.cnpj = cnpj;
      }
    }
    return g;
  };


  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;

    const cnpjLinha = idxCnpj >= 0 ? normalizarCnpj(r[idxCnpj]) : "";
    const nomeLinha = idxPagador >= 0 ? String(r[idxPagador] ?? "").trim() : "";
    if (idxCnpj >= 0 && cnpjLinha.length !== 14 && !nomeLinha) continue;

    const grp = getGrupo(cnpjLinha, nomeLinha);

    const planoCell = idxPlano >= 0 ? r[idxPlano] : "";
    const tipoCell = idxTipo >= 0 ? r[idxTipo] : "";
    const valorCell = idxValor >= 0 ? r[idxValor] : 0;
    const valor = toNumber(valorCell);
    const valorNum = isNaN(valor) ? 0 : valor;
    const valorValido = !isNaN(valor) && valor >= 0;

    if (idxFaixa >= 0) {
      const faixa = parseFaixaEtariaLabel(r[idxFaixa]);
      if (faixa && !(idxTipo >= 0 && (isInclusao(String(tipoCell)) || isExclusao(String(tipoCell)) || isDevolucao(String(tipoCell)))) && !rowHasTaxaAdesao(r, idxTipo)) {
        const key = `${faixa.idadeInicial}-${faixa.idadeFinal ?? "+"}`;
        const prev = grp.faixas.get(key) || faixa;
        prev.quantidade += 1;
        if (valorValido) prev.total += valor;
        grp.faixas.set(key, prev);
      }
    }

    if (rowHasTaxaAdesao(r, idxTipo)) {
      grp.adesaoQtd += 1;
      if (valorValido) grp.adesaoTotal += valor;
      continue;
    }

    if (idxTipo >= 0 && isPermuta(String(tipoCell))) {
      grp.permQtd += 1;
      grp.permTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }
    if (idxTipo >= 0 && isDevolucao(String(tipoCell))) {
      grp.devQtd += 1;
      grp.devTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }
    if (idxTipo >= 0 && isExclusao(String(tipoCell))) {
      grp.excQtd += 1;
      grp.excTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }


    if (idxTipo >= 0 && isInclusao(String(tipoCell))) {
      grp.incQtd += 1;
      if (valorValido) grp.incTotal += valor;
      if (isRetroativa(String(tipoCell))) {
        grp.retroQtd += 1;
        if (valorValido) grp.retroTotal += valor;
      }
      continue;
    }

    if (idxPlano < 0) continue;
    const cat = classificarPlano(String(planoCell));
    if (!cat) continue;
    if (cat === "enfermaria") grp.enfValores.push(valorValido ? valor : 0);
    else grp.aptValores.push(valorValido ? valor : 0);
  }

  // Mescla grupos por-nome (placeholder de CNPJ) em grupos com CNPJ válido
  // quando há um único pagador com o mesmo nome. Evita órfão de exclusões.
  for (const [key, g] of Array.from(grupos.entries())) {
    if (!key.startsWith("__nome::")) continue;
    const nomeKey = key.slice("__nome::".length);
    const candidatos = Array.from(grupos.values()).filter(
      (x) => x !== g && !ehCnpjPlaceholder(x.cnpj) && norm(x.nome) === nomeKey,
    );
    if (candidatos.length === 1) {
      const dest = candidatos[0];
      dest.enfValores.push(...g.enfValores);
      dest.aptValores.push(...g.aptValores);
      dest.incQtd += g.incQtd; dest.incTotal += g.incTotal;
      dest.retroQtd += g.retroQtd; dest.retroTotal += g.retroTotal;
      dest.excQtd += g.excQtd; dest.excTotal += g.excTotal;
      dest.devQtd += g.devQtd; dest.devTotal += g.devTotal;
      dest.permQtd += g.permQtd; dest.permTotal += g.permTotal;
      dest.adesaoQtd += g.adesaoQtd; dest.adesaoTotal += g.adesaoTotal;
      g.faixas.forEach((f, key) => {
        const prev = dest.faixas.get(key) || { ...f, quantidade: 0, total: 0 };
        prev.quantidade += f.quantidade;
        prev.total += f.total;
        dest.faixas.set(key, prev);
      });

      grupos.delete(key);
    }
  }



  const buildCategoria = (vals: number[]): CategoriaResultado => {
    const total = vals.reduce((s, v) => s + v, 0);
    const beneficiarios = vals.length;
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };

  const blocos: AnalisePorCnpj[] = Array.from(grupos.values())
    .map((g) => {
      const avisos: string[] = [];
      if (!g.cnpj) avisos.push("CNPJ não identificado nesta linha — usando apenas o nome.");
      const bloco: AnalisePorCnpj = {
        cnpj: g.cnpj,
        nome: g.nome || "Sem nome",
        nomeExibicao: formatNomeComCnpj(g.nome || "Sem nome", g.cnpj),
        enfermaria: buildCategoria(g.enfValores),
        apartamento: buildCategoria(g.aptValores),
        inclusoes: { quantidade: g.incQtd, total: g.incTotal },
        avisos,
      };
      if (g.retroQtd > 0 || g.retroTotal !== 0) {
        bloco.retroativas = { quantidade: g.retroQtd, total: g.retroTotal };
        // Origem: linhas do relatório de beneficiários (aba principal).
        bloco.retroativasBeneficiarios = { quantidade: g.retroQtd, total: g.retroTotal };
      }
      if (g.excQtd > 0 || g.excTotal !== 0) {
        bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
      }
      if (g.devQtd > 0 || g.devTotal !== 0) {
        bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
      }
      if (g.permQtd > 0 || g.permTotal !== 0) {
        bloco.permuta = { quantidade: g.permQtd, total: g.permTotal };
      }
      if (g.adesaoQtd > 0 || g.adesaoTotal !== 0) {
        bloco.taxaAdesao = { quantidade: g.adesaoQtd, total: g.adesaoTotal };
      }
      if (g.faixas.size > 0) {
        bloco.faixasEtarias = Array.from(g.faixas.values()).sort(
          (a, b) => a.idadeInicial - b.idadeInicial,
        );
      }



      return bloco;
    })
    .filter(
      (b) =>
        b.enfermaria.beneficiarios > 0 ||
        b.apartamento.beneficiarios > 0 ||
        b.inclusoes.quantidade > 0 ||
        (b.exclusoes && b.exclusoes.quantidade > 0) ||
        (b.devolucoes && b.devolucoes.quantidade > 0) ||
        (b.permuta && (b.permuta.quantidade > 0 || b.permuta.total !== 0)) ||
        (b.taxaAdesao && b.taxaAdesao.quantidade > 0),
    )

    .sort((a, b) => {
      const ta = a.enfermaria.total + a.apartamento.total + a.inclusoes.total;
      const tb = b.enfermaria.total + b.apartamento.total + b.inclusoes.total;
      return tb - ta;
    });

  // Enriquece blocos sem CNPJ usando o mapa extraído das demais abas (ex.: RESUMO).
  const { porNome: cnpjsPorNome, todos: cnpjsUnicos } = extrairCnpjsDoWorkbook(wb);
  const cnpjUnicoFallback = cnpjsUnicos.size === 1 ? Array.from(cnpjsUnicos)[0] ?? "" : "";
  if (cnpjsPorNome.size > 0 || cnpjUnicoFallback) {
    for (const bloco of blocos) {
      if (bloco.cnpj) continue;
      const alvo = normMatch(bloco.nome);
      let achado = "";
      if (alvo) {
        // 1) igualdade exata
        if (cnpjsPorNome.has(alvo)) achado = cnpjsPorNome.get(alvo)!;
        // 2) includes em qualquer direção
        if (!achado) {
          for (const [k, v] of cnpjsPorNome) {
            if (k.includes(alvo) || alvo.includes(k)) {
              achado = v;
              break;
            }
          }
        }
      }
      // 3) Fallback: se o workbook tem apenas 1 CNPJ, usa ele.
      if (!achado && cnpjUnicoFallback) achado = cnpjUnicoFallback;
      if (achado) {
        bloco.cnpj = achado;
        bloco.nomeExibicao = formatNomeComCnpj(bloco.nome, achado);
        bloco.avisos = bloco.avisos.filter(
          (a) => !a.startsWith("CNPJ não identificado nesta linha"),
        );
      }
    }
  }


  // Varre TODAS as abas do workbook em busca de pivots/rótulos de
  // "Cobrança Retroativa" que possam estar fora da aba principal
  // (ex.: aba RESUMO com pivots no rodapé ou abas dedicadas
  // "C.RETROATIVA MAR26", "C.RETROATIVA ABR26", ...).
  // Acumula qtd/total e distribui entre os blocos (rateio proporcional).
  let extraRetroQtd = 0;
  let extraRetroTotal = 0;
  let pivotEncontrado = false;
  const mesesRetro = new Set<string>();
  const detalhePorMes = new Map<string, { quantidade: number; total: number }>();
  const addDetalhe = (mes: string | null, qtd: number, total: number) => {
    if (!mes) return;
    const cur = detalhePorMes.get(mes) || { quantidade: 0, total: 0 };
    cur.quantidade += qtd;
    cur.total += total;
    detalhePorMes.set(mes, cur);
  };

  // Helper: extrai rótulo de mês tipo "MAR26", "MAR/26", "MARÇO 2026" -> "MAR/26"
  const extrairMes = (raw: string): string | null => {
    if (!raw) return null;
    const s = String(raw).toUpperCase().replace(/[^A-ZÇÃÕÁÉÍÓÚÂÊÔ0-9]/g, " ").replace(/\s+/g, " ").trim();
    const meses: Record<string, string> = {
      JAN: "JAN", JANEIRO: "JAN", FEV: "FEV", FEVEREIRO: "FEV",
      MAR: "MAR", MARCO: "MAR", MARÇO: "MAR", ABR: "ABR", ABRIL: "ABR",
      MAI: "MAI", MAIO: "MAI", JUN: "JUN", JUNHO: "JUN",
      JUL: "JUL", JULHO: "JUL", AGO: "AGO", AGOSTO: "AGO",
      SET: "SET", SETEMBRO: "SET", OUT: "OUT", OUTUBRO: "OUT",
      NOV: "NOV", NOVEMBRO: "NOV", DEZ: "DEZ", DEZEMBRO: "DEZ",
    };
    const m = s.match(/(JAN(?:EIRO)?|FEV(?:EREIRO)?|MAR(?:CO|ÇO)?|ABR(?:IL)?|MAI(?:O)?|JUN(?:HO)?|JUL(?:HO)?|AGO(?:STO)?|SET(?:EMBRO)?|OUT(?:UBRO)?|NOV(?:EMBRO)?|DEZ(?:EMBRO)?)\s*\/?\s*(\d{2,4})/);
    if (!m) return null;
    const mes = meses[m[1]] || m[1].slice(0, 3);
    const ano = m[2].length === 4 ? m[2].slice(-2) : m[2];
    return `${mes}/${ano}`;
  };

  // Passo 1: procura pivots "Cobrança Retroativa <Mês>" em abas de resumo
  // Chaves já contabilizadas (rótulo + valor) para não somar o mesmo pivot
  // duas vezes quando ele se repete em mais de uma aba/linha.
  const pivotsVistos = new Set<string>();
  // Detalhe por pagador abaixo de cada pivot "Cobrança Retroativa <Mês>":
  // nome normalizado -> mês -> { qtd, total }.
  const retroPorPagador = new Map<string, Map<string, { quantidade: number; total: number }>>();
  // Valor -> primeira ocorrência (mês do rótulo, quando houver, e quantidade).
  const valoresGenericos = new Map<string, { mes: string | null; qtd: number }>();

  // Uma quantidade plausível de beneficiários: inteiro pequeno.
  // Evita capturar CNPJ/CPF (ex.: 81611931005007) como "quantidade".
  const ehQtdPlausivel = (raw: unknown, n: number): boolean => {
    const digitos = String(raw ?? "").replace(/\D/g, "");
    if (digitos.length >= 11) return false; // CPF/CNPJ
    return Number.isFinite(n) && n >= 0 && n < 100000 && Math.abs(n - Math.round(n)) < 0.001;
  };
  wb.worksheets.forEach((sheet) => {
    const nomeAba = norm(sheet.name || "");
    const abaEhRetro = nomeAba.includes("retroativ");
    if (abaEhRetro) return;
    const rowsSheet: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => rowsSheet.push((row.values as unknown[]).slice(1)));
    let pvQtdIdx = -1;
    let pvValIdx = -1;
    for (let i = 0; i < rowsSheet.length; i++) {
      const r = rowsSheet[i] || [];
      // Cabeçalho da tabela dinâmica ("Soma de QTD" / "Soma de Valor")
      const hQtd = r.findIndex((c) => {
        const t = norm(c);
        return t.includes("qtd") || t.includes("quantidade");
      });
      const hVal = r.findIndex((c) => {
        const t = norm(c);
        // "Soma de Valor" ou "Soma de Mensalidade" (algumas pivots usam o nome da coluna de valor)
        return t.includes("valor") || (t.startsWith("soma de") && t.includes("mensalidade"));
      });
      if (hVal >= 0 || hQtd >= 0) {
        pvQtdIdx = hQtd;
        pvValIdx = hVal;
        continue;
      }
      if (r.some((c) => norm(c).startsWith("total"))) continue;
      let hitIdx = -1;
      let hitLabel = "";
      for (let c = 0; c < r.length; c++) {
        const t = norm(r[c]);
        // "Cobrança Retroativa <Mês>" ou "Retroativo <Mês>/<Ano>" (sem a palavra "cobrança").
        // Ignora linhas de total consolidado ("Valor Total Retroativo - ...").
        const ehRetroMes = /^r[ea]{0,2}troativ[oa]s?/.test(t) && !t.includes("total") && extrairMes(String(r[c] ?? "")) !== null;
        if (t.includes("cobranca retroativa") || ehRetroMes) { hitIdx = c; hitLabel = String(r[c] ?? ""); break; }
      }
      if (hitIdx < 0) continue;
      let total = NaN;
      let qtd = 0;
      // Prioridade: colunas declaradas no cabeçalho da pivot.
      if (pvValIdx > hitIdx) {
        const v = toNumber(r[pvValIdx]);
        if (!isNaN(v)) total = v;
        if (pvQtdIdx > hitIdx) {
          const q = toNumber(r[pvQtdIdx]);
          if (!isNaN(q)) qtd = Math.round(q);
        }
      }
      if (isNaN(total)) {
        // Coleta os números à direita do rótulo, ignorando identificadores
        // (CNPJ/CPF) que aparecem em algumas planilhas entre o rótulo e o valor.
        const nums: number[] = [];
        let qtdCand: number | null = null;
        for (let c = hitIdx + 1; c < r.length; c++) {
          const raw = r[c];
          const n = toNumber(raw);
          if (isNaN(n)) continue;
          const digitos = String(raw ?? "").replace(/\D/g, "");
          if (digitos.length >= 11) continue; // CNPJ/CPF — nunca é qtd nem valor
          if (qtdCand === null && nums.length === 0 && ehQtdPlausivel(raw, n)) {
            qtdCand = n;
            continue;
          }
          nums.push(n);
          if (nums.length >= 1) break;
        }
        // Sem coluna de valor: um número inteiro isolado é quantidade de
        // beneficiários, não valor — não deve virar total da cobrança.
        if (nums.length === 0) continue;
        total = nums[0];
        qtd = qtdCand !== null ? Math.round(qtdCand) : 0;
      }
      if (isNaN(total)) continue;

      const mes = extrairMes(hitLabel);
      // Deduplica por rótulo (mês) + valor. A mesma cobrança pode aparecer uma
      // vez com quantidade e outra sem, mas meses distintos podem ter o mesmo
      // valor (ex.: Maio26 e Junho26 = R$ 7.072,00) e devem ser somados.
      const chaveValor = total.toFixed(2);
      const chave = `${mes || norm(hitLabel)}|${chaveValor}`;
      if (pivotsVistos.has(chave)) continue;
      const anterior = valoresGenericos.get(chaveValor);
      if (anterior !== undefined) {
        // Já contabilizamos esse mesmo valor com rótulo genérico
        // ("Cobrança Retroativa") ou com mês: a repetição é a mesma cobrança
        // listada duas vezes (com e sem quantidade) — não soma de novo.
        if (!mes || anterior.mes === null) {
          if (mes && anterior.mes === null) {
            valoresGenericos.set(chaveValor, { mes, qtd: anterior.qtd });
            mesesRetro.add(mes);
            addDetalhe(mes, Math.max(qtd, anterior.qtd) - anterior.qtd, 0);
          }
          pivotsVistos.add(chave);
          continue;
        }
      }
      pivotsVistos.add(chave);
      valoresGenericos.set(chaveValor, { mes: mes || null, qtd });

      pivotEncontrado = true;
      extraRetroQtd += qtd;
      extraRetroTotal += total;
      if (mes) { mesesRetro.add(mes); addDetalhe(mes, qtd, total); }

      // Linhas filhas do pivot (um pagador por linha) até o "Total".
      if (mes && pvValIdx > hitIdx) {
        for (let j = i + 1; j < rowsSheet.length; j++) {
          const rr = rowsSheet[j] || [];
          if (rr.some((c) => { const t = norm(c); return t.startsWith("total") || t.includes("cobranca retroativa") || t.includes("rotulos"); })) break;
          const nomeCel = rr.slice(0, pvValIdx).find((c) => typeof c === "string" && /[a-z]/i.test(c));
          const v = toNumber(rr[pvValIdx]);
          if (!nomeCel || isNaN(v)) break;
          const q = pvQtdIdx >= 0 ? toNumber(rr[pvQtdIdx]) : NaN;
          const k = norm(nomeCel);
          const porMes = retroPorPagador.get(k) || new Map();
          const cur = porMes.get(mes) || { quantidade: 0, total: 0 };
          cur.quantidade += isNaN(q) ? 0 : Math.round(q);
          cur.total += v;
          porMes.set(mes, cur);
          retroPorPagador.set(k, porMes);
        }
      }
    }
  });


  // Passo 2: se não achou pivots, soma linha-a-linha das abas dedicadas
  if (!pivotEncontrado) {
    wb.worksheets.forEach((sheet) => {
      const nomeAba = norm(sheet.name || "");
      if (!nomeAba.includes("retroativ")) return;
      const mes = extrairMes(sheet.name || "");
      if (mes) mesesRetro.add(mes);
      const rowsSheet: unknown[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => rowsSheet.push((row.values as unknown[]).slice(1)));
      let hIdx = -1, iVal = -1, iQtd = -1, iTipo = -1;
      for (let i = 0; i < Math.min(5, rowsSheet.length); i++) {
        const r = rowsSheet[i];
        const v = findColumnIndex(r, COL_VALOR);
        const t = findColumnIndex(r, COL_TIPO_COBRANCA);
        const q = r.findIndex((c) => norm(c) === "qtd");
        if (v >= 0 || t >= 0) { hIdx = i; iVal = v; iQtd = q; iTipo = t; break; }
      }
      if (hIdx < 0) return;
      let abaQtd = 0;
      let abaTotal = 0;
      for (let i = hIdx + 1; i < rowsSheet.length; i++) {
        const r = rowsSheet[i];
        if (!r || r.length === 0) continue;
        // A aba inteira já é dedicada à cobrança retroativa (nome contém "retroativ"),
        // portanto NÃO filtramos por "Tipo Cobrança" — muitos relatórios trazem
        // as linhas com tipo "Mensalidade" mesmo na aba de retroativa.
        // Pula apenas linhas explicitamente marcadas como exclusão/devolução.
        const tipoCell = iTipo >= 0 ? String(r[iTipo] ?? "") : "";
        if (iTipo >= 0 && (isExclusao(tipoCell) || isDevolucao(tipoCell))) continue;
        // Ignora linhas de rodapé/total sem dados úteis
        const primeira = norm(r[0]);
        if (primeira.startsWith("total")) continue;
        const val = toNumber(r[iVal]);
        if (isNaN(val)) continue;
        const qtd = iQtd >= 0 ? toNumber(r[iQtd]) : 1;
        const qNum = isNaN(qtd) ? 1 : qtd;
        const vNum = val;
        extraRetroTotal += vNum;
        extraRetroQtd += qNum;
        abaTotal += vNum;
        abaQtd += qNum;
      }
      if (mes) addDetalhe(mes, abaQtd, abaTotal);
    });
  } else {
    // Mesmo com pivots, coleta meses das abas dedicadas para exibição
    wb.worksheets.forEach((sheet) => {
      const nomeAba = norm(sheet.name || "");
      if (!nomeAba.includes("retroativ")) return;
      const mes = extrairMes(sheet.name || "");
      if (mes) mesesRetro.add(mes);
    });
  }

  // Salvaguarda: quantidades absurdas indicam leitura de CNPJ/identificador.
  if (!Number.isFinite(extraRetroQtd) || extraRetroQtd >= 100000) extraRetroQtd = 0;
  detalhePorMes.forEach((v, k) => {
    if (!Number.isFinite(v.quantidade) || v.quantidade >= 100000) detalhePorMes.set(k, { ...v, quantidade: 0 });
  });

  const mesesArr = Array.from(mesesRetro);
  const detalheArr: RetroativaMesDetalhe[] = Array.from(detalhePorMes.entries())
    .map(([mes, v]) => ({ mes, quantidade: v.quantidade, total: v.total }));


  const achaPagadorRetro = (nome: string) => {
    const n = norm(nome || "");
    if (!n) return null;
    if (retroPorPagador.has(n)) return retroPorPagador.get(n)!;
    for (const [k, v] of retroPorPagador) if (k.startsWith(n) || n.startsWith(k)) return v;
    return null;
  };

  const scaleDetalhe = (w: number): RetroativaMesDetalhe[] | undefined =>
    detalheArr.length
      ? detalheArr.map((d) => ({ mes: d.mes, quantidade: Math.round(d.quantidade * w), total: d.total * w }))
      : undefined;

  if ((extraRetroQtd !== 0 || Math.abs(extraRetroTotal) > 0.001) && blocos.length > 0) {
    const jaRetroTotal = blocos.reduce((s, b) => s + (b.retroativas?.total ?? 0), 0);
    const jaRetroQtd = blocos.reduce((s, b) => s + (b.retroativas?.quantidade ?? 0), 0);
    const deltaQ = extraRetroQtd - jaRetroQtd;
    const deltaT = extraRetroTotal - jaRetroTotal;
    // A varredura global é apenas fallback. Quando as linhas principais já
    // identificaram uma retroativa, os demais valores encontrados são pivots
    // de detalhamento — não lançamentos adicionais.
    const linhasPrincipaisTemRetroativa =
      jaRetroQtd !== 0 || Math.abs(jaRetroTotal) > 0.001;
    if (!linhasPrincipaisTemRetroativa && (deltaQ > 0 || Math.abs(deltaT) > 0.001)) {
      if (blocos.length === 1) {
        const b = blocos[0];
        b.retroativas = {
          quantidade: (b.retroativas?.quantidade ?? 0) + deltaQ,
          total: (b.retroativas?.total ?? 0) + deltaT,
          meses: mesesArr.length ? mesesArr : b.retroativas?.meses,
          mesesDetalhe: scaleDetalhe(1) ?? b.retroativas?.mesesDetalhe,
        };
        b.retroativasReajuste = {
          quantidade: (b.retroativasReajuste?.quantidade ?? 0) + deltaQ,
          total: (b.retroativasReajuste?.total ?? 0) + deltaT,
          ...(mesesArr.length ? { meses: mesesArr } : {}),
          ...(detalheArr.length ? { mesesDetalhe: scaleDetalhe(1) } : {}),
        };
        b.inclusoes = { quantidade: b.inclusoes.quantidade + deltaQ, total: b.inclusoes.total + deltaT };
      } else if (
        retroPorPagador.size > 0 &&
        blocos.every((b) => achaPagadorRetro(b.nome) !== null)
      ) {
        // Usa o valor exato de cada pagador informado no pivot.
        blocos.forEach((b) => {
          const porMes = achaPagadorRetro(b.nome)!;
          const det = Array.from(porMes.entries()).map(([mes, d]) => ({ mes, quantidade: d.quantidade, total: d.total }));
          const q = det.reduce((s, d) => s + d.quantidade, 0);
          const v = det.reduce((s, d) => s + d.total, 0);
          b.retroativas = { quantidade: (b.retroativas?.quantidade ?? 0) + q, total: (b.retroativas?.total ?? 0) + v, meses: det.map((d) => d.mes), mesesDetalhe: det };
          b.retroativasReajuste = { quantidade: (b.retroativasReajuste?.quantidade ?? 0) + q, total: (b.retroativasReajuste?.total ?? 0) + v, meses: det.map((d) => d.mes), mesesDetalhe: det };
          b.inclusoes = { quantidade: b.inclusoes.quantidade + q, total: b.inclusoes.total + v };
        });
      } else {
        const base = blocos.map((b) => Math.abs(b.inclusoes.total) || 0);
        const soma = base.reduce((s, v) => s + v, 0);
        blocos.forEach((b, idx) => {
          const w = soma > 0 ? base[idx] / soma : 1 / blocos.length;
          const q = Math.round(deltaQ * w);
          const v = deltaT * w;
          b.retroativas = {
            quantidade: (b.retroativas?.quantidade ?? 0) + q,
            total: (b.retroativas?.total ?? 0) + v,
            meses: mesesArr.length ? mesesArr : b.retroativas?.meses,
            mesesDetalhe: scaleDetalhe(w) ?? b.retroativas?.mesesDetalhe,
          };
          b.retroativasReajuste = {
            quantidade: (b.retroativasReajuste?.quantidade ?? 0) + q,
            total: (b.retroativasReajuste?.total ?? 0) + v,
            ...(mesesArr.length ? { meses: mesesArr } : {}),
            ...(detalheArr.length ? { mesesDetalhe: scaleDetalhe(w) } : {}),
          };
          b.inclusoes = { quantidade: b.inclusoes.quantidade + q, total: b.inclusoes.total + v };
        });
      }
    } else if (mesesArr.length) {
      blocos.forEach((b) => {
        if (b.retroativas) {
          b.retroativas.meses = mesesArr;
          if (detalheArr.length) b.retroativas.mesesDetalhe = scaleDetalhe(1);
          reclassificarRetroComoReajuste(b);
        }
      });
    }
  } else if (mesesArr.length && blocos.length > 0) {
    blocos.forEach((b) => {
      if (b.retroativas) {
        b.retroativas.meses = mesesArr;
        if (detalheArr.length) b.retroativas.mesesDetalhe = scaleDetalhe(1);
        reclassificarRetroComoReajuste(b);
      }
    });
  }


  // Reconciliação com o total declarado pela planilha: se a soma das linhas
  // ficou acima do "TOTAL" do bloco no Excel, a diferença veio de cobrança
  // retroativa contada duas vezes (pivot repetido em outra aba) — corrige.
  blocos.forEach((b) => {
    const decl = b.totalDeclaradoExcel;
    if (typeof decl !== "number" || decl === 0 || !b.retroativas) return;
    const soma =
      (b.enfermaria?.total ?? 0) +
      (b.apartamento?.total ?? 0) +
      (b.inclusoes?.total ?? 0) +
      (b.exclusoes?.total ?? 0) +
      (b.devolucoes?.total ?? 0) +
      (b.permuta?.total ?? 0) +
      (b.taxaAdesao?.total ?? 0);
    const excesso = soma - decl;
    if (excesso <= 0.05) return;
    const corte = Math.min(excesso, b.retroativas.total);
    if (corte <= 0.05) return;
    const fator = (b.retroativas.total - corte) / b.retroativas.total;
    const novaQtd = Math.max(0, Math.round(b.retroativas.quantidade * fator));
    b.inclusoes = {
      quantidade: Math.max(0, b.inclusoes.quantidade - (b.retroativas.quantidade - novaQtd)),
      total: b.inclusoes.total - corte,
    };
    b.retroativas = {
      ...b.retroativas,
      quantidade: novaQtd,
      total: b.retroativas.total - corte,
      mesesDetalhe: b.retroativas.mesesDetalhe?.map((d) => ({
        mes: d.mes,
        quantidade: Math.round(d.quantidade * fator),
        total: d.total * fator,
      })),
    };
  });

  // Coparticipação — Empresarial: lê pivot da aba RESUMO e distribui nos blocos.
  const rowsResumo = lerRowsAbaResumo(wb);
  if (rowsResumo && blocos.length > 0) {
    let coparticipItems = parseCoparticipacaoRows(rowsResumo);
    if (coparticipItems.length === 0) {
      coparticipItems = parseCoparticipacaoPivotTipoCobranca(rowsResumo);
    }
    if (coparticipItems.length > 0) {
      const acumPorChave = new Map<
        string,
        { substipulantes: CoparticipacaoSubstipulante[]; quantidade: number; total: number }
      >();
      for (const item of coparticipItems) {
        const alvoKey = normMatch(item.nome);
        let match: AnalisePorCnpj | null = null;
        if (blocos.length === 1) {
          match = blocos[0];
        } else {
          match =
            blocos.find((b) => normMatch(b.nome) === alvoKey) ||
            blocos.find((b) => {
              const bk = normMatch(b.nome);
              return bk && (alvoKey.includes(bk) || bk.includes(alvoKey));
            }) ||
            null;
        }
        if (!match) continue;
        const key = match.cnpj || match.nome;
        const acc = acumPorChave.get(key) || { substipulantes: [], quantidade: 0, total: 0 };
        acc.substipulantes.push(item);
        acc.quantidade += item.quantidade;
        acc.total += item.total;
        acumPorChave.set(key, acc);
      }
      for (const b of blocos) {
        const acc = acumPorChave.get(b.cnpj || b.nome);
        if (acc && (acc.quantidade !== 0 || acc.total !== 0)) {
          b.coparticipacao = {
            quantidade: acc.quantidade,
            total: acc.total,
            substipulantes: acc.substipulantes,
          };
        }
      }
    }
  }

  return dividirBlocosPorSubBlocosDeclarados(wb, mesclarBlocosPorNomeForcado(blocos));
}



/** Sub-bloco "CNPJ: xx.xxx.xxx/xxxx-xx NOME" declarado numa aba de totais. */
interface SubBlocoDeclarado {
  cnpj: string;
  nome: string;
  enfQtd: number;
  enfMens: number;
  enfTotal: number;
  aptQtd: number;
  aptMens: number;
  aptTotal: number;
}

/**
 * Varre abas de totais (ex.: "TOTAL GERAL NOTA") procurando blocos no formato:
 *   CNPJ: 07.130.025/0001-59 DIGIBRAS ... - 222 MATRIZ | Qtd | Mensalidade | Total Fatura
 *   Plano M.Empresarial | 14 | 230,45 | 3.226,30
 *   Plano M.Executivo   |  0 | 305,51 | -
 * Um mesmo CNPJ pode aparecer em mais de um bloco (ex.: MATRIZ e
 * MATRIZ REINTEGRAÇÃO) — cada bloco vira uma análise separada.
 */
function lerSubBlocosDeclarados(wb: ExcelJS.Workbook): SubBlocoDeclarado[] {
  const reCnpjRotulo = /cnpj\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
  const out: SubBlocoDeclarado[] = [];

  wb.worksheets.forEach((ws) => {
    if (norm(ws.name).includes("resumo")) return;
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      rows.push((row.values as unknown[]).slice(1));
    });
    if (rows.length === 0 || rows.length > 5000) return;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      let col = -1;
      let m: RegExpMatchArray | null = null;
      for (let c = 0; c < r.length; c++) {
        const txt = cellToText(r[c]);
        const hit = txt.match(reCnpjRotulo);
        if (hit) { col = c; m = hit; break; }
      }
      if (col < 0 || !m) continue;

      const cnpj = normalizarCnpj(m[1]);
      if (cnpj.length !== 14) continue;
      const bruto = cellToText(r[col]);
      const nome = bruto
        .replace(reCnpjRotulo, "")
        .replace(/^[\s\-–—:]+/, "")
        .replace(/[\s\-–—:]+$/, "")
        .trim();

      // Colunas Qtd / Mensalidade / Total: na própria linha do CNPJ ou na seguinte.
      let idxQtd = -1;
      let idxMens = -1;
      let idxTotal = -1;
      let linhaInicio = i + 1;
      for (const cand of [i, i + 1]) {
        const rc = rows[cand] || [];
        let q = -1, me = -1, to = -1;
        for (let c = 0; c < rc.length; c++) {
          const h = norm(rc[c]);
          if (!h) continue;
          if (q < 0 && (h === "qtd" || h.includes("quantidade"))) q = c;
          else if (me < 0 && h.includes("mensalidade")) me = c;
          else if (to < 0 && (h.includes("total") || h.includes("valor"))) to = c;
        }
        if (q >= 0 && to >= 0) {
          idxQtd = q; idxMens = me; idxTotal = to;
          linhaInicio = cand + 1;
          break;
        }
      }
      if (idxTotal < 0) continue;

      const sub: SubBlocoDeclarado = {
        cnpj, nome: nome || "Sem nome",
        enfQtd: 0, enfMens: 0, enfTotal: 0,
        aptQtd: 0, aptMens: 0, aptTotal: 0,
      };

      for (let j = linhaInicio; j < rows.length; j++) {
        const rj = rows[j] || [];
        const label = cellToText(rj[col]).trim();
        const labelNorm = norm(label);
        if (label && reCnpjRotulo.test(label)) break;
        if (labelNorm.startsWith("total")) break;
        if (!label) {
          // Linha vazia encerra o bloco quando já lemos algum plano.
          if (sub.enfQtd || sub.aptQtd || sub.enfTotal || sub.aptTotal) break;
          continue;
        }
        const cat = classificarPlano(label);
        if (!cat) continue;
        const qtd = idxQtd >= 0 ? toNumber(rj[idxQtd]) : NaN;
        const mens = idxMens >= 0 ? toNumber(rj[idxMens]) : NaN;
        const tot = toNumber(rj[idxTotal]);
        const q = isNaN(qtd) ? 0 : Math.round(qtd);
        const t = isNaN(tot) ? 0 : tot;
        if (cat === "enfermaria") {
          sub.enfQtd += q;
          sub.enfTotal += t;
          if (!isNaN(mens) && mens !== 0) sub.enfMens = mens;
        } else {
          sub.aptQtd += q;
          sub.aptTotal += t;
          if (!isNaN(mens) && mens !== 0) sub.aptMens = mens;
        }
      }

      if (sub.enfQtd || sub.aptQtd || sub.enfTotal || sub.aptTotal) out.push(sub);
    }
  });

  return out;
}

/**
 * Quando a planilha declara o mesmo CNPJ em mais de um bloco (ex.: "222 MATRIZ"
 * e "222 MATRIZ REINTEGRAÇÃO"), separa o bloco consolidado em vários — um por
 * bloco declarado — para gerar uma análise/histórico por linha da planilha.
 */
function dividirBlocosPorSubBlocosDeclarados(
  wb: ExcelJS.Workbook,
  blocos: AnalisePorCnpj[],
): AnalisePorCnpj[] {
  if (blocos.length === 0) return blocos;
  const subs = lerSubBlocosDeclarados(wb);
  if (subs.length === 0) return blocos;

  const porCnpj = new Map<string, SubBlocoDeclarado[]>();
  subs.forEach((s) => {
    const arr = porCnpj.get(s.cnpj) || [];
    arr.push(s);
    porCnpj.set(s.cnpj, arr);
  });

  const duplicados = new Map<string, SubBlocoDeclarado[]>();
  porCnpj.forEach((arr, cnpj) => {
    if (arr.length > 1) duplicados.set(cnpj, arr);
  });
  if (duplicados.size === 0) return blocos;

  const escala = (
    v: InclusaoResultado | undefined,
    f: number,
  ): InclusaoResultado | undefined =>
    v ? { ...v, quantidade: Math.round(v.quantidade * f), total: v.total * f } : undefined;

  const saida: AnalisePorCnpj[] = [];
  for (const bloco of blocos) {
    const arr = bloco.cnpj ? duplicados.get(bloco.cnpj) : undefined;
    if (!arr) { saida.push(bloco); continue; }

    const totalQtd = arr.reduce((s, x) => s + x.enfQtd + x.aptQtd, 0);
    const totalVal = arr.reduce((s, x) => s + x.enfTotal + x.aptTotal, 0);

    arr.forEach((sub) => {
      const peso =
        totalQtd > 0
          ? (sub.enfQtd + sub.aptQtd) / totalQtd
          : totalVal !== 0
            ? (sub.enfTotal + sub.aptTotal) / totalVal
            : 1 / arr.length;

      const novo: AnalisePorCnpj = {
        cnpj: bloco.cnpj,
        nome: sub.nome,
        nomeExibicao: formatNomeComCnpj(sub.nome, bloco.cnpj),
        enfermaria: {
          beneficiarios: sub.enfQtd,
          mensalidade: sub.enfMens || (sub.enfQtd > 0 ? sub.enfTotal / sub.enfQtd : 0),
          total: sub.enfTotal,
        },
        apartamento: {
          beneficiarios: sub.aptQtd,
          mensalidade: sub.aptMens || (sub.aptQtd > 0 ? sub.aptTotal / sub.aptQtd : 0),
          total: sub.aptTotal,
        },
        inclusoes: escala(bloco.inclusoes, peso) || { quantidade: 0, total: 0 },
        avisos: [
          ...bloco.avisos,
          `Bloco separado conforme a planilha — o CNPJ possui ${arr.length} faturamentos distintos ("${sub.nome}").`,
        ],
        totalDeclaradoExcel: sub.enfTotal + sub.aptTotal,
      };
      const retro = escala(bloco.retroativas, peso); if (retro) novo.retroativas = retro;
      const retroR = escala(bloco.retroativasReajuste, peso); if (retroR) novo.retroativasReajuste = retroR;
      const retroB = escala(bloco.retroativasBeneficiarios, peso); if (retroB) novo.retroativasBeneficiarios = retroB;
      const exc = escala(bloco.exclusoes, peso); if (exc) novo.exclusoes = exc;
      const dev = escala(bloco.devolucoes, peso); if (dev) novo.devolucoes = dev;
      const perm = escala(bloco.permuta, peso); if (perm) novo.permuta = perm;
      const ade = escala(bloco.taxaAdesao, peso); if (ade) novo.taxaAdesao = ade;
      if (bloco.complemento) {
        novo.complemento = {
          ...bloco.complemento,
          quantidade: Math.round(bloco.complemento.quantidade * peso),
          total: bloco.complemento.total * peso,
        };
      }
      if (bloco.coparticipacao) {
        novo.coparticipacao = {
          ...bloco.coparticipacao,
          quantidade: Math.round(bloco.coparticipacao.quantidade * peso),
          total: bloco.coparticipacao.total * peso,
        };
      }
      if (bloco.faixasEtarias?.length) {
        novo.faixasEtarias = bloco.faixasEtarias.map((f) => ({
          ...f,
          quantidade: Math.round(f.quantidade * peso),
          total: f.total * peso,
        }));
      }
      saida.push(novo);
    });
  }
  return saida;
}


/**
 * Consolida múltiplos blocos por-CNPJ num único bloco por-nome para pagadores
 * que têm regra especial (matriz + filiais com mesmo subestipulante).
 * Ex.: "PIONEIRO COMBUSTIVEIS LTD" → 1 bloco somando todos os CNPJs.
 */
function mesclarBlocosPorNomeForcado(blocos: AnalisePorCnpj[]): AnalisePorCnpj[] {
  const FORCE_GROUP_BY_NAME = getForceGroupByNamePatterns();
  const matchForce = (nome: string) => {
    const n = norm(nome);
    return FORCE_GROUP_BY_NAME.find((p) => n.includes(p)) || null;
  };
  const grupos = new Map<string, AnalisePorCnpj[]>();
  const ordem: AnalisePorCnpj[] = [];
  for (const b of blocos) {
    const tag = matchForce(b.nome);
    if (!tag) { ordem.push(b); continue; }
    // Jabil deve ser agrupada pelo nome completo: matriz e filial são empresas
    // distintas, mas CNPJs diferentes dentro do mesmo nome continuam somados.
    const groupKey = tag.includes("jabil industrial do brasil")
      ? `${tag}::${normMatch(b.nome)}`
      : tag;
    const list = grupos.get(groupKey) || [];
    list.push(b);
    grupos.set(groupKey, list);
  }
  if (grupos.size === 0) return blocos;

  const somaCat = (arr: AnalisePorCnpj[], cat: "enfermaria" | "apartamento"): CategoriaResultado => {
    const beneficiarios = arr.reduce((s, x) => s + (x[cat]?.beneficiarios || 0), 0);
    const total = arr.reduce((s, x) => s + (x[cat]?.total || 0), 0);
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };
  const somaQT = (
    arr: AnalisePorCnpj[],
    key:
      | "inclusoes"
      | "retroativas"
      | "retroativasReajuste"
      | "retroativasBeneficiarios"
      | "exclusoes"
      | "devolucoes"
      | "permuta"
      | "taxaAdesao",
  ) => {
    const items = arr.map((x) => (x as any)[key]).filter(Boolean) as { quantidade: number; total: number }[];
    if (items.length === 0) return undefined;
    return { quantidade: items.reduce((s, x) => s + x.quantidade, 0), total: items.reduce((s, x) => s + x.total, 0) };
  };

  const merged: AnalisePorCnpj[] = [];
  for (const [, arr] of grupos) {
    const principal = arr[0];
    const faixasMap = new Map<string, FaixaEtariaResumo>();
    arr.forEach((b) => (b.faixasEtarias || []).forEach((f) => {
      const k = `${f.idadeInicial}-${f.idadeFinal ?? "+"}`;
      const prev = faixasMap.get(k) || { ...f, quantidade: 0, total: 0 };
      prev.quantidade += f.quantidade;
      prev.total += f.total;
      faixasMap.set(k, prev);
    }));
    const cnpjs = Array.from(new Set(arr.map((x) => x.cnpj).filter(Boolean)));
    const novoBloco: AnalisePorCnpj = {
      cnpj: principal.cnpj,
      nome: principal.nome,
      nomeExibicao: principal.nome,
      enfermaria: somaCat(arr, "enfermaria"),
      apartamento: somaCat(arr, "apartamento"),
      inclusoes: somaQT(arr, "inclusoes") || { quantidade: 0, total: 0 },
      avisos: [
        ...(cnpjs.length > 1 ? [`Consolidado por nome — ${cnpjs.length} CNPJs agrupados (${cnpjs.join(", ")}).`] : []),
      ],
    };
    const retro = somaQT(arr, "retroativas");
    if (retro) {
      const meses = Array.from(new Set(arr.flatMap((x) => x.retroativas?.meses || [])));
      const detalheMap = new Map<string, { quantidade: number; total: number }>();
      arr.forEach((x) => (x.retroativas?.mesesDetalhe || []).forEach((d) => {
        const cur = detalheMap.get(d.mes) || { quantidade: 0, total: 0 };
        cur.quantidade += d.quantidade;
        cur.total += d.total;
        detalheMap.set(d.mes, cur);
      }));
      const mesesDetalhe = Array.from(detalheMap.entries()).map(([mes, v]) => ({ mes, ...v }));
      novoBloco.retroativas = {
        ...retro,
        ...(meses.length ? { meses } : {}),
        ...(mesesDetalhe.length ? { mesesDetalhe } : {}),
      };
    }


    const retroRea = somaQT(arr, "retroativasReajuste");
    if (retroRea) {
      const meses = Array.from(new Set(arr.flatMap((x) => x.retroativasReajuste?.meses || [])));
      novoBloco.retroativasReajuste = { ...retroRea, ...(meses.length ? { meses } : {}) };
    }
    const retroBen = somaQT(arr, "retroativasBeneficiarios");
    if (retroBen) novoBloco.retroativasBeneficiarios = retroBen;
    const exc = somaQT(arr, "exclusoes"); if (exc) novoBloco.exclusoes = exc;
    const dev = somaQT(arr, "devolucoes"); if (dev) novoBloco.devolucoes = dev;
    const perm = somaQT(arr, "permuta"); if (perm) novoBloco.permuta = perm;
    const ade = somaQT(arr, "taxaAdesao"); if (ade) novoBloco.taxaAdesao = ade;
    const complementos = arr.map((x) => x.complemento).filter(Boolean) as ComplementoResultado[];
    if (complementos.length > 0) {
      novoBloco.complemento = {
        quantidade: complementos.reduce((s2, c) => s2 + c.quantidade, 0),
        total: complementos.reduce((s2, c) => s2 + c.total, 0),
        periodoLabel: complementos.find((c) => c.periodoLabel)?.periodoLabel ?? null,
        itens: complementos.flatMap((c) => c.itens || []),
      };
    }
    // Coparticipação: soma quantidade/total e concatena substipulantes.
    const copartics = arr.map((x) => x.coparticipacao).filter(Boolean) as CoparticipacaoResultado[];
    if (copartics.length > 0) {
      const substipulantes = copartics.flatMap((c) => c.substipulantes || []);
      novoBloco.coparticipacao = {
        quantidade: copartics.reduce((s, c) => s + c.quantidade, 0),
        total: copartics.reduce((s, c) => s + c.total, 0),
        ...(substipulantes.length ? { substipulantes } : {}),
      };
    }
    if (faixasMap.size > 0) {
      novoBloco.faixasEtarias = Array.from(faixasMap.values()).sort((a, b) => a.idadeInicial - b.idadeInicial);
    }
    const declarados = arr.map((x) => x.totalDeclaradoExcel).filter((v): v is number => typeof v === "number");
    if (declarados.length > 0) novoBloco.totalDeclaradoExcel = declarados.reduce((s2, v) => s2 + v, 0);
    merged.push(novoBloco);
  }
  return [...ordem, ...merged];
}


/**
 * Cruza blocos do Excel com PDFs analisados, casando por CNPJ do tomador.
 * Devolve uma comparação por bloco (com motivo declarativo quando sem PDF)
 * e a lista de NFs órfãs (PDFs cujo tomador não aparece em nenhum bloco).
 */
export function cruzarExcelComPdfs(
  blocos: AnalisePorCnpj[],
  pdfs: Array<AnalisePdfResultado & { arquivo: string }>,
  tipoAnalise?: string | null,
): { comparacoes: ComparacaoResultado[]; notasOrfas: NotaOrfa[] } {
  const usados = new Set<number>();
  const comparacoes: ComparacaoResultado[] = blocos.map((bloco) => {
    let pdf: (AnalisePdfResultado & { arquivo: string }) | null = null;
    let matchPorNome = false;
    if (bloco.cnpj) {
      const idx = pdfs.findIndex(
        (p, i) => !usados.has(i) && normalizarCnpj(p.tomadorCnpj) === bloco.cnpj,
      );
      if (idx >= 0) {
        usados.add(idx);
        pdf = pdfs[idx];
      }
    }
    // Fallback por nome: quando o Excel não traz CNPJ (ex.: Jabil, cujas planilhas
    // não têm coluna CNPJ), casa o bloco pelo nome do tomador da NFS-e.
    if (!pdf) {
      const alvo = normMatch(bloco.nomeExibicao || bloco.nome);
      if (alvo) {
        const idx = pdfs.findIndex(
          (p, i) => !usados.has(i) && !!p.tomadorNome && normMatch(p.tomadorNome) === alvo,
        );
        if (idx >= 0) {
          usados.add(idx);
          pdf = pdfs[idx];
          matchPorNome = true;
        }
      }
    }
    const excelResult: AnaliseResultado = {
      pagador: bloco.nomeExibicao,
      cnpj: bloco.cnpj,
      nomeExibicao: bloco.nomeExibicao,
      enfermaria: bloco.enfermaria,
      apartamento: bloco.apartamento,
      inclusoes: bloco.inclusoes,
      retroativas: bloco.retroativas,
      retroativasReajuste: bloco.retroativasReajuste,
      retroativasBeneficiarios: bloco.retroativasBeneficiarios,
      exclusoes: bloco.exclusoes,
      devolucoes: bloco.devolucoes,
      permuta: bloco.permuta,
      taxaAdesao: bloco.taxaAdesao,
      faixasEtarias: bloco.faixasEtarias,
      coparticipacao: bloco.coparticipacao,
      complemento: bloco.complemento,
      totalDeclaradoExcel: bloco.totalDeclaradoExcel,
      avisos: bloco.avisos,


    };
    const cmp = compararExcelComPdf(excelResult, pdf, tipoAnalise);
    cmp.cnpj = bloco.cnpj;
    cmp.nomeExibicao = bloco.nomeExibicao;
    cmp.tomadorCnpj = pdf ? normalizarCnpj(pdf.tomadorCnpj) : null;
    cmp.tomadorNome = pdf?.tomadorNome ?? null;
    cmp.nfNumero = pdf?.nfNumero ?? null;
    cmp.valorLiquido = pdf?.valorLiquido ?? null;
    cmp.tributos = pdf?.tributos ?? null;
    if (pdf && matchPorNome) {
      cmp.avisosPdf = [
        ...(cmp.avisosPdf || []),
        "NF casada pelo nome do tomador (Excel sem coluna de CNPJ).",
      ];
    }
    if (!pdf) {
      cmp.motivoSemPdf = bloco.cnpj
        ? "NF não localizada para este CNPJ"
        : "NF não localizada para este tomador (Excel sem CNPJ; nome não bateu com nenhuma NF)";
      // Ausência de NF não é divergência — apenas informativo via motivoSemPdf.
    }
    return cmp;
  });

  const notasOrfas: NotaOrfa[] = pdfs
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !usados.has(i))
    .map(({ p }) => ({
      arquivo: p.arquivo,
      tomadorCnpj: normalizarCnpj(p.tomadorCnpj),
      tomadorNome: p.tomadorNome,
      valorLiquido: p.valorLiquido,
      nfNumero: p.nfNumero,
    }));

  return { comparacoes, notasOrfas };
}
