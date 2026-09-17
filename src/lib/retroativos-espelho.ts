/**
 * Regras compartilhadas de Cobrança Retroativa / Devolução / Reajuste.
 *
 * Usado pela aba Financeiro (card "Cobrança Retroativa") e pelo
 * Repositório Financeiro (aba Arquivos), para que as duas telas mostrem
 * exatamente os mesmos registros e ofereçam as mesmas ações.
 */
import { supabase } from "@/integrations/supabase/client";

export interface LancamentoRetroativo {
  id: string;
  empresa_id: string;
  competencia: string;
  valor_centavos: number;
  descricao: string | null;
  tipo: string;
  origem_retroativo: string | null;
  confirmado: boolean;
  confirmado_origem: string | null;
  confirmado_em: string | null;
  conferencia_status: string | null;
  valor_planilha_centavos: number | null;
  financeiro_movimentacao_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface RetroPlanilha {
  /** Retroativo de reajuste — abas dedicadas "C.RETROATIVA <MES>". */
  reajusteCentavos: number;
  /** Retroativo/devolução de beneficiários específicos — relatório principal. */
  beneficiariosCentavos: number;
  meses: string[];
  detalhe: Array<{ mes: string; total: number }>;
  temReajuste: boolean;
  temBeneficiarios: boolean;
}

export type ConferenciaStatus = "confirmada" | "divergente" | "nao_encontrada";

export interface ConferenciaResultado {
  status: ConferenciaStatus;
  planilha: RetroPlanilha | null;
  baldeExiste: boolean;
  origem: "reajuste" | "beneficiarios";
  encontradoCentavos: number | null;
  registradoCentavos: number;
  ehDevolucao: boolean;
}

export function origemDoLancamento(c: {
  origem_retroativo?: string | null;
  tipo?: string | null;
}): "reajuste" | "beneficiarios" {
  if (c.origem_retroativo === "beneficiarios" || c.origem_retroativo === "reajuste")
    return c.origem_retroativo;
  return c.tipo === "devolucao" ? "beneficiarios" : "reajuste";
}

/** Busca todos os lançamentos retroativos (opcionalmente de uma competência). */
export async function fetchLancamentosRetroativos(
  competencia?: string | null,
): Promise<LancamentoRetroativo[]> {
  let q = supabase
    .from("cobrancas_retroativas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (competencia) q = q.eq("competencia", competencia);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as LancamentoRetroativo[];
}

/** Lê as planilhas da empresa/competência e separa o retroativo por origem. */
export async function buscarRetroativoPlanilha(
  empresaId: string,
  compet: string,
): Promise<RetroPlanilha | null> {
  const { data: movs, error: movErr } = await supabase
    .from("financeiro_movimentacoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", compet);
  if (movErr) throw movErr;
  const movIds = (movs || []).map((m: any) => m.id);
  if (movIds.length === 0) return null;

  const { data: anexos, error: anxErr } = await supabase
    .from("anexos_financeiro")
    .select("nome_arquivo, storage_path, mime_type")
    .in("financeiro_movimentacao_id", movIds);
  if (anxErr) throw anxErr;

  const { isXlsAnexo } = await import("@/lib/financeiro-utils");
  const xls = (anexos || []).filter((a: any) => isXlsAnexo(a) && a.storage_path);
  if (xls.length === 0) return null;

  const { analisarExcelFinanceiroPorCnpj } = await import("@/lib/excel-analysis-utils");
  let reajusteReais = 0;
  let beneficiariosReais = 0;
  let temReajuste = false;
  let temBeneficiarios = false;
  const mesesSet = new Set<string>();
  const detalheMap = new Map<string, number>();
  let algumLido = false;
  for (const a of xls) {
    try {
      const { data, error } = await supabase.storage
        .from("anexos-financeiro")
        .download((a as any).storage_path);
      if (error) throw error;
      const blocos = await analisarExcelFinanceiroPorCnpj(await data.arrayBuffer());
      algumLido = true;
      blocos.forEach((b: any) => {
        const rea = b.retroativasReajuste?.total ?? 0;
        const benRetro = b.retroativasBeneficiarios?.total ?? 0;
        const benDev = b.devolucoes?.total ?? 0;
        if (b.retroativasReajuste) temReajuste = true;
        if (b.retroativasBeneficiarios || b.devolucoes) temBeneficiarios = true;
        reajusteReais += rea;
        beneficiariosReais += benRetro + benDev;
        (b.retroativasReajuste?.meses || b.retroativas?.meses || []).forEach((m: string) =>
          mesesSet.add(m),
        );
        (b.retroativasReajuste?.mesesDetalhe || b.retroativas?.mesesDetalhe || []).forEach((d: any) =>
          detalheMap.set(d.mes, (detalheMap.get(d.mes) || 0) + (d.total || 0)),
        );
      });
    } catch {
      /* ignora arquivo ilegível */
    }
  }
  if (!algumLido) return null;
  return {
    reajusteCentavos: Math.round(reajusteReais * 100),
    beneficiariosCentavos: Math.round(beneficiariosReais * 100),
    meses: Array.from(mesesSet),
    detalhe: Array.from(detalheMap.entries()).map(([mes, total]) => ({ mes, total })),
    temReajuste,
    temBeneficiarios,
  };
}

/**
 * Confere o lançamento contra a planilha de faturamento e grava o resultado.
 * Quando bate, também marca como confirmado (origem "planilha").
 */
export async function conferirLancamentoRetroativo(
  c: {
    id: string;
    empresa_id: string;
    competencia: string;
    valor_centavos: number | null;
    tipo?: string | null;
    origem_retroativo?: string | null;
  },
  userId?: string | null,
): Promise<ConferenciaResultado> {
  const planilha = await buscarRetroativoPlanilha(c.empresa_id, c.competencia);
  const ehDevolucao = c.tipo === "devolucao";
  const origem = origemDoLancamento(c);
  const registrado = c.valor_centavos || 0;

  const balde =
    origem === "reajuste" ? planilha?.reajusteCentavos ?? null : planilha?.beneficiariosCentavos ?? null;
  const baldeExiste = origem === "reajuste" ? !!planilha?.temReajuste : !!planilha?.temBeneficiarios;
  const encontrado = planilha && baldeExiste ? balde : null;

  const status: ConferenciaStatus =
    encontrado === null
      ? "nao_encontrada"
      : Math.abs(
            ehDevolucao ? Math.abs(encontrado) - Math.abs(registrado) : encontrado - registrado,
          ) <= 5
        ? "confirmada"
        : "divergente";

  const { error } = await supabase
    .from("cobrancas_retroativas")
    .update({
      conferencia_status: status,
      conferido_em: new Date().toISOString(),
      valor_planilha_centavos: encontrado,
      ...(status === "confirmada"
        ? {
            confirmado: true,
            confirmado_em: new Date().toISOString(),
            confirmado_por: userId ?? null,
            confirmado_origem: "planilha",
          }
        : {}),
    } as any)
    .eq("id", c.id);
  if (error) throw error;

  return {
    status,
    planilha,
    baldeExiste,
    origem,
    encontradoCentavos: encontrado,
    registradoCentavos: registrado,
    ehDevolucao,
  };
}

/** Confirma/desfaz a confirmação manual de um lançamento retroativo. */
export async function confirmarLancamentoManual(
  c: { id: string; confirmado: boolean },
  userId?: string | null,
) {
  const novo = !c.confirmado;
  const { error } = await supabase
    .from("cobrancas_retroativas")
    .update({
      confirmado: novo,
      confirmado_em: novo ? new Date().toISOString() : null,
      confirmado_por: novo ? userId ?? null : null,
      confirmado_origem: novo ? "manual" : null,
    } as any)
    .eq("id", c.id);
  if (error) throw error;
  return novo;
}

/** Confirma/desfaz que a cobrança de um arquivo (Reajuste/Retroativo) já foi feita. */
export async function confirmarCobrancaArquivo(
  a: { id: string; cobranca_confirmada?: boolean | null },
  userId?: string | null,
) {
  const novo = !a.cobranca_confirmada;
  const { error } = await supabase
    .from("financeiro_arquivos")
    .update({
      cobranca_confirmada: novo,
      cobranca_confirmada_em: novo ? new Date().toISOString() : null,
      cobranca_confirmada_por: novo ? userId ?? null : null,
    } as any)
    .eq("id", a.id);
  if (error) throw error;
  return novo;
}

export function formatBRLCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
