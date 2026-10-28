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
/** Confere se o texto da página traz "CONTRATO : <número>" igual ao esperado. */
export function ultimaPaginaDoContrato(texto: string, contrato: string | number): boolean {
  const esperado = String(contrato).replace(/\D/g, "").replace(/^0+/, "");
  const achados = [...texto.matchAll(/CONTRATO\s*:?\s*(\d+)/gi)].map((m) => m[1].replace(/^0+/, ""));
  return achados.length > 0 && achados.every((n) => n === esperado);
}

/** Recorta do topo da página até o limite, cortando sobras brancas nas laterais e no topo. */
function recortarAteLimite(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, limite: number, margem: number): HTMLCanvasElement {
  const w = canvas.width;
  const maxY = Math.max(1, Math.min(canvas.height - 1, Math.round(limite)));
  const px = ctx.getImageData(0, 0, w, maxY + 1).data;
  const escuro = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return px[i + 3] > 0 && (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235);
  };
  let minY = -1, minX = w, maxX = -1;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x < w; x++) {
      if (!escuro(x, y)) continue;
      if (minY < 0) minY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (minY < 0 || maxX < 0) return canvas;
  minX = Math.max(0, minX - margem); minY = Math.max(0, minY - margem); maxX = Math.min(w - 1, maxX + margem);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  if (!octx) return canvas;
  octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Recorta apenas a área com informações, removendo o espaço em branco da página. */
function recortarConteudo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, margem: number): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  const escuro = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return px[i + 3] > 0 && (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235);
  };
  // Ignora a moldura da página: colunas/linhas quase inteiramente escuras (bordas finas).
  const colMoldura = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    let n = 0; for (let y = 0; y < h; y++) if (escuro(x, y)) n++;
    if (n > h * 0.6) colMoldura[x] = 1;
  }
  const linMoldura = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    let n = 0, cont = 0;
    for (let x = 0; x < w; x++) if (!colMoldura[x] && escuro(x, y)) n++;
    for (let x = 0; x < w; x++) if (!colMoldura[x]) cont++;
    // linha fina de borda (não faixa cinza com texto): checa se a linha de cima ou de baixo é clara
    if (cont && n > cont * 0.9) {
      const claroVizinho = (yy: number) => { if (yy < 0 || yy >= h) return true; let k = 0; for (let x = 0; x < w; x += 4) if (!colMoldura[x] && escuro(x, yy)) k++; return k < (cont / 4) * 0.5; };
      if (claroVizinho(y - 3) || claroVizinho(y + 3)) linMoldura[y] = 1;
    }
  }
  // Linhas com conteúdo (fora da moldura).
  const temConteudo = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    if (linMoldura[y]) continue;
    for (let x = 0; x < w; x++) if (!colMoldura[x] && escuro(x, y)) { temConteudo[y] = 1; break; }
  }
  // Pega só o bloco de cima: para no primeiro espaço em branco grande
  // (assim o rodapé "Impresso em / Página" fica de fora).
  const gapMax = Math.round(h * 0.08);
  let minY = -1, maxY = -1, vazio = 0;
  for (let y = 0; y < h; y++) {
    if (temConteudo[y]) { if (minY < 0) minY = y; maxY = y; vazio = 0; }
    else if (minY >= 0 && ++vazio > gapMax) break;
  }
  if (maxY < 0) return canvas;
  let minX = w, maxX = -1;
  for (let y = minY; y <= maxY; y++) {
    if (linMoldura[y]) continue;
    for (let x = 0; x < w; x++) if (!colMoldura[x] && escuro(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  if (maxX < 0) return canvas;
  minX = Math.max(0, minX - margem); minY = Math.max(0, minY - margem);
  maxX = Math.min(w - 1, maxX + margem); maxY = Math.min(h - 1, maxY + margem);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  if (!octx) return canvas;
  octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Renderiza a última página do PDF e retorna o PNG em base64.
 * Retorna null quando não é possível renderizar (o envio segue sem a imagem).
 */
export async function gerarResumoUltimaPaginaPdf(bytes: Uint8Array, contratoEsperado?: string | number | null): Promise<string | null> {
  try {
    const doc = await (pdfjsLib as any).getDocument({ data: bytes.slice() }).promise;
    if (!doc.numPages) return null;
    if (contratoEsperado != null && String(contratoEsperado).trim()) {
      const pagina = await doc.getPage(doc.numPages);
      const texto = ((await pagina.getTextContent()).items as any[]).map((i) => i.str ?? "").join(" ");
      if (!ultimaPaginaDoContrato(texto, contratoEsperado)) throw new Error("A última página do PDF não é do contrato selecionado.");
    }
    // Tenta em alta resolução; se passar do limite, refaz em resolução menor.
    let b64 = await renderizarPagina(doc, 2);
    if (b64.length > RESUMO_PDF_MAX_B64) b64 = await renderizarPagina(doc, 1.2);
    if (b64.length > RESUMO_PDF_MAX_B64) return null;
    return b64 || null;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("A última página")) throw e;
    return null;
  }
}
