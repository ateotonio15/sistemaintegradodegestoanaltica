// Dashboard de Reclamações — Painel Executivo C-level
// Paleta petróleo/verde-azulado/grafite. Sem barras decorativas nem faixas laterais.
// Cabeçalho em cartão branco arredondado sobre o fundo institucional já existente no banco.

import bgCapaAsset from "@/assets/saude_bg_capa.png.asset.json";
import bgConteudoAsset from "@/assets/saude_bg_conteudo.png.asset.json";

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

export type DashboardMetrics = {
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

export type DashboardSnapshot = {
  periodo: { inicio: string; fim: string };
  periodoAnterior: { inicio: string; fim: string } | null;
  filtros: { empresa: string; executiva: string };
  metrics: DashboardMetrics;
  metricsAnterior: DashboardMetrics | null;
  temposSegmentados: {
    cirurgica: { horas: number; foraPct: number };
    demais: { horas: number; foraPct: number };
  };
  tendencias: { slaDelta: number; backlogDelta: number; foraDelta: number } | null;
  monthlySeries: { label: string; sla: number; fora: number; aberto: number }[];
  volumeSetor: { setor: string; n: number; pct: number }[];
  volumeTipo: { tipo: string; n: number; pct: number }[];
  reincidencias: { setor: string; total: number; reinc: number; taxa: number }[];
  gargalos: { setor: string; tipo: string; qtd: number; tempoMedio: number; foraPct: number }[];
  insights: string[];
  rankingEmpresasVidas?: { empresa: string; vidas: number; reclamacoes: number; indice: number }[];
};

// Paleta petróleo / verde-azulado / grafite. Semântica fixa.
const C = {
  INK: "0F1F2C",          // texto principal (grafite escuro)
  INK_SOFT: "3B4A56",     // texto secundário
  MUTED: "6B7A85",        // texto de apoio / labels
  BORDER: "D8DFE4",       // borda de cartão
  CARD: "FFFFFF",         // fundo de cartão
  CARD_SOFT: "F1F5F7",    // fundo alternativo
  PRIMARY: "0E5E6F",      // petróleo — cor principal
  POSITIVE: "1F9D7A",     // verde-menta (melhora / no prazo)
  NEGATIVE: "C0392B",     // vermelho (piora / risco)
  WARNING: "C97C15",      // âmbar (atenção)
  ACCENT: "14808F",       // teal médio (destaques de gráfico)
} as const;

const SAFE = { x: 0.55, y: 1.4, w: 12.23, h: 5.7 } as const;
const HEADER = { x: 0.4, y: 0.35, w: 12.53, h: 0.85 } as const;

function fmtDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function monthLabelBR(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Cabeçalho consistente: cartão branco arredondado com título/subtítulo/período.
function slideHeader(slide: any, titulo: string, sub: string, periodo: string) {
  slide.addShape("roundRect", {
    x: HEADER.x, y: HEADER.y, w: HEADER.w, h: HEADER.h,
    fill: { color: C.CARD, transparency: 8 },
    line: { color: C.BORDER, width: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText(titulo, {
    x: HEADER.x + 0.25, y: HEADER.y + 0.08, w: HEADER.w - 0.5, h: 0.45,
    fontSize: 22, bold: true, color: C.INK, fontFace: "Calibri",
  });
  slide.addText(`${sub}  ·  ${periodo}`, {
    x: HEADER.x + 0.25, y: HEADER.y + 0.5, w: HEADER.w - 0.5, h: 0.3,
    fontSize: 10, color: C.MUTED, fontFace: "Calibri",
  });
}

function slideFooter(slide: any, filtroLabel: string) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  slide.addText(filtroLabel, {
    x: 0.4, y: 7.25, w: 8, h: 0.25,
    fontSize: 9, color: C.MUTED, fontFace: "Calibri",
  });
  slide.addText(`Gerado em ${geradoEm}`, {
    x: 8.4, y: 7.25, w: 4.53, h: 0.25,
    fontSize: 9, color: C.MUTED, fontFace: "Calibri", align: "right",
  });
}

// Cartão neutro (sem barra lateral colorida — regra explícita do briefing).
function card(slide: any, x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: C.CARD },
    line: { color: C.BORDER, width: 0.5 },
    rectRadius: 0.1,
    shadow: { type: "outer", color: "9AA5B1", opacity: 0.18, blur: 6, offset: 1.5, angle: 90 },
  });
}

// KPI simples (sem comparação) — para slide de Resumo Executivo.
function kpiSimples(
  slide: any,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string, cor: string,
) {
  card(slide, x, y, w, h);
  slide.addText(label.toUpperCase(), {
    x: x + 0.22, y: y + 0.15, w: w - 0.44, h: 0.3,
    fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
  });
  const size = value.length <= 4 ? 40 : value.length <= 7 ? 32 : 26;
  slide.addText(value, {
    x: x + 0.22, y: y + 0.42, w: w - 0.44, h: 0.85,
    fontSize: size, bold: true, color: cor, fontFace: "Calibri", valign: "middle",
  });
  slide.addText(sub, {
    x: x + 0.22, y: y + h - 0.65, w: w - 0.44, h: 0.55,
    fontSize: 10, color: C.INK_SOFT, fontFace: "Calibri", valign: "top",
  });
}

// KPI comparativo (Capa) — inclui delta com seta e valor do mês anterior.
function kpiComparativo(
  slide: any,
  x: number, y: number, w: number, h: number,
  label: string,
  atual: string,
  anterior: string | null,           // valor formatado do mês anterior (ex.: "60%") ou null
  delta: number | null,              // variação em p.p. ou %; null = sem dado
  deltaUnit: "pp" | "pct" | "abs",   // como formatar o delta
  inverse: boolean,                  // true = queda é melhora (Fora do prazo, Backlog, Tempo médio)
  cor: string,
) {
  card(slide, x, y, w, h);
  slide.addText(label.toUpperCase(), {
    x: x + 0.22, y: y + 0.13, w: w - 0.44, h: 0.3,
    fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
  });
  const size = atual.length <= 4 ? 44 : atual.length <= 7 ? 34 : 26;
  slide.addText(atual, {
    x: x + 0.22, y: y + 0.4, w: w - 0.44, h: 0.95,
    fontSize: size, bold: true, color: cor, fontFace: "Calibri", valign: "middle",
  });

  // Delta chip
  let deltaText = "sem dado comparável";
  let deltaColor: string = C.MUTED;
  if (delta !== null) {
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "▬";
    const good = delta === 0 ? null : inverse ? delta < 0 : delta > 0;
    deltaColor = good === null ? C.MUTED : good ? C.POSITIVE : C.NEGATIVE;
    const sign = delta > 0 ? "+" : "";
    const unit = deltaUnit === "pp" ? " p.p." : deltaUnit === "pct" ? "%" : "";
    deltaText = `${arrow} ${sign}${delta}${unit}`;
  }
  slide.addText(deltaText, {
    x: x + 0.22, y: y + h - 0.75, w: w - 0.44, h: 0.32,
    fontSize: 13, bold: true, color: deltaColor, fontFace: "Calibri",
  });
  slide.addText(anterior ? `mês anterior: ${anterior}` : "mês anterior indisponível", {
    x: x + 0.22, y: y + h - 0.42, w: w - 0.44, h: 0.3,
    fontSize: 9, color: C.MUTED, fontFace: "Calibri", italic: true,
  });
}

function delta(atual: number, ant: number | null | undefined, kind: "pp" | "pct") {
  if (ant === null || ant === undefined) return null;
  if (kind === "pp") return Math.round(atual - ant);
  if (ant === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - ant) / ant) * 100);
}

function deltaAbs(atual: number, ant: number | null | undefined) {
  if (ant === null || ant === undefined) return null;
  if (ant === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - ant) / ant) * 100);
}

export async function exportDashboardReclamacoesPptx(snap: DashboardSnapshot) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "Dashboard de Reclamações — Painel Executivo";

  const [bgCapaData, bgConteudoData] = await Promise.all([
    urlToDataUrl(bgCapaAsset.url).catch(() => ""),
    urlToDataUrl(bgConteudoAsset.url).catch(() => ""),
  ]);

  const addBackground = (slide: any, variant: "capa" | "conteudo") => {
    const data = variant === "capa" ? bgCapaData : bgConteudoData;
    if (data) slide.background = { data };
    else slide.background = { color: C.CARD_SOFT };
  };

  const periodoLabel = `${fmtDateBR(snap.periodo.inicio)} a ${fmtDateBR(snap.periodo.fim)}`;
  const filtroLabel = `Empresa: ${snap.filtros.empresa} · Executiva: ${snap.filtros.executiva}`;
  const mesAtualLabel = monthLabelBR(snap.periodo.inicio);
  const mesAntLabel = snap.periodoAnterior ? monthLabelBR(snap.periodoAnterior.inicio) : "mês anterior";

  const m = snap.metrics;
  const p = snap.metricsAnterior;

  // Variáveis de layout compartilhadas
  const gap = 0.2;
  const cols = 3;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;

  // ================= SLIDE — VISÃO ESTRATÉGICA =================
  {
    const sv = pptx.addSlide();
    addBackground(sv, "conteudo");
    slideHeader(sv, "Visão Estratégica", "Comparativo com o mês anterior — Volume de Reclamações Recebidas", periodoLabel);

    // Kicker
    sv.addText("DESEMPENHO GERAL", {
      x: SAFE.x, y: SAFE.y, w: SAFE.w, h: 0.3,
      fontSize: 11, bold: true, color: C.MUTED, charSpacing: 3, fontFace: "Calibri",
    });
    sv.addText("Volume de Reclamações Recebidas", {
      x: SAFE.x, y: SAFE.y + 0.28, w: SAFE.w, h: 0.5,
      fontSize: 22, bold: true, color: C.INK, fontFace: "Calibri",
    });

    const totalAtual = m.total;
    const totalAnt = p?.total ?? 0;
    const totalAcumulado = totalAtual + totalAnt;
    const mediaMensal = totalAcumulado / 2;
    const deltaPct = totalAnt > 0 ? ((totalAtual - totalAnt) / totalAnt) * 100 : null;
    const reducao = deltaPct !== null && deltaPct < 0;
    const diffAbs = totalAtual - totalAnt;

    // ===== Linha de 3 cartões métricos =====
    const cardsY = SAFE.y + 0.9;
    const cardsH = 1.5;
    const cardGap = 0.2;
    const cardW = (SAFE.w - cardGap * 2) / 3;

    const drawMetricCard = (
      cx: number, label: string, valueTxt: string, sub: string, cor: string, destaque: boolean, icon: string,
    ) => {
      sv.addShape("roundRect", {
        x: cx, y: cardsY, w: cardW, h: cardsH,
        fill: { color: C.CARD },
        line: { color: destaque ? cor : C.BORDER, width: destaque ? 2 : 0.5 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "9AA5B1", opacity: 0.18, blur: 6, offset: 1.5, angle: 90 },
      });
      sv.addText(`${icon}  ${label}`, {
        x: cx + 0.25, y: cardsY + 0.15, w: cardW - 0.5, h: 0.3,
        fontSize: 10, bold: true, color: destaque ? cor : C.MUTED, charSpacing: 2, fontFace: "Calibri",
      });
      sv.addText(valueTxt, {
        x: cx + 0.25, y: cardsY + 0.42, w: cardW - 0.5, h: 0.72,
        fontSize: 40, bold: true, color: cor, fontFace: "Calibri", align: "center", valign: "middle",
      });
      sv.addText(sub, {
        x: cx + 0.25, y: cardsY + cardsH - 0.4, w: cardW - 0.5, h: 0.32,
        fontSize: 11, color: C.INK_SOFT, fontFace: "Calibri", align: "center",
      });
    };

    drawMetricCard(SAFE.x, "MÊS ANTERIOR", `${totalAnt}`, mesAntLabel, C.INK, false, "▣");
    drawMetricCard(SAFE.x + cardW + cardGap, "MÊS ATUAL", `${totalAtual}`, mesAtualLabel, C.PRIMARY, true, "◆");
    drawMetricCard(SAFE.x + (cardW + cardGap) * 2, "TOTAL ACUMULADO", `${totalAcumulado.toLocaleString("pt-BR")}`, "PERÍODO CONSOLIDADO", "1B4332", false, "📊");

    // ===== Gráfico de barras — 3 barras coloridas =====
    const chartY = cardsY + cardsH + 0.25;
    const chartH = SAFE.h - (chartY - SAFE.y) - 0.9;
    card(sv, SAFE.x, chartY, SAFE.w, chartH);

    sv.addText(`Média mensal: ${Math.round(mediaMensal)} reclamações/mês`, {
      x: SAFE.x + 0.3, y: chartY + 0.1, w: SAFE.w - 0.6, h: 0.3,
      fontSize: 11, italic: true, color: C.MUTED, fontFace: "Calibri", align: "right",
    });

    sv.addChart(pptx.ChartType.bar,
      [{
        name: "Volume",
        labels: [mesAntLabel, mesAtualLabel, "Total Acumulado"],
        values: [totalAnt, totalAtual, totalAcumulado],
      }],
      {
        x: SAFE.x + 0.3, y: chartY + 0.4, w: SAFE.w - 0.6, h: chartH - 0.55,
        barDir: "col",
        chartColors: ["40916C", "40916C", "1B4332"],
        chartColorsOpacity: 100,
        showValue: true, dataLabelFontSize: 13, dataLabelColor: C.INK, dataLabelPosition: "outEnd",
        dataLabelFontBold: true,
        catAxisLabelFontSize: 12, catAxisLabelColor: C.INK,
        valAxisLabelFontSize: 10, valAxisLabelColor: C.INK_SOFT,
        showLegend: false, barGapWidthPct: 55,
      },
    );

    // ===== Análise de tendência =====
    const trendY = SAFE.y + SAFE.h - 0.6;
    const trendCor = reducao ? C.POSITIVE : deltaPct !== null && deltaPct > 0 ? C.NEGATIVE : C.MUTED;
    const trendIcon = reducao ? "📉" : deltaPct !== null && deltaPct > 0 ? "📈" : "▬";
    const trendVerbo = reducao ? "Redução" : deltaPct !== null && deltaPct > 0 ? "Aumento" : "Estabilidade";
    const deltaTxt = deltaPct !== null ? `${Math.abs(deltaPct).toFixed(1)}%` : "—";
    const absTxt = deltaPct !== null ? `${Math.abs(diffAbs)} reclamações a ${diffAbs < 0 ? "menos" : "mais"}` : "sem comparativo";

    sv.addText(
      [
        { text: `${trendIcon} `, options: { fontSize: 12 } },
        { text: `${trendVerbo} de ${deltaTxt} de ${mesAntLabel} para ${mesAtualLabel} (${absTxt}).   `, options: { bold: true, color: trendCor } },
        { text: `📊 Total acumulado: ${totalAcumulado.toLocaleString("pt-BR")} reclamações.   `, options: { color: C.INK_SOFT } },
        { text: `📈 Média mensal: ${Math.round(mediaMensal)} reclamações/mês.`, options: { color: C.INK_SOFT } },
      ],
      {
        x: SAFE.x, y: trendY, w: SAFE.w, h: 0.5,
        fontSize: 11, fontFace: "Calibri", valign: "middle",
      },
    );

    slideFooter(sv, filtroLabel);
  }

  // ================= SLIDE — PRAZO DE RESPOSTA (Análise Detalhada) =================
  {
    const sp = pptx.addSlide();
    addBackground(sp, "conteudo");
    slideHeader(sp, "Prazo de Resposta — Análise Detalhada", "Respondidas no prazo × Fora do prazo × Em aberto", periodoLabel);

    // Cálculo de valores absolutos a partir das métricas
    const totalAtual = m.total;
    const foraCount = Math.round((totalAtual * m.pctForaDoPrazo) / 100);
    const emAbertoCount = m.emAberto;
    const noPrazoCount = Math.max(0, totalAtual - foraCount - emAbertoCount);
    const pctNo = totalAtual > 0 ? Math.round((noPrazoCount / totalAtual) * 100) : 0;
    const pctFora = totalAtual > 0 ? Math.round((foraCount / totalAtual) * 100) : 0;
    const pctAberto = totalAtual > 0 ? Math.round((emAbertoCount / totalAtual) * 100) : 0;

    // ===== 3 Cartões métricos =====
    const cardsY = SAFE.y + 0.1;
    const cardsH = 1.5;
    const cardGap = 0.2;
    const cardW = (SAFE.w - cardGap * 2) / 3;

    const drawStatusCard = (
      cx: number, icon: string, label: string, valueTxt: string, sub: string, cor: string,
    ) => {
      card(sp, cx, cardsY, cardW, cardsH);
      sp.addText(`${icon}  ${label}`, {
        x: cx + 0.25, y: cardsY + 0.15, w: cardW - 0.5, h: 0.3,
        fontSize: 11, bold: true, color: cor, charSpacing: 2, fontFace: "Calibri",
      });
      sp.addText(valueTxt, {
        x: cx + 0.25, y: cardsY + 0.42, w: cardW - 0.5, h: 0.75,
        fontSize: 42, bold: true, color: cor, fontFace: "Calibri", align: "center", valign: "middle",
      });
      sp.addText(sub, {
        x: cx + 0.25, y: cardsY + cardsH - 0.4, w: cardW - 0.5, h: 0.32,
        fontSize: 11, color: C.INK_SOFT, fontFace: "Calibri", align: "center",
      });
    };

    drawStatusCard(SAFE.x, "✅", "NO PRAZO", `${noPrazoCount}`, `${pctNo}% do total`, "16A34A");
    drawStatusCard(SAFE.x + cardW + cardGap, "❌", "FORA DO PRAZO", `${foraCount}`, `${pctFora}% do total`, "DC2626");
    drawStatusCard(SAFE.x + (cardW + cardGap) * 2, "🔄", "EM ABERTO", `${emAbertoCount}`, `${pctAberto}% • ${mesAtualLabel}`, "D97706");

    // ===== Gráfico de barras empilhadas horizontais (100%) =====
    const chartY = cardsY + cardsH + 0.2;
    const chartH = 2.6;
    card(sp, SAFE.x, chartY, SAFE.w, chartH);
    sp.addText("Evolução mensal — % de cumprimento de prazo", {
      x: SAFE.x + 0.3, y: chartY + 0.1, w: SAFE.w - 0.6, h: 0.3,
      fontSize: 12, bold: true, color: C.INK, fontFace: "Calibri",
    });

    const rawSeries = snap.monthlySeries.length > 0
      ? snap.monthlySeries.slice(-2)
      : [
        { label: mesAntLabel, sla: 0, fora: 0, aberto: 0 },
        { label: mesAtualLabel, sla: pctNo, fora: pctFora, aberto: pctAberto },
      ];

    // Normaliza para garantir que sla + fora + aberto = 100 (evita overflow visual)
    const series = rawSeries.map((s) => {
      const total = Math.max(1, s.sla + s.fora + s.aberto);
      const sla = Math.round((s.sla / total) * 100);
      const fora = Math.round((s.fora / total) * 100);
      const aberto = Math.max(0, 100 - sla - fora);
      return { label: s.label, sla, fora, aberto };
    });
    const labels = series.map((s) => s.label);

    // Oculta rótulos <= 6% (evita labels cortados nas fatias pequenas)
    const hideSmall = '[<=6]"";0"%"';

    sp.addChart(pptx.ChartType.bar,
      [
        { name: "No prazo", labels, values: series.map((s) => s.sla) },
        { name: "Fora do prazo", labels, values: series.map((s) => s.fora) },
        { name: "Em aberto", labels, values: series.map((s) => s.aberto) },
      ],
      {
        // Reserva ~0.6" à direita para acomodar rótulos de fatias pequenas
        x: SAFE.x + 0.3, y: chartY + 0.45, w: SAFE.w - 1.0, h: chartH - 0.6,
        barDir: "bar", barGrouping: "percentStacked",
        chartColors: ["16A34A", "DC2626", "D97706"],
        showValue: true,
        dataLabelFontSize: 10, dataLabelColor: "FFFFFF", dataLabelFontBold: true,
        dataLabelPosition: "ctr", dataLabelFormatCode: hideSmall,
        catAxisLabelFontSize: 12, catAxisLabelColor: C.INK, catAxisLabelFontBold: true,
        valAxisLabelFontSize: 9, valAxisLabelColor: C.INK_SOFT,
        valAxisMinVal: 0, valAxisMaxVal: 1,
        valAxisMajorUnit: 0.1,
        valAxisLabelFormatCode: '0%',
        showLegend: true, legendPos: "b", legendFontSize: 10, legendColor: C.INK,
        barGapWidthPct: 40,
      },
    );

    // ===== Caixa de análise de evolução =====
    const anYs = chartY + chartH + 0.2;
    const anH = SAFE.y + SAFE.h - anYs - 0.1;
    sp.addShape("roundRect", {
      x: SAFE.x, y: anYs, w: SAFE.w, h: anH,
      fill: { color: "F8F9FA" },
      line: { color: "2D6A4F", width: 0 },
      rectRadius: 0.05,
    });
    // Borda esquerda 4px verde
    sp.addShape("rect", {
      x: SAFE.x, y: anYs, w: 0.06, h: anH,
      fill: { color: "2D6A4F" }, line: { color: "2D6A4F", width: 0 },
    });

    const prevSla = snap.monthlySeries.length >= 2 ? snap.monthlySeries[snap.monthlySeries.length - 2].sla : null;
    const currSla = snap.monthlySeries.length >= 1 ? snap.monthlySeries[snap.monthlySeries.length - 1].sla : pctNo;
    const slaTrend = prevSla !== null ? (currSla >= prevSla ? "melhora" : "piora") : "estabilidade";
    const topSetor = snap.volumeSetor[0]?.setor ?? "—";

    sp.addText("🤖 ANÁLISE DE EVOLUÇÃO", {
      x: SAFE.x + 0.25, y: anYs + 0.1, w: SAFE.w - 0.5, h: 0.3,
      fontSize: 12, bold: true, color: "2D6A4F", fontFace: "Calibri",
    });
    sp.addText(
      [
        { text: `• Tendência: ${slaTrend} no cumprimento de prazos de ${mesAntLabel} para ${mesAtualLabel}.\n`, options: {} },
        { text: `• Ponto crítico: ${topSetor} concentra o maior volume do período — monitorar SLA de perto.\n`, options: {} },
        { text: `• Destaque: ${pctNo}% das reclamações do mês atual foram respondidas dentro do prazo.\n`, options: {} },
        { text: `• Recomendação: atenção às ${emAbertoCount} demandas em aberto de ${mesAtualLabel} — risco de vencimento de SLA nas próximas 72h.`, options: {} },
      ],
      {
        x: SAFE.x + 0.25, y: anYs + 0.4, w: SAFE.w - 0.5, h: anH - 0.5,
        fontSize: 11, color: "1F2937", fontFace: "Calibri", valign: "top", paraSpaceAfter: 2,
      },
    );

    slideFooter(sp, filtroLabel);
  }


  // Paleta executiva teal (usada nos slides 3 e 4)
  const TEAL = {
    D1: "0D6E6E", D2: "14B8A6", D3: "99F6E4", G1: "D1D5DB", G2: "E5E7EB",
    RED_BG: "FEF2F2", RED_FG: "DC2626", RED_CELL: "FEE2E2",
    YEL_BG: "FFFBEB", YEL_FG: "D97706", YEL_CELL: "FEF3C7",
    GRN_BG: "F0FDF4", GRN_FG: "16A34A",
    INK: "1F2937", MUTED: "9CA3AF", BORDER: "E5E7EB",
  } as const;

  // Renderiza uma linha de "pílulas" KPI em teal escuro
  const drawKpiPills = (slide: any, y: number, items: { icon: string; text: string }[]) => {
    const totalW = SAFE.w;
    const gapP = 0.15;
    const pillW = (totalW - gapP * (items.length - 1)) / items.length;
    const pillH = 0.5;
    items.forEach((it, i) => {
      const x = SAFE.x + i * (pillW + gapP);
      slide.addShape("roundRect", {
        x, y, w: pillW, h: pillH,
        fill: { color: TEAL.D1 }, line: { color: TEAL.D1, width: 0 },
        rectRadius: 0.08,
      });
      slide.addText(`${it.icon}  ${it.text}`, {
        x: x + 0.15, y, w: pillW - 0.3, h: pillH,
        fontSize: 12, bold: true, color: "FFFFFF", fontFace: "Calibri",
        align: "center", valign: "middle",
      });
    });
  };

  // ================= SLIDE 3 — DISTRIBUIÇÃO DE SETORES & MOTIVOS =================
  {
    const sd = pptx.addSlide();
    addBackground(sd, "conteudo");
    slideHeader(sd, "Distribuição de Setores & Motivos", "Concentração por setor responsável e principais tipos de reclamação", periodoLabel);

    const topSetor = snap.volumeSetor[0];
    const cirurgica = snap.temposSegmentados.cirurgica;
    const demais = snap.temposSegmentados.demais;
    const totalDemandas = m.total;
    const nSetores = snap.volumeSetor.length;
    const mediaH = Math.round((m.tempoMedioDias || 0) * 24);

    // KPI Pills
    drawKpiPills(sd, SAFE.y, [
      { icon: "📋", text: `${totalDemandas} Reclamações` },
      { icon: "🏥", text: `${nSetores} Setores` },
      { icon: "⏱️", text: `Média ${mediaH}h` },
      { icon: "⚠️", text: `${m.pctForaDoPrazo}% fora do SLA` },
    ]);

    // ===== Bloco superior: Donut (esquerda) + Alert Cards (direita) =====
    const topY = SAFE.y + 0.7;
    const topH = 3.0;
    const leftW = 5.4;
    const rightX = SAFE.x + leftW + 0.25;
    const rightW = SAFE.w - leftW - 0.25;

    // -- DONUT --
    card(sd, SAFE.x, topY, leftW, topH);
    sd.addText("Concentração por Setor", {
      x: SAFE.x + 0.25, y: topY + 0.1, w: leftW - 0.5, h: 0.3,
      fontSize: 13, bold: true, color: C.INK, fontFace: "Calibri",
    });

    const dcPct = topSetor?.pct ?? 0;
    const dcN = topSetor?.n ?? 0;
    const outrosPct = topSetor ? Math.max(0, 100 - dcPct) : 0;
    const outrosN = topSetor ? totalDemandas - dcN : 0;
    const dcNome = topSetor?.setor ?? "Sem dados de setor";

    // Donut à esquerda dentro do card
    const donutX = SAFE.x + 0.2;
    const donutY = topY + 0.45;
    const donutSize = 2.4;
    sd.addChart(pptx.ChartType.doughnut,
      [{
        name: "Setores",
        labels: [dcNome, "Outros Setores"],
        values: [dcPct, outrosPct],
      }],
      {
        x: donutX, y: donutY, w: donutSize, h: donutSize,
        chartColors: [TEAL.D1, TEAL.G2],
        showLegend: false,
        holeSize: 60,
        showPercent: true,
        dataLabelFontSize: 12, dataLabelFontBold: true, dataLabelColor: TEAL.INK,
        dataLabelPosition: "outEnd",
        dataLabelFormatCode: '0"%"',
      },
    );
    // Texto central do donut
    sd.addText(`${totalDemandas}`, {
      x: donutX, y: donutY + donutSize / 2 - 0.45, w: donutSize, h: 0.55,
      fontSize: 28, bold: true, color: TEAL.INK, fontFace: "Calibri", align: "center",
    });
    sd.addText("demandas", {
      x: donutX, y: donutY + donutSize / 2 + 0.1, w: donutSize, h: 0.3,
      fontSize: 11, color: TEAL.MUTED, fontFace: "Calibri", align: "center",
    });

    // Legenda à direita do donut
    const legX = donutX + donutSize + 0.15;
    const legW = leftW - (donutSize + 0.4);
    const legY = topY + 0.9;
    const drawLegend = (yy: number, cor: string, nome: string, n: number, pct: number) => {
      sd.addShape("rect", {
        x: legX, y: yy + 0.08, w: 0.18, h: 0.18,
        fill: { color: cor }, line: { color: cor, width: 0 },
      });
      sd.addText(nome, {
        x: legX + 0.25, y: yy, w: legW - 1.3, h: 0.32,
        fontSize: 11, bold: true, color: TEAL.INK, fontFace: "Calibri", valign: "middle",
      });
      sd.addText(`${n}`, {
        x: legX + legW - 1.1, y: yy, w: 0.55, h: 0.32,
        fontSize: 11, color: TEAL.INK, fontFace: "Calibri", align: "right", valign: "middle",
      });
      sd.addText(`${pct}%`, {
        x: legX + legW - 0.5, y: yy, w: 0.5, h: 0.32,
        fontSize: 11, bold: true, color: TEAL.INK, fontFace: "Calibri", align: "right", valign: "middle",
      });
    };
    drawLegend(legY, TEAL.D1, dcNome, dcN, dcPct);
    drawLegend(legY + 0.5, TEAL.G2, "Outros Setores", outrosN, outrosPct);

    // -- ALERT CARDS --
    const alertH = (topH - 0.2) / 3;
    const alertGap = 0.1;
    const drawAlert = (idx: number, borderCor: string, bgCor: string, emoji: string, titulo: string, nome: string, linha2: string, linha3: string) => {
      const ay = topY + 0.1 + idx * (alertH + alertGap);
      const aH = alertH - alertGap;
      // fundo
      sd.addShape("roundRect", {
        x: rightX, y: ay, w: rightW, h: aH,
        fill: { color: bgCor }, line: { color: TEAL.BORDER, width: 0.5 },
        rectRadius: 0.08,
        shadow: { type: "outer", color: "9AA5B1", opacity: 0.12, blur: 4, offset: 1, angle: 90 },
      });
      // borda esquerda 4px colorida
      sd.addShape("rect", {
        x: rightX, y: ay, w: 0.06, h: aH,
        fill: { color: borderCor }, line: { color: borderCor, width: 0 },
      });
      sd.addText(`${emoji}  ${titulo}`, {
        x: rightX + 0.2, y: ay + 0.05, w: rightW - 0.3, h: 0.28,
        fontSize: 10, bold: true, color: borderCor, charSpacing: 2, fontFace: "Calibri",
      });
      sd.addText(nome, {
        x: rightX + 0.2, y: ay + 0.32, w: rightW - 0.3, h: 0.32,
        fontSize: 14, bold: true, color: TEAL.INK, fontFace: "Calibri",
      });
      sd.addText(linha2, {
        x: rightX + 0.2, y: ay + 0.62, w: rightW - 0.3, h: 0.24,
        fontSize: 10, color: TEAL.INK, fontFace: "Calibri",
      });
      sd.addText(linha3, {
        x: rightX + 0.2, y: ay + 0.82, w: rightW - 0.3, h: 0.24,
        fontSize: 10, color: TEAL.INK, fontFace: "Calibri",
      });
    };
    drawAlert(0, TEAL.RED_FG, TEAL.RED_BG, "🔴", "PRINCIPAL OFENSOR",
      dcNome,
      topSetor ? `${dcPct}% das demandas · ${dcN} registros` : "Nenhum setor no período",
      topSetor ? "Setor com maior volume de reclamações no período" : "—");
    drawAlert(1, TEAL.YEL_FG, TEAL.YEL_BG, "🟡", "ATENÇÃO — SLA CIRÚRGICO",
      "Agenda Cirúrgica",
      `Tempo médio: ${Math.round(cirurgica.horas)}h · SLA: 168h`,
      `${cirurgica.foraPct}% fora do prazo`);
    drawAlert(2, TEAL.GRN_FG, TEAL.GRN_BG, "🟢", "DESTAQUE POSITIVO",
      "Demais Setores",
      `Média de resposta: ${Math.round(demais.horas)}h · SLA: 72h`,
      `Apenas ${demais.foraPct}% sem SLA`);

    // ===== Bloco inferior: Top Tipos de Reclamação =====
    const botY = topY + topH + 0.15;
    const botH = SAFE.y + SAFE.h - botY - 0.1;
    card(sd, SAFE.x, botY, SAFE.w, botH);
    sd.addText("Top Tipos de Reclamação", {
      x: SAFE.x + 0.25, y: botY + 0.08, w: SAFE.w - 0.5, h: 0.28,
      fontSize: 13, bold: true, color: C.INK, fontFace: "Calibri",
    });

    if (snap.volumeTipo.length > 0) {
      const tops = snap.volumeTipo.slice(0, 5);
      const gradient = [TEAL.D1, TEAL.D2, TEAL.D3, TEAL.G1, TEAL.G2];
      // Constrói labels enriquecidos "Nome — 358 · 69%"
      const labelsRich = tops.map((t) => `${t.tipo}  ${t.n} · ${t.pct}%`);
      sd.addChart(pptx.ChartType.bar,
        [{
          name: "Reclamações",
          labels: labelsRich,
          values: tops.map((t) => t.n),
        }],
        {
          x: SAFE.x + 0.25, y: botY + 0.4, w: SAFE.w - 0.5, h: botH - 0.75,
          barDir: "bar", chartColors: gradient, chartColorsOpacity: 100,
          showValue: false,
          catAxisLabelFontSize: 10, catAxisLabelColor: TEAL.INK,
          valAxisLabelFontSize: 9, valAxisLabelColor: TEAL.MUTED,
          valAxisHidden: true,
          showLegend: false, barGapWidthPct: 30,
        },
      );
      const topTipo = tops[0];
      sd.addText(`⚠️  ${topTipo.tipo} = ${topTipo.pct}% do total — foco prioritário`, {
        x: SAFE.x + 0.25, y: botY + botH - 0.32, w: SAFE.w - 0.5, h: 0.28,
        fontSize: 11, italic: true, color: TEAL.YEL_FG, fontFace: "Calibri",
      });
    }

    slideFooter(sd, filtroLabel);
  }


  // ================= SLIDE 4 — VOLUME POR SETOR + PRINCIPAIS GARGALOS =================
  if (snap.volumeSetor.length > 0 || snap.gargalos.length > 0) {
    const sc = pptx.addSlide();
    addBackground(sc, "conteudo");
    slideHeader(
      sc,
      "Volume por Setor & Principais Gargalos",
      "Ranking de setores por demandas e cruzamento setor × tipo por impacto",
      periodoLabel,
    );

    const totalDemandas = m.total;
    const nSetores = snap.volumeSetor.length;
    const pior = [...snap.gargalos].sort((a, b) => b.foraPct - a.foraPct)[0];
    const piorTempo = [...snap.gargalos].sort((a, b) => b.tempoMedio - a.tempoMedio)[0];

    // KPI Pills
    drawKpiPills(sc, SAFE.y, [
      { icon: "🏥", text: `${nSetores} Setores` },
      { icon: "📋", text: `${totalDemandas} Demandas` },
      { icon: "⚠️", text: `Maior gargalo: ${pior ? `${pior.setor} ${pior.foraPct}%` : "—"}` },
      { icon: "⏱️", text: `Pior tempo: ${piorTempo ? `${piorTempo.tempoMedio.toFixed(1)} dias` : "—"}` },
    ]);

    const bodyY = SAFE.y + 0.7;
    const bodyH = SAFE.y + SAFE.h - bodyY;
    const gap = 0.25;
    const leftW = 5.2;
    const rightX = SAFE.x + leftW + gap;
    const rightW = SAFE.w - leftW - gap;

    // ===== ESQUERDA: Volume por Setor =====
    if (snap.volumeSetor.length > 0) {
      card(sc, SAFE.x, bodyY, leftW, bodyH);
      sc.addText("Volume por Setor", {
        x: SAFE.x + 0.25, y: bodyY + 0.1, w: leftW - 0.5, h: 0.3,
        fontSize: 13, bold: true, color: C.INK, fontFace: "Calibri",
      });

      const sorted = [...snap.volumeSetor].sort((a, b) => b.n - a.n).slice(0, 8);
      const gradient = [TEAL.D1, TEAL.D2, TEAL.D3, TEAL.G1, TEAL.G1, TEAL.G2, TEAL.G2, TEAL.G2];
      const labels = sorted.map((v) => `${v.setor}  ${v.n} · ${v.pct}%`);

      sc.addChart(pptx.ChartType.bar,
        [{ name: "Demandas", labels, values: sorted.map((v) => v.n) }],
        {
          x: SAFE.x + 0.2, y: bodyY + 0.45, w: leftW - 0.4, h: bodyH - 1.0,
          barDir: "bar", chartColors: gradient.slice(0, sorted.length),
          showValue: false,
          catAxisLabelFontSize: 10, catAxisLabelColor: TEAL.INK,
          valAxisLabelFontSize: 9, valAxisLabelColor: TEAL.MUTED,
          valAxisHidden: true,
          valAxisLabelFormatCode: "0",
          showLegend: false, barGapWidthPct: 30,
        },
      );

      const top2Pct = sorted.slice(0, 2).reduce((s, v) => s + v.pct, 0);
      sc.addText(
        sorted.length >= 2
          ? `${sorted[0].setor} + ${sorted[1].setor} = ${top2Pct}% do volume`
          : `${sorted[0]?.setor ?? ""} concentra ${sorted[0]?.pct ?? 0}% do volume`,
        {
          x: SAFE.x + 0.25, y: bodyY + bodyH - 0.4, w: leftW - 0.5, h: 0.3,
          fontSize: 11, bold: true, color: TEAL.D1, fontFace: "Calibri",
        },
      );
    }

    // ===== DIREITA: Principais Gargalos =====
    if (snap.gargalos.length > 0) {
      card(sc, rightX, bodyY, rightW, bodyH);
      sc.addText("Principais Gargalos", {
        x: rightX + 0.25, y: bodyY + 0.1, w: rightW - 0.5, h: 0.3,
        fontSize: 13, bold: true, color: C.INK, fontFace: "Calibri",
      });

      const cellForPct = (pct: number) => {
        if (pct >= 30) return { fill: { color: TEAL.RED_CELL }, color: TEAL.RED_FG, bold: true };
        if (pct >= 8) return { fill: { color: TEAL.YEL_CELL }, color: TEAL.YEL_FG, bold: true };
        if (pct >= 2) return { fill: { color: TEAL.YEL_BG }, color: TEAL.YEL_FG, bold: false };
        if (pct >= 1) return { fill: { color: TEAL.GRN_BG }, color: TEAL.GRN_FG, bold: true };
        return { fill: { color: "FFFFFF" }, color: TEAL.MUTED, bold: false };
      };

      const header = [
        { text: "Setor", options: { bold: true, color: "FFFFFF", fill: { color: TEAL.D1 }, align: "left", valign: "middle" } },
        { text: "Tipo", options: { bold: true, color: "FFFFFF", fill: { color: TEAL.D1 }, align: "left", valign: "middle" } },
        { text: "Volume", options: { bold: true, color: "FFFFFF", fill: { color: TEAL.D1 }, align: "center", valign: "middle" } },
        { text: "Dias Médios", options: { bold: true, color: "FFFFFF", fill: { color: TEAL.D1 }, align: "center", valign: "middle" } },
        { text: "% Fora SLA", options: { bold: true, color: "FFFFFF", fill: { color: TEAL.D1 }, align: "center", valign: "middle" } },
      ];
      const rows = [
        header,
        ...snap.gargalos.slice(0, 8).map((g, i) => {
          const zebra = i % 2 === 0 ? "FFFFFF" : TEAL.GRN_BG;
          const cell = cellForPct(g.foraPct);
          return [
            { text: g.setor, options: { color: TEAL.INK, fill: { color: zebra }, align: "left", valign: "middle" } },
            { text: g.tipo, options: { color: TEAL.INK, fill: { color: zebra }, align: "left", valign: "middle" } },
            { text: String(g.qtd), options: { color: TEAL.INK, fill: { color: zebra }, align: "center", valign: "middle" } },
            { text: g.tempoMedio.toFixed(1), options: { color: TEAL.INK, fill: { color: zebra }, align: "center", valign: "middle" } },
            { text: `${g.foraPct}%`, options: { color: cell.color, bold: cell.bold, fill: cell.fill, align: "center", valign: "middle" } },
          ];
        }),
      ];
      const tableH = bodyH - 1.9;
      sc.addTable(rows as any, {
        x: rightX + 0.2, y: bodyY + 0.5, w: rightW - 0.4,
        colW: [1.75, 1.75, 0.8, 1.0, 1.0],
        fontSize: 10, fontFace: "Calibri",
        border: { type: "solid", pt: 0.5, color: TEAL.BORDER },
        rowH: 0.32, valign: "middle",
      });

      // Alerta crítico
      const alertY = bodyY + bodyH - 1.3;
      const alertH = 1.15;
      sc.addShape("roundRect", {
        x: rightX + 0.2, y: alertY, w: rightW - 0.4, h: alertH,
        fill: { color: TEAL.RED_BG },
        line: { color: TEAL.RED_FG, width: 2 },
        rectRadius: 0.1,
      });
      sc.addText("🚨  GARGALO CRÍTICO IDENTIFICADO", {
        x: rightX + 0.35, y: alertY + 0.08, w: rightW - 0.7, h: 0.3,
        fontSize: 11, bold: true, color: TEAL.RED_FG, fontFace: "Calibri", charSpacing: 1,
      });
      const g0 = pior;
      const g1 = snap.gargalos.find((g) => g.setor.toLowerCase().includes("agenda cir")) ?? snap.gargalos[1];
      sc.addText(
        [
          g0 ? { text: `${g0.setor} → ${g0.tipo}: ${g0.foraPct}% fora do SLA\n`, options: { bold: true, color: TEAL.INK } } : { text: "", options: {} },
          g0 ? { text: `Apenas ${g0.qtd} caso(s) mas média de ${g0.tempoMedio.toFixed(1)} dias — investigar\n`, options: { color: TEAL.INK } } : { text: "", options: {} },
          g1 && g1 !== g0 ? { text: `${g1.setor}: ${g1.qtd} casos · ${g1.foraPct}% fora · ${g1.tempoMedio.toFixed(1)} dias`, options: { color: TEAL.INK } } : { text: "", options: {} },
        ],
        {
          x: rightX + 0.35, y: alertY + 0.38, w: rightW - 0.7, h: alertH - 0.45,
          fontSize: 10, fontFace: "Calibri", valign: "top", paraSpaceAfter: 1,
        },
      );
    }

    slideFooter(sc, filtroLabel);
  }


  // ================= SLIDE FINAL — RANKING EMPRESAS: VIDAS vs. RECLAMAÇÕES =================
  if (snap.rankingEmpresasVidas && snap.rankingEmpresasVidas.length > 0) {
    const sr = pptx.addSlide();
    addBackground(sr, "conteudo");
    slideHeader(
      sr,
      "Ranking Empresas: Vidas vs. Reclamações",
      "Top 15 empresas por volume de reclamações — % representa reclamações ÷ vidas do contrato",
      periodoLabel,
    );
    card(sr, SAFE.x, SAFE.y, SAFE.w, SAFE.h);

    const rows = snap.rankingEmpresasVidas.slice(0, 15);

    const statusOf = (idx: number): { label: string; cor: string } => {
      if (idx <= 0) return { label: "S/ vidas", cor: C.MUTED };
      if (idx < 1) return { label: "Excelente", cor: C.POSITIVE };
      if (idx < 2) return { label: "Estável", cor: C.ACCENT };
      if (idx < 3) return { label: "Atenção", cor: C.WARNING };
      return { label: "Crítico", cor: C.NEGATIVE };
    };

    const headerRow = [
      { text: "EMPRESA CLIENTE", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "left" } },
      { text: "VIDAS", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "right" } },
      { text: "RECLAMAÇÕES", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "right" } },
      { text: "% DO CONTRATO", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "right" } },
      { text: "STATUS", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "center" } },
    ];

    const bodyRows = rows.map((r) => {
      const st = statusOf(r.indice);
      return [
        { text: r.empresa, options: { color: C.INK, bold: true, valign: "middle", align: "left" } },
        { text: r.vidas.toLocaleString("pt-BR"), options: { color: C.INK, valign: "middle", align: "right" } },
        { text: r.reclamacoes.toLocaleString("pt-BR"), options: { color: C.INK, valign: "middle", align: "right" } },
        { text: r.vidas > 0 ? `${r.indice.toFixed(2)}%` : "—", options: { color: st.cor, bold: true, valign: "middle", align: "right" } },
        { text: st.label, options: { color: "FFFFFF", bold: true, fill: { color: st.cor }, valign: "middle", align: "center" } },
      ];
    });

    sr.addTable([headerRow as any, ...(bodyRows as any)], {
      x: SAFE.x + 0.25, y: SAFE.y + 0.25, w: SAFE.w - 0.5,
      colW: [4.4, 1.6, 2.0, 1.6, 2.13],
      rowH: 0.34,
      fontFace: "Calibri",
      fontSize: 11,
      border: { type: "solid", pt: 0.5, color: C.BORDER },
    });

    slideFooter(sr, filtroLabel);
  }



  const fname = `Dashboard_Reclamacoes_${snap.periodo.inicio}_a_${snap.periodo.fim}.pptx`;
  await pptx.writeFile({ fileName: fname });
}
