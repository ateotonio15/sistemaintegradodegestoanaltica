import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";

// Polyfill ReadableStream async iterator (Safari iOS não suporta nativamente,
// e o pdf.js v5 depende de `for await ... of stream`).
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

export type Anexo1Data = {
  nome: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  vidas: number | null;
  data_implantacao: string | null; // YYYY-MM-DD
  dia_vencimento: number | null;
  valor_enfermaria_reais: number | null;
  valor_apartamento_reais: number | null;
};

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

export async function parseAnexo1(file: File): Promise<Anexo1Data> {
  const name = file.name.toLowerCase();
  let text = "";
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdfText(file);
  } else if (name.endsWith(".docx") || file.type.includes("word")) {
    text = await extractDocxText(file);
  } else {
    throw new Error("Formato não suportado. Envie PDF ou DOCX.");
  }

  if (!text.trim()) throw new Error("Não foi possível extrair texto do arquivo.");

  const { data, error } = await supabase.functions.invoke("parse-anexo1", {
    body: { text },
  });
  if (error) throw error;
  return (data?.data ?? {}) as Anexo1Data;
}
