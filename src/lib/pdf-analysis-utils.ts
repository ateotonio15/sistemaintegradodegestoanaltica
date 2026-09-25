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
  /** Total de devoluções do histórico (negativo); null se não encontrado. */
  devolucoes: { total: number | null };
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
  // Aceita o layout antigo ("TOMADOR DO SERVIÇO") e o layout nacional da
  // NFS-e ("TOMADOR / ADQUIRENTE").
  const reIni = /tomador\s*(?:d[oa]?\s*servi[çc]o|\/\s*adquirente)/i;
  const mIni = texto.match(reIni);
  if (!mIni) return { cnpj: null, nome: null };
  const idx = (mIni.index ?? 0) + mIni[0].length;
  // Limita o escaneamento até o próximo grande bloco
  const reFim = /(destinat[aá]rio\s*da\s*opera|intermedi[aá]rio|servi[çc]o\s*prestado|tributa[çc][aã]o)/i;
  const restante = texto.slice(idx);
  const mFim = restante.match(reFim);
  const trecho = mFim ? restante.slice(0, mFim.index) : restante.slice(0, 1500);

  // CNPJ formatado XX.XXX.XXX/XXXX-XX
  const reCnpj = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
  const mCnpj = trecho.match(reCnpj);
  const cnpj = mCnpj ? soDigitosCnpj(mCnpj[1]) : null;

  // Nome / Nome Empresarial — o valor pode vir na MESMA linha ou na linha
  // imediatamente abaixo. O PDF.js costuma agrupar todos os rótulos da seção
  // (Nome, Endereço, CNPJ...) em uma linha e os respectivos valores na linha
  // seguinte. Por isso tentamos primeiro o "valor na próxima linha".
  let nome: string | null = null;
  const limparNome = (raw: string) =>
    raw
      // corta a partir do primeiro CNPJ formatado encontrado na sequência
      .replace(/\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, "")
      // corta no início do endereço (Rua/Av./Travessa/Alameda/Estrada/Rodovia/Praça/Quadra)
      .replace(/\s+(rua|avenida|av\.?|travessa|trav\.?|alameda|estrada|rodovia|pra[çc]a|quadra|conjunto|bloco)\b.*$/i, "")
      // corta em "Município / UF" colado na mesma linha (layout nacional)
      .replace(/\s+[A-Za-zÀ-ú. ]+\s\/\s[A-Z]{2}\b.*$/, "")
      // corta em CEP encontrado no meio
      .replace(/\s+\d{5}-?\d{3}\b.*$/, "")
      // corta em rótulos colados na mesma linha
      .replace(/\s*(e-?mail|endere[çc]o|munic[ií]pio|cep|telefone|cnpj|inscri[çc][aã]o|raz[aã]o|fantasia)\b.*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();


  const reLabel = /nome\s*\/?\s*nome\s*empresarial\s*[:\-]?\s*(.*)$/im;
  const mLabel = trecho.match(reLabel);
  if (mLabel) {
    const restoMesmaLinha = limparNome(mLabel[1] || "");
    if (restoMesmaLinha && restoMesmaLinha.length > 2) {
      nome = restoMesmaLinha;
    } else {
      // Pega a próxima linha não-vazia após o rótulo
      const idxLabel = (mLabel.index ?? 0) + mLabel[0].length;
      const apos = trecho.slice(idxLabel).split(/\n/);
      for (const ln of apos) {
        const v = limparNome(ln);
        if (v && v.length > 2 && !/^nome\b/i.test(v)) {
          nome = v;
          break;
        }
      }
    }
    if (nome) nome = nome.toUpperCase();
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
export async function extrairTextoPdf(buffer: ArrayBuffer): Promise<string> {
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
 * Extrai a "Data de Vencimento" declarada no bloco "Descrição do Serviço"
 * da NFS-e (ex.: "Data de Vencimento: 01/08/2026") e devolve em ISO (YYYY-MM-DD).
 * Também aceita variações como "Vencimento: 01/08/26" ou "Venc.: 01/08/2026".
 */
export function extrairVencimentoDaDescricao(texto: string): string | null {
  if (!texto) return null;
  const limpo = texto.replace(/\s+/g, " ");
  const regexes = [
    /data\s*d[eo]\s*vencimento\s*[:\-]?\s*(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/i,
    /vencimento\s*[:\-]?\s*(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/i,
    /venc\.?\s*[:\-]?\s*(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/i,
  ];
  for (const re of regexes) {
    const m = limpo.match(re);
    if (!m) continue;
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    let ano = Number(m[3]);
    if (ano < 100) ano += 2000;
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) continue;
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return null;
}

/** Baixa/analisa um PDF e devolve o vencimento declarado na descrição do serviço. */
export async function extrairVencimentoPdf(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const texto = await extrairTextoPdf(buffer);
    return extrairVencimentoDaDescricao(texto);
  } catch {
    return null;
  }
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
      devolucoes: { total: null },
      valorLiquido: null,
      nfNumero: null,
      tomadorCnpj: null,
      tomadorNome: null,
      tributos: {
        valorServico: null,
        baseCalculo: null,
        totalDeducoes: null,
        aliquotaIssqn: null,
        issqn: null,
        issqnRetido: null,
        ibs: null,
        cbs: null,
        outrasRetencoes: null,
        retencaoIssqn: null,
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

  // Fallback (faixa etária): "Enfermaria (27 beneficiarios): R$ 9.729,89"
  // — sem mensalidade por capita, apenas qtd e total.
  const reCatFaixa = (cat: string) =>
    new RegExp(
      `${cat}[\\s\\-:a-z]{0,10}?\\(?\\s*(\\d+)\\s*benefici[aá]ri[oa]s?\\s*\\)?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
      "i",
    );

  const mEnf = t.match(reCat("enfermaria"));
  if (mEnf) {
    const ben = parseInt(mEnf[1], 10);
    const men = parseValor(mEnf[2]);
    const tot = parseValor(mEnf[3]);
    if (!isNaN(ben) && !isNaN(men) && !isNaN(tot)) {
      enfermaria = { beneficiarios: ben, mensalidade: men, total: tot };
    }
  }
  if (!enfermaria) {
    const mEnfF = t.match(reCatFaixa("enfermaria"));
    if (mEnfF) {
      const ben = parseInt(mEnfF[1], 10);
      const tot = parseValor(mEnfF[2]);
      if (!isNaN(ben) && !isNaN(tot)) {
        enfermaria = { beneficiarios: ben, mensalidade: null, total: tot };
      }
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
  if (!apartamento) {
    const mAptF = t.match(reCatFaixa("apartamento"));
    if (mAptF) {
      const ben = parseInt(mAptF[1], 10);
      const tot = parseValor(mAptF[2]);
      if (!isNaN(ben) && !isNaN(tot)) {
        apartamento = { beneficiarios: ben, mensalidade: null, total: tot };
      }
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

  // "Cobrança Retroativa: 388,52" — algumas NFS-e listam separadamente do
  // valor de "Inclusão". O Excel soma as duas em "Inclusões", então fazemos
  // o mesmo aqui para evitar divergências falsas.
  const reRetro = new RegExp(
    `(?:^|[\\s/;|])cobran[çc]a\\s*retroativ[ao]s?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
    "gi",
  );
  for (const mRetro of t.matchAll(reRetro)) {
    const v = parseValor(mRetro[1]);
    if (!isNaN(v) && v > 0) {
      inclusoesTotal += v;
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

  // Devoluções — linha própria no histórico da NFS-e, sempre reduz o total.
  let devolucoesTotal: number | null = null;
  const reDev = new RegExp(
    `devolu(?:cao|coes|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*(\\()?\\s*(-)?\\s*r?\\$?\\s*(${NUM})\\s*(\\))?`,
    "i",
  );
  const mDev = t.match(reDev);
  if (mDev) {
    const v = parseValor(mDev[3]);
    if (!isNaN(v) && v !== 0) {
      devolucoesTotal = -Math.abs(v);
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

  /**
   * Localiza um rótulo (possivelmente no meio de uma linha de cabeçalho) e
   * retorna a PRÓXIMA linha não vazia DEPOIS da linha onde o rótulo aparece.
   * Em DANFSe, os cabeçalhos ficam todos em uma linha e os valores na seguinte.
   * Aceita um número N de linhas-valor a percorrer (default 1).
   */
  const linhasAposRotulo = (re: RegExp, qtd = 3): string[] => {
    const m = tLines.match(re);
    if (!m || m.index == null) return [];
    // Avança até o fim da linha onde o rótulo foi encontrado
    const fimLinha = tLines.indexOf("\n", m.index);
    if (fimLinha < 0) return [];
    const resto = tLines.slice(fimLinha + 1);
    return resto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, qtd);
  };

  const proximaLinhaApos = (re: RegExp): string | null =>
    linhasAposRotulo(re, 1)[0] ?? null;

  const moneysOf = (linha: string): number[] => {
    const out: number[] = [];
    // Aceita valores com ou sem "R$" e com ou sem casas decimais formatadas
    const re = /r\$\s*([\d.]+,\d{2})|(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(linha)) !== null) {
      const raw = mm[1] ?? mm[2];
      const v = parseValor(raw);
      if (!isNaN(v)) out.push(v);
    }
    return out;
  };

  // ---- Bloco "VALOR TOTAL DA NFS-E" ----
  // Estrutura típica DANFSe (em colunas):
  //   Header1: Valor do Serviço | Desc.Cond | Desc.Incond | ISSQN Retido
  //   Row1:    R$ X,XX          | -         | -           | R$ Y,YY
  //   Header2: Total Ret. Federais | PIS/COFINS | Valor Líquido da NFS-e
  //   Row2:    -                   | -          | R$ Z,ZZ
  // Lemos várias linhas após "VALOR TOTAL DA NFS-E" e mapeamos por posição.
  let valorLiquido: number | null = null;
  let issqnRetidoVT: number | null = null;
  let valorServicoVT: number | null = null;
  const linhasVT = linhasAposRotulo(/valor\s+total\s+da\s+nfs[\s\-]?e/i, 8);
  if (linhasVT.length) {
    // Concatena tudo até encontrar próxima seção ("TOTAIS APROXIMADOS" ou outro cabeçalho em CAIXA ALTA)
    const corte = linhasVT.findIndex((l) =>
      /^(totais\s+aproximados|tributacao|tributação|informacoes|informações|outras\s+informacoes)/i.test(l),
    );
    const usar = (corte > 0 ? linhasVT.slice(0, corte) : linhasVT).join(" ");
    const moneys = moneysOf(usar);
    // Ordem esperada após filtrar "-": [Valor Serviço, ISSQN Retido, Valor Líquido]
    if (moneys.length >= 3) {
      valorServicoVT = moneys[0];
      issqnRetidoVT = moneys[1];
      valorLiquido = moneys[moneys.length - 1];
    } else if (moneys.length === 2) {
      // [Valor Serviço, Valor Líquido] — ISSQN Retido como "-" (não retido)
      valorServicoVT = moneys[0];
      valorLiquido = moneys[1];
    } else if (moneys.length === 1) {
      valorLiquido = moneys[0];
    }
    // Validação cruzada: se temos Serviço e Líquido mas ISSQN Retido parece estranho,
    // recalcula via subtração (mais confiável que ordem dos campos)
    if (valorServicoVT != null && valorLiquido != null) {
      const dif = Number((valorServicoVT - valorLiquido).toFixed(2));
      if (dif > 0.01) {
        // Se ISSQN Retido lido difere muito do calculado, prefere o calculado
        if (issqnRetidoVT == null || Math.abs(issqnRetidoVT - dif) > 0.05) {
          issqnRetidoVT = dif;
        }
      } else if (dif <= 0.01) {
        // Serviço == Líquido → não há retenção
        issqnRetidoVT = null;
      }
    }
  }

  // Fallback adicional para "ISSQN Retido" — buscar no bloco "VALOR TOTAL DA NFS-E"
  // procurando o rótulo "ISSQN Retido" seguido do MENOR valor próximo (último da linha de valores)
  if (issqnRetidoVT == null) {
    // Procura "ISSQN Retido" e captura o ÚLTIMO R$ até a próxima quebra dupla ou rótulo
    const idx = t.search(/issqn\s+retido/i);
    if (idx >= 0) {
      const janela = t.slice(idx, idx + 200);
      const moneys = moneysOf(janela);
      if (moneys.length > 0) issqnRetidoVT = moneys[moneys.length - 1];
    }
  }

  // ---- Bloco "TRIBUTAÇÃO MUNICIPAL" ----
  let baseCalculo: number | null = null;
  let totalDeducoes: number | null = null;
  let aliquota: number | null = null;
  let issqnDevido: number | null = null;
  const linhaTM = linhasAposRotulo(/bc\s+issqn/i, 3).join(" ");
  if (linhaTM) {
    const moneys = moneysOf(linhaTM);
    if (moneys.length >= 4) {
      totalDeducoes = moneys[moneys.length - 3];
      baseCalculo = moneys[moneys.length - 2];
      issqnDevido = moneys[moneys.length - 1];
    } else if (moneys.length === 3) {
      // Ex.: [Valor Serviço, BC ISSQN, ISSQN Apurado] (Deduções como "-")
      baseCalculo = moneys[1];
      issqnDevido = moneys[2];
    } else {
      if (moneys.length >= 2) baseCalculo = moneys[moneys.length - 2];
      if (moneys.length >= 1) issqnDevido = moneys[moneys.length - 1];
    }
    const pct = linhaTM.match(/(\d+[,.]\d+)\s*%/);
    if (pct) aliquota = parseValor(pct[1]);
  }

  // Fallbacks por rótulo direto (NFS-e de outros municípios)
  if (baseCalculo == null) {
    const m = tLines.match(/(?:bc\s*issqn|base\s*de\s*calculo)[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
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
  if (totalDeducoes == null) {
    const m = tLines.match(/total\s+deducoes(?:\/redu[cç][oõ]es)?[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) totalDeducoes = parseValor(m[1]);
  }

  // Valor do Serviço (bruto) — usado na Etapa 3 (permite quebra de linha entre rótulo e valor)
  let valorServico: number | null = valorServicoVT;
  if (valorServico == null) {
    const m = t.match(/valor\s+(?:do\s+)?servic[oõ]s?[\s\S]{0,60}?r\$\s*([\d.]+,\d{2})/i);
    if (m) valorServico = parseValor(m[1]);
  }

  // Retenção do ISSQN (status declarado na nota)
  let retencaoIssqn: "retido" | "nao_retido" | null = null;
  if (/retido\s+pelo\s+tomador/i.test(tLines)) retencaoIssqn = "retido";
  else if (/n[ãa]o\s+retido/i.test(tLines)) retencaoIssqn = "nao_retido";
  // Se "Não Retido", o ISSQN Retido não se aplica
  if (retencaoIssqn === "nao_retido") issqnRetidoVT = null;

  // ---- IBS / CBS (linha "INFORMAÇÕES COMPLEMENTARES") ----
  const ibsM = tLines.match(/\bibs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);
  const cbsM = tLines.match(/\bcbs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);

  // ---- Outras retenções (federais) ----
  let outrasRetencoes: number | null = null;
  const mTRF = tLines.match(/total\s+das\s+retencoes\s+federais[^\n]*/i);
  if (mTRF) {
    const linha = mTRF[0];
    const v = linha.match(/r\$\s*([\d.]+,\d{2})/i);
    if (v) outrasRetencoes = parseValor(v[1]);
    else if (/\s-\s|\s-$/.test(linha)) outrasRetencoes = 0;
  }

  // Número da NF
  let nfNumero: string | null = null;
  const reNf = /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];

  const tributos: PdfTributos = {
    valorServico,
    baseCalculo,
    totalDeducoes,
    aliquotaIssqn: aliquota,
    issqn: issqnDevido,
    issqnRetido: issqnRetidoVT,
    ibs: ibsM ? parseValor(ibsM[1]) : null,
    cbs: cbsM ? parseValor(cbsM[1]) : null,
    outrasRetencoes,
    retencaoIssqn,
  };

  return {
    enfermaria: enfermaria ?? { ...empty },
    apartamento: apartamento ?? { ...empty },
    inclusoes: { total: inclusoesTotal },
    exclusoes: { total: exclusoesTotal },
    devolucoes: { total: devolucoesTotal },
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

  // Soma "Cobrança Retroativa" às inclusões (Excel agrega as duas).
  const reRetroS = new RegExp(
    `(?:^|[\\s/;|])cobran[çc]a\\s*retroativ[ao]s?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
    "gi",
  );
  for (const mRetroS of t.matchAll(reRetroS)) {
    const v = parseValor(mRetroS[1]);
    if (!isNaN(v) && v > 0) incTotal += v;
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
