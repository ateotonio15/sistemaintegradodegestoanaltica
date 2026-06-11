import ExcelJS from "exceljs";
import { centavosToReais, labelStatusReajusteFluxo, nomeMes } from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/date-utils";

export type ReajusteRowExport = {
  empresa: string;
  contrato?: string | null;
  cnpj?: string | null;
  responsavel?: string | null;
  ano: number;
  mesReajuste: number | null;
  dataAplicacao?: string | null;
  percentual?: number | null;
  valorAtual?: number | null;
  valorReajustado?: number | null;
  retroativo?: number | null;
  mesesRetro?: number | null;
  valorFinal?: number | null;
  status?: string | null;
};

export async function exportReajustesExcel(rows: ReajusteRowExport[], filename = "reajustes.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reajustes");
  ws.columns = [
    { header: "Empresa", key: "empresa", width: 40 },
    { header: "Contrato", key: "contrato", width: 16 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Responsável", key: "responsavel", width: 24 },
    { header: "Ano", key: "ano", width: 8 },
    { header: "Mês Reajuste", key: "mes", width: 14 },
    { header: "Data Aplicação", key: "dataAplicacao", width: 14 },
    { header: "%", key: "percentual", width: 10 },
    { header: "Valor Atual", key: "valorAtual", width: 16 },
    { header: "Valor Reajustado", key: "valorReajustado", width: 18 },
    { header: "Meses Retroativos", key: "mesesRetro", width: 14 },
    { header: "Retroativo", key: "retroativo", width: 16 },
    { header: "Valor Final", key: "valorFinal", width: 16 },
    { header: "Status", key: "status", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    ws.addRow({
      empresa: r.empresa,
      contrato: r.contrato || "—",
      cnpj: r.cnpj || "—",
      responsavel: r.responsavel || "—",
      ano: r.ano,
      mes: nomeMes(r.mesReajuste),
      dataAplicacao: r.dataAplicacao ? formatDateBR(r.dataAplicacao) : "—",
      percentual: r.percentual != null ? Number(r.percentual) / 100 : null,
      valorAtual: centavosToReais(r.valorAtual ?? 0),
      valorReajustado: centavosToReais(r.valorReajustado ?? 0),
      mesesRetro: r.mesesRetro ?? 0,
      retroativo: centavosToReais(r.retroativo ?? 0),
      valorFinal: centavosToReais(r.valorFinal ?? 0),
      status: labelStatusReajusteFluxo(r.status as any),
    });
  });

  ws.getColumn("percentual").numFmt = "0.00%";
  ["valorAtual", "valorReajustado", "retroativo", "valorFinal"].forEach((k) => {
    ws.getColumn(k).numFmt = '"R$" #,##0.00';
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const esc = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function exportReajustesPDF(rows: ReajusteRowExport[], titulo = "Relatório de Reajustes") {
  const win = window.open("", "_blank");
  if (!win) return;
  const formatBRL = (c?: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavosToReais(c ?? 0));

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}
    .meta{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f5f5f5}
    tr:nth-child(even) td{background:#fafafa}
    .right{text-align:right}
    @media print{.noprint{display:none}}
  </style></head><body>
  <h1>${esc(titulo)}</h1>
  <div class="meta">Gerado em ${esc(new Date().toLocaleString("pt-BR"))} · ${rows.length} registros</div>
  <button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:6px 12px;cursor:pointer">Imprimir / Salvar PDF</button>
  <table>
    <thead><tr>
      <th>Empresa</th><th>Contrato</th><th>Mês</th><th class="right">%</th>
      <th class="right">Valor Atual</th><th class="right">Reajustado</th>
      <th class="right">Retroativo</th><th class="right">Final</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>
        <td>${esc(r.empresa)}</td>
        <td>${esc(r.contrato || "—")}</td>
        <td>${esc(nomeMes(r.mesReajuste))}</td>
        <td class="right">${r.percentual != null ? esc(Number(r.percentual).toFixed(2).replace(".", ",") + "%") : "—"}</td>
        <td class="right">${esc(formatBRL(r.valorAtual))}</td>
        <td class="right">${esc(formatBRL(r.valorReajustado))}</td>
        <td class="right">${esc(formatBRL(r.retroativo))}</td>
        <td class="right"><strong>${esc(formatBRL(r.valorFinal))}</strong></td>
        <td>${esc(labelStatusReajusteFluxo(r.status as any))}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

