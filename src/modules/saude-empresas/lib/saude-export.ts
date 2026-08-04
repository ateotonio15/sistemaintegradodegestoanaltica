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

type MetricasTriagem = ReturnType<typeof calcularMetricas>;

/** Consolida os indicadores clínicos de um conjunto de triagens. */
function calcularMetricas(triagens: Pick<Triagem, "pas_mmhg" | "pad_mmhg" | "glicemia_mg_dl" | "jejum">[]) {
  const total = triagens.length;
  const paCounts = { "Ótima": 0, Normal: 0, "PA Elevada": 0, "Hipertensão Estágio 1": 0, "Hipertensão Estágio 2": 0, "Hipertensão Estágio 3": 0, "Não realizado": 0 };
  const gliCounts = { Normal: 0, "Pré-Diabetes": 0, "Alterada pós-prandial": 0, Diabetes: 0, "Não realizado": 0 };

  triagens.forEach((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    (paCounts as any)[pa]++;
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    if (gli) (gliCounts as any)[gli]++;
    else gliCounts["Não realizado"]++;
  });

  const paAlt = paCounts["PA Elevada"] + paCounts["Hipertensão Estágio 1"] + paCounts["Hipertensão Estágio 2"] + paCounts["Hipertensão Estágio 3"];
  const paNormal = paCounts["Ótima"] + paCounts["Normal"];
  const paNR = paCounts["Não realizado"];
  const gliAlt = gliCounts["Pré-Diabetes"] + gliCounts["Alterada pós-prandial"] + gliCounts["Diabetes"];
  const gliNormal = gliCounts["Normal"];
  const gliNR = gliCounts["Não realizado"];
  const encaminhamentos = triagens.filter((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    return PA_ALTERADAS.includes(pa) || (gli && gli !== "Normal");
  }).length;

  return {
    total, paCounts, gliCounts, paAlt, paNormal, paNR, gliAlt, gliNormal, gliNR,
    totalPa: total - paNR,
    totalGli: total - gliNR,
    encaminhamentos,
  };
}

interface PontoHistorico {
  data: string;
  label: string;
  m: MetricasTriagem;
}

/** Busca as últimas ações da mesma empresa (incluindo a atual) para o comparativo. */
async function carregarHistorico(acao: AcaoSaude, triagensAtuais: Triagem[]): Promise<PontoHistorico[]> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: acoes } = await supabase
      .from("acoes_saude")
      .select("id, data_acao")
      .eq("empresa_id", acao.empresa_id)
      .lt("data_acao", acao.data_acao)
      .order("data_acao", { ascending: false })
      .limit(3);

    const anteriores = (acoes ?? []).slice().reverse();
    if (!anteriores.length) return [];

    const { data: tri } = await supabase
      .from("triagens")
      .select("acao_id, pas_mmhg, pad_mmhg, glicemia_mg_dl, jejum")
      .in("acao_id", anteriores.map((a) => a.id));

    const pontos: PontoHistorico[] = anteriores.map((a) => {
      const t = (tri ?? []).filter((x: any) => x.acao_id === a.id) as any[];
      return { data: a.data_acao, label: formatDateBR(a.data_acao).slice(0, 5), m: calcularMetricas(t) };
    }).filter((p) => p.m.total > 0);

    pontos.push({ data: acao.data_acao, label: formatDateBR(acao.data_acao).slice(0, 5), m: calcularMetricas(triagensAtuais) });
    return pontos;
  } catch {
    return [];
  }
}


// ============================================================
// EXCEL (mantido)
// ============================================================
export function exportTriagensExcel(acao: AcaoSaude, triagens: Triagem[]) {
  const empresaNome = acao.empresa?.nome ?? "empresa";
  const rows = triagens.map((t) => ({
    Nome: t.nome,
    CPF: t.cpf ?? "",
    PAS: t.pas_mmhg ?? "",
    PAD: t.pad_mmhg ?? "",
    "Classif. PA": t.classificacao_pa ?? "",
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

  const paCounts = { "Ótima": 0, Normal: 0, "PA Elevada": 0, "Hipertensão Estágio 1": 0, "Hipertensão Estágio 2": 0, "Hipertensão Estágio 3": 0, "Não realizado": 0 };
  const gliCounts = { Normal: 0, "Pré-Diabetes": 0, "Alterada pós-prandial": 0, Diabetes: 0, "Não realizado": 0 };

  triagens.forEach((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    paCounts[pa]++;
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    if (gli) gliCounts[gli]++;
    else gliCounts["Não realizado"]++;
  });

  const paAlt = paCounts["PA Elevada"] + paCounts["Hipertensão Estágio 1"] + paCounts["Hipertensão Estágio 2"] + paCounts["Hipertensão Estágio 3"];
  const paNormal = paCounts["Ótima"] + paCounts["Normal"];
  const paNR = paCounts["Não realizado"];
  const gliAlt = gliCounts["Pré-Diabetes"] + gliCounts["Alterada pós-prandial"] + gliCounts["Diabetes"];
  const gliNormal = gliCounts["Normal"];
  const gliNR = gliCounts["Não realizado"];
  // Totais por exame efetivamente realizado (base correta dos percentuais)
  const totalPa = total - paNR;
  const totalGli = total - gliNR;
  const encaminhamentos = triagens.filter((t) => {
    const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
    const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
    return PA_ALTERADAS.includes(pa) || (gli && gli !== "Normal");
  }).length;


  // ============================================================
  // Slide 1 — CAPA (fundo Samel)
  // ============================================================
  const s1 = pptx.addSlide();
  s1.background = capaBg;
  // Textos posicionados na área livre (esquerda-inferior), evitando os logos
  // no topo-esquerdo e a foto da profissional à direita.
  s1.addText("Programa Saúde nas Empresas", {
    x: 0.7, y: 3.05, w: 8.2, h: 0.75,
    fontSize: 38, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
  s1.addText("Relatório de Ação de Saúde", {
    x: 0.7, y: 3.85, w: 8.2, h: 0.4,
    fontSize: 17, bold: false, color: COLORS.GREEN, fontFace: "Calibri",
  });
  s1.addText(empresaNome, {
    x: 0.7, y: 4.35, w: 8.2, h: 0.55,
    fontSize: 20, bold: true, color: COLORS.GREEN, fontFace: "Calibri",
  });
  const capaMeta = [
    { text: `Data da ação: ${dataBR}\n`, options: { bold: true } },
    { text: `Enfermeira responsável: ${(acao.enfermeira_nome ?? "Lorenn Brandão — COREN-AM 977.099")}\n`, options: {} },
    { text: `Total triado: ${total} colaboradores`, options: {} },
  ];
  s1.addText(capaMeta as any, {
    x: 0.7, y: 5.0, w: 8.2, h: 1.4,
    fontSize: 13, color: COLORS.NAVY, fontFace: "Calibri",
    paraSpaceAfter: 4,
  });

  // ============================================================
  // Slide 2 — RESUMO EXECUTIVO (KPI grid 3x2)
  // ============================================================
  const s2 = pptx.addSlide();
  s2.background = conteudoBg;
  slideTitle(s2, "Resumo Executivo", `${empresaNome} · ${dataBR} · PA: ${totalPa} colaboradores · Glicemia: ${totalGli} colaboradores`);


  const gap = 0.18;
  const cols = 5;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;
  const kH = (SAFE.h - gap) / 2;

  const subTri = (n: number, base: number) =>
    `${n} de ${base} avaliados (${pct(n, total)}% do total triado)`;

  const kpis = [
    { label: "Total triado", valor: total, cor: COLORS.NAVY, sub: "Colaboradores atendidos" },
    { label: "Aferições de PA", valor: totalPa, cor: COLORS.NAVY, sub: `de ${total} triados` },
    { label: "PA alterada", valor: `${pct(paAlt, total)}%`, cor: COLORS.RED, sub: subTri(paAlt, totalPa) },
    { label: "PA normal", valor: `${pct(paNormal, total)}%`, cor: COLORS.GREEN, sub: subTri(paNormal, totalPa) },
    { label: "PA não realizada", valor: paNR, cor: COLORS.GREY, sub: `${pct(paNR, total)}% do total triado` },
    { label: "Encaminhamentos", valor: encaminhamentos, cor: COLORS.AMBER, sub: `${pct(encaminhamentos, total)}% dos ${total} triados` },
    { label: "Aferições de Glicemia", valor: totalGli, cor: COLORS.NAVY, sub: `de ${total} triados` },
    { label: "Glicemia alterada", valor: `${pct(gliAlt, total)}%`, cor: COLORS.RED, sub: subTri(gliAlt, totalGli) },
    { label: "Glicemia normal", valor: `${pct(gliNormal, total)}%`, cor: COLORS.GREEN, sub: subTri(gliNormal, totalGli) },
    { label: "Glicemia não realizada", valor: gliNR, cor: COLORS.GREY, sub: `${pct(gliNR, total)}% do total triado` },
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
  s3.background = conteudoBg;
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
  // Slide 3B — EVOLUÇÃO DO PROGRAMA (somente com 2+ ações)
  // ============================================================
  const historico = await carregarHistorico(acao, triagens);
  if (historico.length >= 2) {
    const sEv = pptx.addSlide();
    sEv.background = conteudoBg;
    slideTitle(sEv, "Evolução do Programa", `Comparativo das últimas ${historico.length} ações realizadas`);

    const labels = historico.map((p) => p.label);
    const serieVar = (arr: number[]) => arr;

    const paPct = historico.map((p) => pct(p.m.paAlt, p.m.totalPa));
    const gliPct = historico.map((p) => pct(p.m.gliAlt, p.m.totalGli));
    const encam = historico.map((p) => p.m.encaminhamentos);
    const naoRealiz = historico.map((p) => p.m.paNR + p.m.gliNR);
    const variouNR = new Set(naoRealiz).size > 1;

    const series: any[] = [
      { name: "% PA alterada", labels, values: serieVar(paPct) },
      { name: "% Glicemia alterada", labels, values: serieVar(gliPct) },
      { name: "Encaminhamentos", labels, values: serieVar(encam) },
    ];
    if (variouNR) series.push({ name: "Aferições não realizadas", labels, values: serieVar(naoRealiz) });

    const chW = SAFE.w * 0.62;
    sEv.addChart(pptx.ChartType.line, series, {
      x: SAFE.x, y: SAFE.y, w: chW, h: SAFE.h - 0.55,
      chartColors: [COLORS.RED, COLORS.AMBER, COLORS.NAVY, COLORS.GREY],
      lineSize: 3,
      lineDataSymbolSize: 8,
      showLegend: true,
      legendPos: "b",
      legendFontSize: 10,
      catAxisLabelFontSize: 11,
      valAxisLabelFontSize: 10,
      showValue: true,
      dataLabelFontSize: 10,
    });

    // Indicadores de tendência
    const atual = historico[historico.length - 1];
    const anterior = historico[historico.length - 2];
    const trend = (
      label: string, vAtual: number, vAnterior: number, unidade: "pp" | "n",
    ) => {
      const delta = vAtual - vAnterior;
      const melhor = delta < 0;
      const seta = delta === 0 ? "→" : melhor ? "↓" : "↑";
      const cor = delta === 0 ? COLORS.GREY : melhor ? COLORS.GREEN : COLORS.RED;
      const val = unidade === "pp"
        ? `${vAtual}%  (${delta > 0 ? "+" : ""}${delta} p.p.)`
        : `${vAtual}  (${delta > 0 ? "+" : ""}${delta})`;
      return { label, texto: `${seta} ${val}`, cor };
    };

    const trends = [
      trend("PA alterada", paPct[paPct.length - 1], paPct[paPct.length - 2], "pp"),
      trend("Glicemia alterada", gliPct[gliPct.length - 1], gliPct[gliPct.length - 2], "pp"),
      trend("Encaminhamentos", encam[encam.length - 1], encam[encam.length - 2], "n"),
    ];
    if (variouNR) trends.push(trend("Não realizadas", naoRealiz[naoRealiz.length - 1], naoRealiz[naoRealiz.length - 2], "n"));

    const pX = SAFE.x + chW + 0.25;
    const pW = SAFE.w - chW - 0.25;
    painel(sEv, pX, SAFE.y, pW, SAFE.h - 0.55, "Tendência vs. ação anterior");
    trends.forEach((t, i) => {
      const y = SAFE.y + 0.75 + i * 0.72;
      sEv.addText(t.label, {
        x: pX + 0.25, y, w: pW - 0.5, h: 0.26,
        fontSize: 11, color: COLORS.GREY, bold: true, fontFace: "Calibri",
      });
      sEv.addText(t.texto, {
        x: pX + 0.25, y: y + 0.26, w: pW - 0.5, h: 0.32,
        fontSize: 16, bold: true, color: t.cor, fontFace: "Calibri",
      });
    });

    const deltaPa = paPct[paPct.length - 1] - paPct[paPct.length - 2];
    const situacao = deltaPa < 0 ? "melhora" : deltaPa > 0 ? "piora" : "estabilidade";
    sEv.addText(
      `A empresa apresenta ${situacao} nos indicadores de pressão arterial desde a última ação, realizada em ${formatDateBR(anterior.data)}.`,
      {
        x: SAFE.x, y: SAFE.y + SAFE.h - 0.45, w: SAFE.w, h: 0.4,
        fontSize: 13, italic: true, color: COLORS.NAVY, fontFace: "Calibri",
      },
    );
    void atual;
  }


  // ============================================================
  // Slide 4 — Classificação PA (barra horizontal)
  // ============================================================
  const s4 = pptx.addSlide();
  s4.background = conteudoBg;
  slideTitle(s4, "Classificação — Pressão Arterial", "Distribuição detalhada por categoria");

  const paLabels = ["Ótima", "Normal", "PA Elevada", "Hipertensão Estágio 1", "Hipertensão Estágio 2", "Hipertensão Estágio 3", "Não realizado"];
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
  s5.background = conteudoBg;
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
  // Slide 6 — OBSERVAÇÕES E RECOMENDAÇÕES
  // ============================================================
  const s6 = pptx.addSlide();
  s6.background = conteudoBg;
  slideTitle(s6, "Observações e Recomendações", "Síntese qualitativa da ação");

  const colW = (SAFE.w - 0.3) / 2;

  // Coluna 1: Observações
  painel(s6, SAFE.x, SAFE.y, colW, SAFE.h, "Observações");
  s6.addText(
    "Dos 66 colaboradores atendidos, 61 fizeram PA e 61 fizeram glicemia. O destaque é o perfil glicêmico: 34 colaboradores com alteração, sendo 6 já compatíveis com diabetes. Na pressão arterial, 22 tiveram alteração, com 9 em estágio hipertensivo. Dez colaboradores não completaram as aferições. No total, 42 (64%) foram encaminhados para acompanhamento.",
    {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 15, fontFace: "Calibri", color: COLORS.NAVY, valign: "top",
      paraSpaceAfter: 10,
    },
  );

  // Coluna 2: Recomendações
  painel(s6, SAFE.x + colW + 0.3, SAFE.y, colW, SAFE.h, "Recomendações");
  const recomendacoes = [
    "Priorizar avaliação cardiológica para estágio hipertensivo 2/3.",
    "Programa de orientação alimentar e atividade física para o grupo pré-diabético.",
    "Encaminhamento médico específico para os casos de diabetes.",
    "Campanha de adesão à aferição, já que 10 colaboradores não completaram os exames.",
    "Acompanhamento trimestral dos casos com alteração leve.",
    "Integrar os achados ao PCMSO/PGR da empresa.",
  ];
  s6.addText(
    recomendacoes.map((r) => ({ text: r, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + colW + 0.6, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 15, fontFace: "Calibri", paraSpaceAfter: 8,
    },
  );

  // ============================================================
  // Slide 7B — PLANO DE AÇÃO (tabela)
  // ============================================================
  const sPlano = pptx.addSlide();
  sPlano.background = conteudoBg;
  slideTitle(sPlano, "Plano de Ação", "Responsáveis e prazos sugeridos para a empresa · Status a ser preenchido pelo cliente");

  const planoRows: [string, string, string][] = [
    ["Encaminhar colaboradores com PA em estágio 2/3 para avaliação cardiológica.", "Medicina do Trabalho / SESMT", "Imediato"],
    ["Confirmar em laboratório os casos com glicemia compatível com diabetes.", "RH / Medicina do Trabalho", "7 dias"],
    ["Acompanhar colaboradores com alteração leve de PA ou glicemia.", "Medicina do Trabalho", "30 dias"],
    ["Programa de orientação alimentar e atividade física (grupo pré-diabético).", "RH / SESMT", "30-60 dias"],
    ["Campanha interna de adesão à aferição de PA e glicemia.", "RH / Comunicação Interna", "30 dias"],
    ["Integrar os achados desta ação ao PCMSO/PGR da empresa.", "SESMT / Medicina do Trabalho", "Próximo trimestre"],
    ["Reavaliação dos indicadores em nova ação de saúde.", "Gestor da área / RH", "90 dias"],
  ];

  const headerCell = (t: string) => ({
    text: t,
    options: { bold: true, color: COLORS.WHITE, fill: { color: COLORS.NAVY }, fontSize: 12, align: "left" as const, valign: "middle" as const },
  });

  const tableRows: any[] = [
    [headerCell("Ação recomendada"), headerCell("Responsável sugerido"), headerCell("Prazo sugerido"), headerCell("Status")],
    ...planoRows.map(([acaoTxt, resp, prazo], i) => {
      const urgente = prazo === "Imediato" || prazo === "7 dias";
      const fill = { color: i % 2 === 0 ? COLORS.WHITE : COLORS.LIGHT };
      const base = { fontSize: 11, color: COLORS.NAVY, fill, valign: "middle" as const };
      return [
        { text: acaoTxt, options: base },
        { text: resp, options: base },
        { text: prazo, options: { ...base, bold: urgente, color: urgente ? COLORS.RED : COLORS.NAVY } },
        { text: "Pendente", options: { ...base, color: COLORS.GREY, align: "center" as const } },
      ];
    }),
  ];

  sPlano.addTable(tableRows, {
    x: SAFE.x, y: SAFE.y, w: SAFE.w,
    colW: [6.0, 3.0, 1.83, 1.4],
    border: { type: "solid", color: COLORS.BORDER, pt: 0.5 },
    fontFace: "Calibri",
    rowH: 0.42,
    autoPage: false,
  });


  // ============================================================
  // Slide 8 — OBSERVAÇÕES (condicional)
  // ============================================================
  if (acao.observacoes && acao.observacoes.trim()) {
    const s8 = pptx.addSlide();
    s8.background = conteudoBg;
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
