import { supabase } from "@/integrations/supabase/client";
import { revisaoFaturamento } from "../../supabase/functions/_shared/nfse-central-regras";
import { somarTotalFaturamento } from "@/lib/faturamento-totais";
import { sumPdfTotal } from "@/lib/financeiro-analise-lote";

export type RecebimentoCentral = {
  id: string; estado: string; motivo: string | null; storage_path: string | null;
  movimentacao_destino_id: string | null; cnpj_tomador: string;
};

const isXls = (a: { mime_type?: string | null; nome_arquivo?: string | null }) =>
  /spreadsheet|excel|csv/i.test(a.mime_type ?? "") || /\.(xlsx|xlsm|xls|csv)$/i.test(a.nome_arquivo ?? "");
const contaStatus = (a: { origem?: string | null }) => !["retroativo", "reajuste"].includes((a.origem ?? "normal").toLowerCase());

async function invocar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("processar-recebimento-central", { body });
  if (error) throw error;
  return data as { estado: string; motivo?: string | null };
}

/** Valida o PDF da fila privada com os parsers do SIGA e pede ao servidor a conclusão. */
export async function processarRecebimento(rec: RecebimentoCentral) {
  if (rec.estado !== "aguardando_validacao" || !rec.movimentacao_destino_id || !rec.storage_path)
    return invocar({ acao: "resolver", recebimento_id: rec.id });

  const falha = (revisao: string, erro: string) =>
    invocar({ acao: "concluir", recebimento_id: rec.id, revisao, leitura_ok: false, valor_excel: null, valor_pdf: null, comparacao: null, erro_leitura: erro });

  const { data: anexos, error } = await supabase.from("anexos_financeiro")
    .select("id, mime_type, nome_arquivo, storage_path, bucket, origem").eq("financeiro_movimentacao_id", rec.movimentacao_destino_id);
  if (error) throw error;
  const revisao = revisaoFaturamento((anexos ?? []).map((a) => a.id));
  const planilhas = (anexos ?? []).filter((a) => contaStatus(a) && isXls(a));
  if (planilhas.length !== 1) return falha(revisao, planilhas.length ? "Mais de uma planilha de faturamento anexada." : "Faturamento não anexado.");

  const { data: mov } = await supabase.from("financeiro_movimentacoes").select("tipo_analise").eq("id", rec.movimentacao_destino_id).maybeSingle();
  if ((mov?.tipo_analise ?? "").toLowerCase().includes("honda")) return falha(revisao, "Tipo de análise simplificada não participa da anexação automática.");

  try {
    const [pdfDl, xlsDl] = await Promise.all([
      supabase.storage.from("nfse-entrada").download(rec.storage_path),
      supabase.storage.from(planilhas[0].bucket || "anexos-financeiro").download(planilhas[0].storage_path),
    ]);
    if (pdfDl.error || xlsDl.error) return falha(revisao, "Não foi possível baixar o PDF ou a planilha.");
    const [{ analisarExcelFinanceiroPorPagador, compararExcelComPdf }, { analisarPdfFinanceiro }] = await Promise.all([
      import("@/lib/excel-analysis-utils"), import("@/lib/pdf-analysis-utils"),
    ]);
    const excel = await analisarExcelFinanceiroPorPagador(await xlsDl.data.arrayBuffer(), { cnpj: rec.cnpj_tomador });
    const pdf = await analisarPdfFinanceiro(await pdfDl.data.arrayBuffer());
    const cmp = compararExcelComPdf({ ...excel, pagador: "" } as any, { ...pdf, arquivo: "central.pdf" } as any, mov?.tipo_analise);
    cmp.tomadorCnpj = pdf.tomadorCnpj ?? null;
    const valorPdf = sumPdfTotal(cmp);
    const leituraOk = valorPdf != null && !!pdf.tomadorCnpj;
    return invocar({
      acao: "concluir", recebimento_id: rec.id, revisao, leitura_ok: leituraOk,
      valor_excel: somarTotalFaturamento(excel as any), valor_pdf: valorPdf,
      comparacao: {
        enfermaria: cmp.enfermaria, apartamento: cmp.apartamento, inclusoes: cmp.inclusoes,
        exclusoes: cmp.exclusoes, devolucoes: cmp.devolucoes,
        divergencias: cmp.divergencias.slice(0, 50).map((d) => d.slice(0, 500)), tomadorCnpj: cmp.tomadorCnpj,
      },
      ...(leituraOk ? {} : { erro_leitura: "PDF ilegível ou incompleto." }),
    });
  } catch {
    return falha(revisao, "PDF ou planilha ilegível.");
  }
}
