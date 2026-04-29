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
  enfermaria: CategoriaResultado;
  apartamento: CategoriaResultado;
  inclusoes: InclusaoResultado;
  /** Apenas Análise Moto Honda — total geralmente negativo. */
  exclusoes?: InclusaoResultado;
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

/** Normaliza string: minúsculo, sem acentos, sem espaços nas pontas. */
function norm(s: unknown): string {
  return String(s ?? "")
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
  let s = String(v).trim();
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
    p.includes("apartamento")
  ) {
    return "apartamento";
  }
  if (
    p.includes("coletivo empresarial master") ||
    p.includes("master empresarial") ||
    p.includes("enfermaria")
  ) {
    return "enfermaria";
  }
  return null;
}

function isInclusao(tipo: string): boolean {
  const t = norm(tipo);
  return t.includes("inclusao") || t.includes("inclusão");
}

/**
 * Lê um buffer .xlsx/.xls e devolve análise: Enfermaria, Apartamento e Inclusões.
 * As colunas obrigatórias são "Plano" e "Tipo Cobrança" (variações aceitas).
 */
export async function analisarExcelFinanceiro(
  buffer: ArrayBuffer,
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

  // Coletar todas as linhas brutas (até 2000 para evitar travas)
  const allRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length >= 2000) return;
    const values = (row.values as unknown[]).slice(1); // ExcelJS é 1-indexed
    allRows.push(values);
  });

  // Procurar a linha de cabeçalho dentro das primeiras 10
  let headerRow: unknown[] | null = null;
  let headerIdx = -1;
  let idxPlano = -1;
  let idxTipo = -1;
  let idxValor = -1;

  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const r = allRows[i];
    const p = findColumnIndex(r, COL_PLANO);
    const t = findColumnIndex(r, COL_TIPO_COBRANCA);
    const v = findColumnIndex(r, COL_VALOR);
    // Considera cabeçalho se achou pelo menos plano OU tipo cobrança
    if (p >= 0 || t >= 0) {
      headerRow = r;
      headerIdx = i;
      idxPlano = p;
      idxTipo = t;
      idxValor = v;
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

  const enfValores: number[] = [];
  const aptValores: number[] = [];
  let incQtd = 0;
  let incTotal = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;

    const planoCell = idxPlano >= 0 ? r[idxPlano] : "";
    const tipoCell = idxTipo >= 0 ? r[idxTipo] : "";
    const valorCell = idxValor >= 0 ? r[idxValor] : 0;

    const valor = toNumber(valorCell);
    const valorValido = !isNaN(valor) && valor >= 0;

    // Inclusão tem prioridade — não soma em enfermaria/apartamento
    if (idxTipo >= 0 && isInclusao(String(tipoCell))) {
      incQtd += 1;
      if (valorValido) incTotal += valor;
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

  const buildCategoria = (vals: number[]): CategoriaResultado => {
    const total = vals.reduce((s, v) => s + v, 0);
    const beneficiarios = vals.length;
    // Mensalidade "média" — se todos iguais, mostra o próprio valor
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };

  return {
    enfermaria: buildCategoria(enfValores),
    apartamento: buildCategoria(aptValores),
    inclusoes: { quantidade: incQtd, total: incTotal },
    avisos,
  };
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
  divergencias: string[];
  avisosPdf: string[];
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

  return {
    pagador: excel.pagador,
    arquivoPdf: pdf?.arquivo ?? null,
    enfermaria,
    apartamento,
    inclusoes,
    divergencias,
    avisosPdf: pdf?.avisos ?? [],
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
