// Configura o worker do PDF.js para Vite (build em browser)
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — Vite resolve o worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfCategoria {
  beneficiarios: number | null;
  mensalidade: number | null;
  total: number;
}

export interface AnalisePdfResultado {
  arquivo: string;
  enfermaria: PdfCategoria;
  apartamento: PdfCategoria;
  inclusoes: { total: number };
  /** Valor Líquido da NFS-e (extraído do PDF), null se não encontrado. */
  valorLiquido: number | null;
  /** Número da NF (ex: "4601"), null se não encontrado. */
  nfNumero: string | null;
  avisos: string[];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "200.99" / "200,99" / "1.234,56" / "1234.56" → number */
function parseValor(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  // Caso BRL clássico: tem vírgula → ponto é separador de milhar
  if (s.includes(",")) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  // Sem vírgula: o ponto pode ser decimal (ex.: "200.99") ou milhar (ex.: "1.234")
  // Heurística: se tiver exatamente 2 dígitos após o último ponto, é decimal
  const m = s.match(/^(\d+)\.(\d{1,2})$/);
  if (m) return parseFloat(`${m[1]}.${m[2]}`);
  return parseFloat(s.replace(/\./g, ""));
}

/** Extrai todo o texto do PDF (em ordem de leitura) como uma única string. */
async function extrairTextoPdf(buffer: ArrayBuffer): Promise<string> {
  // IMPORTANTE: pdf.js DESTRÓI (detaches) o ArrayBuffer após uso.
  // Como o mesmo buffer pode ser passado para análise completa e simplificada,
  // sempre clonamos antes para preservar o original.
  const data = buffer.slice(0);
  const pdf = await (pdfjsLib as any).getDocument({ data }).promise;
  const partes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter((i) => typeof i.str === "string")
      .map((i) => ({
        str: i.str as string,
        x: i.transform?.[4] ?? 0,
        y: i.transform?.[5] ?? 0,
      }));

    // Agrupar por Y (tolerância 2px) → linhas naturais
    const groups: Array<{ y: number; items: typeof items }> = [];
    items.forEach((it) => {
      const g = groups.find((gr) => Math.abs(gr.y - it.y) < 2);
      if (g) g.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    });
    groups.sort((a, b) => b.y - a.y);
    groups.forEach((g) => {
      g.items.sort((a, b) => a.x - b.x);
      partes.push(g.items.map((i) => i.str).join(" "));
    });
  }
  return partes.join("\n").replace(/\u00a0/g, " ");
}

/**
 * Lê um PDF (NFS-e Samel) e extrai os totais de Enfermaria / Apartamento / Inclusões
 * a partir do bloco "Descrição do Serviço".
 *
 * Padrão típico:
 *   "Enfermaria: 97x200.99= 19.496,03/ Apartamento: 37x261.36= 9.670,32 Inclusão:450,29"
 */
export async function analisarPdfFinanceiro(
  buffer: ArrayBuffer,
): Promise<Omit<AnalisePdfResultado, "arquivo">> {
  const empty: PdfCategoria = { beneficiarios: null, mensalidade: null, total: 0 };
  const avisos: string[] = [];

  let texto: string;
  try {
    texto = await extrairTextoPdf(buffer);
  } catch (e: any) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { total: 0 },
      valorLiquido: null,
      nfNumero: null,
      avisos: [`Falha ao abrir PDF: ${e?.message || e}`],
    };
  }

  // Texto normalizado (sem acentos / minúsculo) para casamento de regex,
  // mas preservando dígitos e separadores. Linha única para regex livres.
  const t = norm(texto);

  // Padrão "Enfermaria: 97x200.99= 19.496,03"
  const NUM = String.raw`[\d.,]+`;
  const reCat = (cat: string) =>
    new RegExp(`${cat}\\s*:?\\s*(\\d+)\\s*[xX×]\\s*(${NUM})\\s*=\\s*(${NUM})`, "i");

  const reInclusao = new RegExp(
    `inclus(?:ao|oes|oes|ao|oes)\\s*:?\\s*(${NUM})`,
    "i",
  );

  let enfermaria: PdfCategoria | null = null;
  let apartamento: PdfCategoria | null = null;
  let inclusoesTotal = 0;
  let inclusoesEncontradas = false;

  const mEnf = t.match(reCat("enfermaria"));
  if (mEnf) {
    const ben = parseInt(mEnf[1], 10);
    const men = parseValor(mEnf[2]);
    const tot = parseValor(mEnf[3]);
    if (!isNaN(ben) && !isNaN(men) && !isNaN(tot)) {
      enfermaria = { beneficiarios: ben, mensalidade: men, total: tot };
    }
  }

  const mApt = t.match(reCat("apartamento"));
  if (mApt) {
    const ben = parseInt(mApt[1], 10);
    const men = parseValor(mApt[2]);
    const tot = parseValor(mApt[3]);
    if (!isNaN(ben) && !isNaN(men) && !isNaN(tot)) {
      apartamento = { beneficiarios: ben, mensalidade: men, total: tot };
    }
  }

  const mInc = t.match(reInclusao);
  if (mInc) {
    const v = parseValor(mInc[1]);
    if (!isNaN(v) && v > 0) {
      inclusoesTotal = v;
      inclusoesEncontradas = true;
    }
  }

  if (!enfermaria) avisos.push("Categoria 'Enfermaria' não encontrada no PDF.");
  if (!apartamento) avisos.push("Categoria 'Apartamento' não encontrada no PDF.");
  if (!inclusoesEncontradas) avisos.push("Categoria 'Inclusões' não encontrada no PDF.");

  // Valor Líquido da NFS-e — aceita variações de espaçamento
  let valorLiquido: number | null = null;
  const reValorLiquido = /valor\s*l[ií]?quido\s*da\s*nfs[\s\-]?e\s*r?\$?\s*([\d.,]+)/i;
  const mVL = t.match(reValorLiquido);
  if (mVL) {
    const v = parseValor(mVL[1]);
    if (!isNaN(v) && v > 0) valorLiquido = v;
  }

  // Número da NF — procura "nº NNNN" ou "n NNNN" no texto
  let nfNumero: string | null = null;
  const reNf = /\bn[º°o]?\s*[:.]?\s*(\d{3,8})\b/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];

  return {
    enfermaria: enfermaria ?? { ...empty },
    apartamento: apartamento ?? { ...empty },
    inclusoes: { total: inclusoesTotal },
    valorLiquido,
    nfNumero,
    avisos,
  };
}

// =====================================================================
// Análise simplificada (Moto Honda) — quando a NF não traz Enfermaria/Apto
// =====================================================================

export interface AnalisePdfSimplificado {
  beneficiarios: number | null;
  inclusoes: { quantidade: number | null; total: number };
  exclusoes: { quantidade: number | null; total: number };
  valorLiquido: number | null;
  nfNumero: string | null;
  avisos: string[];
}

/**
 * Lê PDF e tenta extrair APENAS:
 *  - Total de beneficiários
 *  - Inclusões (qtd opcional + valor)
 *  - Exclusões (qtd opcional + valor; pode ser negativo)
 *
 * Usado como fallback automático quando o PDF Moto Honda não trouxer
 * categorias detalhadas (Enfermaria/Apartamento/Mensalidade).
 */
export async function analisarPdfFinanceiroSimplificado(
  buffer: ArrayBuffer,
): Promise<AnalisePdfSimplificado> {
  const avisos: string[] = [];
  let texto: string;
  try {
    texto = await extrairTextoPdf(buffer);
  } catch (e: any) {
    return {
      beneficiarios: null,
      inclusoes: { quantidade: null, total: 0 },
      exclusoes: { quantidade: null, total: 0 },
      valorLiquido: null,
      nfNumero: null,
      avisos: [`Falha ao abrir PDF: ${e?.message || e}`],
    };
  }

  const t = norm(texto);
  // Aceita opcionalmente R$, parênteses (= negativo contábil) ao redor do número
  const NUM = String.raw`\(?\s*r?\$?\s*-?[\d.,]+\s*\)?`;

  const parseValor = (raw: string): number => {
    let s = raw.trim();
    if (!s) return NaN;
    // Parênteses contábeis = negativo
    let negativo = false;
    if (s.startsWith("(") && s.endsWith(")")) {
      negativo = true;
      s = s.slice(1, -1).trim();
    }
    // Remove R$ e espaços
    s = s.replace(/r\$\s*/i, "").replace(/\s+/g, "");
    if (s.startsWith("-")) {
      negativo = !negativo;
      s = s.slice(1);
    }
    let n: number;
    if (s.includes(",")) {
      n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    } else {
      const m = s.match(/^(\d+)\.(\d{1,2})$/);
      n = m ? parseFloat(`${m[1]}.${m[2]}`) : parseFloat(s.replace(/\./g, ""));
    }
    if (isNaN(n)) return NaN;
    return negativo ? -n : n;
  };

  // Beneficiários: tenta vários padrões (incl. "(16353 beneficiarios)")
  let beneficiarios: number | null = null;
  const reBenef1 = /total\s*de?\s*beneficiarios?\s*[:\-=]?\s*(\d+)/i;
  const reBenef2 = /\(?\s*(\d+)\s*\)?\s*beneficiarios?/i;
  const reBenef3 = /qtd\.?\s*(?:de\s*)?beneficiarios?\s*[:\-=]?\s*(\d+)/i;
  const reBenef4 = /referente\s*a\s*\(?\s*(\d+)\s*beneficiarios?/i;
  const m1 =
    t.match(reBenef4) || t.match(reBenef1) || t.match(reBenef3) || t.match(reBenef2);
  if (m1) {
    const v = parseInt(m1[1], 10);
    if (!isNaN(v)) beneficiarios = v;
  }

  // Inclusões: "inclusoes:34.463,50" ou "inclusao 12x R$ 100,00"
  let incQtd: number | null = null;
  let incTotal = 0;
  const reInc = new RegExp(
    `inclus(?:ao|oes|ões)?\\s*[:\\-=]?\\s*(?:(\\d+)\\s*[xX×]\\s*)?(${NUM})`,
    "i",
  );
  const mInc = t.match(reInc);
  if (mInc) {
    if (mInc[1]) incQtd = parseInt(mInc[1], 10);
    const v = parseValor(mInc[2]);
    if (!isNaN(v)) incTotal = v;
  }

  // Exclusões: "exclusoes: (6.976,73)" → negativo
  let excQtd: number | null = null;
  let excTotal = 0;
  const reExc = new RegExp(
    `exclus(?:ao|oes|ões)?\\s*[:\\-=]?\\s*(?:(\\d+)\\s*[xX×]\\s*)?(${NUM})`,
    "i",
  );
  const mExc = t.match(reExc);
  if (mExc) {
    if (mExc[1]) excQtd = parseInt(mExc[1], 10);
    const v = parseValor(mExc[2]);
    if (!isNaN(v)) excTotal = v;
  }

  if (beneficiarios === null) avisos.push("Total de beneficiários não encontrado no PDF.");
  if (incTotal === 0 && !mInc) avisos.push("Inclusões não encontradas no PDF.");
  if (excTotal === 0 && !mExc) avisos.push("Exclusões não encontradas no PDF.");

  // Valor Líquido + NF (compartilhado com análise completa)
  let valorLiquido: number | null = null;
  const reVL = /valor\s*l[ií]?quido\s*da\s*nfs[\s\-]?e\s*r?\$?\s*([\d.,]+)/i;
  const mVL = t.match(reVL);
  if (mVL) {
    const v = parseValor(mVL[1]);
    if (!isNaN(v) && v > 0) valorLiquido = v;
  }
  let nfNumero: string | null = null;
  const reNf = /\bn[º°o]?\s*[:.]?\s*(\d{3,8})\b/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];

  return {
    beneficiarios,
    inclusoes: { quantidade: incQtd, total: incTotal },
    exclusoes: { quantidade: excQtd, total: excTotal },
    valorLiquido,
    nfNumero,
    avisos,
  };
}
