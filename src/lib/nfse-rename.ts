// Utilidades para identificar metadados de uma NFS-e (PDF) e
// gerar automaticamente o nome do arquivo no padrão:
//   "NF <TOMADOR> <NUMERO>.pdf"
//
// Reaproveita o parser existente em pdf-analysis-utils.ts.

import { extrairTextoPdf, extrairTomador } from "./pdf-analysis-utils";

export interface NfseMetadados {
  nfNumero: string | null;
  tomadorNome: string | null;
  tomadorCnpj: string | null;
  /** true quando conseguimos ler o PDF (mesmo que não tenha encontrado todos os campos). */
  leituraOk: boolean;
  /** Mensagem amigável em caso de falha total de leitura. */
  erro?: string;
}

/** Lê um PDF (NFS-e) e devolve número da NFS-e + tomador (nome/CNPJ). */
export async function extrairMetadadosNfse(
  buffer: ArrayBuffer,
): Promise<NfseMetadados> {
  let texto: string;
  try {
    texto = await extrairTextoPdf(buffer);
  } catch (e: any) {
    return {
      nfNumero: null,
      tomadorNome: null,
      tomadorCnpj: null,
      leituraOk: false,
      erro: e?.message || String(e),
    };
  }

  const { cnpj: tomadorCnpj, nome: tomadorNome } = extrairTomador(texto);

  // Número da NFS-e. O PDF.js agrupa rótulos numa linha e valores na seguinte:
  //   "Número da NFS-e   Competência da NFS-e   Data e Hora ..."
  //   "7141              02/06/2026             02/06/2026 12:00:55 ..."
  // Estratégia:
  //   1) tentar valor logo após o rótulo na mesma linha;
  //   2) se não houver, pegar o primeiro token 3-8 dígitos da próxima linha
  //      não-vazia (rejeitando a "Chave de Acesso" que tem 40+ dígitos).
  const t = texto.replace(/\u00a0/g, " ");
  let nfNumero: string | null = null;
  const reLabelNum = /n[uú]mero\s+d[ao]?\s+nfs[\s\-]?e\s*[:\-]?\s*(.*)$/im;
  const mLabel = t.match(reLabelNum);
  if (mLabel) {
    const restoMesmaLinha = (mLabel[1] || "").trim();
    const mInline = restoMesmaLinha.match(/^(\d{3,8})\b/);
    if (mInline) {
      nfNumero = mInline[1];
    } else {
      const idxApos = (mLabel.index ?? 0) + mLabel[0].length;
      const linhas = t.slice(idxApos).split(/\n/);
      for (const ln of linhas) {
        const tokens = ln.split(/\s+/).filter(Boolean);
        for (const tok of tokens) {
          if (/^\d{3,8}$/.test(tok)) {
            nfNumero = tok;
            break;
          }
        }
        if (nfNumero) break;
      }
    }
  }


  return {
    nfNumero,
    tomadorNome: tomadorNome ? tomadorNome.toUpperCase().trim() : null,
    tomadorCnpj,
    leituraOk: true,
  };
}

/**
 * Remove caracteres inválidos para nomes de arquivo e normaliza espaços.
 * Mantém acentuação. Retorna string segura para usar como nome.
 */
export function sanitizarNomeArquivo(nome: string): string {
  return nome
    .replace(/[\\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Monta o nome final do arquivo no padrão "NF <TOMADOR> <NUMERO>.pdf".
 * Se faltar tomador ou número, retorna null (caller decide o fallback).
 */
export function montarNomeArquivoNfse(
  tomador: string | null,
  nfNumero: string | null,
): string | null {
  if (!tomador || !nfNumero) return null;
  const base = sanitizarNomeArquivo(`NF ${tomador} ${nfNumero}`);
  if (!base) return null;
  return `${base}.pdf`;
}

/**
 * Garante unicidade do nome contra uma lista de nomes já existentes.
 * Se "NF X 123.pdf" existir, devolve "NF X 123 (2).pdf", etc.
 */
export function gerarNomeUnico(nome: string, existentes: string[]): string {
  const setExist = new Set(existentes.map((n) => n.toLowerCase()));
  if (!setExist.has(nome.toLowerCase())) return nome;
  const m = nome.match(/^(.*?)(\.[^.]+)?$/);
  const base = m?.[1] ?? nome;
  const ext = m?.[2] ?? "";
  let i = 2;
  while (true) {
    const tentativa = `${base} (${i})${ext}`;
    if (!setExist.has(tentativa.toLowerCase())) return tentativa;
    i += 1;
    if (i > 999) return tentativa;
  }
}
