import { supabase } from "@/integrations/supabase/client";
import { gerarResumoUltimaPaginaPdf } from "@/lib/relatorio-resumo-pdf";
import { validarArquivoContrato, type ArquivoPortal } from "./portalEmpresaRelatorios";

export async function enviarRelatoriosPortal({ movimentacaoId, contrato, destinatarios, cc = [], arquivos, lote = false }: {
  movimentacaoId: string; contrato: string | null; destinatarios: string[]; cc?: string[]; arquivos: ArquivoPortal[]; lote?: boolean;
}) {
  if (arquivos.length !== 2 || !arquivos.some(a => a.tipo === "pdf") || !arquivos.some(a => a.tipo === "xlsx")) throw new Error("Aguarde o PDF e o Excel da empresa selecionada.");
  arquivos.forEach(a => validarArquivoContrato(contrato, a, a.nome_arquivo));
  let resumo_png_base64: string | null = null;
  const pdf = arquivos.find(a => a.tipo === "pdf");
  // Resumo gerado do PDF desta empresa; se a última página for de outro contrato, o envio é bloqueado.
  if (pdf) resumo_png_base64 = await gerarResumoUltimaPaginaPdf(new Uint8Array(await pdf.blob.arrayBuffer()), contrato);
  // Apenas referências de trabalhos: o servidor consulta o contrato cadastrado e baixa os arquivos novamente.
  const { data, error } = await supabase.functions.invoke("enviar-relatorio-email", { body: {
    movimentacao_id: movimentacaoId, destinatarios, cc, lote,
    portal_jobs: arquivos.map(({ job_id, nr_contrato, tipo }) => ({ job_id, nr_contrato, tipo })),
    ...(resumo_png_base64 ? { resumo_png_base64 } : {}),
  } });
  if (error) {
    const response = (error as { context?: Response }).context;
    const msg = response ? (await response.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if (!data?.ok) throw new Error(data?.error || "Não foi possível enviar o e-mail.");
  if (!data.registro_salvo) throw new Error("E-mail enviado, mas o registro não foi salvo. Confira antes de reenviar.");
  return data;
}