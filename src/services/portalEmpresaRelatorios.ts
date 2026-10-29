import { iniciarRelatorioPortal, consultarRelatorioPortal, baixarRelatorioPortal, validarContratoPortal, type ArquivoPortal, type TipoRelatorioPortal } from "../../supabase/functions/_shared/portal-empresa-relatorios";
export { validarContratoPortal, validarArquivoContrato, ErroCarregarArquivoPortal } from "../../supabase/functions/_shared/portal-empresa-relatorios";
export type { ArquivoPortal, JobRelatorioPortal } from "../../supabase/functions/_shared/portal-empresa-relatorios";

function esperar(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cancelar = () => { clearTimeout(timer); reject(new DOMException("Consulta cancelada", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancelar); resolve(); }, 2000);
    signal.addEventListener("abort", cancelar, { once: true });
  });
}
export async function gerarRelatorioPortal(contrato: unknown, tipo: TipoRelatorioPortal, signal: AbortSignal): Promise<ArquivoPortal> {
  const numero = validarContratoPortal(contrato);
  const job = await iniciarRelatorioPortal(numero, tipo, signal);
  const inicio = Date.now();
  while (Date.now() - inicio < 10 * 60 * 1000) {
    signal.throwIfAborted();
    const estado = await consultarRelatorioPortal(job, signal);
    if (estado.status === "concluido") return baixarRelatorioPortal(numero, job, signal);
    await esperar(signal);
  }
  throw new Error(`A geração do contrato #${numero} demorou demais. Tente novamente.`);
}
export async function gerarRelatoriosPortal(contrato: unknown, signal: AbortSignal): Promise<ArquivoPortal[]> {
  // Cada chamada tem seu próprio trabalho e contrato; não há cache compartilhado entre empresas.
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  signal.throwIfAborted();
  signal.addEventListener("abort", cancelar, { once: true });
  try {
    return await Promise.all([gerarRelatorioPortal(contrato, "pdf", controller.signal), gerarRelatorioPortal(contrato, "xlsx", controller.signal)]);
  } catch (e) { controller.abort(); throw e; }
  finally { signal.removeEventListener("abort", cancelar); }
}