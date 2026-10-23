// pdf.js para servidor (Deno), via build serverless do unpdf — mesma API usada por extrairTextoPdf.
import { getResolvedPDFJS } from "npm:unpdf@0.12.1";

export const GlobalWorkerOptions = {};
export function getDocument(opts) {
  return {
    promise: getResolvedPDFJS().then((p) =>
      p.getDocument({ ...opts, isEvalSupported: false, useSystemFonts: true, disableFontFace: true }).promise
    ),
  };
}
