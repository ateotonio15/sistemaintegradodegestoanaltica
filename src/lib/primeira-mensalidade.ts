import { supabase } from "@/integrations/supabase/client";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";

export interface GerarPrimeiraResultado {
  empresas: number;
  movimentacoes: number;
  primeirasMensalidades: number;
  nomes: string[];
}

function mesAtual(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function periodoBase(e: any): string | null {
  if (e.tipo_movimentacao === "Diária" && e.data_corte) return periodoDaDataCorte(e.data_corte);
  return e.periodo_movimentacao ?? null;
}

/**
 * Gera, para os contratos implantados na competência informada:
 *  - a primeira movimentação operacional do mês (aba Movimentações)
 *  - a linha de "Primeira mensalidade" no Financeiro
 * Idempotente: nunca duplica linhas já existentes.
 */
export async function gerarPrimeiraMensalidade(mes: string = mesAtual()): Promise<GerarPrimeiraResultado> {
  const { data: empresas, error } = await supabase
    .from("empresas")
    .select(
      "id, nome, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, responsavel_contrato, nao_faturado_financeiro, data_implantacao, primeira_competencia_financeira, status_implantacao",
    );
  if (error) throw error;

  const elegiveis = (empresas ?? []).filter((e: any) => {
    const impl = (e.data_implantacao ?? "").slice(0, 7);
    const comp = (e.primeira_competencia_financeira ?? "").slice(0, 7);
    return impl === mes || comp === mes;
  });
  if (elegiveis.length === 0) {
    return { empresas: 0, movimentacoes: 0, primeirasMensalidades: 0, nomes: [] };
  }

  const ids = elegiveis.map((e: any) => e.id);

  const [{ data: movsExist }, { data: finExist }] = await Promise.all([
    supabase.from("movimentacoes").select("empresa_id, periodo").eq("mes_referencia", mes).in("empresa_id", ids),
    supabase
      .from("financeiro_movimentacoes")
      .select("empresa_id, periodo, tipo_lancamento")
      .eq("mes_referencia", mes)
      .in("empresa_id", ids),
  ]);

  const movKeys = new Set((movsExist ?? []).map((m: any) => `${m.empresa_id}|${m.periodo}`));
  const finKeys = new Set(
    (finExist ?? []).map((f: any) => `${f.empresa_id}|${f.periodo}|${f.tipo_lancamento ?? "normal"}`),
  );

  const novasMovs: any[] = [];
  const novasFin: any[] = [];
  const nomes: string[] = [];

  for (const e of elegiveis as any[]) {
    const periodo = periodoBase(e);
    if (!periodo) continue;
    nomes.push(e.nome);

    if (!movKeys.has(`${e.id}|${periodo}`)) {
      novasMovs.push({
        empresa_id: e.id,
        mes_referencia: mes,
        periodo,
        tipo_movimentacao: e.tipo_movimentacao ?? null,
        responsavel_movimentacao: e.responsavel_contrato ?? null,
        dentro_prazo: true,
      });
    }

    if (e.nao_faturado_financeiro === true) continue;

    if (!finKeys.has(`${e.id}|${periodo}|primeira_mensalidade`)) {
      novasFin.push({
        empresa_id: e.id,
        mes_referencia: mes,
        periodo,
        dentro_prazo: true,
        responsavel: e.responsavel_contrato ?? null,
        tipo_analise: "normal",
        possui_prorrogacao: false,
        tipo_lancamento: "primeira_mensalidade",
      });
    }
  }

  let movimentacoes = 0;
  if (novasMovs.length > 0) {
    const { data, error: mErr } = await supabase
      .from("movimentacoes")
      .upsert(novasMovs, { onConflict: "empresa_id,mes_referencia,periodo", ignoreDuplicates: true })
      .select("id");
    if (mErr) throw mErr;
    movimentacoes = data?.length ?? 0;
  }

  let primeirasMensalidades = 0;
  if (novasFin.length > 0) {
    const { data, error: fErr } = await supabase
      .from("financeiro_movimentacoes")
      .upsert(novasFin, {
        onConflict: "empresa_id,mes_referencia,periodo,tipo_lancamento",
        ignoreDuplicates: true,
      })
      .select("id");
    if (fErr) throw fErr;
    primeirasMensalidades = data?.length ?? 0;
  }

  return { empresas: nomes.length, movimentacoes, primeirasMensalidades, nomes };
}
