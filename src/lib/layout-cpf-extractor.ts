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
 * Extrai conjunto de identificadores únicos de vidas de um layout Excel.
 *
 * Suporta dois formatos:
 *  1) Layout SAMEL de movimentação: cabeçalhos `CPF` + `NOME` (+ opcional
 *     `TIPO OPERACAO`). Considera apenas linhas com TIPO OPERACAO = "I".
 *  2) Layout de roster de administradora (ex.: Plural/Qualicorp/Allcare):
 *     cabeçalho `CARTEIRINHA` (snapshot da base ativa). Considera todas
 *     as linhas com beneficiário preenchido.
 *
 * NÃO retorna nomes ou dados pessoais — apenas identificadores em formato
 * numérico/string para diff entre meses.
 */
export async function extractCpfsFromLayout(buffer: ArrayBuffer): Promise<Set<string>> {
  const ids = new Set<string>();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  type Chosen = {
    ws: ExcelJS.Worksheet;
    headerRow: number;
    mode: "cpf" | "carteirinha";
    idxId: number;
    idxNome: number;
    idxTipo: number;
  };

  let chosen: Chosen | null = null;
  let bestVidas = -1;

  for (const sheet of wb.worksheets) {
    for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
      const headers: string[] = [];
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
        headers[col] = normalize(cellToString(cell.value));
      });

      // Tenta layout Carteirinha (roster administradora)
      const idxCart = headers.findIndex((h) => h === "CARTEIRINHA" || h === "CARTAO" || h === "CARTAO IDENTIFICACAO");
      const idxBenef = headers.findIndex((h) => h === "BENEFICIARIO" || h === "NOME BENEFICIARIO" || h === "NOME");

      if (idxCart >= 0 && idxBenef >= 0) {
        let vidas = 0;
        for (let rr = r + 1; rr <= sheet.rowCount; rr++) {
          const nome = cellToString(sheet.getRow(rr).getCell(idxBenef).value).trim();
          const cart = cellToString(sheet.getRow(rr).getCell(idxCart).value).trim();
          if (nome && cart) vidas++;
        }
        if (vidas > bestVidas) {
          bestVidas = vidas;
          chosen = { ws: sheet, headerRow: r, mode: "carteirinha", idxId: idxCart, idxNome: idxBenef, idxTipo: -1 };
        }
        continue;
      }

      // Fallback: layout CPF (movimentação SAMEL)
      const idxCpf = headers.findIndex((h) => h === "CPF");
      const idxNome = headers.findIndex((h) => h === "NOME");
      if (idxCpf < 0 || idxNome < 0) continue;
      const idxTipo = headers.findIndex((h) => h === "TIPO OPERACAO");
      let vidas = 0;
      for (let rr = r + 1; rr <= sheet.rowCount; rr++) {
        const nome = cellToString(sheet.getRow(rr).getCell(idxNome).value).trim();
        if (nome) vidas++;
      }
      if (vidas > bestVidas) {
        bestVidas = vidas;
        chosen = { ws: sheet, headerRow: r, mode: "cpf", idxId: idxCpf, idxNome, idxTipo };
      }
    }
  }

  if (!chosen) return ids;

  for (let r = chosen.headerRow + 1; r <= chosen.ws.rowCount; r++) {
    const row = chosen.ws.getRow(r);
    if (!row.hasValues) continue;
    const nome = cellToString(row.getCell(chosen.idxNome).value).trim();
    if (!nome) continue;

    if (chosen.mode === "cpf") {
      if (chosen.idxTipo >= 0) {
        const tipo = normalize(cellToString(row.getCell(chosen.idxTipo).value));
        if (tipo !== "I") continue;
      }
      const cpf = onlyDigits(cellToString(row.getCell(chosen.idxId).value));
      if (isValidCPF(cpf)) ids.add(cpf);
    } else {
      // mode === "carteirinha"
      const cart = onlyDigits(cellToString(row.getCell(chosen.idxId).value));
      if (cart.length >= 6) ids.add(cart);
    }
  }
  return ids;
}

