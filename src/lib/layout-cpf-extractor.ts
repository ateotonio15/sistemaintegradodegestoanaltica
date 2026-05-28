import ExcelJS from "exceljs";

function normalize(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function cellToString(v: any) {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as any).text || "");
  if (typeof v === "object" && "result" in v) return String((v as any).result ?? "");
  return String(v);
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function isValidCPF(v: string) {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}

/**
 * Extrai conjunto de CPFs válidos (linhas TIPO OPERACAO = "I") de um layout Excel.
 * NÃO retorna nomes ou dados pessoais.
 */
export async function extractCpfsFromLayout(buffer: ArrayBuffer): Promise<Set<string>> {
  const cpfs = new Set<string>();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Encontra melhor sheet/linha header
  let chosen: { ws: ExcelJS.Worksheet; headerRow: number } | null = null;
  let bestVidas = -1;
  for (const sheet of wb.worksheets) {
    for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
      const headers: string[] = [];
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
        headers[col] = normalize(cellToString(cell.value));
      });
      const idxCpf = headers.findIndex((h) => h === "CPF");
      const idxNome = headers.findIndex((h) => h === "NOME");
      if (idxCpf < 0 || idxNome < 0) continue;
      let vidas = 0;
      for (let rr = r + 1; rr <= sheet.rowCount; rr++) {
        const nome = cellToString(sheet.getRow(rr).getCell(idxNome).value).trim();
        if (nome) vidas++;
      }
      if (vidas > bestVidas) {
        bestVidas = vidas;
        chosen = { ws: sheet, headerRow: r };
      }
    }
  }
  if (!chosen) return cpfs;

  const headers: string[] = [];
  chosen.ws.getRow(chosen.headerRow).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = normalize(cellToString(cell.value));
  });
  const idxCpf = headers.findIndex((h) => h === "CPF");
  const idxTipo = headers.findIndex((h) => h === "TIPO OPERACAO");
  const idxNome = headers.findIndex((h) => h === "NOME");
  if (idxCpf < 0) return cpfs;

  for (let r = chosen.headerRow + 1; r <= chosen.ws.rowCount; r++) {
    const row = chosen.ws.getRow(r);
    if (!row.hasValues) continue;
    const nome = idxNome >= 0 ? cellToString(row.getCell(idxNome).value).trim() : "";
    if (!nome) continue;
    if (idxTipo >= 0) {
      const tipo = normalize(cellToString(row.getCell(idxTipo).value));
      if (tipo !== "I") continue;
    }
    const cpf = onlyDigits(cellToString(row.getCell(idxCpf).value));
    if (isValidCPF(cpf)) cpfs.add(cpf);
  }
  return cpfs;
}
