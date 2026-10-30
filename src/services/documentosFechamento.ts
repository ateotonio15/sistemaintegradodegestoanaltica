import { supabase } from "@/integrations/supabase/client";
import type { ContextoImportacao } from "./importarArquivosMovimentacao";
import { validarArquivoContrato, type ArquivoPortal } from "./portalEmpresaRelatorios";

export async function consultarDocumentoFechamento(contexto: ContextoImportacao, tipo: "pdf" | "xlsx", signal: AbortSignal, jobId?: string): Promise<ArquivoPortal | null> {
  signal.throwIfAborted();
  const { data, error } = await supabase.functions.invoke("preparar-documento-fechamento", {
    body: { movimentacao_id: contexto.movimentacaoId, empresa_id: contexto.empresaId, contrato: contexto.contrato,
      competencia: contexto.mes, periodo: contexto.periodo, tipo, ...(jobId ? { job_id: jobId } : {}) }, signal,
  });
  signal.throwIfAborted();
  if (error || data?.error) throw new Error(data?.error || "Não foi possível consultar o Repositório de Envios.");
  if (data?.ausente === true) return null;
  if (!data?.id || !data?.url || !data?.nome_arquivo) throw new Error("Documento inválido no repositório.");
  const job = { job_id: data.id, nr_contrato: Number(contexto.contrato), tipo };
  validarArquivoContrato(contexto.contrato, job, data.nome_arquivo);
  const resposta = await fetch(data.url, { signal });
  if (!resposta.ok) throw new Error("Não foi possível carregar o arquivo do Repositório de Envios.");
  const blob = await resposta.blob();
  if (!blob.size || blob.size > 25 * 1024 * 1024) throw new Error("Arquivo vazio ou inválido no repositório.");
  return { ...job, nome_arquivo: data.nome_arquivo, blob, repositorio_envio_id: data.id, versao_repositorio: data.versao };
}