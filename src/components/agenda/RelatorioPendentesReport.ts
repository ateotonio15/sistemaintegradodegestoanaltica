import type { PendenteProcedimentoItem } from "@/lib/agendaCirurgicaApi";
import { linhasPendentes } from "@/lib/agenda-pendentes";

export function printRelatorioPendentes({ dados, filtros, mediaDias, total }: { dados: PendenteProcedimentoItem[]; filtros: string; mediaDias: string; total: number }) {
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) throw new Error("Permita pop-ups para imprimir o relatório.");
  const escape = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
  const rows = linhasPendentes(dados);
  const css = getComputedStyle(document.documentElement);
  const primary = css.getPropertyValue("--primary");
  const foreground = css.getPropertyValue("--primary-foreground");
  const muted = css.getPropertyValue("--secondary");
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><title>Procedimentos Pendentes — Samel</title><style>@page{size:A4 landscape;margin:10mm}body{font:11px Arial;letter-spacing:0}header{background:hsl(${primary});color:hsl(${foreground});padding:16px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:7px;border-bottom:1px solid hsl(${muted})}tbody tr:nth-child(even){background:hsl(${muted})}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><header><h1>Samel · Procedimentos Pendentes por Empresa</h1></header><p>${escape(filtros)}</p><p>Total: ${total} · Média histórica: ${escape(mediaDias)} · Em risco (≤ 2d): ${dados.filter(d => d.dias_para_execucao <= 2).length}</p><table><thead><tr>${Object.keys(rows[0] ?? { Paciente: "", Procedimento: "", Empresa: "", CNPJ: "", "Data Agendada": "", "Agendado em": "", "Dias p/ Execução": "", Atendimento: "" }).map(k => `<th>${escape(k)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${Object.values(row).map(v => `<td>${escape(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 300);
}