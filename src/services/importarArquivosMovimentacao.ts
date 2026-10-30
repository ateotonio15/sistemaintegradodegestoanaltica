import { gerarRelatorioPortal, validarArquivoContrato, validarContratoPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";

export interface ContextoImportacao {
  movimentacaoId: string;
  empresaId: string;
  contrato: string;
  mes: string;
  periodo: string | null;
}

export async function importarArquivosMovimentacao(
  contexto: ContextoImportacao,
  signal: AbortSignal,
  anexar: (arquivo: ArquivoPortal) => Promise<void>,
  encontrados: (quantidade: number) => void,
) {
  const contrato = validarContratoPortal(contexto.contrato);
  signal.throwIfAborted();
  const resultados = await Promise.allSettled([
    gerarRelatorioPortal(contrato, "pdf", signal),
    gerarRelatorioPortal(contrato, "xlsx", signal),
  ]);
  signal.throwIfAborted();
  const arquivos = resultados.flatMap(resultado => resultado.status === "fulfilled" ? [resultado.value] : []);
  // Valida todos antes de anexar o primeiro: uma resposta divergente nunca entra na movimentação.
  for (const arquivo of arquivos) validarArquivoContrato(contrato, arquivo, arquivo.nome_arquivo);
  encontrados(arquivos.length);
  let anexados = 0;
  let falhas = resultados.filter(resultado => resultado.status === "rejected").length;
  for (const arquivo of arquivos) {
    signal.throwIfAborted();
    try { await anexar(arquivo); anexados++; }
    catch (erro) { if (signal.aborted) throw erro; falhas++; }
  }
  return { encontrados: arquivos.length, anexados, falhas };
}