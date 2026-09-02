import type { FinanceiroRow } from "@/components/financeiro/FinanceiroTable";
import { labelStatusFinanceiro, formatMesReferencia, type StatusFinanceiro } from "@/lib/financeiro-utils";
import { formatDateBR } from "@/lib/date-utils";
import samelIcon from "@/assets/samel-icon.png.asset.json";

const VERDE: [number, number, number] = [50, 169, 118];

const ORDEM_STATUS: StatusFinanceiro[] = [
  "Enviada",
  "Nota emitida",
  "Aguardando validação",
  "Faturado",
  "Em faturamento",
  "Fora do prazo",
  "Aguardando nota",
  "Pendente",
];

const pct = (n: number, total: number) =>
  total > 0 ? `${((n / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";

async function carregarLogo(): Promise<string | null> {
  try {
    const resp = await fetch(samelIcon.url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Relatório analítico de faturamento (PDF) — usa exatamente as linhas
 * já filtradas na aba Faturamento (competência, período, status, busca...).
 */
export async function gerarRelatorioAnaliseFaturamento(
  rows: FinanceiroRow[],
  mes: string,
  subtituloFiltros?: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const hoje = new Date().toLocaleString("pt-BR");
  const logoData = await carregarLogo();
  const total = rows.length;

  const contagem = new Map<StatusFinanceiro, number>();
  rows.forEach((r) => contagem.set(r.status, (contagem.get(r.status) ?? 0) + 1));

  const emitidas = (contagem.get("Enviada") ?? 0) + (contagem.get("Nota emitida") ?? 0);
  const enviadas = contagem.get("Enviada") ?? 0;
  const emAndamento =
    (contagem.get("Em faturamento") ?? 0) +
    (contagem.get("Faturado") ?? 0) +
    (contagem.get("Aguardando validação") ?? 0);
  const semAcao =
    (contagem.get("Pendente") ?? 0) +
    (contagem.get("Aguardando nota") ?? 0) +
    (contagem.get("Fora do prazo") ?? 0);

  function drawHeader() {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, pageW, 64, "F");
    const textX = logoData ? 108 : 40;
    if (logoData) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(32, 12, 56, 40, 6, 6, "F");
      doc.addImage(logoData, "PNG", 44, 17, 32, 30, undefined, "FAST");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Análise de faturamento por status", textX, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 244, 236);
    doc.text(
      `Competência ${formatMesReferencia(mes)} · SIGA · Emitido em ${hoje}`,
      textX,
      48,
    );
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(String(total), pageW - 40, 32, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("contratos", pageW - 40, 46, { align: "right" });
  }

  drawHeader();

  doc.setTextColor(75, 85, 99);
  doc.setFontSize(9);
  if (subtituloFiltros) doc.text(subtituloFiltros, 40, 84);

  let y = subtituloFiltros ? 100 : 88;

  // Resumo executivo
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Qtde", "% do total"]],
    body: [
      ["Contratos analisados", String(total), "100,0%"],
      ["Notas emitidas (emitida + enviada)", String(emitidas), pct(emitidas, total)],
      ["Notas enviadas ao cliente", String(enviadas), pct(enviadas, total)],
      ["Em andamento (faturando/faturado/validação)", String(emAndamento), pct(emAndamento, total)],
      ["Sem ação (pendente/aguardando/fora do prazo)", String(semAcao), pct(semAcao, total)],
    ],
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 6, textColor: [17, 24, 39] },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [234, 246, 240] },
    columnStyles: {
      0: { cellWidth: 260, fontStyle: "bold" },
      1: { cellWidth: 60, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
    },
    margin: { left: 40, right: 40, top: 80, bottom: 40 },
    tableWidth: 400,
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // Distribuição por status
  autoTable(doc, {
    startY: y,
    head: [["Status", "Contratos", "% do total"]],
    body: ORDEM_STATUS.map((s) => [
      labelStatusFinanceiro(s),
      String(contagem.get(s) ?? 0),
      pct(contagem.get(s) ?? 0, total),
    ]),
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 6, textColor: [17, 24, 39] },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [234, 246, 240] },
    columnStyles: {
      0: { cellWidth: 180, fontStyle: "bold" },
      1: { cellWidth: 80, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
    },
    margin: { left: 40, right: 40, top: 80, bottom: 40 },
    tableWidth: 340,
  });

  // O que falta
  const faltantes = rows.filter((r) => r.status !== "Enviada" && r.status !== "Nota emitida");
  if (faltantes.length > 0) {
    doc.addPage("a4", "landscape");
    drawHeader();
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`O que falta emitir — ${faltantes.length} contrato(s)`, 40, 86);

    autoTable(doc, {
      startY: 96,
      head: [["Empresa", "Contrato", "Período", "Status", "Responsável", "Iniciado em", "Vencimento"]],
      body: faltantes.map((r) => [
        r.empresa_nome,
        r.empresa_codigo || "—",
        r.periodo_corte || "—",
        labelStatusFinanceiro(r.status),
        r.faturamento_iniciado_por_nome || r.responsavel || "—",
        formatDateBR(r.faturamento_iniciado_em) || "—",
        formatDateBR(r.data_vencimento) || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 4, textColor: [17, 24, 39] },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [234, 246, 240] },
      columnStyles: {
        0: { cellWidth: 230 },
        1: { cellWidth: 60 },
        2: { cellWidth: 90 },
        3: { cellWidth: 90 },
        4: { cellWidth: 120 },
        5: { cellWidth: 70, halign: "center" },
        6: { cellWidth: 70, halign: "center" },
      },
      margin: { left: 40, right: 40, top: 80, bottom: 40 },
    });
  }

  // Detalhamento completo
  doc.addPage("a4", "landscape");
  drawHeader();
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Detalhamento — ${total} contrato(s)`, 40, 86);

  autoTable(doc, {
    startY: 96,
    head: [["#", "Empresa", "Contrato", "Período", "Status", "Envio nota", "Vencimento", "Anexos"]],
    body: rows.map((r, i) => [
      String(i + 1),
      r.empresa_nome,
      r.empresa_codigo || "—",
      r.periodo_corte || "—",
      labelStatusFinanceiro(r.status),
      formatDateBR(r.data_envio_nota) || "—",
      formatDateBR(r.data_vencimento) || "—",
      String(r.anexos_count ?? 0),
    ]),
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 4, textColor: [17, 24, 39] },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [234, 246, 240] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 240 },
      2: { cellWidth: 60 },
      3: { cellWidth: 100 },
      4: { cellWidth: 95 },
      5: { cellWidth: 70, halign: "center" },
      6: { cellWidth: 70, halign: "center" },
      7: { cellWidth: 50, halign: "center" },
    },
    margin: { left: 40, right: 40, top: 80, bottom: 40 },
  });

  // Rodapé com paginação
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 140);
    doc.text(`Página ${p} de ${pages}`, pageW - 40, pageH - 20, { align: "right" });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`analise_faturamento_${mes}_${stamp}.pdf`);
}
