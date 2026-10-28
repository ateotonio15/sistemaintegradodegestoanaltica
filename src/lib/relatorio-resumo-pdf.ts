// Gera uma imagem PNG da ÚLTIMA página de um PDF de relatório de vidas,
// para embutir no corpo do e-mail enviado à empresa (resumo de totais).
// Renderização feita no navegador via PDF.js; falhas não devem bloquear o envio.
import { ultimaPaginaDoContrato } from "./relatorio-resumo-contrato";
export { ultimaPaginaDoContrato };
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
  const limite = await limiteInferiorPorTexto(pagina, viewport, escala);
  const recortado = limite != null
    ? recortarAteLimite(canvas, ctx, limite, Math.round(8 * escala))
    : recortarConteudo(canvas, ctx, Math.round(12 * escala));
  const dataUrl = recortado.toDataURL("image/png");
  return dataUrl.split(",")[1] ?? "";
}

const RODAPE = /impresso\s+em|p[áa]gina\s*\d/i;

/**
 * Usa o texto do PDF para achar onde terminam as informações (ex.: linha
 * "Coletivo Empresarial Master"), ignorando o rodapé "Impresso em / Página".
 * Retorna a coordenada Y (em pixels do canvas) do fim do recorte, ou null.
 */
async function limiteInferiorPorTexto(pagina: any, viewport: any, escala: number): Promise<number | null> {
  try {
    const conteudo = await pagina.getTextContent();
    const itens = (conteudo.items as any[])
      .filter((it) => typeof it.str === "string" && it.str.trim())
      .map((it) => {
        const [, y] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return { str: it.str as string, y: y as number };
      });
    if (!itens.length) return null;
    const rodape = itens.filter((it) => RODAPE.test(it.str));
    const topoRodape = rodape.length ? Math.min(...rodape.map((it) => it.y)) - 14 * escala : Infinity;
    const corpo = itens.filter((it) => it.y < topoRodape);
    if (!corpo.length) return null;
    const ultimo = Math.max(...corpo.map((it) => it.y));
    return Math.min(viewport.height - 1, ultimo + 18 * escala);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("A última página")) throw e;
    return null;
  }
}
