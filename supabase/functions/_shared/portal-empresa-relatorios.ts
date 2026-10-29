export const PORTAL_URL = "https://api-portal-empresa.samel.com.br";
export const RELATORIOS_PORTAL = {
  pdf: { path: "/api/relatorios/ops-vidas-ativas-contrato-empresarial", mime: "application/pdf" },
  xlsx: { path: "/api/relatorios/ops-mensalidades-excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;
export type TipoRelatorioPortal = keyof typeof RELATORIOS_PORTAL;
export type JobRelatorioPortal = { job_id: string; nr_contrato: number; tipo: TipoRelatorioPortal };
export type ArquivoPortal = JobRelatorioPortal & { nome_arquivo: string; blob: Blob; atualizado_em?: string };

export function validarContratoPortal(valor: unknown): number {
  if ((typeof valor !== "string" && typeof valor !== "number") || !/^\d+$/.test(String(valor).trim())) throw new Error("CÓD. CONTRATO inválido na empresa selecionada.");
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new Error("CÓD. CONTRATO deve ser um inteiro positivo.");
  return numero;
}
export function validarArquivoContrato(contrato: unknown, job: JobRelatorioPortal, nome: string): void {
  const numero = validarContratoPortal(contrato);
  const marcadores = [...nome.matchAll(/_Contrato_(\d+)_/g)];
  if (job.nr_contrato !== numero || marcadores.length !== 1 || marcadores[0][1] !== String(numero) || !nome.toLowerCase().endsWith(`.${job.tipo}`) || /[\r\n/\\]/.test(nome)) {
    throw new Error(`Relatório bloqueado: o arquivo não pertence ao contrato #${numero} da empresa selecionada.`);
  }
}
function validarJobId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new Error("Identificador de relatório inválido.");
  return id;
}
async function lerJson(response: Response) {
  if (!response.ok) throw new Error(`A API de relatórios está indisponível (${response.status}).`);
  const data = await response.json();
  if (data.success !== true) throw new Error(typeof data.erro === "string" ? data.erro : "Não foi possível consultar o relatório.");
  return data;
}
export async function iniciarRelatorioPortal(contrato: unknown, tipo: TipoRelatorioPortal, signal?: AbortSignal): Promise<JobRelatorioPortal> {
  const nr_contrato = validarContratoPortal(contrato);
  const data = await lerJson(await fetch(`${PORTAL_URL}/api/relatorios-async`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: RELATORIOS_PORTAL[tipo].path, payload: { nr_contrato } }), signal,
  }));
  return { job_id: validarJobId(data.job_id), nr_contrato, tipo };
}
export async function consultarRelatorioPortal(job: JobRelatorioPortal, signal?: AbortSignal) {
  const data = await lerJson(await fetch(`${PORTAL_URL}/api/relatorios-async/${validarJobId(job.job_id)}`, { signal }));
  if (data.job_id !== job.job_id) throw new Error("Relatório bloqueado: a resposta pertence a outra geração.");
  if (data.status === "erro") throw new Error(data.erro || "Falha ao gerar relatório.");
  if (!["processando", "concluido"].includes(data.status)) throw new Error("Situação de relatório inválida.");
  if (data.status === "concluido") validarArquivoContrato(job.nr_contrato, job, data.nome_arquivo ?? "");
  return data as { status: "processando" | "concluido"; nome_arquivo?: string };
}
export async function baixarRelatorioPortal(contrato: unknown, job: JobRelatorioPortal, signal?: AbortSignal): Promise<ArquivoPortal> {
  if (validarContratoPortal(contrato) !== job.nr_contrato) throw new Error("Relatório bloqueado: contrato divergente.");
  const data = await consultarRelatorioPortal(job, signal);
  if (data.status !== "concluido" || !data.nome_arquivo) throw new Error("O relatório ainda está sendo gerado.");
  validarArquivoContrato(contrato, job, data.nome_arquivo);
  const response = await fetch(`${PORTAL_URL}/api/relatorios-async/${validarJobId(job.job_id)}/download`, { signal });
  if (!response.ok) throw new Error("Não foi possível baixar o relatório.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 15 * 1024 * 1024) throw new Error("Relatório vazio ou maior que 15 MB.");
  const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const valido = job.tipo === "pdf" ? String.fromCharCode(...bytes) === "%PDF-" : bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!valido) throw new Error("O conteúdo recebido não é um relatório válido.");
  const ultimaAtualizacao = response.headers.get("Last-Modified");
  const atualizado_em = ultimaAtualizacao && Number.isFinite(Date.parse(ultimaAtualizacao)) ? ultimaAtualizacao : undefined;
  return { ...job, nome_arquivo: data.nome_arquivo, blob: new Blob([blob], { type: RELATORIOS_PORTAL[job.tipo].mime }), ...(atualizado_em ? { atualizado_em } : {}) };
}