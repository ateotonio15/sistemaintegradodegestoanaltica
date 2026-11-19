import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — Vite resolve o worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { LinhaTexto, PaginaTexto } from "./assinatura-localizar";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

/** Lê o texto do PDF agrupado em linhas, com posição em frações da página. */
export async function lerTextoPdf(bytes: Uint8Array): Promise<PaginaTexto[]> {
  const doc = await (pdfjsLib as any).getDocument({ data: bytes.slice() }).promise;
  const paginas: PaginaTexto[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const { width: W, height: H } = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const grupos = new Map<number, { itens: any[] }>();
    for (const it of tc.items as any[]) {
      if (!it.str?.trim()) continue;
      const chave = Math.round(it.transform[5] / 3);
      if (!grupos.has(chave)) grupos.set(chave, { itens: [] });
      grupos.get(chave)!.itens.push(it);
    }
    const linhas: LinhaTexto[] = [...grupos.values()].map(({ itens }) => {
      itens.sort((a, b) => a.transform[4] - b.transform[4]);
      const x0 = Math.min(...itens.map((i) => i.transform[4]));
      const x1 = Math.max(...itens.map((i) => i.transform[4] + i.width));
      const base = Math.min(...itens.map((i) => i.transform[5]));
      const h = Math.max(...itens.map((i) => i.height || Math.abs(i.transform[3]) || 10));
      return { texto: itens.map((i) => i.str).join(" "), pagina: n, x: x0 / W, y: (H - base - h) / H, w: (x1 - x0) / W, h: h / H };
    }).sort((a, b) => a.y - b.y);
    paginas.push({ linhas });
  }
  return paginas;
}
