import mammoth from "mammoth";

// Polyfill ReadableStream async iterator (Safari iOS / pdf.js v5)
if (typeof ReadableStream !== "undefined" &&
    !(ReadableStream.prototype as any)[Symbol.asyncIterator]) {
  (ReadableStream.prototype as any)[Symbol.asyncIterator] = function () {
    const reader = this.getReader();
    return {
      next: () => reader.read(),
      return: (value: any) => { reader.releaseLock(); return { value, done: true }; },
      [Symbol.asyncIterator]() { return this; },
    };
  };
  (ReadableStream.prototype as any).values =
    (ReadableStream.prototype as any)[Symbol.asyncIterator];
}

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return out;
}

async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || "";
}

/** Extrai texto bruto de PDF, DOCX ou TXT. */
export async function extrairTextoContrato(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdfText(file);
  } else if (name.endsWith(".docx") || file.type.includes("word")) {
    text = await extractDocxText(file);
  } else if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    text = await file.text();
  } else {
    throw new Error("Formato não suportado. Envie PDF, DOCX ou TXT.");
  }
  if (!text.trim()) {
    throw new Error("Não foi possível extrair texto do arquivo (PDF pode ser digitalizado/imagem).");
  }
  return text;
}
