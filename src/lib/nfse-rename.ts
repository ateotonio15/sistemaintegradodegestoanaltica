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

  // Número da NFS-e. Procura o rótulo e captura o número logo após.
  // Aceita "Número da NFS-e", "Numero NFSe", "NFS-e Nº", etc.
  const t = texto.replace(/\u00a0/g, " ");
  let nfNumero: string | null = null;
  const padroes: RegExp[] = [
    /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,30}(\d{3,10})/i,
    /nfs[\s\-]?e[^\d]{0,10}n[ºo°\.]?\s*[:\-]?\s*(\d{3,10})/i,
    /n[ºo°\.]?\s*da\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i,
  ];
  for (const re of padroes) {
    const m = t.match(re);
    if (m) {
      nfNumero = m[1];
      break;
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
