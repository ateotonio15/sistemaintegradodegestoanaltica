/**
 * Soma do total previsto da Previsão Financeira com deduplicação de
 * documentos compartilhados (item 3 do pacote).
 *
 * Contexto: movimentações de um mesmo Grupo Financeiro compartilham anexos
 * (expandirAnexosPorGrupo). Sem dedup, a mesma planilha apareceria na linha
 * de cada movimentação do grupo e o total contaria o documento duas vezes.
 *
 * Consolidação por DOCUMENTO e por FATIA identificada:
 * - Cada planilha (storage_path) é um documento. Documentos distintos
 *   sempre somam — uma linha com duas planilhas consolida as duas.
 * - Documento com separação por pagador: a fatia conta uma vez por
 *   identidade de pagador (CNPJ; na falta dele, nome normalizado).
 *   Pagadores distintos sem CNPJ NUNCA compartilham a mesma chave por
 *   ambos terem CNPJ nulo — usam o nome; nomes vazios/iguais geram aviso
 *   de ambiguidade (sinalização, nunca mescla silenciosa).
 * - Documento sem separação por pagador: devolve o total agregado; a
 *   condição "não separável" vale por documento, nunca para o conjunto
 *   inteiro de arquivos da linha — misturar uma planilha não separável
 *   com uma separável soma os dois documentos.
 *
 * Limites:
 * - Dois anexos com o mesmo storage_path são o mesmo arquivo físico; se o
 *   usuário anexar intencionalmente o mesmo arquivo duas vezes como
 *   documentos distintos, o sistema contará uma vez só.
 */

export interface DocumentoTotal {
  /** storage_path da planilha. */
  path: string;
  /** true quando a planilha não tem coluna de pagador (total agregado). */
  semSeparacao: boolean;
  /** Total do documento para esta linha (fatia do pagador ou agregado). */
  total: number;
}

export interface ItemTotalPrevisto {
  /** Um documento por planilha da linha, com o total correspondente. */
  documentos: DocumentoTotal[];
  /** CNPJ do filtro de pagador da linha (null/vazio = sem CNPJ). */
  cnpjFiltro: string | null;
  /** Nome do filtro de pagador da linha (fallback de identidade). */
  nomeFiltro: string | null;
}

export interface ResultadoTotalPrevisto {
  total: number;
  /** Avisos de ambiguidade de identidade (pagadores sem CNPJ e sem nome
   *  distintivo). Nunca mesclados silenciosamente. */
  avisos: string[];
}

const normalizarNome = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const soDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

/**
 * Soma os totais contando cada documento uma única vez por identidade de
 * pagador. Documentos compartilhados por movimentações do mesmo grupo
 * entram uma vez; documentos distintos somam normalmente.
 */
export function somarTotalPrevistoComAvisos(itens: ItemTotalPrevisto[]): ResultadoTotalPrevisto {
  const vistos = new Set<string>();
  const avisosSet = new Set<string>();
  let total = 0;
  for (const item of itens) {
    const cnpj = soDigitos(item.cnpjFiltro);
    const nome = normalizarNome(item.nomeFiltro);
    // Identidade inequívoca: CNPJ tem prioridade; sem CNPJ, o nome. Sem os
    // dois, não há como distinguir pagadores — sinaliza e usa identidade
    // própria vazia (cada linha sem identidade é tratada como agregado).
    let identidade: string;
    if (cnpj) identidade = `cnpj:${cnpj}`;
    else if (nome) identidade = `nome:${nome}`;
    else {
      identidade = "sem-identidade";
      avisosSet.add(
        "Pagador sem CNPJ e sem nome: não foi possível distinguir pagadores; valores tratados como agregado.",
      );
    }
    for (const doc of item.documentos) {
      // A condição "não separável" é do documento, não do conjunto.
      const chave = doc.semSeparacao
        ? `agregado::${doc.path}`
        : `${doc.path}::${identidade}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      total += doc.total;
    }
  }
  return { total: Number(total.toFixed(2)), avisos: Array.from(avisosSet) };
}

/** Atalho quando só o número interessa (mantém as mesmas regras). */
export function somarTotalPrevisto(itens: ItemTotalPrevisto[]): number {
  return somarTotalPrevistoComAvisos(itens).total;
}
