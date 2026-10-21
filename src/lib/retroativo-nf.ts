/**
 * Linhas de cobrança retroativa na NFS-e (texto já normalizado, sem acentos).
 * Aceita "Cobrança retroativa: 388,52", "Retroativo agosto: 436,74",
 * "Retroativo - Setembro/26 R$ 436,74", "Retroação 08/2026 = 436,74".
 * O valor precisa ter centavos (",dd") para não capturar ano ou quantidade.
 */
export function regexRetroativoNf(): RegExp {
  const MES = String.raw`(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:\/|-|de)?\s*\d{2,4}(?![\d,]))?`;
  const COMP = String.raw`\d{1,2}\s*\/\s*\d{2,4}(?![\d,])`;
  return new RegExp(
    String.raw`(?:^|[\s/;|(])(?:cobranca\s*)?retroa(?:tiv[ao]s?|cao)(?:\s+(?:a|de|ref\.?|referente(?:\s+a)?))?(?:\s*[-:]?\s*(?:${MES}|${COMP}))?\s*(?:\(\s*\d+\s*[a-z]*\s*\))?\s*[:\-=]?\s*(?:r\s*\$)?\s*(\d[\d.]*,\d{2})`,
    "gi",
  );
}

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
      .replace(/\s+[A-Za-zÀ-ú.]+(?:\s[A-Za-zÀ-ú.]+)?\s\/\s[A-Z]{2}\b.*$/, "")
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

