// Gera uma imagem PNG da ÚLTIMA página de um PDF de relatório de vidas,
// para embutir no corpo do e-mail enviado à empresa (resumo de totais).
// Renderização feita no navegador via PDF.js; falhas não devem bloquear o envio.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — Vite resolve o worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

/** Limite do PNG em base64 enviado à função de e-mail (~3 MB decodificado). */
export const RESUMO_PDF_MAX_B64 = 4_000_000;

async function renderizarPagina(doc: any, escala: number): Promise<string> {
  const pagina = await doc.getPage(doc.numPages);
  const viewport = pagina.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  await pagina.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1] ?? "";
}

/**
 * Renderiza a última página do PDF e retorna o PNG em base64.
 * Retorna null quando não é possível renderizar (o envio segue sem a imagem).
 */
export async function gerarResumoUltimaPaginaPdf(bytes: Uint8Array): Promise<string | null> {
  try {
    const doc = await (pdfjsLib as any).getDocument({ data: bytes }).promise;
    if (!doc.numPages) return null;
    // Tenta em alta resolução; se passar do limite, refaz em resolução menor.
    let b64 = await renderizarPagina(doc, 2);
    if (b64.length > RESUMO_PDF_MAX_B64) b64 = await renderizarPagina(doc, 1.2);
    if (b64.length > RESUMO_PDF_MAX_B64) return null;
    return b64 || null;
  } catch {
    return null;
  }
}
