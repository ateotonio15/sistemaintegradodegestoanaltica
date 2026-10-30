import { supabase } from "@/integrations/supabase/client";
import type { ArquivoEnvio } from "@/lib/repositorio-envios";
import { identificarAnexoImportado } from "@/lib/anexo-importacao";
import { validarContratoPortal, type ArquivoPortal } from "./portalEmpresaRelatorios";
import type { ContextoImportacao } from "./importarArquivosMovimentacao";

export function selecionarArquivosRepositorio(arquivos: ArquivoEnvio[], contexto: ContextoImportacao): ArquivoEnvio[] {
  const atuais = arquivos.filter(a => a.empresa_id === contexto.empresaId && a.contrato === contexto.contrato
    && a.competencia === contexto.mes && a.periodo === contexto.periodo && a.status.toLowerCase() === "atual");
  const porDocumento = new Map<string, ArquivoEnvio>();
  for (const a of atuais) {
    const anterior = porDocumento.get(a.tipo_relatorio);
    if (!anterior || a.versao > anterior.versao) porDocumento.set(a.tipo_relatorio, a);
  }
  const prioridade = (a: ArquivoEnvio) => a.tipo_relatorio === "Relatório de Vidas" ? 0 : a.tipo_relatorio === "OPS Mensalidades" ? 1 : 2;
  return [...porDocumento.values()].sort((a, b) => prioridade(a) - prioridade(b) || a.nome_arquivo.localeCompare(b.nome_arquivo));
}

export async function conferirContextoRepositorio(contexto: ContextoImportacao, signal: AbortSignal) {
  signal.throwIfAborted();
  const { data: mov, error } = await supabase.from("movimentacoes").select("empresa_id, mes_referencia, periodo").eq("id", contexto.movimentacaoId).abortSignal(signal).single();
  if (error) throw error;
  const { data: emp, error: empError } = await supabase.from("empresas").select("nome, codigo_contrato").eq("id", mov.empresa_id).abortSignal(signal).single();
  if (empError) throw empError;
  signal.throwIfAborted();
  if (mov.empresa_id !== contexto.empresaId || mov.mes_referencia !== contexto.mes || mov.periodo !== contexto.periodo
    || String(validarContratoPortal(emp.codigo_contrato)) !== contexto.contrato) throw new Error("Salve as alterações da empresa, competência e período antes de importar.");
  return emp.nome;
}

export async function buscarArquivosRepositorio(contexto: ContextoImportacao, signal: AbortSignal) {
  const arquivos: ArquivoEnvio[] = [];
  for (let inicio = 0; ; inicio += 500) {
    let query = supabase.from("envios_empresa_arquivos").select("*")
      .eq("empresa_id", contexto.empresaId).eq("contrato", contexto.contrato).eq("competencia", contexto.mes)
      .ilike("status", "atual").order("id").range(inicio, inicio + 499);
    query = contexto.periodo === null ? query.is("periodo", null) : query.eq("periodo", contexto.periodo);
    const { data, error } = await query.abortSignal(signal);
    if (error) throw error;
    signal.throwIfAborted();
    arquivos.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  return selecionarArquivosRepositorio(arquivos, contexto);
}

export async function carregarArquivoRepositorio(a: ArquivoEnvio, contexto: ContextoImportacao, signal: AbortSignal): Promise<ArquivoPortal> {
  signal.throwIfAborted();
  const info = identificarAnexoImportado(a.nome_arquivo);
  const marcadores = [...a.nome_arquivo.matchAll(/_Contrato_(\d+)_/g)];
  if (!info.aceito || marcadores.length !== 1 || marcadores[0]?.[1] !== contexto.contrato || /[\r\n/\\]/.test(a.nome_arquivo)) throw new Error(`Arquivo inválido para este contrato: ${a.nome_arquivo}`);
  const { data, error } = await supabase.storage.from(a.bucket).download(a.storage_path);
  signal.throwIfAborted();
  if (error) throw error;
  if (!data.size || data.size > 25 * 1024 * 1024) throw new Error(`Arquivo vazio ou maior que 25 MB: ${a.nome_arquivo}`);
  return { job_id: a.id, nr_contrato: Number(contexto.contrato), tipo: info.extensao === "pdf" ? "pdf" : "xlsx",
    nome_arquivo: a.nome_arquivo, blob: new Blob([data], { type: a.mime_type || data.type }), repositorio_envio_id: a.id, versao_repositorio: a.versao };
}