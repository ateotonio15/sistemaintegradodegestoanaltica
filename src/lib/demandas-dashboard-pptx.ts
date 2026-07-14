// Exportador de PPTX para o Dashboard de Reclamações (indicadores executivos).
// Recebe um snapshot já calculado da página e monta um deck com os principais indicadores.

import waveAsset from "@/assets/ppt_wave.png.asset.json";
import logoAsset from "@/assets/ppt_logo.png.asset.json";

async function urlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export type DashboardSnapshot = {
  periodo: { inicio: string; fim: string };
  filtros: { empresa: string; executiva: string };
  metrics: {
    total: number;
    resolvidas: number;
    emAberto: number;
    pctResolvidas: number;
    pctEmAberto: number;
    slaNoPrazoPct: number;
    tempoMedioDias: number;
    pctForaDoPrazo: number;
    acimaDaMeta: boolean;
    score: number;
  };
  temposSegmentados: {
    cirurgica: { horas: number; foraPct: number };
    demais: { horas: number; foraPct: number };
  };
  tendencias: { slaDelta: number; backlogDelta: number; foraDelta: number } | null;
  monthlySeries: { label: string; sla: number; fora: number; aberto: number }[];
  volumeSetor: { setor: string; n: number; pct: number }[];
  reincidencias: { setor: string; total: number; reinc: number; taxa: number }[];
  gargalos: { setor: string; tipo: string; qtd: number; tempoMedio: number; foraPct: number }[];
  insights: string[];
};

const C = {
  NAVY: "0B2E4F",
  GREEN: "1F9D55",
  RED: "C0392B",
  AMBER: "E1A500",
  GREY: "6B7280",
  LIGHT: "F4F6F8",
  WHITE: "FFFFFF",
  BORDER: "E5E7EB",
  MUTED: "94A3B8",
} as const;

const SAFE = { x: 0.55, y: 1.35, w: 12.23, h: 5.85 } as const;

function fmtDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function slideTitle(slide: any, titulo: string, sub?: string) {
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: C.NAVY }, line: { color: C.NAVY } });
  slide.addText(titulo, {
    x: 0.55, y: 0.15, w: 12.2, h: 0.4,
    fontSize: 22, bold: true, color: C.WHITE, fontFace: "Calibri",
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.55, y: 0.5, w: 12.2, h: 0.35,
      fontSize: 12, color: "CBD5E1", fontFace: "Calibri",
    });
  }
}

function kpiCard(slide: any, x: number, y: number, w: number, h: number, label: string, value: string, cor: string, sub?: string) {
  slide.addShape("rect", { x, y, w: 0.1, h, fill: { color: cor }, line: { color: cor } });
  slide.addShape("roundRect", {
    x: x + 0.1, y, w: w - 0.1, h,
    fill: { color: C.WHITE }, line: { color: C.BORDER, width: 0.75 }, rectRadius: 0.06,
  });
  slide.addText(label.toUpperCase(), {
    x: x + 0.25, y: y + 0.12, w: w - 0.35, h: 0.3,
    fontSize: 9, bold: true, color: C.GREY, charSpacing: 2, fontFace: "Calibri",
  });
  const size = value.length <= 4 ? 36 : value.length <= 7 ? 28 : 22;
  slide.addText(value, {
    x: x + 0.25, y: y + 0.4, w: w - 0.35, h: h - 0.75,
    fontSize: size, bold: true, color: cor, fontFace: "Calibri", valign: "middle",
  });
  if (sub) {
    slide.addText(sub, {
      x: x + 0.25, y: y + h - 0.4, w: w - 0.35, h: 0.3,
      fontSize: 10, color: C.GREY, fontFace: "Calibri",
    });
  }
}

function painel(slide: any, x: number, y: number, w: number, h: number, titulo: string) {
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: C.WHITE }, line: { color: C.BORDER, width: 0.75 }, rectRadius: 0.08,
  });
  slide.addText(titulo, {
    x: x + 0.25, y: y + 0.12, w: w - 0.5, h: 0.35,
    fontSize: 13, bold: true, color: C.NAVY, fontFace: "Calibri",
  });
}

export async function exportDashboardReclamacoesPptx(snap: DashboardSnapshot) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "Dashboard de Reclamações — Painel Executivo";

  // Carrega imagens do template (fundo aquarela + logo) como data URLs.
  const [waveData, logoData] = await Promise.all([
    urlToDataUrl(waveAsset.url).catch(() => ""),
    urlToDataUrl(logoAsset.url).catch(() => ""),
  ]);

  const addBackground = (slide: any, variant: "capa" | "conteudo") => {
    slide.background = { color: C.WHITE };
    if (waveData) {
      // Onda decorativa inferior-esquerda
      slide.addImage({
        data: waveData,
        x: 0, y: variant === "capa" ? 6.02 : 6.35,
        w: variant === "capa" ? 5.07 : 4.5,
        h: variant === "capa" ? 1.48 : 1.15,
      });
      if (variant === "capa") {
        // Onda superior-direita rotacionada
        slide.addImage({
          data: waveData,
          x: 8.25, y: -0.03, w: 5.11, h: 1.55, rotate: 180,
        });
      }
    }
    if (logoData) {
      slide.addImage({
        data: logoData,
        x: variant === "capa" ? 0.55 : 12.55,
        y: variant === "capa" ? 0.4 : 0.15,
        w: 0.65, h: 0.6,
      });
    }
  };

  const periodoLabel = `Período: ${fmtDateBR(snap.periodo.inicio)} a ${fmtDateBR(snap.periodo.fim)}`;
  const filtroLabel = `Empresa: ${snap.filtros.empresa} · Executiva: ${snap.filtros.executiva}`;

  // ===== Slide 1 — Capa =====
  const s1 = pptx.addSlide();
  addBackground(s1, "capa");
  s1.addText("PAINEL EXECUTIVO", {
    x: 0.7, y: 2.4, w: 12, h: 0.5,
    fontSize: 14, bold: true, color: C.GREEN, charSpacing: 8, fontFace: "Calibri",
  });
  s1.addText("Dashboard de Reclamações", {
    x: 0.7, y: 2.9, w: 12, h: 1.0,
    fontSize: 44, bold: true, color: C.NAVY, fontFace: "Calibri",
  });
  s1.addText("Visão estratégica · SLA, risco operacional e tendências", {
    x: 0.7, y: 4.0, w: 12, h: 0.5,
    fontSize: 16, color: C.GREY, fontFace: "Calibri",
  });
  s1.addText([
    { text: `${periodoLabel}\n`, options: { bold: true } },
    { text: filtroLabel, options: {} },
  ] as any, {
    x: 0.7, y: 4.9, w: 12, h: 1.0,
    fontSize: 13, color: C.NAVY, fontFace: "Calibri", paraSpaceAfter: 4,
  });
  s1.addText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, {
    x: 0.7, y: 7.0, w: 12, h: 0.3,
    fontSize: 10, color: C.GREY, fontFace: "Calibri",
  });

  // ===== Slide 2 — Resumo executivo (KPIs) =====
  const m = snap.metrics;
  const s2 = pptx.addSlide();
  addBackground(s2, "conteudo");
  slideTitle(s2, "Resumo Executivo", `${periodoLabel} · ${filtroLabel}`);

  const gap = 0.22;
  const cols = 3;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;
  const kH = (SAFE.h - gap * 2) / 3;

  const kpis = [
    { label: "SLA no prazo", value: `${m.slaNoPrazoPct}%`, cor: m.slaNoPrazoPct >= 92 ? C.GREEN : m.slaNoPrazoPct >= 80 ? C.AMBER : C.RED, sub: `${m.total - Math.round(m.total * (m.pctForaDoPrazo / 100))} de ${m.total} dentro do prazo` },
    { label: "Backlog em aberto", value: `${m.emAberto}`, cor: m.pctEmAberto > 30 ? C.RED : C.AMBER, sub: `${m.pctEmAberto}% do total ainda em aberto` },
    { label: "Pontuação operacional", value: `${m.score}`, cor: m.score >= 85 ? C.GREEN : m.score >= 70 ? C.AMBER : C.RED, sub: "Eficiência ponderada de SLA, resolução e backlog" },
    { label: "Total de demandas", value: `${m.total}`, cor: C.NAVY, sub: `${m.resolvidas} resolvidas (${m.pctResolvidas}%)` },
    { label: "Fora do prazo", value: `${m.pctForaDoPrazo}%`, cor: m.acimaDaMeta ? C.RED : C.GREEN, sub: m.acimaDaMeta ? "Acima da meta de 8%" : "Dentro da meta (≤8%)" },
    { label: "Tempo médio de resolução", value: `${m.tempoMedioDias.toFixed(1)}d`, cor: C.NAVY, sub: "Dias corridos por demanda resolvida" },
  ];
  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = SAFE.x + col * (kW + gap);
    const y = SAFE.y + row * (kH + gap);
    kpiCard(s2, x, y, kW, kH, k.label, k.value, k.cor, k.sub);
  });

  // ===== Slide 3 — Tempo médio + Tendências =====
  const s3 = pptx.addSlide();
  s3.background = { color: C.LIGHT };
  slideTitle(s3, "Tempo de resposta & Tendências", periodoLabel);

  const colW = (SAFE.w - 0.3) / 2;
  painel(s3, SAFE.x, SAFE.y, colW, SAFE.h, "Tempo médio (horas úteis)");
  const t = snap.temposSegmentados;
  s3.addText([
    { text: `Agenda Cirúrgica (SLA 168h)\n`, options: { bold: true, color: C.NAVY, fontSize: 14 } },
    { text: `${t.cirurgica.horas.toFixed(0)}h  `, options: { bold: true, color: C.NAVY, fontSize: 30 } },
    { text: `(${t.cirurgica.foraPct}% sem SLA)\n\n`, options: { color: C.GREY, fontSize: 12 } },
    { text: `Demais setores (SLA 72h)\n`, options: { bold: true, color: C.NAVY, fontSize: 14 } },
    { text: `${t.demais.horas.toFixed(0)}h  `, options: { bold: true, color: C.NAVY, fontSize: 30 } },
    { text: `(${t.demais.foraPct}% sem SLA)`, options: { color: C.GREY, fontSize: 12 } },
  ] as any, {
    x: SAFE.x + 0.3, y: SAFE.y + 0.65, w: colW - 0.6, h: SAFE.h - 0.9,
    fontFace: "Calibri", valign: "top",
  });

  painel(s3, SAFE.x + colW + 0.3, SAFE.y, colW, SAFE.h, "Tendências do período");
  const tr = snap.tendencias;
  const arrow = (n: number) => (n > 0 ? "▲" : n < 0 ? "▼" : "▬");
  const trendColor = (n: number, inverse = false) => {
    if (n === 0) return C.GREY;
    const good = inverse ? n < 0 : n > 0;
    return good ? C.GREEN : C.RED;
  };
  if (tr) {
    const lines = [
      { label: "SLA no prazo", val: tr.slaDelta, inverse: false },
      { label: "Backlog em aberto", val: tr.backlogDelta, inverse: true },
      { label: "Fora do prazo", val: tr.foraDelta, inverse: true },
    ];
    lines.forEach((ln, i) => {
      const y0 = SAFE.y + 0.7 + i * 1.15;
      s3.addText(ln.label, {
        x: SAFE.x + colW + 0.55, y: y0, w: colW - 0.6, h: 0.3,
        fontSize: 12, color: C.GREY, fontFace: "Calibri",
      });
      s3.addText(`${arrow(ln.val)} ${ln.val > 0 ? "+" : ""}${ln.val}%`, {
        x: SAFE.x + colW + 0.55, y: y0 + 0.3, w: colW - 0.6, h: 0.55,
        fontSize: 26, bold: true, color: trendColor(ln.val, ln.inverse), fontFace: "Calibri",
      });
    });
  } else {
    s3.addText("Sem dados suficientes para tendências.", {
      x: SAFE.x + colW + 0.55, y: SAFE.y + 1.0, w: colW - 0.6, h: 0.5,
      fontSize: 12, color: C.GREY, fontFace: "Calibri", italic: true,
    });
  }

  // ===== Slide 4 — Evolução Mensal =====
  if (snap.monthlySeries.length > 0) {
    const s4 = pptx.addSlide();
    s4.background = { color: C.LIGHT };
    slideTitle(s4, "Evolução Mensal", "SLA no prazo, fora do prazo e backlog");
    const labels = snap.monthlySeries.map((x) => x.label);
    s4.addChart(pptx.ChartType.line,
      [
        { name: "SLA no prazo (%)", labels, values: snap.monthlySeries.map((x) => x.sla) },
        { name: "Fora do prazo (%)", labels, values: snap.monthlySeries.map((x) => x.fora) },
        { name: "Backlog aberto", labels, values: snap.monthlySeries.map((x) => x.aberto) },
      ],
      {
        x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h,
        chartColors: [C.GREEN, C.RED, C.NAVY],
        showLegend: true, legendPos: "b", legendFontSize: 11,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
        lineDataSymbolSize: 8, lineSize: 2,
      },
    );
  }

  // ===== Slide 5 — Volume por setor =====
  if (snap.volumeSetor.length > 0) {
    const s5 = pptx.addSlide();
    s5.background = { color: C.LIGHT };
    slideTitle(s5, "Volume por Setor", "Top setores em número de demandas");
    s5.addChart(pptx.ChartType.bar,
      [{ name: "Demandas", labels: snap.volumeSetor.map((v) => v.setor), values: snap.volumeSetor.map((v) => v.n) }],
      {
        x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h,
        barDir: "bar", chartColors: [C.NAVY],
        showValue: true, dataLabelFontSize: 11, dataLabelColor: C.NAVY, dataLabelPosition: "outEnd",
        catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, showLegend: false,
      },
    );
  }

  // ===== Slide 6 — Reincidências =====
  if (snap.reincidencias.length > 0) {
    const s6 = pptx.addSlide();
    s6.background = { color: C.LIGHT };
    slideTitle(s6, "Reincidências por Setor", "Taxa de reincidência (%) — quanto menor, melhor");
    s6.addChart(pptx.ChartType.bar,
      [{ name: "Taxa de reincidência (%)", labels: snap.reincidencias.map((r) => r.setor), values: snap.reincidencias.map((r) => r.taxa) }],
      {
        x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h,
        barDir: "bar", chartColors: [C.AMBER],
        showValue: true, dataLabelFontSize: 11, dataLabelColor: C.NAVY, dataLabelPosition: "outEnd",
        catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, showLegend: false,
      },
    );
  }

  // ===== Slide 7 — Gargalos =====
  if (snap.gargalos.length > 0) {
    const s7 = pptx.addSlide();
    s7.background = { color: C.LIGHT };
    slideTitle(s7, "Principais Gargalos", "Setor × tipo com maior impacto (volume × tempo médio)");
    painel(s7, SAFE.x, SAFE.y, SAFE.w, SAFE.h, "Top 5 gargalos");
    const rows = [
      [
        { text: "Setor", options: { bold: true, color: C.WHITE, fill: C.NAVY } },
        { text: "Tipo", options: { bold: true, color: C.WHITE, fill: C.NAVY } },
        { text: "Qtd.", options: { bold: true, color: C.WHITE, fill: C.NAVY } },
        { text: "Tempo médio (d)", options: { bold: true, color: C.WHITE, fill: C.NAVY } },
        { text: "Fora do prazo", options: { bold: true, color: C.WHITE, fill: C.NAVY } },
      ],
      ...snap.gargalos.map((g) => [
        { text: g.setor, options: { color: C.NAVY } },
        { text: g.tipo, options: { color: C.NAVY } },
        { text: String(g.qtd), options: { color: C.NAVY } },
        { text: g.tempoMedio.toFixed(1), options: { color: C.NAVY } },
        { text: `${g.foraPct}%`, options: { color: g.foraPct > 8 ? C.RED : C.GREEN, bold: true } },
      ]),
    ];
    s7.addTable(rows as any, {
      x: SAFE.x + 0.3, y: SAFE.y + 0.65, w: SAFE.w - 0.6,
      colW: [3.5, 3.5, 1.2, 2.0, 1.4],
      fontSize: 12, fontFace: "Calibri",
      border: { pt: 0.5, color: C.BORDER },
      rowH: 0.4,
    });
  }

  // ===== Slide 8 — Insights =====
  if (snap.insights.length > 0) {
    const s8 = pptx.addSlide();
    s8.background = { color: C.LIGHT };
    slideTitle(s8, "Insights & Recomendações", "Análise automática dos indicadores");
    painel(s8, SAFE.x, SAFE.y, SAFE.w, SAFE.h, "Observações do período");
    s8.addText(
      snap.insights.map((f) => ({ text: f, options: { bullet: { code: "25CF" }, color: C.NAVY } })) as any,
      {
        x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: SAFE.w - 0.6, h: SAFE.h - 1.0,
        fontSize: 16, fontFace: "Calibri", paraSpaceAfter: 10,
      },
    );
  }

  const fname = `Dashboard_Reclamacoes_${snap.periodo.inicio}_a_${snap.periodo.fim}.pptx`;
  await pptx.writeFile({ fileName: fname });
}
