import { supabase } from "@/integrations/supabase/client";
import type {
  AnaliseResultado,
  ComparacaoResultado,
  ComparacaoSimplificada,
  CampoValidacao,
  NotaOrfa,
} from "@/lib/excel-analysis-utils";

export type StatusAnalise = "OK" | "ERRO" | "PENDENTE";

export interface DivergenciaSerial {
  campo: string;
  valor_excel: number | null;
  valor_pdf: number | null;
  diferenca: number | null;
  mensagem: string;
}

export interface FinanceiroAnaliseRow {
  id: string;
  empresa_id: string;
  financeiro_movimentacao_id: string | null;
  pagador_id: string | null;
  mes_referencia: string;
  periodo: string;
  pagador_nome: string | null;
  pagador_cnpj: string | null;
  tipo_analise: string | null;
  status_analise: StatusAnalise;
  nome_arquivo_excel: string | null;
  nome_arquivo_pdf: string | null;
  hash_excel: string | null;
  hash_pdf: string | null;
  valor_excel_apartamento: number | null;
  valor_pdf_apartamento: number | null;
  valor_excel_enfermaria: number | null;
  valor_pdf_enfermaria: number | null;
  valor_excel_inclusoes: number | null;
  valor_pdf_inclusoes: number | null;
  valor_excel_exclusoes: number | null;
  valor_pdf_exclusoes: number | null;
  qtd_excel_apartamento: number | null;
  qtd_pdf_apartamento: number | null;
  qtd_excel_enfermaria: number | null;
  qtd_pdf_enfermaria: number | null;
  divergencias: DivergenciaSerial[];
  resultado_completo: {
    resultados: AnaliseResultado[];
    comparacoes: Array<ComparacaoResultado | ComparacaoSimplificada>;
  } | null;
  mensagem_final: string | null;
  analisado_por: string | null;
  analisado_por_nome: string | null;
  data_analise: string;
  created_at: string;
  updated_at: string;
}

const TABELA = "financeiro_analises" as const;

/** SHA-256 de um buffer, retornado em hex. */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function chaveOf(args: {
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
  pagador_id?: string | null;
  pagador_cnpj?: string | null;
  pagador_nome?: string | null;
}) {
  return [
    args.empresa_id,
    args.mes_referencia,
    args.periodo,
    args.pagador_id || "",
    onlyDigits(args.pagador_cnpj),
    (args.pagador_nome || "").trim().toLowerCase(),
  ].join("|");
}

// ---------------- Extração de divergências e status ----------------

function isSimplificada(
  c: ComparacaoResultado | ComparacaoSimplificada | null | undefined,
): c is ComparacaoSimplificada {
  return !!c && "beneficiarios" in c && !("enfermaria" in c);
}

function diff(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return Number((Number(a) - Number(b)).toFixed(2));
}

function pushIfDiverge(
  arr: DivergenciaSerial[],
  campo: string,
  cmp: CampoValidacao | null | undefined,
  money: boolean,
) {
  if (!cmp) return;
  if (cmp.pdf === null || cmp.pdf === undefined) return;
  if (cmp.ok) return;
  arr.push({
    campo,
    valor_excel: cmp.excel,
    valor_pdf: cmp.pdf,
    diferenca: diff(cmp.excel, cmp.pdf),
    mensagem: money
      ? `Valor divergente entre Excel e PDF em ${campo}.`
      : `Quantidade divergente entre Excel e PDF em ${campo}.`,
  });
}

export function extrairDivergencias(
  comparacao: ComparacaoResultado | ComparacaoSimplificada | null | undefined,
): DivergenciaSerial[] {
  const out: DivergenciaSerial[] = [];
  if (!comparacao) return out;
  if (comparacao.divergencias?.length) {
    return Array.from(new Set(comparacao.divergencias)).map((mensagem) => ({
      campo: "Nota fiscal",
      valor_excel: null,
      valor_pdf: null,
      diferenca: null,
      mensagem,
    }));
  }

  if (isSimplificada(comparacao)) {
    pushIfDiverge(out, "Total de beneficiários", comparacao.beneficiarios, false);
    pushIfDiverge(out, "Inclusões — total", comparacao.inclusoes, true);
    pushIfDiverge(out, "Exclusões — total", comparacao.exclusoes, true);
    return out;
  }

  if (comparacao.enfermaria) {
    pushIfDiverge(out, "Enfermaria — beneficiários", comparacao.enfermaria.beneficiarios, false);
    pushIfDiverge(out, "Enfermaria — mensalidade", comparacao.enfermaria.mensalidade, true);
    pushIfDiverge(out, "Enfermaria — total", comparacao.enfermaria.total, true);
  }
  if (comparacao.apartamento) {
    pushIfDiverge(out, "Apartamento — beneficiários", comparacao.apartamento.beneficiarios, false);
    pushIfDiverge(out, "Apartamento — mensalidade", comparacao.apartamento.mensalidade, true);
    pushIfDiverge(out, "Apartamento — total", comparacao.apartamento.total, true);
  }
  if (comparacao.inclusoes) {
    pushIfDiverge(out, "Inclusões — total", comparacao.inclusoes.total, true);
  }
  return out;
}

export function calcularStatus(
  resultado: AnaliseResultado | null | undefined,
  comparacao: ComparacaoResultado | ComparacaoSimplificada | null | undefined,
): StatusAnalise {
  if (!resultado) return "PENDENTE";
  // Sem PDF => não há como comparar de fato; consideramos pendente.
  const arquivoPdf = comparacao?.arquivoPdf ?? null;
  if (!comparacao || !arquivoPdf) return "PENDENTE";
  return extrairDivergencias(comparacao).length === 0 ? "OK" : "ERRO";
}

export function mensagemFinal(status: StatusAnalise, divergencias: DivergenciaSerial[]): string {
  if (status === "OK") return "Todos os valores conferem com o PDF.";
  if (status === "PENDENTE") return "Análise pendente: PDF de validação não encontrado.";
  if (divergencias.length === 1) return `1 divergência encontrada: ${divergencias[0].campo}.`;
  return `${divergencias.length} divergências encontradas entre Excel e PDF.`;
}

// ---------------- Persistência ----------------

export interface SalvarAnaliseInput {
  empresa_id: string;
  financeiro_movimentacao_id: string | null;
  pagador_id: string | null;
  pagador_nome: string | null;
  pagador_cnpj: string | null;
  mes_referencia: string;
  periodo: string;
  tipo_analise: string | null;
  hash_excel: string | null;
  hash_pdf: string | null;
  nome_arquivo_excel: string | null;
  nome_arquivo_pdf: string | null;
  resultado: AnaliseResultado;
  comparacao: ComparacaoResultado | ComparacaoSimplificada | null;
  resultadoCompletoExtra?: {
    resultados: AnaliseResultado[];
    comparacoes: Array<ComparacaoResultado | ComparacaoSimplificada>;
    notasOrfas?: NotaOrfa[];
  };
}

export async function salvarAnalise(input: SalvarAnaliseInput): Promise<FinanceiroAnaliseRow | null> {
  const divergencias = extrairDivergencias(input.comparacao);
  const status = calcularStatus(input.resultado, input.comparacao);

  // Quem está logado
  let analisado_por: string | null = null;
  let analisado_por_nome: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    analisado_por = data.user?.id ?? null;
    if (analisado_por) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", analisado_por)
        .maybeSingle();
      analisado_por_nome = prof?.display_name || prof?.username || null;
    }
  } catch {
    // ignora
  }

  const cmp = input.comparacao as any;
  const isSimp = isSimplificada(input.comparacao);

  const valor_excel_apartamento = isSimp
    ? null
    : cmp?.apartamento?.total?.excel ?? input.resultado.apartamento?.total ?? null;
  const valor_pdf_apartamento = isSimp ? null : cmp?.apartamento?.total?.pdf ?? null;
  const valor_excel_enfermaria = isSimp
    ? null
    : cmp?.enfermaria?.total?.excel ?? input.resultado.enfermaria?.total ?? null;
  const valor_pdf_enfermaria = isSimp ? null : cmp?.enfermaria?.total?.pdf ?? null;
  const valor_excel_inclusoes = isSimp
    ? cmp?.inclusoes?.excel ?? input.resultado.inclusoes?.total ?? null
    : cmp?.inclusoes?.total?.excel ?? input.resultado.inclusoes?.total ?? null;
  const valor_pdf_inclusoes = isSimp
    ? cmp?.inclusoes?.pdf ?? null
    : cmp?.inclusoes?.total?.pdf ?? null;
  const valor_excel_exclusoes = isSimp
    ? cmp?.exclusoes?.excel ?? input.resultado.exclusoes?.total ?? null
    : input.resultado.exclusoes?.total ?? null;
  const valor_pdf_exclusoes = isSimp ? cmp?.exclusoes?.pdf ?? null : null;

  const qtd_excel_apartamento = isSimp ? null : input.resultado.apartamento?.beneficiarios ?? null;
  const qtd_pdf_apartamento = isSimp ? null : cmp?.apartamento?.beneficiarios?.pdf ?? null;
  const qtd_excel_enfermaria = isSimp ? null : input.resultado.enfermaria?.beneficiarios ?? null;
  const qtd_pdf_enfermaria = isSimp ? null : cmp?.enfermaria?.beneficiarios?.pdf ?? null;

  const payload = {
    empresa_id: input.empresa_id,
    financeiro_movimentacao_id: input.financeiro_movimentacao_id,
    pagador_id: input.pagador_id,
    pagador_nome: input.pagador_nome,
    pagador_cnpj: input.pagador_cnpj,
    mes_referencia: input.mes_referencia,
    periodo: input.periodo,
    tipo_analise: input.tipo_analise,
    status_analise: status,
    nome_arquivo_excel: input.nome_arquivo_excel,
    nome_arquivo_pdf: input.nome_arquivo_pdf,
    hash_excel: input.hash_excel,
    hash_pdf: input.hash_pdf,
    valor_excel_apartamento,
    valor_pdf_apartamento,
    valor_excel_enfermaria,
    valor_pdf_enfermaria,
    valor_excel_inclusoes,
    valor_pdf_inclusoes,
    valor_excel_exclusoes,
    valor_pdf_exclusoes,
    qtd_excel_apartamento,
    qtd_pdf_apartamento,
    qtd_excel_enfermaria,
    qtd_pdf_enfermaria,
    divergencias: divergencias as any,
    resultado_completo: (input.resultadoCompletoExtra ?? {
      resultados: [input.resultado],
      comparacoes: input.comparacao ? [input.comparacao] : [],
    }) as any,
    mensagem_final: mensagemFinal(status, divergencias),
    analisado_por,
    analisado_por_nome,
    data_analise: new Date().toISOString(),
  };

  // Upsert manual: tenta buscar registro existente e update; se não houver, insert.
  const existing = await buscarAnaliseSalvaPorChave({
    empresa_id: input.empresa_id,
    mes_referencia: input.mes_referencia,
    periodo: input.periodo,
    pagador_cnpj: input.pagador_cnpj,
    pagador_nome: input.pagador_nome,
  });

  if (existing) {
    const { data, error } = await supabase
      .from(TABELA)
      .update(payload as any)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[financeiro_analises] update error", error);
      return null;
    }
    return data as unknown as FinanceiroAnaliseRow;
  } else {
    const { data, error } = await supabase
      .from(TABELA)
      .insert(payload as any)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[financeiro_analises] insert error", error);
      return null;
    }
    return data as unknown as FinanceiroAnaliseRow;
  }
}

export async function buscarAnaliseSalvaPorChave(args: {
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
  pagador_cnpj: string | null;
  pagador_nome: string | null;
}): Promise<FinanceiroAnaliseRow | null> {
  let q = supabase
    .from(TABELA)
    .select("*")
    .eq("empresa_id", args.empresa_id)
    .eq("mes_referencia", args.mes_referencia)
    .eq("periodo", args.periodo);
  if (args.pagador_cnpj) q = q.eq("pagador_cnpj", args.pagador_cnpj);
  else q = q.is("pagador_cnpj", null);
  if (args.pagador_nome) q = q.eq("pagador_nome", args.pagador_nome);
  else q = q.is("pagador_nome", null);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("[financeiro_analises] buscar error", error);
    return null;
  }
  return (data as unknown as FinanceiroAnaliseRow) ?? null;
}

export async function listarAnalisesDoMes(mes_referencia: string): Promise<FinanceiroAnaliseRow[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("mes_referencia", mes_referencia)
    .order("data_analise", { ascending: false })
    .limit(2000);
  if (error) {
    console.warn("[financeiro_analises] listar error", error);
    return [];
  }
  return (data as unknown as FinanceiroAnaliseRow[]) ?? [];
}

export async function listarAnalisesComErro(mes_referencia: string): Promise<FinanceiroAnaliseRow[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("mes_referencia", mes_referencia)
    .eq("status_analise", "ERRO")
    .order("data_analise", { ascending: false })
    .limit(5000);
  if (error) {
    console.warn("[financeiro_analises] erros error", error);
    return [];
  }
  return (data as unknown as FinanceiroAnaliseRow[]) ?? [];
}

export async function deletarAnalise(id: string): Promise<boolean> {
  const { error } = await supabase.from(TABELA).delete().eq("id", id);
  if (error) {
    console.warn("[financeiro_analises] delete error", error);
    return false;
  }
  return true;
}

export { chaveOf as analiseChave };
