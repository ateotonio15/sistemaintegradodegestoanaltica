import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExecKpis, CampanhaDist, EmpresaTop, TriagemMock } from "./exec-mock-julho-2026";

const TEAL = "#004d40";
const ACCENT = "#1b998b";
const SLATE = "#0f172a";

export interface ExecPdfInput {
  mes: number; ano: number;
  kpis: ExecKpis;
  campanhas: CampanhaDist[];
  topEmpresas: EmpresaTop[];
  triagem: TriagemMock[];
  campanhaEspecial?: "outubro-rosa" | "novembro-azul" | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function exportExecutivePdf(input: ExecPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ===== CAPA =====
  doc.setFillColor(TEAL);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor("#003029");
  doc.rect(0, H - 60, W, 60, "F");

  doc.setTextColor("#a7f3d0");
  doc.setFontSize(10);
  doc.text("SAÚDE OCUPACIONAL · RELATÓRIO EXECUTIVO", 40, 60);

  doc.setTextColor("#ffffff");
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("Gestão de Saúde nas Empresas", 40, 130);

  doc.setFontSize(22);
  doc.setFont("helvetica", "normal");
  doc.text(`${MESES[input.mes - 1]} · ${input.ano}`, 40, 170);

  doc.setFontSize(11);
  doc.setTextColor("#a7f3d0");
  doc.text("Panorama consolidado para a Diretoria Corporativa", 40, 200);

  // KPIs na capa
  const kArr = [
    { label: "Total de Ações", value: input.kpis.totalAcoes },
    { label: "Empresas", value: input.kpis.empresasAtendidas },
    { label: "Palestras", value: input.kpis.palestras },
    { label: "Sinais Vitais", value: input.kpis.sinaisVitais },
    { label: "Média Semanal", value: input.kpis.mediaSemanal },
  ];
  const kw = (W - 80) / kArr.length;
  kArr.forEach((k, i) => {
    const x = 40 + i * kw;
    doc.setFillColor("#ffffff");
    doc.roundedRect(x + 5, H - 200, kw - 10, 90, 8, 8, "F");
    doc.setTextColor(TEAL);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(String(k.value), x + 20, H - 155);
    doc.setFontSize(9);
    doc.setTextColor(SLATE);
    doc.setFont("helvetica", "normal");
    doc.text(k.label.toUpperCase(), x + 20, H - 130);
  });

  doc.setTextColor("#ffffff");
  doc.setFontSize(9);
  doc.text("Confidencial · Uso Interno", 40, H - 25);

  // ===== SLIDE 2 - DISTRIBUIÇÃO =====
  doc.addPage();
  drawHeader(doc, "Distribuição por Campanha", `${MESES[input.mes - 1]}/${input.ano}`);
  autoTable(doc, {
    startY: 130,
    head: [["Campanha", "Ações", "% do Total"]],
    body: input.campanhas.map((c) => {
      const total = input.campanhas.reduce((s, x) => s + x.valor, 0) || 1;
      return [c.nome, String(c.valor), `${((c.valor / total) * 100).toFixed(1)}%`];
    }),
    styles: { fontSize: 12, cellPadding: 10 },
    headStyles: { fillColor: TEAL as any, textColor: "#ffffff" },
    theme: "grid",
    margin: { left: 40, right: 40 },
  });

  // barras simples
  const total = input.campanhas.reduce((s, x) => s + x.valor, 0) || 1;
  let y = (doc as any).lastAutoTable.finalY + 30;
  input.campanhas.forEach((c) => {
    const bw = ((W - 240) * c.valor) / total;
    doc.setFillColor(c.cor);
    doc.roundedRect(180, y, bw, 22, 4, 4, "F");
    doc.setTextColor(SLATE);
    doc.setFontSize(10);
    doc.text(c.nome, 40, y + 15);
    doc.text(String(c.valor), 180 + bw + 8, y + 15);
    y += 32;
  });

  // ===== SLIDE 3 - TOP EMPRESAS =====
  doc.addPage();
  drawHeader(doc, "Top Empresas Atendidas", "Ranking por número de ações");
  autoTable(doc, {
    startY: 130,
    head: [["#", "Empresa", "Ações"]],
    body: input.topEmpresas.map((e, i) => [i + 1, e.nome, e.acoes]),
    styles: { fontSize: 12, cellPadding: 8 },
    headStyles: { fillColor: ACCENT as any, textColor: "#ffffff" },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  // ===== SLIDE 4 - TRIAGEM =====
  doc.addPage();
  drawHeader(doc, "Sinais Vitais & Triagem", "Alterações clínicas por empresa");
  autoTable(doc, {
    startY: 130,
    head: [["Empresa", "Atendidos", "PA Alta", "Glicemia Alta", "IMC Alto", "Tabagismo"]],
    body: input.triagem.map((t) => [t.empresa, t.atendidos, t.pa_alta, t.gli_alta, t.imc_alto, t.tabagismo]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: TEAL as any, textColor: "#ffffff" },
    theme: "grid",
    margin: { left: 40, right: 40 },
  });

  // ===== SLIDE ESPECIAL =====
  if (input.campanhaEspecial === "outubro-rosa") {
    doc.addPage();
    doc.setFillColor("#fdf2f8"); doc.rect(0, 0, W, H, "F");
    doc.setTextColor("#be185d"); doc.setFontSize(14);
    doc.text("CAMPANHA DO MÊS", 40, 60);
    doc.setFontSize(32); doc.setFont("helvetica", "bold");
    doc.text("Outubro Rosa", 40, 100);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE);
    doc.text("Prevenção ao câncer de mama e engajamento feminino.", 40, 130);
  }
  if (input.campanhaEspecial === "novembro-azul") {
    doc.addPage();
    doc.setFillColor("#eff6ff"); doc.rect(0, 0, W, H, "F");
    doc.setTextColor("#1e3a8a"); doc.setFontSize(14);
    doc.text("CAMPANHA DO MÊS", 40, 60);
    doc.setFontSize(32); doc.setFont("helvetica", "bold");
    doc.text("Novembro Azul", 40, 100);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE);
    doc.text("Prevenção ao câncer de próstata e saúde do homem.", 40, 130);
  }

  doc.save(`Relatorio-Executivo-Saude-${MESES[input.mes - 1]}-${input.ano}.pdf`);
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(TEAL); doc.rect(0, 0, W, 8, "F");
  doc.setTextColor(SLATE); doc.setFontSize(9);
  doc.text("SAÚDE OCUPACIONAL · RELATÓRIO EXECUTIVO", 40, 40);
  doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.setTextColor(TEAL);
  doc.text(title, 40, 75);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor("#64748b");
  doc.text(subtitle, 40, 95);
}
