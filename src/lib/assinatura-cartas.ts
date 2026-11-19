import { PDFDocument } from "pdf-lib";

/** Posição da assinatura em frações da página (origem no canto superior esquerdo). */
export interface PosicaoAssinatura {
  x: number; // centro horizontal (0-1)
  y: number; // centro vertical (0-1)
  largura: number; // largura da assinatura como fração da largura da página
}

export const POSICAO_PADRAO: PosicaoAssinatura = { x: 0.5, y: 0.8, largura: 0.3 };
export const RUBRICA_LARGURA = 0.08;

/** Converte a posição relativa em retângulo do PDF (origem no canto inferior esquerdo). */
export function retanguloPdf(
  pos: PosicaoAssinatura, pagW: number, pagH: number, imgW: number, imgH: number,
) {
  const w = pos.largura * pagW;
  const h = imgW > 0 ? (w * imgH) / imgW : 0;
  const cx = pos.x * pagW;
  const cyTopo = pos.y * pagH;
  let x = cx - w / 2;
  let y = pagH - cyTopo - h / 2;
  x = Math.min(Math.max(0, x), Math.max(0, pagW - w));
  y = Math.min(Math.max(0, y), Math.max(0, pagH - h));
  return { x, y, width: w, height: h };
}

/** Retângulo da rubrica: canto inferior direito de cada página. */
export function retanguloRubrica(pagW: number, imgW: number, imgH: number) {
  const w = RUBRICA_LARGURA * pagW;
  const h = imgW > 0 ? (w * imgH) / imgW : 0;
  const margem = pagW * 0.04;
  return { x: pagW - w - margem, y: margem, width: w, height: h };
}

async function embutir(doc: PDFDocument, bytes: Uint8Array, tipo: string) {
  return tipo.includes("png") ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

export interface ImagemAssinatura { bytes: Uint8Array; tipo: string }

/** Assina a última página e, se houver rubrica, rubrica todas as páginas. */
export async function assinarPdf(
  pdf: Uint8Array, assinatura: ImagemAssinatura, rubrica: ImagemAssinatura | null, pos: PosicaoAssinatura,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const paginas = doc.getPages();
  if (!paginas.length) throw new Error("PDF sem páginas");
  const img = await embutir(doc, assinatura.bytes, assinatura.tipo);
  const ultima = paginas[paginas.length - 1];
  const { width, height } = ultima.getSize();
  ultima.drawImage(img, retanguloPdf(pos, width, height, img.width, img.height));
  if (rubrica) {
    const rub = await embutir(doc, rubrica.bytes, rubrica.tipo);
    for (const p of paginas) {
      p.drawImage(rub, retanguloRubrica(p.getSize().width, rub.width, rub.height));
    }
  }
  return doc.save();
}

export function nomeAssinado(nome: string) {
  return nome.replace(/\.pdf$/i, "") + " - assinado.pdf";
}
