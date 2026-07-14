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

const SAFE = { x: 0.55, y: 1.4, w: 12.23, h: 5.8 } as const;
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
  slide.addText(sub, {
    x: HEADER.x + 0.25, y: HEADER.y + 0.5, w: 8, h: 0.3,
    fontSize: 11, color: C.MUTED, fontFace: "Calibri",
  });
  slide.addText(periodo, {
    x: HEADER.x + 8.3, y: HEADER.y + 0.5, w: HEADER.w - 8.6, h: 0.3,
    fontSize: 11, color: C.PRIMARY, bold: true, fontFace: "Calibri", align: "right",
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

  // ================= SLIDE 1 — CAPA COMPARATIVA =================
  const s1 = pptx.addSlide();
  addBackground(s1, "capa");

  // Cartão-envelope com todo conteúdo
  slideHeader(
    s1,
    "Dashboard de Reclamações",
    `Painel executivo · ${mesAtualLabel} vs. ${mesAntLabel}`,
    periodoLabel,
  );

  // Grid 3x2 de KPIs comparativos
  const gap = 0.2;
  const cols = 3;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;
  const kH = (SAFE.h - 0.9 - gap) / 2; // reserva espaço para frase-resumo
  const gridY = SAFE.y;

  const corSla = m.slaNoPrazoPct >= 92 ? C.POSITIVE : m.slaNoPrazoPct >= 80 ? C.WARNING : C.NEGATIVE;
  const corBacklog = m.pctEmAberto > 30 ? C.NEGATIVE : m.pctEmAberto > 15 ? C.WARNING : C.POSITIVE;
  const corScore = m.score >= 85 ? C.POSITIVE : m.score >= 70 ? C.WARNING : C.NEGATIVE;
  const corFora = m.acimaDaMeta ? C.NEGATIVE : C.POSITIVE;

  const cards: Array<{
    label: string; atual: string; anterior: string | null;
    delta: number | null; unit: "pp" | "pct" | "abs"; inverse: boolean; cor: string;
  }> = [
    {
      label: "SLA no prazo", atual: `${m.slaNoPrazoPct}%`,
      anterior: p ? `${p.slaNoPrazoPct}%` : null,
      delta: delta(m.slaNoPrazoPct, p?.slaNoPrazoPct, "pp"),
      unit: "pp", inverse: false, cor: corSla,
    },
    {
      label: "Backlog em aberto", atual: `${m.emAberto}`,
      anterior: p ? `${p.emAberto}` : null,
      delta: deltaAbs(m.emAberto, p?.emAberto),
      unit: "pct", inverse: true, cor: corBacklog,
    },
    {
      label: "Pontuação operacional", atual: `${m.score}`,
      anterior: p ? `${p.score}` : null,
      delta: delta(m.score, p?.score, "pp"),
      unit: "pp", inverse: false, cor: corScore,
    },
    {
      label: "Total de demandas", atual: `${m.total}`,
      anterior: p ? `${p.total}` : null,
      delta: deltaAbs(m.total, p?.total),
      unit: "pct", inverse: false, cor: C.PRIMARY,
    },
    {
      label: "Fora do prazo", atual: `${m.pctForaDoPrazo}%`,
      anterior: p ? `${p.pctForaDoPrazo}%` : null,
      delta: delta(m.pctForaDoPrazo, p?.pctForaDoPrazo, "pp"),
      unit: "pp", inverse: true, cor: corFora,
    },
    {
      label: "Tempo médio de resolução", atual: `${m.tempoMedioDias.toFixed(1)}d`,
      anterior: p ? `${p.tempoMedioDias.toFixed(1)}d` : null,
      delta: p ? Math.round(((m.tempoMedioDias - p.tempoMedioDias) / (p.tempoMedioDias || 1)) * 100) : null,
      unit: "pct", inverse: true, cor: C.PRIMARY,
    },
  ];

  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = SAFE.x + col * (kW + gap);
    const y = gridY + row * (kH + gap);
    kpiComparativo(s1, x, y, kW, kH, c.label, c.atual, c.anterior, c.delta, c.unit, c.inverse, c.cor);
  });

  // Frase-resumo automática
  const frases: string[] = [];
  if (p) {
    const dSla = delta(m.slaNoPrazoPct, p.slaNoPrazoPct, "pp")!;
    const dBack = deltaAbs(m.emAberto, p.emAberto)!;
    const dFora = delta(m.pctForaDoPrazo, p.pctForaDoPrazo, "pp")!;
    const verboSla = dSla > 0 ? "subiu" : dSla < 0 ? "recuou" : "manteve-se";
    const verboBack = dBack > 0 ? "cresceu" : dBack < 0 ? "recuou" : "manteve-se";
    if (dSla !== 0) frases.push(`SLA no prazo ${verboSla} ${Math.abs(dSla)} p.p.`);
    if (dBack !== 0) frases.push(`backlog ${verboBack} ${Math.abs(dBack)}%`);
    if (dFora !== 0) frases.push(`fora do prazo variou ${dFora > 0 ? "+" : ""}${dFora} p.p.`);
  }
  const resumo = frases.length
    ? `${frases.join(" · ").charAt(0).toUpperCase()}${frases.join(" · ").slice(1)} em relação a ${mesAntLabel}.`
    : "Sem dado comparável do mês anterior para todos os indicadores.";

  const resumoY = gridY + 2 * (kH + gap) + 0.05;
  card(s1, SAFE.x, resumoY, SAFE.w, 0.75);
  s1.addText(resumo, {
    x: SAFE.x + 0.25, y: resumoY + 0.12, w: SAFE.w - 0.5, h: 0.5,
    fontSize: 14, bold: true, color: C.INK, fontFace: "Calibri", valign: "middle",
  });

  slideFooter(s1, filtroLabel);

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

    const contentY = SAFE.y + 0.9;
    const contentH = SAFE.h - 0.9;
    const leftW = 5.2;
    const rightX = SAFE.x + leftW + 0.3;
    const rightW = SAFE.w - leftW - 0.3;

    const totalAtual = m.total;
    const totalAnt = p?.total ?? null;
    const deltaPct = totalAnt && totalAnt > 0 ? ((totalAtual - totalAnt) / totalAnt) * 100 : null;
    const reducao = deltaPct !== null && deltaPct < 0;

    // Card mês anterior
    const cardH = 1.6;
    card(sv, SAFE.x, contentY, leftW, cardH);
    sv.addText("MÊS ANTERIOR", {
      x: SAFE.x + 0.3, y: contentY + 0.2, w: leftW - 0.3, h: 0.3,
      fontSize: 10, bold: true, color: C.MUTED, charSpacing: 3, fontFace: "Calibri",
    });
    sv.addText(mesAntLabel, {
      x: SAFE.x + 0.3, y: contentY + 0.5, w: leftW - 3, h: 0.4,
      fontSize: 14, color: C.INK_SOFT, fontFace: "Calibri",
    });
    sv.addText(totalAnt !== null ? `${totalAnt}` : "—", {
      x: SAFE.x + leftW - 2.5, y: contentY + 0.2, w: 2.2, h: cardH - 0.4,
      fontSize: 54, bold: true, color: C.INK, fontFace: "Calibri", align: "right", valign: "middle",
    });

    // Card mês atual (destacado)
    const card2Y = contentY + cardH + 0.2;
    sv.addShape("roundRect", {
      x: SAFE.x, y: card2Y, w: leftW, h: cardH,
      fill: { color: C.CARD },
      line: { color: C.PRIMARY, width: 2 },
      rectRadius: 0.1,
      shadow: { type: "outer", color: "9AA5B1", opacity: 0.18, blur: 6, offset: 1.5, angle: 90 },
    });
    sv.addText("MÊS ATUAL", {
      x: SAFE.x + 0.3, y: card2Y + 0.2, w: leftW - 0.3, h: 0.3,
      fontSize: 10, bold: true, color: C.PRIMARY, charSpacing: 3, fontFace: "Calibri",
    });
    sv.addText(mesAtualLabel, {
      x: SAFE.x + 0.3, y: card2Y + 0.5, w: leftW - 3, h: 0.4,
      fontSize: 14, color: C.INK_SOFT, fontFace: "Calibri",
    });
    sv.addText(`${totalAtual}`, {
      x: SAFE.x + leftW - 2.5, y: card2Y + 0.2, w: 2.2, h: cardH - 0.4,
      fontSize: 54, bold: true, color: C.PRIMARY, fontFace: "Calibri", align: "right", valign: "middle",
    });

    // Faixa de delta
    const badgeY = card2Y + cardH + 0.2;
    const badgeH = contentH - (badgeY - contentY) - 0.05;
    if (deltaPct !== null) {
      const cor = reducao ? C.POSITIVE : deltaPct > 0 ? C.NEGATIVE : C.MUTED;
      const arrow = reducao ? "▼" : deltaPct > 0 ? "▲" : "■";
      const label = reducao ? "Redução no Volume de Reclamações" : deltaPct > 0 ? "Aumento no Volume de Reclamações" : "Volume estável";
      sv.addShape("roundRect", {
        x: SAFE.x, y: badgeY, w: leftW, h: Math.max(0.6, badgeH),
        fill: { color: cor, transparency: 85 },
        line: { color: cor, width: 1 },
        rectRadius: 0.08,
      });
      sv.addText(`${arrow} ${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%  ${label}`, {
        x: SAFE.x + 0.25, y: badgeY, w: leftW - 0.5, h: Math.max(0.6, badgeH),
        fontSize: 13, bold: true, color: cor, fontFace: "Calibri", valign: "middle",
      });
    }

    // Gráfico de barras à direita
    card(sv, rightX, contentY, rightW, contentH - 0.05);
    sv.addChart(pptx.ChartType.bar,
      [{
        name: "Volume",
        labels: [mesAntLabel, mesAtualLabel],
        values: [totalAnt ?? 0, totalAtual],
      }],
      {
        x: rightX + 0.25, y: contentY + 0.25, w: rightW - 0.5, h: contentH - 0.55,
        barDir: "col",
        chartColors: [C.PRIMARY],
        chartColorsOpacity: 100,
        showValue: true, dataLabelFontSize: 14, dataLabelColor: C.INK, dataLabelPosition: "outEnd",
        dataLabelFontBold: true,
        catAxisLabelFontSize: 12, catAxisLabelColor: C.INK,
        valAxisLabelFontSize: 10, valAxisLabelColor: C.INK_SOFT,
        showLegend: false, barGapWidthPct: 60,
      },
    );

    slideFooter(sv, filtroLabel);
  }

  // ================= SLIDE — DISTRIBUIÇÃO DE SETORES & MOTIVOS =================
  {
    const sd = pptx.addSlide();
    addBackground(sd, "conteudo");
    slideHeader(sd, "Distribuição de Setores & Motivos", "Concentração por setor responsável e principais tipos de reclamação", periodoLabel);

    const topSetor = snap.volumeSetor[0];
    const topTipo = snap.volumeTipo[0];
    const cirurgica = snap.temposSegmentados.cirurgica;
    const demais = snap.temposSegmentados.demais;

    const leftW = 5.6;
    const rightX = SAFE.x + leftW + 0.3;
    const rightW = SAFE.w - leftW - 0.3;

    // ===== ESQUERDA: Fatores de Concentração =====
    card(sd, SAFE.x, SAFE.y, leftW, SAFE.h);
    sd.addText("Fatores de Concentração", {
      x: SAFE.x + 0.3, y: SAFE.y + 0.2, w: leftW - 0.6, h: 0.4,
      fontSize: 16, bold: true, color: C.INK, fontFace: "Calibri",
    });

    const fatores: { icon: string; titulo: string; texto: string }[] = [];
    if (topSetor) {
      fatores.push({
        icon: "●", titulo: `${topSetor.setor}:`,
        texto: `Concentra ${topSetor.pct}% das demandas totais do período, sendo o principal ofensor operacional.`,
      });
    }
    fatores.push({
      icon: "◐", titulo: "Agenda Cirúrgica:",
      texto: `Tempo médio de resposta de ${Math.round(cirurgica.horas)}h (SLA de 168h), com ${cirurgica.foraPct}% fora do SLA.`,
    });
    fatores.push({
      icon: "◇", titulo: "Demais Setores:",
      texto: `Desempenho ágil com média de ${Math.round(demais.horas)}h (SLA de 72h) e ${demais.foraPct}% sem SLA.`,
    });
    if (topTipo) {
      fatores.push({
        icon: "▲", titulo: `Tipo predominante — ${topTipo.tipo}:`,
        texto: `${topTipo.pct}% das reclamações do período (${topTipo.n} registros).`,
      });
    }

    const blocoY = SAFE.y + 0.7;
    const blocoH = (SAFE.h - 0.85) / fatores.length;
    fatores.forEach((f, i) => {
      const y = blocoY + i * blocoH;
      sd.addText(f.icon, {
        x: SAFE.x + 0.3, y, w: 0.35, h: blocoH,
        fontSize: 14, bold: true, color: C.PRIMARY, fontFace: "Calibri", valign: "top",
      });
      sd.addText(
        [
          { text: f.titulo + " ", options: { bold: true, color: C.INK } },
          { text: f.texto, options: { color: C.INK_SOFT } },
        ],
        {
          x: SAFE.x + 0.7, y, w: leftW - 0.9, h: blocoH,
          fontSize: 12, fontFace: "Calibri", valign: "top", paraSpaceAfter: 4,
        },
      );
    });

    // ===== DIREITA: Donut de setores + barras de tipos =====
    const halfH = (SAFE.h - 0.2) / 2;

    // Donut setores (top 1 vs outros)
    card(sd, rightX, SAFE.y, rightW, halfH);
    sd.addText("Concentração por Setor", {
      x: rightX + 0.25, y: SAFE.y + 0.15, w: rightW - 0.5, h: 0.3,
      fontSize: 12, bold: true, color: C.INK, fontFace: "Calibri",
    });
    if (topSetor) {
      const outrosPct = Math.max(0, 100 - topSetor.pct);
      sd.addChart(pptx.ChartType.doughnut,
        [{
          name: "Setores",
          labels: [topSetor.setor, "Outros Setores"],
          values: [topSetor.pct, outrosPct],
        }],
        {
          x: rightX + 0.25, y: SAFE.y + 0.5, w: rightW - 0.5, h: halfH - 0.6,
          chartColors: [C.PRIMARY, C.BORDER],
          showLegend: true, legendPos: "b", legendFontSize: 10, legendColor: C.INK,
          holeSize: 65,
          showValue: false,
          dataLabelFontSize: 10, dataLabelColor: C.INK,
        },
      );
    }

    // Barras tipos
    const b2y = SAFE.y + halfH + 0.2;
    card(sd, rightX, b2y, rightW, halfH);
    sd.addText("Top Tipos de Reclamação", {
      x: rightX + 0.25, y: b2y + 0.15, w: rightW - 0.5, h: 0.3,
      fontSize: 12, bold: true, color: C.INK, fontFace: "Calibri",
    });
    if (snap.volumeTipo.length > 0) {
      const tops = snap.volumeTipo.slice(0, 5);
      sd.addChart(pptx.ChartType.bar,
        [{
          name: "Reclamações",
          labels: tops.map((t) => t.tipo),
          values: tops.map((t) => t.n),
        }],
        {
          x: rightX + 0.25, y: b2y + 0.5, w: rightW - 0.5, h: halfH - 0.6,
          barDir: "bar", chartColors: [C.ACCENT],
          showValue: true, dataLabelFontSize: 10, dataLabelColor: C.INK, dataLabelPosition: "outEnd",
          catAxisLabelFontSize: 10, catAxisLabelColor: C.INK,
          valAxisLabelFontSize: 9, valAxisLabelColor: C.INK_SOFT,
          showLegend: false, barGapWidthPct: 40,
        },
      );
    } else {
      sd.addText("Sem dados de tipo no período.", {
        x: rightX + 0.25, y: b2y + 0.5, w: rightW - 0.5, h: halfH - 0.6,
        fontSize: 12, color: C.MUTED, fontFace: "Calibri", align: "center", valign: "middle",
      });
    }

    slideFooter(sd, filtroLabel);
  }





  // ================= SLIDE 2 — RESUMO EXECUTIVO =================
  const s2 = pptx.addSlide();
  addBackground(s2, "conteudo");
  slideHeader(s2, "Resumo Executivo", "Indicadores-chave do mês corrente com definição", periodoLabel);

  const defs: Array<{ label: string; value: string; cor: string; def: string }> = [
    { label: "SLA no prazo", value: `${m.slaNoPrazoPct}%`, cor: corSla,
      def: "% de demandas resolvidas dentro do prazo aplicável ao setor." },
    { label: "Backlog em aberto", value: `${m.emAberto}`, cor: corBacklog,
      def: `Demandas ainda não resolvidas no fim do período (${m.pctEmAberto}% do total).` },
    { label: "Pontuação operacional", value: `${m.score}`, cor: corScore,
      def: "Índice ponderado (SLA 40% · resolução 30% · prazo 20% · backlog 10%)." },
    { label: "Total de demandas", value: `${m.total}`, cor: C.PRIMARY,
      def: `Volume total do período — ${m.resolvidas} resolvidas (${m.pctResolvidas}%).` },
    { label: "Fora do prazo", value: `${m.pctForaDoPrazo}%`, cor: corFora,
      def: m.acimaDaMeta ? "Acima da meta de 8% — requer atenção." : "Dentro da meta (≤ 8%)." },
    { label: "Tempo médio de resolução", value: `${m.tempoMedioDias.toFixed(1)}d`, cor: C.PRIMARY,
      def: "Dias corridos entre abertura e resolução para demandas resolvidas." },
  ];

  const rH = (SAFE.h - gap) / 2;
  defs.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = SAFE.x + col * (kW + gap);
    const y = SAFE.y + row * (rH + gap);
    kpiSimples(s2, x, y, kW, rH, d.label, d.value, d.def, d.cor);
  });
  slideFooter(s2, filtroLabel);

  // ================= SLIDE 3 — TEMPO DE RESPOSTA & TENDÊNCIAS =================
  const s3 = pptx.addSlide();
  addBackground(s3, "conteudo");
  slideHeader(s3, "Tempo de Resposta & Tendências", "Tempo médio por tipo de setor e variação vs. início do período", periodoLabel);

  const colW = (SAFE.w - 0.25) / 2;
  card(s3, SAFE.x, SAFE.y, colW, SAFE.h);
  s3.addText("TEMPO MÉDIO (HORAS ÚTEIS)", {
    x: SAFE.x + 0.25, y: SAFE.y + 0.18, w: colW - 0.5, h: 0.3,
    fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
  });
  const t = snap.temposSegmentados;
  const bloco = (y0: number, titulo: string, valor: string, sub: string, corValor: string) => {
    s3.addText(titulo, {
      x: SAFE.x + 0.3, y: y0, w: colW - 0.6, h: 0.35,
      fontSize: 13, bold: true, color: C.INK, fontFace: "Calibri",
    });
    s3.addText(valor, {
      x: SAFE.x + 0.3, y: y0 + 0.35, w: colW - 0.6, h: 0.9,
      fontSize: 40, bold: true, color: corValor, fontFace: "Calibri",
    });
    s3.addText(sub, {
      x: SAFE.x + 0.3, y: y0 + 1.25, w: colW - 0.6, h: 0.3,
      fontSize: 11, color: C.MUTED, fontFace: "Calibri",
    });
  };
  bloco(SAFE.y + 0.65, "Agenda Cirúrgica · SLA 168h",
    `${t.cirurgica.horas.toFixed(0)}h`,
    `${t.cirurgica.foraPct}% acima do SLA`,
    t.cirurgica.foraPct > 10 ? C.NEGATIVE : C.PRIMARY);
  bloco(SAFE.y + 3.1, "Demais Setores · SLA 72h",
    `${t.demais.horas.toFixed(0)}h`,
    `${t.demais.foraPct}% acima do SLA`,
    t.demais.foraPct > 10 ? C.NEGATIVE : C.PRIMARY);

  card(s3, SAFE.x + colW + 0.25, SAFE.y, colW, SAFE.h);
  s3.addText("VARIAÇÃO NO PERÍODO", {
    x: SAFE.x + colW + 0.5, y: SAFE.y + 0.18, w: colW - 0.5, h: 0.3,
    fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
  });
  const tr = snap.tendencias;
  if (tr) {
    const linhas = [
      { label: "SLA no prazo", val: tr.slaDelta, inverse: false },
      { label: "Backlog em aberto", val: tr.backlogDelta, inverse: true },
      { label: "Fora do prazo", val: tr.foraDelta, inverse: true },
    ];
    linhas.forEach((ln, i) => {
      const y0 = SAFE.y + 0.65 + i * 1.55;
      const arrow = ln.val > 0 ? "▲" : ln.val < 0 ? "▼" : "▬";
      const good = ln.val === 0 ? null : ln.inverse ? ln.val < 0 : ln.val > 0;
      const cor = good === null ? C.MUTED : good ? C.POSITIVE : C.NEGATIVE;
      s3.addText(ln.label, {
        x: SAFE.x + colW + 0.5, y: y0, w: colW - 0.5, h: 0.3,
        fontSize: 12, color: C.INK_SOFT, fontFace: "Calibri",
      });
      s3.addText(`${arrow} ${ln.val > 0 ? "+" : ""}${ln.val}%`, {
        x: SAFE.x + colW + 0.5, y: y0 + 0.3, w: colW - 0.5, h: 0.7,
        fontSize: 30, bold: true, color: cor, fontFace: "Calibri",
      });
    });
  } else {
    s3.addText("Sem dado comparável.", {
      x: SAFE.x + colW + 0.5, y: SAFE.y + 1.0, w: colW - 0.5, h: 0.4,
      fontSize: 12, color: C.MUTED, italic: true, fontFace: "Calibri",
    });
  }
  slideFooter(s3, filtroLabel);

  // ================= SLIDE 4 — EVOLUÇÃO MENSAL (6 MESES) =================
  if (snap.monthlySeries.length > 0) {
    const s4 = pptx.addSlide();
    addBackground(s4, "conteudo");
    slideHeader(s4, "Evolução Mensal", "Últimos 6 meses — SLA no prazo, fora do prazo e backlog", periodoLabel);
    card(s4, SAFE.x, SAFE.y, SAFE.w, SAFE.h);

    const labels = snap.monthlySeries.map((x) => x.label);
    s4.addChart(pptx.ChartType.line,
      [
        { name: "SLA no prazo (%)", labels, values: snap.monthlySeries.map((x) => x.sla) },
        { name: "Fora do prazo (%)", labels, values: snap.monthlySeries.map((x) => x.fora) },
        { name: "Backlog (qtd)", labels, values: snap.monthlySeries.map((x) => x.aberto) },
      ],
      {
        x: SAFE.x + 0.25, y: SAFE.y + 0.35, w: SAFE.w - 0.5, h: SAFE.h - 0.55,
        chartColors: [C.POSITIVE, C.NEGATIVE, C.PRIMARY],
        showLegend: true, legendPos: "b", legendFontSize: 11, legendColor: C.INK,
        catAxisLabelFontSize: 10, catAxisLabelColor: C.INK_SOFT,
        valAxisLabelFontSize: 10, valAxisLabelColor: C.INK_SOFT,
        lineDataSymbolSize: 8, lineSize: 2.5,
        showValue: false,
      },
    );
    slideFooter(s4, filtroLabel);
  }

  // ================= SLIDE 5 — VOLUME POR SETOR =================
  if (snap.volumeSetor.length > 0) {
    const s5 = pptx.addSlide();
    addBackground(s5, "conteudo");
    slideHeader(s5, "Volume por Setor", "Ranking dos setores com maior número de demandas no período", periodoLabel);
    card(s5, SAFE.x, SAFE.y, SAFE.w, SAFE.h);
    s5.addChart(pptx.ChartType.bar,
      [{ name: "Demandas", labels: snap.volumeSetor.map((v) => v.setor), values: snap.volumeSetor.map((v) => v.n) }],
      {
        x: SAFE.x + 0.25, y: SAFE.y + 0.35, w: SAFE.w - 0.5, h: SAFE.h - 0.55,
        barDir: "bar", chartColors: [C.PRIMARY],
        showValue: true, dataLabelFontSize: 11, dataLabelColor: C.INK, dataLabelPosition: "outEnd",
        catAxisLabelFontSize: 11, catAxisLabelColor: C.INK,
        valAxisLabelFontSize: 10, valAxisLabelColor: C.INK_SOFT,
        showLegend: false, barGapWidthPct: 40,
      },
    );
    slideFooter(s5, filtroLabel);
  }

  // ================= SLIDE 6 — REINCIDÊNCIAS =================
  if (snap.reincidencias.length > 0) {
    const s6 = pptx.addSlide();
    addBackground(s6, "conteudo");
    slideHeader(s6, "Reincidências por Setor", "Taxa de reincidência (%) — setores acima de 20% requerem plano de ação", periodoLabel);
    card(s6, SAFE.x, SAFE.y, SAFE.w, SAFE.h);
    // Cor semântica: barras acima de 20 = negativo, demais = warning
    const acima = snap.reincidencias.some((r) => r.taxa > 20);
    s6.addChart(pptx.ChartType.bar,
      [{ name: "Taxa (%)", labels: snap.reincidencias.map((r) => r.setor), values: snap.reincidencias.map((r) => r.taxa) }],
      {
        x: SAFE.x + 0.25, y: SAFE.y + 0.35, w: SAFE.w - 0.5, h: SAFE.h - 0.55,
        barDir: "bar", chartColors: [acima ? C.NEGATIVE : C.WARNING],
        showValue: true, dataLabelFontSize: 11, dataLabelColor: C.INK, dataLabelPosition: "outEnd",
        catAxisLabelFontSize: 11, catAxisLabelColor: C.INK,
        valAxisLabelFontSize: 10, valAxisLabelColor: C.INK_SOFT,
        showLegend: false, barGapWidthPct: 40,
      },
    );
    slideFooter(s6, filtroLabel);
  }

  // ================= SLIDE 7 — GARGALOS =================
  if (snap.gargalos.length > 0) {
    const s7 = pptx.addSlide();
    addBackground(s7, "conteudo");
    slideHeader(s7, "Principais Gargalos", "Setor × tipo — ordenado por impacto (volume × tempo médio)", periodoLabel);
    card(s7, SAFE.x, SAFE.y, SAFE.w, SAFE.h);

    const header = [
      { text: "Setor", options: { bold: true, color: C.CARD, fill: { color: C.PRIMARY }, align: "left" } },
      { text: "Tipo", options: { bold: true, color: C.CARD, fill: { color: C.PRIMARY }, align: "left" } },
      { text: "Qtd.", options: { bold: true, color: C.CARD, fill: { color: C.PRIMARY }, align: "center" } },
      { text: "Tempo médio (dias)", options: { bold: true, color: C.CARD, fill: { color: C.PRIMARY }, align: "center" } },
      { text: "% fora do prazo", options: { bold: true, color: C.CARD, fill: { color: C.PRIMARY }, align: "center" } },
    ];
    const rows = [
      header,
      ...snap.gargalos.map((g) => {
        const critical = g.foraPct > 8 && g.qtd >= 5;
        const fill = critical ? { color: "FBEBE9" } : { color: C.CARD };
        return [
          { text: g.setor, options: { color: C.INK, fill, align: "left" } },
          { text: g.tipo, options: { color: C.INK, fill, align: "left" } },
          { text: String(g.qtd), options: { color: C.INK, fill, align: "center" } },
          { text: g.tempoMedio.toFixed(1), options: { color: C.INK, fill, align: "center" } },
          {
            text: `${g.foraPct}%`,
            options: {
              color: g.foraPct > 8 ? C.NEGATIVE : C.POSITIVE,
              bold: true, fill, align: "center",
            },
          },
        ];
      }),
    ];
    s7.addTable(rows as any, {
      x: SAFE.x + 0.3, y: SAFE.y + 0.55, w: SAFE.w - 0.6,
      colW: [3.4, 3.4, 1.2, 2.2, 1.83],
      fontSize: 12, fontFace: "Calibri",
      border: { pt: 0.5, color: C.BORDER },
      rowH: 0.42, valign: "middle",
    });
    slideFooter(s7, filtroLabel);
  }

  // ================= SLIDE 8 — INSIGHTS & RECOMENDAÇÕES =================
  const recs: string[] = [];
  if (m.acimaDaMeta) {
    recs.push("Definir plano de ação semanal com os setores acima da meta de 8% fora do prazo e revisar prazos internos.");
  }
  if (snap.reincidencias[0] && snap.reincidencias[0].taxa > 20) {
    recs.push(`Investigar causa-raiz das reincidências em ${snap.reincidencias[0].setor} (${snap.reincidencias[0].taxa}%) e padronizar tratativa.`);
  }
  if (snap.gargalos[0]) {
    recs.push(`Priorizar squad em ${snap.gargalos[0].setor} · ${snap.gargalos[0].tipo}, que concentra o maior impacto (${snap.gargalos[0].qtd} demandas, tempo médio ${snap.gargalos[0].tempoMedio.toFixed(1)}d).`);
  }
  if (p && m.emAberto > p.emAberto) {
    recs.push("Ampliar capacidade de resposta no curto prazo — backlog cresceu vs. o mês anterior.");
  }
  const recsFinal = recs.slice(0, 3);

  if (snap.insights.length > 0 || recsFinal.length > 0) {
    const s8 = pptx.addSlide();
    addBackground(s8, "conteudo");
    slideHeader(s8, "Insights & Recomendações", "Análise automática do período com ações objetivas", periodoLabel);

    const cW = (SAFE.w - 0.25) / 2;
    card(s8, SAFE.x, SAFE.y, cW, SAFE.h);
    s8.addText("OBSERVAÇÕES DO PERÍODO", {
      x: SAFE.x + 0.25, y: SAFE.y + 0.18, w: cW - 0.5, h: 0.3,
      fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
    });
    s8.addText(
      (snap.insights.length ? snap.insights : ["Sem observações críticas no período."]).map(
        (f) => ({ text: f, options: { bullet: { code: "25CF" }, color: C.INK } }),
      ) as any,
      {
        x: SAFE.x + 0.35, y: SAFE.y + 0.6, w: cW - 0.65, h: SAFE.h - 0.8,
        fontSize: 14, fontFace: "Calibri", paraSpaceAfter: 10,
      },
    );

    card(s8, SAFE.x + cW + 0.25, SAFE.y, cW, SAFE.h);
    s8.addText("RECOMENDAÇÕES DE AÇÃO", {
      x: SAFE.x + cW + 0.5, y: SAFE.y + 0.18, w: cW - 0.5, h: 0.3,
      fontSize: 10, bold: true, color: C.MUTED, charSpacing: 2, fontFace: "Calibri",
    });
    s8.addText(
      (recsFinal.length ? recsFinal : ["Manter cadência atual — indicadores dentro do esperado."]).map(
        (f, i) => ({ text: f, options: { bullet: { code: "25B6" }, color: C.INK } }),
      ) as any,
      {
        x: SAFE.x + cW + 0.6, y: SAFE.y + 0.6, w: cW - 0.75, h: SAFE.h - 0.8,
        fontSize: 14, bold: false, fontFace: "Calibri", paraSpaceAfter: 10,
      },
    );
    slideFooter(s8, filtroLabel);
  }

  // ================= SLIDE FINAL — RANKING EMPRESAS: VIDAS vs. RECLAMAÇÕES =================
  if (snap.rankingEmpresasVidas && snap.rankingEmpresasVidas.length > 0) {
    const sr = pptx.addSlide();
    addBackground(sr, "conteudo");
    slideHeader(
      sr,
      "Ranking Empresas: Vidas vs. Reclamações",
      "Top 15 empresas — % que as reclamações representam sobre o contrato (reclamações ÷ vidas)",
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
      { text: "ÍNDICE", options: { bold: true, color: C.MUTED, fill: { color: C.CARD_SOFT }, valign: "middle", align: "right" } },
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
