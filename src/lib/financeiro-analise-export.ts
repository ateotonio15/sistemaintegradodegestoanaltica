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

export async function exportarAnaliseExcel(data: AnaliseCompletaExport) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CS Control";
  wb.created = new Date();

  // Resumo
  const ws = wb.addWorksheet("Resumo");
  ws.columns = [{ width: 32 }, { width: 50 }];
  ws.addRow([data.titulo]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["Empresa", data.empresa]);
  ws.addRow(["CNPJ", data.cnpj || "—"]);
  ws.addRow(["Competência", data.competencia]);
  ws.addRow(["Período", data.periodo]);
  ws.addRow(["NFS-e", data.documentos.nfNumero || "—"]);
  ws.addRow(["Tomador", data.documentos.tomador || "—"]);
  ws.addRow(["Status geral", data.statusGeral]);
  ws.addRow(["Gerado em", data.geradoEm]);
  ws.addRow(["Gerado por", data.geradoPor || "—"]);
  ws.addRow([]);
  ws.addRow(["Total de itens", data.resumo.totalItens]);
  ws.addRow(["OK", data.resumo.ok]);
  ws.addRow(["Divergências", data.resumo.divergencias]);
  ws.addRow(["Alertas", data.resumo.alertas]);
  ws.addRow([]);
  ws.addRow(["Mensagem", data.resumo.mensagem]);

  // Documentos
  const wsDoc = wb.addWorksheet("Etapa 1 - Documentos");
  wsDoc.columns = [{ width: 32 }, { width: 60 }];
  wsDoc.addRow(["Item", "Valor"]).font = { bold: true };
  wsDoc.addRow(["Excel encontrado", data.documentos.excelEncontrado ? "Sim" : "Não"]);
  wsDoc.addRow(["PDF encontrado", data.documentos.pdfEncontrado ? "Sim" : "Não"]);
  wsDoc.addRow(["Nome do Excel", data.documentos.nomeExcel || "—"]);
  wsDoc.addRow(["Nome do PDF", data.documentos.nomePdf || "—"]);
  wsDoc.addRow(["NFS-e", data.documentos.nfNumero || "—"]);
  wsDoc.addRow(["Tomador", data.documentos.tomador || "—"]);
  wsDoc.addRow(["CNPJ", data.documentos.cnpj || "—"]);
  wsDoc.addRow(["Status", data.documentos.status]);

  // Categorias
  const wsCat = wb.addWorksheet("Etapa 2 - Excel x Histórico");
  wsCat.columns = [
    { header: "Categoria", width: 26 },
    { header: "Valor no Excel", width: 18 },
    { header: "Valor no histórico da NFS-e", width: 26 },
    { header: "Diferença", width: 14 },
    { header: "Status", width: 14 },
    { header: "Observação", width: 40 },
  ];
  wsCat.getRow(1).font = { bold: true };
  data.categorias.forEach((c) => {
    wsCat.addRow([
      c.categoria,
      c.excel == null ? "—" : c.excel,
      c.pdf == null ? "—" : c.pdf,
      c.diferenca == null ? "—" : c.diferenca,
      c.status,
      c.observacao || "",
    ]);
  });

  // Valor do serviço
  const wsServ = wb.addWorksheet("Etapa 3 - Valor do Serviço");
  wsServ.columns = [
    { header: "Origem", width: 36 },
    { header: "Valor encontrado", width: 22 },
    { header: "Status", width: 16 },
  ];
  wsServ.getRow(1).font = { bold: true };
  data.servico.forEach((s) =>
    wsServ.addRow([s.origem, s.valor == null ? "—" : s.valor, s.status]),
  );

  // Resultado
  const wsRes = wb.addWorksheet("Etapa 5 - Resultado");
  wsRes.columns = [{ width: 80 }];
  wsRes.addRow(["Status geral: " + data.statusGeral]).font = { bold: true };
  wsRes.addRow([data.resumo.mensagem]);
  wsRes.addRow([]);
  if (data.divergenciasLista.length > 0) {
    wsRes.addRow(["Divergências encontradas:"]).font = { bold: true };
    data.divergenciasLista.forEach((d) => wsRes.addRow(["• " + d]));
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
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
