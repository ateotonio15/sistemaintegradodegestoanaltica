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

export interface PdfTributos {
  /** Base de cálculo (R$). */
  baseCalculo: number | null;
  /** Alíquota ISSQN (%) — ex.: 5. */
  aliquotaIssqn: number | null;
  /** ISSQN devido (R$). */
  issqn: number | null;
  /** Valor retido (ISSQN retido na fonte, R$). */
  issqnRetido: number | null;
  /** IBS (R$). */
  ibs: number | null;
  /** CBS (R$). */
  cbs: number | null;
  /** Outras retenções (R$). */
  outrasRetencoes: number | null;
}

export interface AnalisePdfResultado {
  arquivo: string;
  enfermaria: PdfCategoria;
  apartamento: PdfCategoria;
  inclusoes: { total: number };
  /** Total de exclusões do histórico (negativo); null se não encontrado. */
  exclusoes: { total: number | null };
  /** Valor Líquido da NFS-e (extraído do PDF), null se não encontrado. */
  valorLiquido: number | null;
  /** Número da NF (ex: "4601"), null se não encontrado. */
  nfNumero: string | null;
  /** CNPJ do TOMADOR do serviço (apenas dígitos), null se não encontrado. */
  tomadorCnpj: string | null;
  /** Nome do TOMADOR do serviço (normalizado), null se não encontrado. */
  tomadorNome: string | null;
  /** Tributos extraídos da NFS-e (parciais). */
  tributos: PdfTributos;
  avisos: string[];
}

/** Normaliza CNPJ → apenas dígitos (14 chars). */
function soDigitosCnpj(s: string): string {
  return (s || "").replace(/\D/g, "").slice(0, 14);
}

/**
 * Extrai CNPJ + Nome do TOMADOR do serviço de uma NFS-e Samel.
 * Estratégia: localizar o bloco "TOMADOR DO SERVIÇO" e pegar o primeiro CNPJ
 * (14 dígitos no formato XX.XXX.XXX/XXXX-XX) e o "Nome / Nome Empresarial"
 * que aparecem depois dele, antes do próximo bloco.
 */
export function extrairTomador(textoOriginal: string): {
  cnpj: string | null;
  nome: string | null;
} {
  const texto = textoOriginal.replace(/\u00a0/g, " ");
  // Localiza início do bloco TOMADOR (case-insensitive, com/sem acento)
  const reIni = /tomador\s*d[oa]?\s*servi[çc]o/i;
  const mIni = texto.match(reIni);
  if (!mIni) return { cnpj: null, nome: null };
  const idx = (mIni.index ?? 0) + mIni[0].length;
  // Limita o escaneamento até o próximo grande bloco
  const reFim = /(intermedi[aá]rio|servi[çc]o\s*prestado|tributa[çc][aã]o)/i;
  const restante = texto.slice(idx);
  const mFim = restante.match(reFim);
  const trecho = mFim ? restante.slice(0, mFim.index) : restante.slice(0, 1500);

  // CNPJ formatado XX.XXX.XXX/XXXX-XX
  const reCnpj = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
  const mCnpj = trecho.match(reCnpj);
  const cnpj = mCnpj ? soDigitosCnpj(mCnpj[1]) : null;

  // Nome / Nome Empresarial — o valor pode vir na mesma linha ou logo abaixo
  let nome: string | null = null;
  const reNome = /nome\s*\/?\s*nome\s*empresarial\s*[:\-]?\s*([^\n\r]+)/i;
  const mNome = trecho.match(reNome);
  if (mNome) {
    nome = mNome[1]
      .replace(/\s{2,}/g, " ")
      .replace(/\s*(e-?mail|endere[çc]o|munic[ií]pio|cep|telefone|inscri[çc][aã]o).*$/i, "")
      .trim();
    if (!nome) nome = null;
  }

  return { cnpj, nome };
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
      exclusoes: { total: null },
      valorLiquido: null,
      nfNumero: null,
      tomadorCnpj: null,
      tomadorNome: null,
      tributos: {
        baseCalculo: null,
        aliquotaIssqn: null,
        issqn: null,
        issqnRetido: null,
        ibs: null,
        cbs: null,
        outrasRetencoes: null,
      },
      avisos: [`Falha ao abrir PDF: ${e?.message || e}`],
    };
  }

  // Tomador (CNPJ + Nome) extraído ANTES da normalização para preservar pontuação
  const { cnpj: tomadorCnpj, nome: tomadorNome } = extrairTomador(texto);

  // Texto normalizado (sem acentos / minúsculo) para casamento de regex,
  // mas preservando dígitos e separadores. Linha única para regex livres.
  const t = norm(texto);

  // Padrões aceitos:
  //   "Enfermaria: 97x200.99= 19.496,03"
  //   "Enfermaria CE-70x357,07: R$24.994,90"   (WINLOGIS)
  //   "Enfermaria Master 70 x 357,07 = 24.994,90"
  // Captura: (1)=qtd, (2)=mensalidade, (3)=total
  const NUM = String.raw`[\d.,]+`;
  const reCat = (cat: string) =>
    new RegExp(
      // cat + qualquer rótulo curto (CE, Master, etc.) + sep + qtd x preço + sep + total
      `${cat}[\\s\\-:a-z]{0,30}?(\\d+)\\s*[xX×]\\s*(${NUM})\\s*[=:]\\s*r?\\$?\\s*(${NUM})`,
      "i",
    );

  // Aceita: Inclusão, Inclusao, Inclusões, Inclusoes, Incluso, Incluído, Incluidos, etc.
  const reInclusao = new RegExp(
    `inclus(?:ao|oes|ões|o|os|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
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

  // Exclusões — aceita "(1.935,63)", "-1.935,63" ou "1.935,63" precedido de "exclusão"
  // Captura o valor + opcional "()" indicando negativo.
  let exclusoesTotal: number | null = null;
  const reExc = new RegExp(
    `exclus(?:ao|oes|ões|o|os|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*(\\()?\\s*(-)?\\s*r?\\$?\\s*(${NUM})\\s*(\\))?`,
    "i",
  );
  const mExc = t.match(reExc);
  if (mExc) {
    const v = parseValor(mExc[3]);
    if (!isNaN(v) && v !== 0) {
      const negativo = !!mExc[1] || !!mExc[2] || !!mExc[4];
      exclusoesTotal = negativo ? -Math.abs(v) : -Math.abs(v);
      // Sempre negativo (exclusão sempre reduz)
    }
  }

  // Valor Líquido da NFS-e — aceita variações de espaçamento e label que aparece
  // antes ou depois do valor (depende do layout das colunas no PDF).
  let valorLiquido: number | null = null;
  const reVL1 = /valor\s*l[ií]?quido(?:\s*d[ao]?\s*(?:nfs[\s\-]?e|nota))?[^\d\-]{0,40}(r?\$?\s*[\d.,]+)/i;
  const reVL2 = /(r?\$?\s*[\d.,]+)[^\d\-]{0,40}valor\s*l[ií]?quido/i;
  const mVL = t.match(reVL1) || t.match(reVL2);
  if (mVL) {
    const v = parseValor(mVL[1].replace(/r?\$?\s*/i, ""));
    if (!isNaN(v) && v > 0) valorLiquido = v;
  }

  // Número da NF — procura especificamente "Número da NFS-e <NNNN>"
  let nfNumero: string | null = null;
  const reNf = /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];

  // =====================================================================
  // Tributos (extração parcial — Fase 1)
  // Procura por rótulos comuns na NFS-e: Base de Cálculo, Alíquota ISSQN,
  // ISSQN devido / a recolher, ISSQN retido, IBS, CBS, Outras retenções.
  // =====================================================================
  const findMoney = (re: RegExp): number | null => {
    const m = t.match(re);
    if (!m) return null;
    const v = parseValor(m[1]);
    return isNaN(v) ? null : v;
  };
  const tributos: PdfTributos = {
    baseCalculo: findMoney(/base\s*d[eo]?\s*c[aá]lculo[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
    aliquotaIssqn: findMoney(/al[ií]quota\s*(?:do\s*)?issqn[^\d\-]{0,20}([\d.,]+)\s*%?/i),
    issqn: findMoney(/issqn\s*(?:devido|a\s*recolher|calculado)?[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
    issqnRetido: findMoney(/issqn\s*retido[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i)
      ?? findMoney(/valor\s*retido[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
    ibs: findMoney(/\bibs\b[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
    cbs: findMoney(/\bcbs\b[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
    outrasRetencoes: findMoney(/outras\s*reten[cç][oõ]es[^\d\-]{0,30}(r?\$?\s*[\d.,]+)/i),
  };

  return {
    enfermaria: enfermaria ?? { ...empty },
    apartamento: apartamento ?? { ...empty },
    inclusoes: { total: inclusoesTotal },
    exclusoes: { total: exclusoesTotal },
    valorLiquido,
    nfNumero,
    tomadorCnpj,
    tomadorNome,
    tributos,
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
    `inclus(?:ao|oes|ões|o|os|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*(?:(\\d+)\\s*[xX×]\\s*)?(${NUM})`,
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
  const reNf = /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i;
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
