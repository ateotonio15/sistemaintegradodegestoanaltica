/**
 * Repositório de Envios — registro automático dos arquivos enviados às empresas.
 *
 * Módulo puro (sem dependências): só monta os registros e os caminhos de
 * armazenamento. Quem grava de verdade é a função de envio, após o SMTP aceitar
 * o e-mail. Nada aqui inventa empresa, mês ou período.
 */

export const BUCKET_ENVIOS = "arquivos-envios";

export type TipoAnexo = "pdf" | "xlsx";

/** Nome de apresentação de cada relatório do Portal (a "categoria" da tela). */
export const TIPO_RELATORIO: Record<TipoAnexo, string> = {
  pdf: "Relatório de Vidas",
  xlsx: "OPS Mensalidades",
};

export type DestinoEnvio = {
  movimentacaoId: string;
  empresaId: string;
  contrato: string;
  competencia: string;
  periodo: string | null;
};

export type AnexoEnviado = {
  nome: string;
  mime: string;
  conteudo: Uint8Array;
  contrato: string;
  tipo: TipoAnexo;
};

export type ItemEnvioEmpresa = {
  movimentacao_id: string;
  empresa_id: string;
  contrato: string;
  competencia: string;
  periodo: string | null;
  nome_arquivo: string;
  bucket: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  tipo_relatorio: string;
};

/**
 * Nome de arquivo sem caminho: remove separadores e pontos iniciais para que
 * `../` ou `/` nunca entrem no caminho do armazenamento.
 */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return limpo.length ? limpo.slice(-120) : "arquivo";
}

/**
 * Caminho no bucket. Começa com a movimentação para que a permissão de leitura
 * do arquivo seja exatamente a permissão de leitura da movimentação.
 */
export function caminhoEnvio(destino: DestinoEnvio, envioId: string, anexo: AnexoEnviado): string {
  return `envios/${destino.movimentacaoId}/${envioId}/${String(anexo.contrato)}-${anexo.tipo}-${nomeSeguro(anexo.nome)}`;
}

/** Bytes de cada arquivo, indexados pelo caminho onde serão gravados. */
export function bytesPorCaminho(
  anexos: AnexoEnviado[],
  destinoPorContrato: Map<string, DestinoEnvio>,
  envioId: string,
): Map<string, Uint8Array> {
  const mapa = new Map<string, Uint8Array>();
  for (const anexo of anexos) {
    const destino = destinoPorContrato.get(String(anexo.contrato));
    if (!destino) continue;
    mapa.set(caminhoEnvio(destino, envioId, anexo), anexo.conteudo);
  }
  return mapa;
}

/**
 * Um registro por arquivo realmente enviado. Contrato sem destino é ignorado —
 * o repositório nunca recebe arquivo sem empresa, mês ou categoria conhecida.
 */
export function montarItensEnvio(
  anexos: AnexoEnviado[],
  destinoPorContrato: Map<string, DestinoEnvio>,
  envioId: string,
): ItemEnvioEmpresa[] {
  const itens: ItemEnvioEmpresa[] = [];
  const vistos = new Set<string>();
  for (const anexo of anexos) {
    const destino = destinoPorContrato.get(String(anexo.contrato));
    if (!destino) continue;
    const storage_path = caminhoEnvio(destino, envioId, anexo);
    if (vistos.has(storage_path)) continue;
    vistos.add(storage_path);
    itens.push({
      movimentacao_id: destino.movimentacaoId,
      empresa_id: destino.empresaId,
      contrato: String(destino.contrato),
      competencia: destino.competencia,
      periodo: destino.periodo,
      nome_arquivo: anexo.nome,
      bucket: BUCKET_ENVIOS,
      storage_path,
      mime_type: anexo.mime,
      tamanho_bytes: anexo.conteudo.byteLength,
      tipo_relatorio: TIPO_RELATORIO[anexo.tipo] ?? "Outros",
    });
  }
  return itens;
}
