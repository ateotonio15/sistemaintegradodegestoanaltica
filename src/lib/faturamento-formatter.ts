import ExcelJS from "exceljs";

export type ModoFaturamento = "prorata" | "nao_prorata";

const HEADER_FILL = "FFBFBFBF";

function norm(v: unknown): string {
  return String(v ?? "").trim();
}
function lower(v: unknown): string {
  return norm(v).toLowerCase();
}

function findCol(ws: ExcelJS.Worksheet, headerRow: number, titulo: string): number {
  const row = ws.getRow(headerRow);
  const target = titulo.trim().toLowerCase();
  let last = 0;
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    if (lower(cellText(cell)) === target && !last) last = col;
  });
  return last;
}

function cellText(cell: ExcelJS.Cell): string {
  const v: any = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray((v as any).richText)) {
      return (v as any).richText.map((r: any) => r.text).join("");
    }
    if ("text" in v) return String((v as any).text ?? "");
    if ("result" in v) return String((v as any).result ?? "");
    if ("hyperlink" in v) return String((v as any).text ?? (v as any).hyperlink ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function cellNumber(cell: ExcelJS.Cell): number {
  const v: any = cell.value;
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "result" in v) return Number((v as any).result);
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? NaN : n;
}

function lastUsedRow(ws: ExcelJS.Worksheet): number {
  return ws.actualRowCount || ws.rowCount || 1;
}

function preencherTitular(ws: ExcelJS.Worksheet, headerRow: number) {
  const colBenef = findCol(ws, headerRow, "Beneficiário");
  const colTit = findCol(ws, headerRow, "Titularidade");
  const colMat = findCol(ws, headerRow, "Matricula");
  const colTitular = findCol(ws, headerRow, "Titular");
  if (!colBenef || !colTit || !colMat || !colTitular) return;
  const last = lastUsedRow(ws);
  const map = new Map<string, string>();
  for (let i = headerRow + 1; i <= last; i++) {
    const mat = norm(cellText(ws.getRow(i).getCell(colMat)));
    if (!mat || map.has(mat)) continue;
    if (lower(cellText(ws.getRow(i).getCell(colTit))) === "titular") {
      map.set(mat, norm(cellText(ws.getRow(i).getCell(colBenef))));
    }
  }
  for (let i = headerRow + 1; i <= last; i++) {
    const mat = norm(cellText(ws.getRow(i).getCell(colMat)));
    if (!map.has(mat)) continue;
    const cell = ws.getRow(i).getCell(colTitular);
    if (lower(cellText(ws.getRow(i).getCell(colTit))) !== "titular") {
      cell.value = map.get(mat)!;
    } else {
      cell.value = "";
    }
  }
}

function pagadorTemMultiplosCNPJs(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  colPag: number,
  colCNPJ: number,
): boolean {
  if (!colPag || !colCNPJ) return false;
  const last = lastUsedRow(ws);
  const map = new Map<string, Set<string>>();
  for (let i = headerRow + 1; i <= last; i++) {
    const p = norm(cellText(ws.getRow(i).getCell(colPag)));
    const c = norm(cellText(ws.getRow(i).getCell(colCNPJ)));
    if (!p || !c) continue;
    if (!map.has(p)) map.set(p, new Set());
    map.get(p)!.add(c);
    if (map.get(p)!.size > 1) return true;
  }
  return false;
}

function haMultiplasModalidades(ws: ExcelJS.Worksheet, headerRow: number, col: number): boolean {
  if (!col) return false;
  const last = lastUsedRow(ws);
  const s = new Set<string>();
  for (let i = headerRow + 1; i <= last; i++) {
    const v = lower(cellText(ws.getRow(i).getCell(col)));
    if (v) s.add(v);
    if (s.size > 1) return true;
  }
  return false;
}

function readAllRows(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  lastCol: number,
): { headers: string[]; rows: any[][] } {
  const headers: string[] = [];
  for (let c = 1; c <= lastCol; c++) headers.push(norm(cellText(ws.getRow(headerRow).getCell(c))));
  const rows: any[][] = [];
  const last = lastUsedRow(ws);
  for (let i = headerRow + 1; i <= last; i++) {
    const arr: any[] = [];
    for (let c = 1; c <= lastCol; c++) arr.push(ws.getRow(i).getCell(c).value);
    if (arr.some((v) => v !== null && v !== undefined && String(v).trim() !== "")) rows.push(arr);
  }
  return { headers, rows };
}

export async function formatarFaturamentoExcel(
  buffer: ArrayBuffer,
  modo: ModoFaturamento,
): Promise<{ blob: Blob; filename: string }> {
  const wbIn = new ExcelJS.Workbook();
  await wbIn.xlsx.load(buffer);
  const wsIn = wbIn.worksheets[0];
  if (!wsIn) throw new Error("Planilha vazia.");

  const headerRow = wsIn.actualRowCount ? (wsIn.getRow(1).actualCellCount ? 1 : wsIn.getRow(1).number) : 1;
  // Detect header row = first non-empty row
  let hr = 1;
  for (let r = 1; r <= Math.min(20, wsIn.rowCount); r++) {
    if (wsIn.getRow(r).actualCellCount > 0) {
      hr = r;
      break;
    }
  }
  preencherTitular(wsIn, hr);

  let lastCol = 0;
  wsIn.getRow(hr).eachCell({ includeEmpty: false }, (_c, col) => {
    if (col > lastCol) lastCol = col;
  });

  const { headers, rows: allRows } = readAllRows(wsIn, hr, lastCol);
  const headerKey = (h: string) => h.trim().toLowerCase();
  const colIdx = (name: string) =>
    headers.findIndex((h) => headerKey(h) === headerKey(name));

  const iBenef = colIdx("Beneficiário");
  const iTipo = colIdx("Tipo Cobrança");
  const iValor = colIdx("Valor");
  const iCNPJ = colIdx("CNPJ");
  const iPag = colIdx("Pagador");
  const iPlano = colIdx("Plano");
  const iFx = colIdx("Fx Etária");
  const iContr = colIdx("Contr");
  const iComp = headers.findIndex((h) => /compet/i.test(h));
  const iDtResc = colIdx("Dt_rescisão");

  // Remove duplicate header rows
  const headerStr = headers.join("|");
  const rows0 = allRows.filter((r) => r.map((v) => norm(v)).join("|") !== headerStr);

  // Tipo Cobrança rules
  const rows1 = rows0
    .map((r) => {
      if (iTipo >= 0) {
        const t = lower(r[iTipo]);
        if (t === "inclusão pós-prazo") r[iTipo] = "Mensalidade";
      }
      return r;
    })
    .filter((r) => {
      if (iTipo < 0) return true;
      const t = lower(r[iTipo]);
      if (modo === "nao_prorata") return !(t === "inclusão" || t === "abatimento");
      return t !== "abatimento";
    });

  // CNPJ pad to 14
  if (iCNPJ >= 0) {
    for (const r of rows1) {
      const raw = r[iCNPJ];
      if (raw === null || raw === undefined || raw === "") continue;
      let s = typeof raw === "number" ? String(Math.trunc(raw)) : String(raw).trim();
      s = s.replace(/\D/g, "");
      if (s.length === 13) s = "0" + s;
      r[iCNPJ] = s;
    }
  }

  // Consolidate reajustes into Mensalidade of same Beneficiário
  if (iBenef >= 0 && iTipo >= 0 && iValor >= 0) {
    for (let i = rows1.length - 1; i >= 0; i--) {
      const t = lower(rows1[i][iTipo]);
      if (t === "reajuste - variação de custo" || t === "reajuste - mudança de faixa-etária") {
        const benef = norm(rows1[i][iBenef]);
        const idx = rows1.findIndex(
          (rr, j) => j !== i && norm(rr[iBenef]) === benef && lower(rr[iTipo]) === "mensalidade",
        );
        if (idx >= 0) {
          const a = parseFloat(String(rows1[idx][iValor] ?? 0)) || 0;
          const b = parseFloat(String(rows1[i][iValor] ?? 0)) || 0;
          rows1[idx][iValor] = a + b;
          rows1.splice(i, 1);
        }
      }
    }
  }

  // Remove Dt_rescisão if empty
  let dropDtResc = false;
  if (iDtResc >= 0) {
    dropDtResc = rows1.every((r) => {
      const v = r[iDtResc];
      return v === null || v === undefined || String(v).trim() === "";
    });
  }

  // Build final headers + rows (with QTD after Valor, optionally drop Dt_rescisão)
  const finalHeaders: string[] = [];
  const keepIdx: number[] = [];
  headers.forEach((h, i) => {
    if (dropDtResc && i === iDtResc) return;
    keepIdx.push(i);
    finalHeaders.push(h);
    if (i === iValor) finalHeaders.push("QTD");
  });
  const iValorFinal = finalHeaders.indexOf("Valor");
  const iQtdFinal = iValorFinal >= 0 ? iValorFinal + 1 : -1;

  const finalRows: any[][] = rows1.map((r) => {
    const out: any[] = [];
    keepIdx.forEach((i) => {
      out.push(r[i]);
      if (i === iValor) out.push(1);
    });
    if (iQtdFinal < 0) out.push(1);
    return out;
  });

  // Build output workbook
  const wbOut = new ExcelJS.Workbook();
  const wsOut = wbOut.addWorksheet("RELATORIO BENEFICIARIOS", {
    views: [{ showGridLines: false }],
  });
  wsOut.addRow(finalHeaders);
  finalRows.forEach((r) => wsOut.addRow(r));

  wsOut.eachRow((row) => {
    row.height = 15;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { ...(cell.font || {}), size: 8 };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" },
      };
    });
  });
  const headerRowOut = wsOut.getRow(1);
  headerRowOut.eachCell((cell) => {
    cell.font = { bold: true, size: 8, color: { argb: "FF000000" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  // CNPJ column as text format
  const iCNPJOut = finalHeaders.findIndex((h) => headerKey(h) === "cnpj");
  if (iCNPJOut >= 0) {
    wsOut.getColumn(iCNPJOut + 1).numFmt = "@";
  }
  if (iQtdFinal >= 0) wsOut.getColumn(iQtdFinal + 1).numFmt = "0";
  if (iValorFinal >= 0) wsOut.getColumn(iValorFinal + 1).numFmt = "#,##0.00";

  // Larguras específicas por coluna (fonte 8pt) — evita colunas espremidas
  const WIDTHS: Record<string, number> = {
    "carteirinha": 14,
    "competência": 13,
    "competencia": 13,
    "contr": 8,
    "beneficiário": 38,
    "beneficiario": 38,
    "titularidade": 16,
    "titular": 28,
    "família": 9,
    "familia": 9,
    "dt adesão": 12,
    "dt adesao": 12,
    "matricula": 12,
    "matrícula": 12,
    "fx etária": 10,
    "fx etaria": 10,
    "cpf": 14,
    "dt": 12,
    "dt_rescisão": 12,
    "dt_rescisao": 12,
    "idade": 7,
    "tipo cobrança": 20,
    "tipo cobranca": 20,
    "cnpj": 18,
    "pagador": 28,
    "plano": 28,
    "valor": 11,
    "qtd": 6,
  };
  wsOut.columns.forEach((col, idx) => {
    const header = String(finalHeaders[idx] ?? "").trim().toLowerCase();
    if (WIDTHS[header] != null) {
      col.width = WIDTHS[header];
      return;
    }
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const l = String(cellText(cell)).length;
      if (l > max) max = l;
    });
    // fator 0.9 para fonte 8pt
    col.width = Math.min(Math.max(Math.round(max * 0.9) + 2, 10), 42);
  });


  // Determine key columns in the CLEANED data
  const iPagFinal = finalHeaders.findIndex((h) => headerKey(h) === "pagador");
  const iCNPJFinal = iCNPJOut;
  const iFxFinal = finalHeaders.findIndex((h) => headerKey(h) === "fx etária");
  const iPlanoFinal = finalHeaders.findIndex((h) => headerKey(h) === "plano");
  const iTipoFinal = finalHeaders.findIndex((h) => headerKey(h) === "tipo cobrança");
  const iContrFinal = finalHeaders.findIndex((h) => headerKey(h) === "contr");
  const iCompFinal = finalHeaders.findIndex((h) => /compet/i.test(h));

  // Determine pagador principal (mais linhas)
  let nomePagadorCompleto = "Pagador Desconhecido";
  if (iPagFinal >= 0) {
    const cnt = new Map<string, number>();
    finalRows.forEach((r) => {
      const p = norm(r[iPagFinal]);
      if (p) cnt.set(p, (cnt.get(p) || 0) + 1);
    });
    let max = 0;
    for (const [k, v] of cnt) if (v > max) (max = v), (nomePagadorCompleto = k);
  }
  const partes = nomePagadorCompleto.split(/\s+/);
  const nomePagadorCurto = partes.slice(0, 2).join(" ") || nomePagadorCompleto;

  // Contrato mais frequente
  let contratoStr = "Não encontrado";
  if (iContrFinal >= 0) {
    const cnt = new Map<string, number>();
    finalRows.forEach((r) => {
      if (norm(r[iPagFinal]) !== nomePagadorCompleto) return;
      const c = norm(r[iContrFinal]);
      if (c) cnt.set(c, (cnt.get(c) || 0) + 1);
    });
    let max = 0;
    for (const [k, v] of cnt) if (v > max) (max = v), (contratoStr = k);
  }

  // Competência mais recente (aceita string DD/MM/YYYY ou Date)
  let maxDate: Date | null = null;
  if (iCompFinal >= 0) {
    finalRows.forEach((r) => {
      const v = r[iCompFinal];
      let d: Date | null = null;
      if (v instanceof Date) d = v;
      else if (v != null) {
        const s = String(v).trim();
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let y = parseInt(m[3], 10);
          if (y < 100) y += 2000;
          d = new Date(Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10), 12));
        } else if (s) {
          const tmp = new Date(s);
          if (!isNaN(tmp.getTime())) d = tmp;
        }
      }
      if (d && !isNaN(d.getTime())) {
        if (!maxDate || d > maxDate) maxDate = d;
      }
    });
  }

  const meses = [
    "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
    "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
  ];
  const competenciaStr = maxDate
    ? `${meses[maxDate.getUTCMonth()]}${maxDate.getUTCFullYear()}`
    : "COMPETENCIA-NAO-ENCONTRADA";


  // Build RESUMO
  const wsRes = wbOut.addWorksheet("RESUMO", { views: [{ showGridLines: false }] });
  const usaCNPJ = pagadorTemMultiplosCNPJsArr(finalRows, iPagFinal, iCNPJFinal);
  const keyMainIdx = usaCNPJ && iCNPJFinal >= 0 ? iCNPJFinal : iPagFinal;
  const keyMainLabel = usaCNPJ && iCNPJFinal >= 0 ? "CNPJ" : "Pagador";

  let secondIdx = -1;
  let secondLabel = "";
  if (modo === "prorata") {
    if (iTipoFinal >= 0) {
      secondIdx = iTipoFinal;
      secondLabel = "Tipo Cobrança";
    }
  } else {
    if (iFxFinal >= 0 && haMultiplasModalidadesArr(finalRows, iFxFinal)) {
      secondIdx = iFxFinal;
      secondLabel = "Fx Etária";
    } else if (iPlanoFinal >= 0 && haMultiplasModalidadesArr(finalRows, iPlanoFinal)) {
      secondIdx = iPlanoFinal;
      secondLabel = "Plano";
    }
  }

  const headerRes = [keyMainLabel, ...(secondIdx >= 0 ? [secondLabel] : []), "Soma de QTD", "Soma de Valor"];
  wsRes.addRow(headerRes);

  // Group
  type Agg = { qtd: number; valor: number };
  const grouped = new Map<string, Map<string, Agg>>();
  finalRows.forEach((r) => {
    const k1 = norm(r[keyMainIdx]);
    const k2 = secondIdx >= 0 ? norm(r[secondIdx]) : "__total__";
    if (!grouped.has(k1)) grouped.set(k1, new Map());
    const inner = grouped.get(k1)!;
    if (!inner.has(k2)) inner.set(k2, { qtd: 0, valor: 0 });
    const agg = inner.get(k2)!;
    agg.qtd += Number(r[iQtdFinal]) || 0;
    const vv = typeof r[iValorFinal] === "number" ? r[iValorFinal] : parseFloat(String(r[iValorFinal] ?? "0")) || 0;
    agg.valor += vv;
  });

  let grandQtd = 0;
  let grandVal = 0;
  const keys1 = Array.from(grouped.keys()).sort();
  for (const k1 of keys1) {
    const inner = grouped.get(k1)!;
    let subQ = 0;
    let subV = 0;
    if (secondIdx >= 0) {
      const keys2 = Array.from(inner.keys()).sort();
      // Main row (subtotal placeholder to be filled)
      const mainRowRef = wsRes.addRow([k1, "", 0, 0]);
      for (const k2 of keys2) {
        const a = inner.get(k2)!;
        wsRes.addRow(["", k2, a.qtd, a.valor]);
        subQ += a.qtd;
        subV += a.valor;
      }
      mainRowRef.getCell(3).value = subQ;
      mainRowRef.getCell(4).value = subV;
      mainRowRef.font = { bold: true, size: 9 };
    } else {
      const a = inner.get("__total__")!;
      wsRes.addRow([k1, a.qtd, a.valor]);
      subQ = a.qtd;
      subV = a.valor;
    }
    grandQtd += subQ;
    grandVal += subV;
  }
  const totalRow = wsRes.addRow(
    secondIdx >= 0 ? ["Total Geral", "", grandQtd, grandVal] : ["Total Geral", grandQtd, grandVal],
  );
  totalRow.font = { bold: true, size: 9 };

  wsRes.getRow(1).font = { bold: true, size: 9, color: { argb: "FF000000" } };
  wsRes.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };

  const qtdCol = secondIdx >= 0 ? 3 : 2;
  const valCol = secondIdx >= 0 ? 4 : 3;
  wsRes.getColumn(qtdCol).numFmt = "0";
  wsRes.getColumn(valCol).numFmt = "#,##0.00";
  wsRes.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const l = String(cellText(cell)).length;
      if (l > max) max = l;
    });
    col.width = Math.min(Math.max(max + 2, 10), 40);
  });
  wsRes.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" },
      };
      if (!cell.font) cell.font = { size: 9 };
      else cell.font = { ...cell.font, size: cell.font.size ?? 9 };
    });
  });

  // Contrato row
  const contratoRow = wsRes.addRow([]);
  const cRow = wsRes.addRow([`Contrato: ${contratoStr}`]);
  cRow.getCell(1).font = { bold: true, size: 10 };
  void contratoRow;

  const nomeLimpo = nomePagadorCurto.replace(/[\\/:*?"<>|]/g, "");
  const filename = `FATURAMENTO ${nomeLimpo} - ${competenciaStr}.xlsx`;

  const out = await wbOut.xlsx.writeBuffer();
  return {
    blob: new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  };
}

function haMultiplasModalidadesArr(rows: any[][], colIdx: number): boolean {
  const s = new Set<string>();
  for (const r of rows) {
    const v = lower(r[colIdx]);
    if (v) s.add(v);
    if (s.size > 1) return true;
  }
  return false;
}

function pagadorTemMultiplosCNPJsArr(rows: any[][], iPag: number, iCNPJ: number): boolean {
  if (iPag < 0 || iCNPJ < 0) return false;
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const p = norm(r[iPag]);
    const c = norm(r[iCNPJ]);
    if (!p || !c) continue;
    if (!map.has(p)) map.set(p, new Set());
    map.get(p)!.add(c);
    if (map.get(p)!.size > 1) return true;
  }
  return false;
}
