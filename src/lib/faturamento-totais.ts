/**
 * Cálculo centralizado dos totais de faturamento (F1 da auditoria).
 *
 * Regras:
 * - Soma as categorias preservando os sinais (exclusões, devoluções e
 *   permuta já chegam negativas do parser).
 * - Retroativos NÃO entram na soma: são subconjunto das inclusões
 *   (`inclusoes.total` já os contém). Somá-los de novo duplicaria valor.
 * - Este total é o TOTAL DE FATURAMENTO (valor bruto previsto). Não é
 *   valor recebido — não existe fonte de pagamentos no sistema.
 * - Categoria com quantidade > 0 e valor ausente/inválido gera pendência
 *   de validação, e o total é marcado como parcial (F9/F13).
 */

export type SituacaoValor = "valor" | "zero" | "ausente" | "invalido";

/** Diferencia zero numérico válido de campo ausente e de valor inválido. */
export function classificarValorCampo(v: unknown): SituacaoValor {
  if (v === null || v === undefined || v === "") return "ausente";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "invalido";
  return n === 0 ? "zero" : "valor";
}

interface CategoriaEntrada {
  total: number | null | undefined;
  quantidade?: number | null;
  beneficiarios?: number | null;
}

/** Categorias que compõem o total de faturamento, nesta ordem. */
export const CATEGORIAS_TOTAL_FATURAMENTO = [
  "enfermaria",
  "apartamento",
  "inclusoes",
  "exclusoes",
  "devolucoes",
  "permuta",
  "taxaAdesao",
  "coparticipacao",
  "complemento",
] as const;

export type CategoriaFaturamento = (typeof CATEGORIAS_TOTAL_FATURAMENTO)[number];

export const ROTULO_CATEGORIA: Record<CategoriaFaturamento, string> = {
  enfermaria: "Mensalidade Enfermaria",
  apartamento: "Mensalidade Apartamento",
  inclusoes: "Inclusões",
  exclusoes: "Exclusões",
  devolucoes: "Devoluções",
  permuta: "Permuta",
  taxaAdesao: "Taxa de adesão",
  coparticipacao: "Coparticipação",
  complemento: "Complemento",
};

export interface PendenciaValidacao {
  categoria: CategoriaFaturamento;
  rotulo: string;
  quantidade: number;
  motivo: "valor ausente" | "valor inválido";
}

export interface TotalFaturamento {
  /** Soma das categorias conhecidas, com sinais preservados. */
  total: number;
  /** false quando alguma categoria presente ficou sem valor (total parcial). */
  completo: boolean;
  pendencias: PendenciaValidacao[];
}

type ResultadoComoObjeto = Partial<Record<CategoriaFaturamento, CategoriaEntrada | null | undefined>> & {
  /** Retroativos: subconjunto de inclusões — nunca somados aqui. */
  retroativas?: CategoriaEntrada | null;
};

/**
 * Soma o total de faturamento de um resultado de análise (um pagador ou o
 * agregado). Aceita qualquer objeto com as categorias do parser
 * (`AnaliseResultado`, `AnalisePorCnpj` ou equivalente).
 */
export function calcularTotalFaturamento(r: ResultadoComoObjeto): TotalFaturamento {
  let total = 0;
  const pendencias: PendenciaValidacao[] = [];

  for (const cat of CATEGORIAS_TOTAL_FATURAMENTO) {
    const c = r[cat];
    if (!c) continue; // categoria não extraída — não presume inexistência, só não soma
    const qtd = Number(c.quantidade ?? c.beneficiarios ?? 0) || 0;
    const situacao = classificarValorCampo(c.total);
    if (situacao === "valor" || situacao === "zero") {
      total += Number(c.total);
      continue;
    }
    // Valor ausente/inválido com lançamentos presentes: pendência de validação.
    if (qtd > 0) {
      pendencias.push({
        categoria: cat,
        rotulo: ROTULO_CATEGORIA[cat],
        quantidade: qtd,
        motivo: situacao === "ausente" ? "valor ausente" : "valor inválido",
      });
    }
  }

  return {
    total: Number(total.toFixed(2)),
    completo: pendencias.length === 0,
    pendencias,
  };
}

/**
 * Versão simplificada para os consumidores atuais: devolve só o número.
 * Mantém a regra de não somar retroativos (subconjunto de inclusões).
 */
export function somarTotalFaturamento(r: ResultadoComoObjeto): number {
  return calcularTotalFaturamento(r).total;
}

// =====================================================================
// Completude de registros de análise (relatório analítico — item 1)
// =====================================================================

export type SituacaoRegistroAnalise = "completo" | "parcial" | "legado";

export interface ValorRegistroAnalise {
  /** Valor extraído; em "legado" é o valor conhecido das colunas escalares. */
  valor: number;
  situacao: SituacaoRegistroAnalise;
}

/**
 * Um resultado é compatível com o cálculo centralizado quando é um objeto
 * com pelo menos uma categoria de faturamento cujo total é numérico
 * (zero incluso — zero lido é valor válido). A presença de JSON sozinha
 * não comprova que o parser antigo extraiu todas as categorias: resultados
 * sem nenhuma categoria numérica são tratados como legados.
 */
function resultadoCompativel(r: unknown): r is ResultadoComoObjeto {
  if (!r || typeof r !== "object" || Array.isArray(r)) return false;
  return CATEGORIAS_TOTAL_FATURAMENTO.some((cat) => {
    const c = (r as Record<string, any>)[cat];
    return c && typeof c === "object" && typeof c.total === "number" && Number.isFinite(c.total);
  });
}

/** Versão do formato de `resultado_completo` com evidência de cobertura. */
export const VERSAO_RESULTADO_COMPLETO = 2;

/**
 * Evidência de cobertura da extração: o registro precisa ter sido gravado
 * pelo formato versionado atual (meta.versao) E cada resultado precisa ser
 * compatível com o cálculo centralizado. A mera presença de uma categoria
 * numérica no JSON NÃO comprova que o parser antigo extraiu todas as
 * categorias — registros sem a marca de versão são "legado", preservando
 * o valor conhecido das colunas escalares.
 */
export function temEvidenciaCobertura(resultadoCompleto: unknown): boolean {
  const rc = resultadoCompleto as { meta?: { versao?: unknown } } | null | undefined;
  return !!rc && typeof rc === "object" && (rc.meta?.versao as number) >= VERSAO_RESULTADO_COMPLETO;
}

/**
 * Extrai o total de um registro de `financeiro_analises` usando o cálculo
 * centralizado sobre `resultado_completo.resultados`, respeitando:
 * - a estrutura real do JSON ({ resultados, comparacoes });
 * - vários resultados no mesmo JSON (um por pagador) — cada um é somado
 *   pela função central; retroativos nunca entram (subconjunto de inclusões);
 * - resultados incompatíveis ou estrutura ausente → "legado": preserva o
 *   valor conhecido das colunas escalares, sem afirmar completude.
 *
 * `fallbackColunas` é o valor já conhecido (soma das colunas valor_excel_*
 * com fallback nas valor_pdf_*), usado apenas quando o JSON não permite o
 * cálculo centralizado.
 */
export function extrairValorRegistroAnalise(
  registro: { resultado_completo?: unknown },
  fallbackColunas: number,
): ValorRegistroAnalise {
  const rc = registro.resultado_completo as
    | { resultados?: unknown; meta?: { versao?: unknown } }
    | null
    | undefined;
  const resultados = rc && Array.isArray(rc.resultados) ? rc.resultados : null;

  if (
    resultados &&
    resultados.length > 0 &&
    resultados.every(resultadoCompativel) &&
    temEvidenciaCobertura(rc)
  ) {
    let valor = 0;
    let completo = true;
    for (const r of resultados as ResultadoComoObjeto[]) {
      const t = calcularTotalFaturamento(r);
      valor += t.total;
      if (!t.completo) completo = false;
    }
    return {
      valor: Number(valor.toFixed(2)),
      situacao: completo ? "completo" : "parcial",
    };
  }

  return { valor: fallbackColunas, situacao: "legado" };
}
