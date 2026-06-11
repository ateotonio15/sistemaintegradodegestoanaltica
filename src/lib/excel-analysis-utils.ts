import ExcelJS from "exceljs";

export interface CategoriaResultado {
  beneficiarios: number;
  mensalidade: number;
  total: number;
}

export interface InclusaoResultado {
  quantidade: number;
  total: number;
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
  /** Apenas Análise Moto Honda — total geralmente negativo. */
  exclusoes?: InclusaoResultado;
  /** Devoluções — categoria própria com valor negativo (crédito). */
  devolucoes?: InclusaoResultado;
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
  exclusoes?: InclusaoResultado;
  devolucoes?: InclusaoResultado;
  avisos: string[];
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
  if (v instanceof Date) return v.toISOString();
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
const COL_PAGADOR = ["pagador", "nome pagador", "nome do pagador", "razao social", "razão social", "empresa", "contratante", "nome empresa", "nome da empresa"];

/** Normalização "agressiva" para casamento de nomes: remove pontuação e colapsa espaços. */
function normMatch(s: unknown): string {
  return norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove tudo que não é dígito (para comparar CNPJs). */
export function normalizarCnpj(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
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
      if (h === alias || h.includes(alias)) return i;
    }
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
  return null;
}

function isInclusao(tipo: string): boolean {
  const t = norm(tipo);
  // Inclusão e Cobrança Retroativa (ex.: "C. RETROATIVA", "Cob. Retroativo")
  // são tratadas como acréscimos e somadas em Inclusões.
  return t.includes("inclusao") || t.includes("inclusão") || t.includes("retroativ");
}

function isRetroativa(tipo: string): boolean {
  return norm(tipo).includes("retroativ");
}

function isExclusao(tipo: string): boolean {
  const t = norm(tipo);
  return (
    t.includes("exclusao") ||
    t.includes("exclusão") ||
    t.includes("excluido")
  );
}

function isDevolucao(tipo: string): boolean {
  const t = norm(tipo);
  return t.includes("devolucao") || t.includes("devolução") || t.includes("devolvido");
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
      idxPagador = findColumnIndex(r, COL_PAGADOR);
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
): ComparacaoResultado {
  const divergencias: string[] = [];
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
    if (pdf && !pdfEnc) divergencias.push("Categoria Enfermaria não encontrada no PDF.");
    else if (pdfEnc) {
      if (!enfermaria.beneficiarios.ok)
        divergencias.push(
          `Divergência nos beneficiários da enfermaria (Excel ${e.beneficiarios} × PDF ${p!.beneficiarios ?? "—"}).`,
        );
      if (!enfermaria.mensalidade.ok)
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
    if (pdf && !pdfEnc) divergencias.push("Categoria Apartamento não encontrada no PDF.");
    else if (pdfEnc) {
      if (!apartamento.beneficiarios.ok)
        divergencias.push(
          `Divergência nos beneficiários do apartamento (Excel ${e.beneficiarios} × PDF ${p!.beneficiarios ?? "—"}).`,
        );
      if (!apartamento.mensalidade.ok)
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
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i] || [];
    let lbl = -1, qtd = -1, mens = -1, val = -1;
    for (let c = 0; c < r.length; c++) {
      const h = norm(r[c]);
      if (!h) continue;
      if (lbl < 0 && (h.includes("empresa/modulo") || h.includes("empresa / modulo") || h.includes("modulo"))) lbl = c;
      else if (qtd < 0 && (h === "qtd" || h.includes("quantidade"))) qtd = c;
      else if (mens < 0 && h.includes("mensalidade")) mens = c;
      else if (val < 0 && (h === "valor" || h.includes("valor total"))) val = c;
    }
    if (lbl >= 0 && val >= 0) {
      headerIdx = i; idxLabel = lbl; idxQtd = qtd; idxMens = mens; idxValor = val;
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
  };


  const blocos: Acc[] = [];
  let cur: Acc | null = null;

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
    ) break;
    // Pula linhas de subtotal/total de bloco (ex.: "TOTAL ENFERMARIA", "SUBTOTAL APARTAMENTO",
    // "TOTAL EMPRESA", "TOTAL CONTRATO"), que repetiriam valores já contabilizados nos módulos.
    if (
      /^sub[\s-]*total\b/.test(labelNorm) ||
      (/^total\b/.test(labelNorm) && !labelNorm.startsWith("total geral"))
    ) {
      continue;
    }

    const m = labelRaw.match(reCnpj);
    if (m) {
      const cnpj = normalizarCnpj(m[1]);
      const nome = labelRaw.slice(0, m.index).trim().replace(/[-–—:]\s*$/, "").trim();
      cur = {
        cnpj, nome: nome || "Sem nome",
        enfValores: [], enfQtd: 0, enfMens: 0,
        aptValores: [], aptQtd: 0, aptMens: 0,
        incQtd: 0, incTotal: 0,
        retroQtd: 0, retroTotal: 0,
        excQtd: 0, excTotal: 0,
        devQtd: 0, devTotal: 0,
      };
      blocos.push(cur);
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

    if (labelNorm.includes("inclus") || labelNorm.includes("retroativ")) {
      cur.incQtd += qtdNum;
      cur.incTotal += valNum;
      if (labelNorm.includes("retroativ")) {
        cur.retroQtd += qtdNum;
        cur.retroTotal += valNum;
      }
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
    if (g.retroQtd > 0 || g.retroTotal !== 0) {
      bloco.retroativas = { quantidade: g.retroQtd, total: g.retroTotal };
    }
    if (g.excQtd > 0 || g.excTotal !== 0) {
      bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
    }
    if (g.devQtd > 0 || g.devTotal !== 0) {
      bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
    }

    return bloco;
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
  if (viaResumo && viaResumo.length > 0) return viaResumo;

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
      idxPagador = findColumnIndex(r, COL_PAGADOR);
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
  };
  const grupos = new Map<string, Acc>();
  const ehCnpjPlaceholder = (c: string) => !c || c.length !== 14 || /0{6,}$/.test(c);
  const getGrupo = (cnpj: string, nome: string): Acc => {
    // Chave preferencial: CNPJ válido. Pagadores distintos com a mesma
    // razão social (matriz + filial) ficam em blocos separados. Linhas
    // sem CNPJ válido (ex.: exclusões com placeholder) caem em chave por
    // nome — quando há ambiguidade entre múltiplos CNPJs com mesmo nome,
    // o agrupamento por nome só é usado como último recurso.
    const nomeKey = norm(nome);
    const cnpjValido = !ehCnpjPlaceholder(cnpj);
    const key = cnpjValido
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
      }
      if (g.excQtd > 0 || g.excTotal !== 0) {
        bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
      }
      if (g.devQtd > 0 || g.devTotal !== 0) {
        bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
      }

      return bloco;
    })
    .filter(
      (b) =>
        b.enfermaria.beneficiarios > 0 ||
        b.apartamento.beneficiarios > 0 ||
        b.inclusoes.quantidade > 0 ||
        (b.exclusoes && b.exclusoes.quantidade > 0) ||
        (b.devolucoes && b.devolucoes.quantidade > 0),
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


  return blocos;
}


/**
 * Cruza blocos do Excel com PDFs analisados, casando por CNPJ do tomador.
 * Devolve uma comparação por bloco (com motivo declarativo quando sem PDF)
 * e a lista de NFs órfãs (PDFs cujo tomador não aparece em nenhum bloco).
 */
export function cruzarExcelComPdfs(
  blocos: AnalisePorCnpj[],
  pdfs: Array<AnalisePdfResultado & { arquivo: string }>,
): { comparacoes: ComparacaoResultado[]; notasOrfas: NotaOrfa[] } {
  const usados = new Set<number>();
  const comparacoes: ComparacaoResultado[] = blocos.map((bloco) => {
    let pdf: (AnalisePdfResultado & { arquivo: string }) | null = null;
    if (bloco.cnpj) {
      const idx = pdfs.findIndex(
        (p, i) => !usados.has(i) && normalizarCnpj(p.tomadorCnpj) === bloco.cnpj,
      );
      if (idx >= 0) {
        usados.add(idx);
        pdf = pdfs[idx];
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
      exclusoes: bloco.exclusoes,
      devolucoes: bloco.devolucoes,
      avisos: bloco.avisos,

    };
    const cmp = compararExcelComPdf(excelResult, pdf);
    cmp.cnpj = bloco.cnpj;
    cmp.nomeExibicao = bloco.nomeExibicao;
    cmp.tomadorCnpj = pdf ? normalizarCnpj(pdf.tomadorCnpj) : null;
    cmp.tomadorNome = pdf?.tomadorNome ?? null;
    cmp.nfNumero = pdf?.nfNumero ?? null;
    cmp.valorLiquido = pdf?.valorLiquido ?? null;
    cmp.tributos = pdf?.tributos ?? null;
    if (!pdf) {
      cmp.motivoSemPdf = bloco.cnpj
        ? "NF não localizada para este CNPJ"
        : "CNPJ não identificado na planilha";
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
