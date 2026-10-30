import { gerarRelatorioPortal, validarArquivoContrato, validarContratoPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { consultarDocumentoFechamento } from "./documentosFechamento";

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
  anexar: (arquivo: ArquivoPortal) => Promise<"ignorado" | void>,
  encontrados: (quantidade: number) => void,
  preparar = false,
) {
  const contrato = validarContratoPortal(contexto.contrato);
  signal.throwIfAborted();
  const obter = async (tipo: "pdf" | "xlsx") => {
    if (!preparar) return gerarRelatorioPortal(contrato, tipo, signal);
    const atual = await consultarDocumentoFechamento(contexto, tipo, signal);
    if (atual) return atual;
    const gerado = await gerarRelatorioPortal(contrato, tipo, signal);
    validarArquivoContrato(contrato, gerado, gerado.nome_arquivo);
    signal.throwIfAborted();
    const registrado = await consultarDocumentoFechamento(contexto, tipo, signal, gerado.job_id);
    if (!registrado) throw new Error("Não foi possível registrar o documento no repositório.");
    return registrado;
  };
  const resultados = await Promise.allSettled((["pdf", "xlsx"] as const).map(obter));
  signal.throwIfAborted();
  const arquivos = resultados.flatMap(resultado => resultado.status === "fulfilled" ? [resultado.value] : []);
  // Valida todos antes de anexar o primeiro: uma resposta divergente nunca entra na movimentação.
  for (const arquivo of arquivos) validarArquivoContrato(contrato, arquivo, arquivo.nome_arquivo);
  encontrados(arquivos.length);
  let anexados = 0;
  let ignorados = 0;
  let falhas = resultados.filter(resultado => resultado.status === "rejected").length;
  const documentos = (["pdf", "xlsx"] as const).map(tipo => ({ tipo, disponivel: false }));
  for (const arquivo of arquivos) {
    signal.throwIfAborted();
    try {
      if (await anexar(arquivo) === "ignorado") ignorados++; else anexados++;
      const documento = documentos.find(item => item.tipo === arquivo.tipo);
      if (documento) documento.disponivel = true;
    }
    catch (erro) { if (signal.aborted) throw erro; falhas++; }
  }
  return { encontrados: arquivos.length, anexados, ignorados, falhas, documentos };
}