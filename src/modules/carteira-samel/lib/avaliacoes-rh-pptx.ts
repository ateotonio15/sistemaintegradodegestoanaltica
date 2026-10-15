// Exporta o Dashboard de Avaliação RH em PowerPoint (somente leitura dos dados já calculados na tela).
export type AvaliacoesRHSnapshot = {
  titulo: string;
  periodo: string;
  stats: { total: number; media: number; comentarios: number; empresas: number };
  distribuicao: { name: string; value: number }[];
  mediaPorPergunta: { pergunta: string; media: number }[];
  rankingExecutivas: { nome: string; media: number; qtd: number }[];
  rankingEmpresas: { nome: string; qtd: number }[];
  evolucao: { mes: string; media: number; qtd: number }[];
};

const INK = "0F1F2C", MUTED = "6B7A85", PRIMARY = "0F766E", LIGHT = "F1F5F4";

export async function exportarAvaliacoesRHPptx(s: AvaliacoesRHSnapshot) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const font = "Calibri";

  const header = (slide: any, t: string) => {
    slide.background = { color: "FFFFFF" };
    slide.addText(t, { x: 0.5, y: 0.3, w: 12.3, h: 0.7, fontSize: 30, bold: true, color: INK, fontFace: font });
    slide.addText(s.periodo, { x: 0.5, y: 0.95, w: 12.3, h: 0.4, fontSize: 14, color: MUTED, fontFace: font });
  };

  // Capa
  const capa = pptx.addSlide();
  capa.background = { color: PRIMARY };
  capa.addText(s.titulo, { x: 0.8, y: 2.6, w: 11.7, h: 1.2, fontSize: 48, bold: true, color: "FFFFFF", fontFace: font });
  capa.addText(`Dashboard de avaliações · ${s.periodo}`, { x: 0.8, y: 3.8, w: 11.7, h: 0.6, fontSize: 22, color: "D1FAE5", fontFace: font });
  capa.addText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontSize: 14, color: "D1FAE5", fontFace: font });

  // Indicadores
  const k = pptx.addSlide();
  header(k, "Indicadores gerais");
  const cards = [
    ["Total de avaliações", String(s.stats.total)],
    ["Nota média geral", s.stats.media.toFixed(2)],
    ["Empresas avaliando", String(s.stats.empresas)],
    ["Com comentário", String(s.stats.comentarios)],
  ];
  cards.forEach(([l, v], i) => {
    const x = 0.5 + i * 3.1;
    k.addShape(pptx.ShapeType.roundRect, { x, y: 2.2, w: 2.9, h: 2.6, fill: { color: LIGHT }, line: { color: LIGHT }, rectRadius: 0.15 });
    k.addText(v, { x, y: 2.5, w: 2.9, h: 1.3, fontSize: 60, bold: true, color: PRIMARY, align: "center", fontFace: font });
    k.addText(l, { x, y: 3.9, w: 2.9, h: 0.6, fontSize: 18, color: INK, align: "center", fontFace: font });
  });
  k.addText("Nota média em escala de 1 a 5.", { x: 0.5, y: 5.3, w: 12, h: 0.4, fontSize: 14, color: MUTED, fontFace: font });

  // Distribuição + perguntas
  const d = pptx.addSlide();
  header(d, "Distribuição das notas e média por pergunta");
  d.addChart(pptx.ChartType.doughnut, [{ name: "Notas", labels: s.distribuicao.map(x => x.name), values: s.distribuicao.map(x => x.value) }], {
    x: 0.4, y: 1.5, w: 5.6, h: 5.6, holeSize: 55, showLegend: true, legendPos: "b", legendFontSize: 14,
    chartColors: ["EF4444", "F97316", "EAB308", "84CC16", "22C55E"], showPercent: true, dataLabelColor: "FFFFFF",
  });
  if (s.mediaPorPergunta.length) {
    d.addChart(pptx.ChartType.bar, [{ name: "Média", labels: s.mediaPorPergunta.map(x => x.pergunta), values: s.mediaPorPergunta.map(x => x.media) }], {
      x: 6.2, y: 1.5, w: 6.8, h: 5.6, barDir: "bar", chartColors: [PRIMARY], valAxisMinVal: 0, valAxisMaxVal: 5,
      showValue: true, dataLabelFontSize: 14, catAxisLabelFontSize: 13, valAxisLabelFontSize: 12, catAxisOrientation: "maxMin",
    });
  }

  // Evolução
  if (s.evolucao.length) {
    const e = pptx.addSlide();
    header(e, "Evolução mensal da nota média");
    e.addChart(pptx.ChartType.bar, [{ name: "Nota média", labels: s.evolucao.map(x => x.mes), values: s.evolucao.map(x => x.media) }], {
      x: 0.5, y: 1.5, w: 12.3, h: 5.6, chartColors: [PRIMARY], valAxisMinVal: 0, valAxisMaxVal: 5, showValue: true,
      dataLabelFontSize: 14, catAxisLabelFontSize: 14,
    });
  }

  const tabela = (t: string, head: string[], rows: string[][]) => {
    for (let i = 0; i < Math.max(rows.length, 1); i += 12) {
      const sl = pptx.addSlide();
      header(sl, i ? `${t} (cont.)` : t);
      const hd = head.map(h => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: PRIMARY } } }));
      const body = rows.slice(i, i + 12).map(r => r.map(c => ({ text: c })));
      sl.addTable([hd, ...(body.length ? body : [[{ text: "Sem dados" }, ...head.slice(1).map(() => ({ text: "" }))]])], {
        x: 0.5, y: 1.5, w: 12.3, fontSize: 15, fontFace: font, color: INK, border: { type: "solid", color: "D8DFE4", pt: 0.5 }, rowH: 0.42,
      });
    }
  };
  tabela("Ranking de executivas", ["#", "Executiva", "Nota média", "Avaliações"],
    s.rankingExecutivas.map((r, i) => [String(i + 1), r.nome, r.media.toFixed(2), String(r.qtd)]));
  tabela("Empresas que mais avaliaram", ["#", "Empresa", "Avaliações"],
    s.rankingEmpresas.map((r, i) => [String(i + 1), r.nome, String(r.qtd)]));

  await pptx.writeFile({ fileName: `Avaliacao_RH_${s.periodo.replace(/[^\w]+/g, "_")}.pptx` });
}
