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
  const pdf = await (pdfjsLib as any).getDocument({ data: buffer }).promise;
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

  return {
    enfermaria: enfermaria ?? { ...empty },
    apartamento: apartamento ?? { ...empty },
    inclusoes: { total: inclusoesTotal },
    avisos,
  };
}
