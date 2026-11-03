import * as XLSX from "xlsx";
import { dataCorteMovimentacao } from "../../supabase/functions/_shared/data-corte";

/** Conta as vidas (linhas com beneficiário) da planilha "OPS Mensalidades". Somente leitura. */
export async function contarVidasExcel(blob: Blob): Promise<number | null> {
  try {
    const wb = XLSX.read(await (typeof blob.arrayBuffer === "function" ? blob.arrayBuffer() : new Response(blob).arrayBuffer()), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return null;
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const cab = (linhas[0] ?? []).map(c => String(c ?? "").trim().toLowerCase());
    const col = cab.findIndex(c => c === "beneficiario" || c === "beneficiário");
    const dados = linhas.slice(1);
    return col >= 0 ? dados.filter(l => String(l?.[col] ?? "").trim() !== "").length : dados.length;
  } catch { return null; }
}

/** Data/hora de geração lida do nome do arquivo (`_AAAAMMDD_HHMM`), sem depender de fuso. */
export function dataGeracaoArquivo(nome: string): { dia: number; mes: number; ano: number; hora: string } | null {
  const m = /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(?=\.|_)/.exec(nome);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]), hora: `${m[4]}:${m[5]}` };
}

export function formatarGeracao(nome: string): string | null {
  const d = dataGeracaoArquivo(nome);
  return d ? `${String(d.dia).padStart(2, "0")}/${String(d.mes).padStart(2, "0")}/${d.ano} ${d.hora}` : null;
}

/**
 * Arquivo gerado até o fim do período (dia de corte, inclusive) pode não ter os
 * desligamentos/inclusões feitos depois — mostrar aviso para buscar no Portal.
 */
export function arquivoAnteriorAoCorte(nome: string, periodo: string | null | undefined, mes: string | null | undefined): boolean {
  const g = dataGeracaoArquivo(nome);
  const corte = dataCorteMovimentacao(periodo, mes);
  if (!g || !corte) return false;
  const [d, m, a] = corte.split("/").map(Number);
  return g.ano * 10000 + g.mes * 100 + g.dia <= a * 10000 + m * 100 + d;
}
