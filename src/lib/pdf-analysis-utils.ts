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
  /** Valor do Serviço bruto da NFS-e (R$) — usado na Etapa 3 (conferência bruta). */
  valorServico: number | null;
  /** Base de cálculo do ISSQN (R$). */
  baseCalculo: number | null;
  /** Total de Deduções/Reduções (R$). */
  totalDeducoes: number | null;
  /** Alíquota ISSQN (%) — ex.: 2. */
  aliquotaIssqn: number | null;
  /** ISSQN apurado / devido (R$). */
  issqn: number | null;
  /** ISSQN retido na fonte (R$). null quando "Não Retido". */
  issqnRetido: number | null;
  /** IBS (R$). */
  ibs: number | null;
  /** CBS (R$). */
  cbs: number | null;
  /** Outras retenções federais (R$). */
  outrasRetencoes: number | null;
  /** Indicador de retenção do ISSQN extraído da nota. */
  retencaoIssqn: "retido" | "nao_retido" | null;
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

  // ============================================================
  // Extração estrutural (DANFSe): rótulos e valores ficam em linhas
  // adjacentes, então precisamos preservar as quebras de linha.
  // ============================================================
  const tLines = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ \t]+/g, " ");

  const proximaLinhaApos = (re: RegExp): string | null => {
    const m = tLines.match(re);
    if (!m || m.index == null) return null;
    const resto = tLines.slice(m.index + m[0].length);
    const linhas = resto.split("\n").map((l) => l.trim()).filter(Boolean);
    return linhas[0] ?? null;
  };

  const moneysOf = (linha: string): number[] => {
    const out: number[] = [];
    const re = /r\$\s*([\d.]+,\d{2})/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(linha)) !== null) {
      const v = parseValor(mm[1]);
      if (!isNaN(v)) out.push(v);
    }
    return out;
  };

  // ---- Bloco "VALOR TOTAL DA NFS-E" (Valor Líquido + ISSQN Retido) ----
  // Ordem dos valores: Valor Serviço | Desc.Cond | Desc.Incond | ISSQN Retido
  //                  | Total Ret. Federais | PIS/COFINS | Valor Líquido
  let valorLiquido: number | null = null;
  let issqnRetidoVT: number | null = null;
  const linhaVT = proximaLinhaApos(/valor\s+liquido\s+da\s+nfs[\s\-]?e/i);
  if (linhaVT) {
    const moneys = moneysOf(linhaVT);
    if (moneys.length >= 1) valorLiquido = moneys[moneys.length - 1];
    if (moneys.length >= 3) issqnRetidoVT = moneys[moneys.length - 2];
  }

  // ---- Bloco "TRIBUTAÇÃO MUNICIPAL" (BC ISSQN / Alíquota / ISSQN Apurado) ----
  // Ordem: Valor Serviço | Desc.Incond | Total Deduções | Cálc.BM
  //      | BC ISSQN | Alíquota Aplicada | Retenção ISSQN | ISSQN Apurado
  let baseCalculo: number | null = null;
  let aliquota: number | null = null;
  let issqnDevido: number | null = null;
  const linhaTM = proximaLinhaApos(/bc\s+issqn/i);
  if (linhaTM) {
    const moneys = moneysOf(linhaTM);
    // Esperado: [Valor Serviço, Total Deduções, BC ISSQN, ISSQN Apurado]
    if (moneys.length >= 2) baseCalculo = moneys[moneys.length - 2];
    if (moneys.length >= 1) issqnDevido = moneys[moneys.length - 1];
    const pct = linhaTM.match(/(\d+[,.]\d+)\s*%/);
    if (pct) aliquota = parseValor(pct[1]);
  }

  // Fallbacks por rótulo direto (NFS-e de outros municípios)
  if (baseCalculo == null) {
    const m = tLines.match(/base\s*de\s*calculo[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) baseCalculo = parseValor(m[1]);
  }
  if (issqnDevido == null) {
    const m = tLines.match(/issqn\s*(?:apurado|devido|a\s*recolher)[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) issqnDevido = parseValor(m[1]);
  }
  if (aliquota == null) {
    const m = tLines.match(/aliquota\s*(?:aplicada|do\s*issqn|issqn)?[^\n]{0,20}(\d+[,.]\d+)\s*%/i);
    if (m) aliquota = parseValor(m[1]);
  }

  // ---- IBS / CBS (linha "INFORMAÇÕES COMPLEMENTARES") ----
  // Padrão: "IBS: 0,1% com reducao de 60% | R$ 18,33  CBS: 0,9% ... | R$ 165,00"
  const ibsM = tLines.match(/\bibs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);
  const cbsM = tLines.match(/\bcbs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);

  // ---- Outras retenções (federais) ----
  // Se a linha "Total das Retenções Federais" mostra "-", consideramos zero.
  let outrasRetencoes: number | null = null;
  const mTRF = tLines.match(/total\s+das\s+retencoes\s+federais[^\n]*/i);
  if (mTRF) {
    const linha = mTRF[0];
    const v = linha.match(/r\$\s*([\d.]+,\d{2})/i);
    if (v) outrasRetencoes = parseValor(v[1]);
    else if (/\s-\s|\s-$/.test(linha)) outrasRetencoes = 0;
  }

  // Número da NF — procura especificamente "Número da NFS-e <NNNN>"
  let nfNumero: string | null = null;
  const reNf = /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];

  const tributos: PdfTributos = {
    baseCalculo,
    aliquotaIssqn: aliquota,
    issqn: issqnDevido,
    issqnRetido: issqnRetidoVT,
    ibs: ibsM ? parseValor(ibsM[1]) : null,
    cbs: cbsM ? parseValor(cbsM[1]) : null,
    outrasRetencoes,
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
