import * as XLSX from "xlsx";
import type { Triagem, AcaoSaude } from "../hooks/useSaudeEmpresas";
import { classificarImc, classificarPa, classificarGlicemia, PA_ALTERADAS } from "./saude-rules";
import bgCapaAsset from "@/assets/saude_bg_capa.png.asset.json";
import bgConteudoAsset from "@/assets/saude_bg_conteudo.png.asset.json";

async function fetchDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ============================================================
// Paleta corporativa (fixa)
// ============================================================
const COLORS = {
  NAVY: "1B3A4B",
  GREEN: "2C5F2D",
  RED: "C0392B",
  AMBER: "E1A500",
  GREY: "6B7280",
  LIGHT: "F4F6F8",
  WHITE: "FFFFFF",
  BORDER: "E5E7EB",
} as const;

// Zona segura (evita logos/rodapés dos templates)
const SAFE = { x: 0.55, y: 1.9, w: 12.23, h: 4.3 } as const;

function safeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 80);
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

// ============================================================
// EXCEL (mantido)
// ============================================================
export function exportTriagensExcel(acao: AcaoSaude, triagens: Triagem[]) {
  const empresaNome = acao.empresa?.nome ?? "empresa";
  const rows = triagens.map((t) => ({
    Nome: t.nome,
    CPF: t.cpf ?? "",
    Idade: t.idade ?? "",
    Sexo: t.sexo ?? "",
    Setor: t.setor ?? "",
    Peso: t.peso_kg ?? "",
    Altura: t.altura_cm ?? "",
    IMC: t.imc ?? "",
    "Classif. IMC": classificarImc(t.imc ?? undefined) ?? "",
    PAS: t.pas_mmhg ?? "",
    PAD: t.pad_mmhg ?? "",
    "Classif. PA": t.classificacao_pa ?? "",
    FC: t.freq_cardiaca ?? "",
    SatO2: t.sat_o2 ?? "",
    Glicemia: t.glicemia_mg_dl ?? "",
    Jejum: t.jejum ? "Sim" : "Não",
    "Classif. Glicemia": t.classificacao_glicemia ?? "",
    HAS: t.tem_has ? "Sim" : "Não",
    DM: t.tem_dm ? "Sim" : "Não",
    Risco: t.risco_geral ?? "",
    Recomendação: t.recomendacao ?? "",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Triagens");
  const fname = `triagens_${safeName(empresaNome)}_${acao.data_acao}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ============================================================
// HELPERS DE LAYOUT
// ============================================================
function slideTitle(slide: any, titulo: string, subtitulo?: string) {
  // Largura limitada para não sobrepor os logos no canto superior direito do template
  slide.addText(titulo, {
    x: SAFE.x, y: 0.7, w: 8.6, h: 0.5,
    fontSize: 26, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: SAFE.x, y: 1.2, w: 8.6, h: 0.35,
      fontSize: 13, color: COLORS.GREEN, fontFace: "Calibri",
    });
  }
}


function kpiCard(
  slide: any,
  x: number, y: number, w: number, h: number,
  label: string, valor: string | number, cor: string, sub?: string,
) {
  const pptx = slide;
  // Barra vertical
  slide.addShape("rect", {
    x, y, w: 0.1, h,
    fill: { color: cor }, line: { color: cor },
  });
  // Corpo do card
  slide.addShape("roundRect", {
    x: x + 0.1, y, w: w - 0.1, h,
    fill: { color: COLORS.WHITE },
    line: { color: COLORS.BORDER, width: 0.75 },
    rectRadius: 0.06,
  });
  // Label
  slide.addText(label.toUpperCase(), {
    x: x + 0.25, y: y + 0.1, w: w - 0.35, h: 0.3,
    fontSize: 10, bold: true, color: COLORS.GREY, charSpacing: 2, fontFace: "Calibri",
  });
  // Valor (tamanho dinâmico)
  const strVal = String(valor);
  const size = strVal.length <= 3 ? 42 : strVal.length <= 5 ? 36 : 30;
  slide.addText(strVal, {
    x: x + 0.25, y: y + 0.45, w: w - 0.35, h: h - 0.9,
    fontSize: size, bold: true, color: cor, fontFace: "Calibri",
    valign: "middle",
  });
  if (sub) {
    slide.addText(sub, {
      x: x + 0.25, y: y + h - 0.4, w: w - 0.35, h: 0.3,
      fontSize: 10, color: COLORS.GREY, fontFace: "Calibri",
    });
  }
}

function painel(slide: any, x: number, y: number, w: number, h: number, titulo: string) {
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: COLORS.WHITE },
    line: { color: COLORS.BORDER, width: 0.75 },
    rectRadius: 0.08,
  });
  slide.addText(titulo, {
    x: x + 0.25, y: y + 0.15, w: w - 0.5, h: 0.4,
    fontSize: 13, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
}

// ============================================================
// EXPORT PRINCIPAL — PPTX EXECUTIVO
// ============================================================
export async function exportRelatorioPptx(acao: AcaoSaude, triagens: Triagem[]) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.title = `Relatório de Saúde - ${acao.empresa?.nome ?? ""}`;

  // Plano de fundo (template Samel — Programa Saúde nas Empresas)
  const [bgCapa, bgConteudo] = await Promise.all([
    fetchDataUri(bgCapaAsset.url),
    fetchDataUri(bgConteudoAsset.url),
  ]);
  const capaBg = { data: bgCapa } as const;
  const conteudoBg = { data: bgConteudo } as const;


  const empresaNome = (acao.empresa?.nome ?? "Empresa").toUpperCase();
  const dataBR = formatDateBR(acao.data_acao);

  // ----- Cálculos -----
  const total = triagens.length;

  const paCounts = { Normal: 0, "Pré-Hipertensão": 0, "HA Estágio 1": 0, "HA Estágio 2": 0, "HA Estágio 3": 0, "Não realizado": 0 };
  const gliCounts = { Normal: 0, "Pré-Diabetes": 0, "Alterada pós-prandial": 0, Diabetes: 0, "Não realizado": 0 };

  triagens.forEach((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    paCounts[pa]++;
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    if (gli) gliCounts[gli]++;
    else gliCounts["Não realizado"]++;
  });

  const paAlt = paCounts["Pré-Hipertensão"] + paCounts["HA Estágio 1"] + paCounts["HA Estágio 2"] + paCounts["HA Estágio 3"];
  const paNormal = paCounts["Normal"];
  const paNR = paCounts["Não realizado"];
  const gliAlt = gliCounts["Pré-Diabetes"] + gliCounts["Alterada pós-prandial"] + gliCounts["Diabetes"];
  const gliNormal = gliCounts["Normal"];
  const gliNR = gliCounts["Não realizado"];
  const encaminhamentos = triagens.filter((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    return PA_ALTERADAS.includes(pa) || (gli && gli !== "Normal");
  }).length;

  // ============================================================
  // Slide 1 — CAPA
  // ============================================================
  const s1 = pptx.addSlide();
  s1.background = { color: COLORS.NAVY };
  s1.addShape("rect", { x: 0, y: 3.2, w: 13.333, h: 1.1, fill: { color: COLORS.LIGHT }, line: { color: COLORS.LIGHT } });
  s1.addText("RELATÓRIO DE AÇÃO DE SAÚDE", {
    x: 0.6, y: 1.4, w: 12.1, h: 0.6,
    fontSize: 14, bold: true, color: COLORS.AMBER, charSpacing: 8, fontFace: "Calibri",
  });
  s1.addText("Saúde Ocupacional & Medicina do Trabalho", {
    x: 0.6, y: 2.0, w: 12.1, h: 0.6,
    fontSize: 32, bold: true, color: COLORS.WHITE, fontFace: "Calibri",
  });
  s1.addText(empresaNome, {
    x: 0.6, y: 3.35, w: 12.1, h: 0.8,
    fontSize: 26, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
  const capaMeta = [
    { text: `EMPRESA: ${empresaNome}\n`, options: { bold: true } },
    { text: `DATA: ${dataBR}\n`, options: { bold: true } },
    { text: `ENFERMEIRA: ${(acao.enfermeira_nome ?? "LORENN BRANDÃO — COREN-AM 977.099").toUpperCase()}`, options: { bold: true } },
  ];
  s1.addText(capaMeta as any, {
    x: 0.6, y: 5.45, w: 12.1, h: 1.3,
    fontSize: 13, color: COLORS.WHITE, fontFace: "Courier New",
  });

  // ============================================================
  // Slide 2 — RESUMO EXECUTIVO (KPI grid 3x2)
  // ============================================================
  const s2 = pptx.addSlide();
  s2.background = { color: COLORS.LIGHT };
  slideTitle(s2, "Resumo Executivo", `${empresaNome} · ${dataBR}`);

  const gap = 0.22;
  const cols = 3;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;
  const kH = (SAFE.h - gap) / 2;

  const kpis = [
    { label: "Total triado", valor: total, cor: COLORS.NAVY, sub: "Colaboradores triados" },
    { label: "PA alterada", valor: `${pct(paAlt, total)}%`, cor: COLORS.RED, sub: `${paAlt} do total` },
    { label: "PA normal", valor: `${pct(paNormal, total)}%`, cor: COLORS.GREEN, sub: `${paNormal} do total` },
    { label: "Glicemia alterada", valor: `${pct(gliAlt, total)}%`, cor: COLORS.RED, sub: `${gliAlt} do total` },
    { label: "Glicemia normal", valor: `${pct(gliNormal, total)}%`, cor: COLORS.GREEN, sub: `${gliNormal} do total` },
    { label: "Encaminhamentos", valor: encaminhamentos, cor: COLORS.AMBER, sub: `${pct(encaminhamentos, total)}% do total` },
  ];
  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = SAFE.x + col * (kW + gap);
    const y = SAFE.y + row * (kH + gap);
    kpiCard(s2, x, y, kW, kH, k.label, k.valor, k.cor, k.sub);
  });

  // ============================================================
  // Slide 3 — PAINEL DE INDICADORES (2 doughnuts)
  // ============================================================
  const s3 = pptx.addSlide();
  s3.background = { color: COLORS.LIGHT };
  slideTitle(s3, "Painel de Indicadores", "Distribuição por categoria clínica");

  const chartW = (SAFE.w - 0.4) / 2;
  const doughnutOpts = (title: string) => ({
    x: 0, y: 0, w: 0, h: 0,
    chartColors: [COLORS.GREEN, COLORS.RED, COLORS.GREY],
    holeSize: 55,
    showLegend: true,
    legendPos: "b" as const,
    legendFontSize: 10,
    showTitle: true,
    title,
    titleFontSize: 14,
    titleColor: COLORS.NAVY,
    showPercent: true,
    dataLabelColor: COLORS.WHITE,
    dataLabelFontSize: 11,
    dataLabelFontBold: true,
  });

  s3.addChart(pptx.ChartType.doughnut,
    [{ name: "PA", labels: ["Normal", "Alterada", "Não realizado"], values: [paNormal, paAlt, paNR] }],
    { ...doughnutOpts("Pressão Arterial"), x: SAFE.x, y: SAFE.y, w: chartW, h: SAFE.h },
  );
  s3.addChart(pptx.ChartType.doughnut,
    [{ name: "Glicemia", labels: ["Normal", "Alterada", "Não realizado"], values: [gliNormal, gliAlt, gliNR] }],
    { ...doughnutOpts("Glicemia"), x: SAFE.x + chartW + 0.4, y: SAFE.y, w: chartW, h: SAFE.h },
  );

  // ============================================================
  // Slide 4 — Classificação PA (barra horizontal)
  // ============================================================
  const s4 = pptx.addSlide();
  s4.background = { color: COLORS.LIGHT };
  slideTitle(s4, "Classificação — Pressão Arterial", "Distribuição detalhada por categoria");

  const paLabels = ["Normal", "Pré-Hipertensão", "HA Estágio 1", "HA Estágio 2", "HA Estágio 3", "Não realizado"];
  s4.addChart(pptx.ChartType.bar,
    [{ name: "Colaboradores", labels: paLabels, values: paLabels.map((l) => (paCounts as any)[l]) }],
    {
      x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h,
      barDir: "bar",
      chartColors: [COLORS.NAVY],
      showValue: true,
      dataLabelFontSize: 11,
      dataLabelColor: COLORS.NAVY,
      dataLabelPosition: "outEnd",
      catAxisLabelFontSize: 11,
      valAxisLabelFontSize: 10,
      showLegend: false,
    },
  );

  // ============================================================
  // Slide 5 — Classificação Glicemia (barra horizontal)
  // ============================================================
  const s5 = pptx.addSlide();
  s5.background = { color: COLORS.LIGHT };
  slideTitle(s5, "Classificação — Glicemia", "Distribuição detalhada por categoria");

  const gliLabels = ["Normal", "Pré-Diabetes", "Alterada pós-prandial", "Diabetes", "Não realizado"];
  s5.addChart(pptx.ChartType.bar,
    [{ name: "Colaboradores", labels: gliLabels, values: gliLabels.map((l) => (gliCounts as any)[l]) }],
    {
      x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h,
      barDir: "bar",
      chartColors: [COLORS.GREEN],
      showValue: true,
      dataLabelFontSize: 11,
      dataLabelColor: COLORS.GREEN,
      dataLabelPosition: "outEnd",
      catAxisLabelFontSize: 11,
      valAxisLabelFontSize: 10,
      showLegend: false,
    },
  );

  // ============================================================
  // Slide 6 — PRINCIPAIS ACHADOS
  // ============================================================
  const s6 = pptx.addSlide();
  s6.background = { color: COLORS.LIGHT };
  slideTitle(s6, "Principais Achados", "Síntese técnica da ação");

  painel(s6, SAFE.x, SAFE.y, SAFE.w, SAFE.h, "Observações Clínicas");

  const est = paCounts["HA Estágio 1"] + paCounts["HA Estágio 2"] + paCounts["HA Estágio 3"];
  const findings = [
    `${total} colaboradores avaliados na ação de ${dataBR}.`,
    `${paAlt} (${pct(paAlt, total)}%) apresentaram alteração pressórica — ${est} em estágio hipertensivo (HA 1/2/3).`,
    `${gliAlt} (${pct(gliAlt, total)}%) com alteração glicêmica — ${gliCounts["Pré-Diabetes"]} em pré-diabetes e ${gliCounts["Diabetes"]} compatível com diabetes.`,
    `${encaminhamentos} colaboradores (${pct(encaminhamentos, total)}%) requerem acompanhamento médico/ocupacional.`,
    `${paNR + gliNR} aferições não realizadas — necessário reforço na adesão à triagem.`,
  ];
  s6.addText(
    findings.map((f) => ({ text: f, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: SAFE.w - 0.6, h: SAFE.h - 1.0,
      fontSize: 16, fontFace: "Calibri", paraSpaceAfter: 8,
    },
  );

  // ============================================================
  // Slide 7 — CONCLUSÃO TÉCNICA (2 colunas)
  // ============================================================
  const s7 = pptx.addSlide();
  s7.background = { color: COLORS.LIGHT };
  slideTitle(s7, "Conclusão Técnica", "Indicadores consolidados e recomendações");

  const colW = (SAFE.w - 0.3) / 2;

  // Coluna 1: Indicadores-chave
  painel(s7, SAFE.x, SAFE.y, colW, SAFE.h, "Indicadores-Chave");
  const indicadores = [
    `Total triado: ${total}`,
    `PA normal: ${paNormal} (${pct(paNormal, total)}%)`,
    `PA alterada: ${paAlt} (${pct(paAlt, total)}%)`,
    `Glicemia normal: ${gliNormal} (${pct(gliNormal, total)}%)`,
    `Glicemia alterada: ${gliAlt} (${pct(gliAlt, total)}%)`,
    `Encaminhamentos: ${encaminhamentos} (${pct(encaminhamentos, total)}%)`,
    `Não realizados (PA+Gli): ${paNR + gliNR}`,
  ];
  s7.addText(
    indicadores.map((i) => ({ text: i, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 13, fontFace: "Calibri", paraSpaceAfter: 6,
    },
  );

  // Coluna 2: Recomendações
  painel(s7, SAFE.x + colW + 0.3, SAFE.y, colW, SAFE.h, "Recomendações de Promoção à Saúde");
  const recs = [
    "Encaminhar colaboradores com PA em estágio 2/3 para avaliação cardiológica.",
    "Programa de orientação alimentar e prática de atividade física para o grupo pré-diabético.",
    "Campanha interna de adesão à aferição (PA e glicemia).",
    "Acompanhamento trimestral dos colaboradores com alteração leve.",
    "Integração dos achados ao PCMSO/PGR da empresa.",
  ];
  s7.addText(
    recs.map((r) => ({ text: r, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + colW + 0.6, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 13, fontFace: "Calibri", paraSpaceAfter: 6,
    },
  );

  // ============================================================
  // Slide 8 — OBSERVAÇÕES (condicional)
  // ============================================================
  if (acao.observacoes && acao.observacoes.trim()) {
    const s8 = pptx.addSlide();
    s8.background = { color: COLORS.LIGHT };
    slideTitle(s8, "Observações", "Notas da enfermeira responsável");
    painel(s8, SAFE.x, SAFE.y, SAFE.w, SAFE.h, "Observações da Ação");
    s8.addText(acao.observacoes, {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: SAFE.w - 0.6, h: SAFE.h - 1.0,
      fontSize: 14, color: COLORS.NAVY, fontFace: "Calibri", valign: "top",
    });
  }

  const fname = `Saude_${safeName(acao.empresa?.nome ?? "Empresa")}_${acao.data_acao.split("-").reverse().join("-")}.pptx`;
  await pptx.writeFile({ fileName: fname });
}
