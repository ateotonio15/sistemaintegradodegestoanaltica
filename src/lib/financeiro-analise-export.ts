import ExcelJS from "exceljs";
import { formatBRL } from "@/lib/excel-analysis-utils";

export interface CategoriaComparada {
  categoria: string;
  excel: number | null;
  pdf: number | null;
  diferenca: number | null;
  status: string;
  observacao?: string;
}

export interface DocumentoInfo {
  excelEncontrado: boolean;
  pdfEncontrado: boolean;
  nomeExcel: string | null;
  nomePdf: string | null;
  nfNumero: string | null;
  tomador: string | null;
  cnpj: string | null;
  status: string;
}

export interface ConferenciaServico {
  origem: string;
  valor: number | null;
  status: string;
  unidade?: "BRL" | "%";
  observacao?: string;
}

export interface AnaliseCompletaExport {
  titulo: string;
  empresa: string;
  cnpj: string | null;
  competencia: string;
  periodo: string;
  statusGeral: string;
  geradoEm: string;
  geradoPor: string | null;
  documentos: DocumentoInfo;
  categorias: CategoriaComparada[];
  servico: ConferenciaServico[];
  resumo: {
    totalItens: number;
    ok: number;
    divergencias: number;
    alertas: number;
    mensagem: string;
  };
  divergenciasLista: string[];
}

function safeFile(s: string) {
  return s.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 60);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Design tokens =====
const COLOR = {
  brand: "FF0F766E", // teal-700
  brandDark: "FF134E4A",
  brandLight: "FFCCFBF1",
  headerBg: "FF0F172A", // slate-900
  headerFg: "FFFFFFFF",
  zebra: "FFF8FAFC",
  border: "FFE2E8F0",
  ok: "FF16A34A",
  okBg: "FFDCFCE7",
  div: "FFDC2626",
  divBg: "FFFEE2E2",
  warn: "FFB45309",
  warnBg: "FFFEF3C7",
  neutral: "FF475569",
  neutralBg: "FFF1F5F9",
  labelFg: "FF334155",
};

function statusColors(s: string) {
  const k = (s || "").toLowerCase();
  if (k === "ok") return { fg: COLOR.ok, bg: COLOR.okBg };
  if (k.includes("diverg") || k === "erro") return { fg: COLOR.div, bg: COLOR.divBg };
  if (k.includes("aten") || k.includes("pend") || k.includes("alerta"))
    return { fg: COLOR.warn, bg: COLOR.warnBg };
  return { fg: COLOR.neutral, bg: COLOR.neutralBg };
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLOR.border } },
  left: { style: "thin", color: { argb: COLOR.border } },
  right: { style: "thin", color: { argb: COLOR.border } },
  bottom: { style: "thin", color: { argb: COLOR.border } },
};

function applyBorders(ws: ExcelJS.Worksheet, range: string) {
  const [a, b] = range.split(":");
  const start = ws.getCell(a);
  const end = ws.getCell(b);
  for (let r = start.row as number; r <= (end.row as number); r++) {
    for (let c = start.col as number; c <= (end.col as number); c++) {
      ws.getCell(r, c).border = thinBorder;
    }
  }
}

function setTitle(ws: ExcelJS.Worksheet, text: string, span: number, subtitle?: string) {
  ws.mergeCells(1, 1, 1, span);
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font = { name: "Calibri", bold: true, size: 16, color: { argb: COLOR.headerFg } };
  c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brand } };
  ws.getRow(1).height = 32;

  if (subtitle) {
    ws.mergeCells(2, 1, 2, span);
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = { name: "Calibri", italic: true, size: 11, color: { argb: COLOR.headerFg } };
    s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandDark } };
    ws.getRow(2).height = 20;
  }
}

function styleTableHeader(ws: ExcelJS.Worksheet, rowIndex: number, span: number) {
  const row = ws.getRow(rowIndex);
  row.height = 22;
  for (let c = 1; c <= span; c++) {
    const cell = row.getCell(c);
    cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: COLOR.headerFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = thinBorder;
  }
}

function zebraRows(ws: ExcelJS.Worksheet, firstRow: number, lastRow: number, span: number) {
  for (let r = firstRow; r <= lastRow; r++) {
    const isZebra = (r - firstRow) % 2 === 1;
    for (let c = 1; c <= span; c++) {
      const cell = ws.getCell(r, c);
      if (isZebra && !cell.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.zebra } };
      }
      cell.border = thinBorder;
      if (!cell.alignment) cell.alignment = { vertical: "middle", indent: 1 };
    }
  }
}

function paintStatusCell(cell: ExcelJS.Cell) {
  const v = String(cell.value ?? "");
  const { fg, bg } = statusColors(v);
  cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: fg } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = thinBorder;
}

function addInfoRow(ws: ExcelJS.Worksheet, label: string, value: ExcelJS.CellValue) {
  const row = ws.addRow([label, value]);
  row.height = 18;
  row.getCell(1).font = { bold: true, color: { argb: COLOR.labelFg } };
  row.getCell(1).alignment = { vertical: "middle", indent: 1 };
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.neutralBg } };
  row.getCell(2).alignment = { vertical: "middle", indent: 1 };
  row.getCell(1).border = thinBorder;
  row.getCell(2).border = thinBorder;
  return row;
}

export async function exportarAnaliseExcel(data: AnaliseCompletaExport) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CS Control";
  wb.company = "CS Control";
  wb.created = new Date();
  const props: any = wb.properties;
  props.date1904 = false;

  const moneyFmt = '_-R$ * #,##0.00_-;[Red]-R$ * #,##0.00_-;_-R$ * "-"??_-;_-@_-';

  // ============ Resumo ============
  const ws = wb.addWorksheet("Resumo", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 2 }],
    properties: { defaultRowHeight: 16 },
  });
  ws.columns = [{ width: 32 }, { width: 58 }];
  setTitle(ws, data.titulo, 2, "Conferência Excel × Histórico NFS-e × Tributação");

  ws.addRow([]);
  const sec1 = ws.addRow(["INFORMAÇÕES DA NOTA", ""]);
  sec1.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.brandDark } };
  sec1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandLight } };
  ws.mergeCells(sec1.number, 1, sec1.number, 2);
  sec1.getCell(1).alignment = { vertical: "middle", indent: 1 };
  sec1.height = 22;

  addInfoRow(ws, "Empresa", data.empresa);
  addInfoRow(ws, "CNPJ", data.cnpj || "—");
  addInfoRow(ws, "Competência", data.competencia);
  addInfoRow(ws, "Período", data.periodo);
  addInfoRow(ws, "NFS-e", data.documentos.nfNumero || "—");
  addInfoRow(ws, "Tomador", data.documentos.tomador || "—");
  const stRow = addInfoRow(ws, "Status geral", data.statusGeral);
  paintStatusCell(stRow.getCell(2));
  addInfoRow(ws, "Gerado em", data.geradoEm);
  addInfoRow(ws, "Gerado por", data.geradoPor || "—");

  ws.addRow([]);
  const sec2 = ws.addRow(["INDICADORES", ""]);
  sec2.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.brandDark } };
  sec2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandLight } };
  ws.mergeCells(sec2.number, 1, sec2.number, 2);
  sec2.getCell(1).alignment = { vertical: "middle", indent: 1 };
  sec2.height = 22;

  const items = [
    ["Total de itens", data.resumo.totalItens, COLOR.neutral, COLOR.neutralBg],
    ["OK", data.resumo.ok, COLOR.ok, COLOR.okBg],
    ["Divergências", data.resumo.divergencias, COLOR.div, COLOR.divBg],
    ["Alertas", data.resumo.alertas, COLOR.warn, COLOR.warnBg],
  ] as const;
  items.forEach(([label, val, fg, bg]) => {
    const r = addInfoRow(ws, label as string, val as number);
    r.getCell(2).font = { bold: true, size: 12, color: { argb: fg as string } };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg as string } };
    r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
  });

  ws.addRow([]);
  const msgRow = ws.addRow(["Mensagem", data.resumo.mensagem]);
  msgRow.getCell(1).font = { bold: true, color: { argb: COLOR.labelFg } };
  msgRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.neutralBg } };
  msgRow.getCell(1).alignment = { vertical: "top", indent: 1 };
  msgRow.getCell(2).alignment = { vertical: "top", wrapText: true, indent: 1 };
  msgRow.height = 48;
  msgRow.getCell(1).border = thinBorder;
  msgRow.getCell(2).border = thinBorder;

  // ============ Etapa 1 ============
  const wsDoc = wb.addWorksheet("Etapa 1 - Documentos", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  wsDoc.columns = [{ width: 32 }, { width: 70 }];
  setTitle(wsDoc, "Etapa 1 — Documentos analisados", 2);
  wsDoc.addRow([]);
  wsDoc.addRow(["Item", "Valor"]);
  styleTableHeader(wsDoc, 4, 2);
  const docRows: Array<[string, string]> = [
    ["Excel encontrado", data.documentos.excelEncontrado ? "Sim" : "Não"],
    ["PDF encontrado", data.documentos.pdfEncontrado ? "Sim" : "Não"],
    ["Nome do Excel", data.documentos.nomeExcel || "—"],
    ["Nome do PDF", data.documentos.nomePdf || "—"],
    ["NFS-e", data.documentos.nfNumero || "—"],
    ["Tomador", data.documentos.tomador || "—"],
    ["CNPJ", data.documentos.cnpj || "—"],
    ["Status", data.documentos.status],
  ];
  const docStart = 5;
  docRows.forEach((d) => wsDoc.addRow(d));
  zebraRows(wsDoc, docStart, docStart + docRows.length - 1, 2);
  for (let r = docStart; r < docStart + docRows.length; r++) {
    wsDoc.getCell(r, 1).font = { bold: true, color: { argb: COLOR.labelFg } };
  }
  paintStatusCell(wsDoc.getCell(docStart + docRows.length - 1, 2));

  // ============ Etapa 2 ============
  const wsCat = wb.addWorksheet("Etapa 2 - Excel x Histórico", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  wsCat.columns = [
    { width: 30 },
    { width: 20 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 44 },
  ];
  setTitle(wsCat, "Etapa 2 — Conferência Excel × Histórico da NFS-e", 6);
  wsCat.addRow([]);
  wsCat.addRow(["Categoria", "Valor no Excel", "Histórico da NFS-e", "Diferença", "Status", "Observação"]);
  styleTableHeader(wsCat, 4, 6);
  const catStart = 5;
  data.categorias.forEach((c) => {
    const row = wsCat.addRow([
      c.categoria,
      c.excel,
      c.pdf,
      c.diferenca,
      c.status,
      c.observacao || "",
    ]);
    row.getCell(1).font = { bold: true, color: { argb: COLOR.labelFg } };
    [2, 3, 4].forEach((i) => {
      const cell = row.getCell(i);
      if (cell.value == null) cell.value = "—";
      else cell.numFmt = moneyFmt;
      cell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    });
    if (c.diferenca != null && Math.abs(c.diferenca) > 0.01) {
      row.getCell(4).font = { bold: true, color: { argb: COLOR.div } };
    } else if (c.diferenca != null) {
      row.getCell(4).font = { color: { argb: COLOR.ok } };
    }
    paintStatusCell(row.getCell(5));
    row.getCell(6).alignment = { vertical: "middle", wrapText: true, indent: 1 };
  });
  const catEnd = 4 + data.categorias.length;
  zebraRows(wsCat, catStart, catEnd, 6);
  wsCat.autoFilter = { from: { row: 4, column: 1 }, to: { row: catEnd, column: 6 } };

  // ============ Etapa 3 ============
  const wsServ = wb.addWorksheet("Etapa 3 - Conferências", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  wsServ.columns = [{ width: 44 }, { width: 22 }, { width: 16 }, { width: 44 }];
  setTitle(wsServ, "Etapa 3 — Valor do Serviço e Conferência Tributária", 4);
  wsServ.addRow([]);
  wsServ.addRow(["Origem / Item", "Valor encontrado", "Status", "Observação"]);
  styleTableHeader(wsServ, 4, 4);
  const sStart = 5;
  data.servico.forEach((s) => {
    const row = wsServ.addRow([s.origem, s.valor, s.status, s.observacao || ""]);
    row.getCell(1).font = { bold: true, color: { argb: COLOR.labelFg } };
    const vCell = row.getCell(2);
    if (s.valor == null) vCell.value = "—";
    else if (s.unidade === "%") {
      vCell.value = s.valor / 100;
      vCell.numFmt = "0.00%";
    } else {
      vCell.numFmt = moneyFmt;
    }
    vCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    paintStatusCell(row.getCell(3));
    row.getCell(4).alignment = { vertical: "middle", wrapText: true, indent: 1 };
  });
  zebraRows(wsServ, sStart, 4 + data.servico.length, 4);

  // ============ Resultado ============
  const wsRes = wb.addWorksheet("Resultado Final", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 2 }],
  });
  wsRes.columns = [{ width: 100 }];
  setTitle(wsRes, "Resultado Final da Análise", 1);
  wsRes.addRow([]);
  const stCell = wsRes.addRow([`Status geral: ${data.statusGeral}`]).getCell(1);
  stCell.font = { bold: true, size: 13 };
  paintStatusCell(stCell);
  stCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  const msg = wsRes.addRow([data.resumo.mensagem]);
  msg.getCell(1).alignment = { vertical: "top", wrapText: true, indent: 1 };
  msg.height = 36;
  wsRes.addRow([]);
  if (data.divergenciasLista.length > 0) {
    const h = wsRes.addRow(["Divergências encontradas"]);
    h.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.div } };
    h.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.divBg } };
    h.getCell(1).alignment = { vertical: "middle", indent: 1 };
    h.height = 22;
    data.divergenciasLista.forEach((d) => {
      const r = wsRes.addRow(["•  " + d]);
      r.getCell(1).alignment = { vertical: "top", wrapText: true, indent: 1 };
      r.getCell(1).font = { color: { argb: COLOR.labelFg } };
    });
  } else {
    const ok = wsRes.addRow(["Nenhuma divergência identificada. Todos os pontos conferem."]);
    ok.getCell(1).font = { bold: true, color: { argb: COLOR.ok } };
    ok.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.okBg } };
    ok.getCell(1).alignment = { vertical: "middle", indent: 1 };
    ok.height = 22;
  }
  wsRes.addRow([]);
  const foot = wsRes.addRow([
    `Gerado em ${data.geradoEm}${data.geradoPor ? ` por ${data.geradoPor}` : ""} • CS Control`,
  ]);
  foot.getCell(1).font = { italic: true, color: { argb: COLOR.neutral }, size: 10 };

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `analise-completa-${safeFile(data.empresa)}-${safeFile(data.competencia)}.xlsx`,
  );
}

export function exportarAnalisePDF(data: AnaliseCompletaExport) {
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return;
  const num = (v: number | null) => (v == null ? "—" : formatBRL(v));
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      OK: "#16a34a",
      Divergente: "#dc2626",
      Atenção: "#f59e0b",
      Erro: "#dc2626",
      "Não analisado": "#6b7280",
      Pendente: "#f59e0b",
    };
    const c = map[s] || "#374151";
    return `<span style="background:${c}1a;color:${c};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid ${c}40">${s}</span>`;
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${data.titulo}</title>
<style>
*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#0f172a;padding:32px;max-width:1000px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
.sub{color:#64748b;font-size:13px;margin-bottom:16px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 16px}
.card{border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px}.card .l{font-size:11px;color:#64748b;text-transform:uppercase}.card .v{font-size:14px;font-weight:600;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}th{background:#f8fafc}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.diverg{color:#dc2626;font-weight:600}.ok{color:#16a34a}
.footer{margin-top:32px;font-size:11px;color:#94a3b8}
@media print{body{padding:16px}}
</style></head><body>
<h1>${data.titulo}</h1>
<div class="sub">Conferência entre Excel, histórico da NFS-e e informações tributárias da nota fiscal.</div>
<div class="cards">
  <div class="card"><div class="l">Empresa</div><div class="v">${data.empresa}</div></div>
  <div class="card"><div class="l">CNPJ</div><div class="v">${data.cnpj || "—"}</div></div>
  <div class="card"><div class="l">NFS-e</div><div class="v">${data.documentos.nfNumero || "—"}</div></div>
  <div class="card"><div class="l">Competência</div><div class="v">${data.competencia} • ${data.periodo}</div></div>
  <div class="card"><div class="l">Valor total do Excel</div><div class="v">${num(
    data.servico.find((s) => s.origem.toLowerCase().includes("excel"))?.valor ?? null,
  )}</div></div>
  <div class="card"><div class="l">Valor do Serviço (NFS-e)</div><div class="v">${num(
    data.servico.find((s) => s.origem.toLowerCase().includes("serviço"))?.valor ?? null,
  )}</div></div>
  <div class="card"><div class="l">Valor líquido (NFS-e)</div><div class="v">${num(
    data.servico.find((s) => s.origem.toLowerCase().includes("líquido"))?.valor ?? null,
  )}</div></div>
  <div class="card"><div class="l">Status geral</div><div class="v">${statusBadge(data.statusGeral)}</div></div>
</div>

<h2>Etapa 1 — Documentos</h2>
<table>
<tr><th>Excel encontrado</th><td>${data.documentos.excelEncontrado ? "Sim" : "Não"}</td><th>PDF encontrado</th><td>${data.documentos.pdfEncontrado ? "Sim" : "Não"}</td></tr>
<tr><th>Arquivo Excel</th><td>${data.documentos.nomeExcel || "—"}</td><th>Arquivo PDF</th><td>${data.documentos.nomePdf || "—"}</td></tr>
<tr><th>NFS-e</th><td>${data.documentos.nfNumero || "—"}</td><th>Tomador</th><td>${data.documentos.tomador || "—"}</td></tr>
<tr><th>CNPJ</th><td colspan="3">${data.documentos.cnpj || "—"}</td></tr>
<tr><th>Status</th><td colspan="3">${statusBadge(data.documentos.status)}</td></tr>
</table>

<h2>Etapa 2 — Conferência Excel x Histórico da NFS-e</h2>
<table>
<thead><tr><th>Categoria</th><th>Valor no Excel</th><th>Valor no histórico da NFS-e</th><th>Diferença</th><th>Status</th><th>Observação</th></tr></thead>
<tbody>
${data.categorias
  .map(
    (c) => `<tr>
<td>${c.categoria}</td>
<td class="num">${num(c.excel)}</td>
<td class="num">${num(c.pdf)}</td>
<td class="num ${c.diferenca && Math.abs(c.diferenca) > 0.01 ? "diverg" : "ok"}">${num(c.diferenca)}</td>
<td>${statusBadge(c.status)}</td>
<td>${c.observacao || ""}</td>
</tr>`,
  )
  .join("")}
</tbody></table>

<h2>Etapa 3 — Conferência do Valor do Serviço</h2>
<table>
<thead><tr><th>Origem</th><th>Valor encontrado</th><th>Status</th></tr></thead>
<tbody>
${data.servico
  .map((s) => `<tr><td>${s.origem}</td><td class="num">${num(s.valor)}</td><td>${statusBadge(s.status)}</td></tr>`)
  .join("")}
</tbody></table>

<h2>Etapa 5 — Resultado Final</h2>
<p><strong>${data.resumo.mensagem}</strong></p>
<table>
<tr><th>Total de itens analisados</th><td>${data.resumo.totalItens}</td>
<th>OK</th><td>${data.resumo.ok}</td>
<th>Divergências</th><td>${data.resumo.divergencias}</td>
<th>Alertas</th><td>${data.resumo.alertas}</td></tr>
</table>
${
  data.divergenciasLista.length > 0
    ? `<h2>Divergências encontradas</h2><ul>${data.divergenciasLista.map((d) => `<li>${d}</li>`).join("")}</ul>`
    : ""
}

<div class="footer">Gerado em ${data.geradoEm}${data.geradoPor ? ` por ${data.geradoPor}` : ""} • CS Control</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}
