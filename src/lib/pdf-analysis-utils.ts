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

/** Converte "1.234,56" / "R$ 1.234,56" / "1234.56" em number. */
function parseBRL(raw: string): number {
  let s = raw.replace(/[R$\s]/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/** Extrai todos os tokens numéricos (BRL ou inteiro) de uma string. */
function extrairNumeros(linha: string): number[] {
  const matches = linha.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/g);
  if (!matches) return [];
  return matches.map((m) => parseBRL(m)).filter((n) => !isNaN(n));
}

function classificarCategoria(linha: string): "enfermaria" | "apartamento" | "inclusao" | null {
  const p = norm(linha);
  if (!p) return null;
  if (p.includes("inclusao") || p.includes("inclusão")) return "inclusao";
  // apartamento primeiro (executivo pode coexistir com master)
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

/**
 * Lê um PDF (boleto/fatura) e retorna os totais por categoria,
 * focando na seção "Serviço Prestado".
 */
export async function analisarPdfFinanceiro(
  buffer: ArrayBuffer,
): Promise<Omit<AnalisePdfResultado, "arquivo">> {
  const empty: PdfCategoria = { beneficiarios: null, mensalidade: null, total: 0 };
  const avisos: string[] = [];

  let pdf: any;
  try {
    pdf = await (pdfjsLib as any).getDocument({ data: buffer }).promise;
  } catch (e: any) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { total: 0 },
      avisos: [`Falha ao abrir PDF: ${e?.message || e}`],
    };
  }

  // Extrai linhas, agrupando itens próximos no eixo Y de cada página
  const linhas: string[] = [];
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

    // Agrupar por Y (tolerância 2px)
    const groups: Array<{ y: number; items: typeof items }> = [];
    items.forEach((it) => {
      const g = groups.find((gr) => Math.abs(gr.y - it.y) < 2);
      if (g) g.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    });
    groups.sort((a, b) => b.y - a.y);
    groups.forEach((g) => {
      g.items.sort((a, b) => a.x - b.x);
      const linha = g.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (linha) linhas.push(linha);
    });
  }

  // Localizar bloco "Serviço Prestado"
  const idxInicio = linhas.findIndex((l) => norm(l).includes("servico prestado"));
  const linhasAnalisadas = idxInicio >= 0 ? linhas.slice(idxInicio) : linhas;

  if (idxInicio < 0) {
    avisos.push("Seção 'Serviço Prestado' não localizada — analisando documento inteiro.");
  }

  let enfermaria: PdfCategoria | null = null;
  let apartamento: PdfCategoria | null = null;
  let inclusoesTotal = 0;
  let inclusoesEncontradas = false;

  for (let i = 0; i < linhasAnalisadas.length; i++) {
    const linha = linhasAnalisadas[i];
    const cat = classificarCategoria(linha);
    if (!cat) continue;

    // Tenta números na própria linha; se não houver suficientes, pega na próxima
    let nums = extrairNumeros(linha);
    if (nums.length < 2 && i + 1 < linhasAnalisadas.length) {
      nums = nums.concat(extrairNumeros(linhasAnalisadas[i + 1]));
    }

    if (cat === "inclusao") {
      // Inclusões: PDF só traz o valor total (último número significativo)
      if (nums.length > 0) {
        inclusoesTotal += nums[nums.length - 1];
        inclusoesEncontradas = true;
      }
      continue;
    }

    if (nums.length < 3) {
      avisos.push(
        `Linha de ${cat === "enfermaria" ? "Enfermaria" : "Apartamento"} sem qtd/unitário/total identificáveis no PDF.`,
      );
      continue;
    }

    // Padrão típico de fatura: [..., qtd, unitário, total] (3 últimos)
    const total = nums[nums.length - 1];
    const mensalidade = nums[nums.length - 2];
    const beneficiarios = Math.round(nums[nums.length - 3]);

    const dado: PdfCategoria = { beneficiarios, mensalidade, total };
    if (cat === "enfermaria") enfermaria = dado;
    else apartamento = dado;
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
