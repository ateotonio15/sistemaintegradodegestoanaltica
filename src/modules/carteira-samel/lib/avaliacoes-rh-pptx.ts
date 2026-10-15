import fundoCapa from "@/assets/ppt/fundo-capa.jpg";
import fundoConteudo from "@/assets/ppt/fundo-conteudo.jpg";

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

const INK = "0F1F2C", MUTED = "536674", PRIMARY = "0F766E", LIGHT = "EDF4F1";
const WHITE = "FFFFFF", GOLD = "966515", CORAL = "AE453B";

async function paraDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar o fundo da apresentação");
  const blob = await response.blob();
  return await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:/, ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** Comparação descritiva com a média do período, não uma meta corporativa. */
export function statusDesempenhoRH(media: number, mediaGlobal: number) {
  const diferenca = Math.round(media * 100) - Math.round(mediaGlobal * 100);
  return diferenca > 0 ? "Acima da média" : diferenca < 0 ? "Abaixo da média" : "Na média";
}

/** Builder separado do download para permitir conferência do arquivo gerado. */
export async function criarAvaliacoesRHPptx(s: AvaliacoesRHSnapshot, fundos: { capa: string; conteudo: string }) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CS Control";
  pptx.title = `${s.titulo} | Visão executiva`;
  pptx.subject = `Avaliações de RH · ${s.periodo}`;
  pptx.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };
  const font = "Calibri";
  const num = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const texto = (sl: any, t: string, x: number, y: number, w: number, h: number, size = 20, color = INK, bold = false) =>
    sl.addText(t, { x, y, w, h, fontSize: size, color, bold, fontFace: font, margin: 0, breakLine: false, valign: "mid", fit: "shrink" });
  const bloco = (sl: any, x: number, y: number, w: number, h: number, color = LIGHT) =>
    sl.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color } });
  const header = (t: string, n: number) => {
    const sl = pptx.addSlide();
    sl.addImage({ data: fundos.conteudo, x: 0, y: 0, w: 13.333333, h: 7.5 });
    texto(sl, t, 0.6, 0.48, 8.25, 0.8, 32, INK, true);
    texto(sl, `${s.periodo}  /  ${String(n).padStart(2, "0")} de 06`, 0.6, 1.32, 10, 0.3, 14, MUTED);
    return sl;
  };
  const total = s.stats.total;
  const notasAltas = s.distribuicao.slice(3, 5).reduce((acc, d) => acc + d.value, 0);
  const engajamento = total ? notasAltas / total * 100 : 0;
  const lider = s.rankingEmpresas[0];

  // 01 — Título executivo e métricas, sem encobrir a foto nem os logos.
  const capa = pptx.addSlide();
  capa.addImage({ data: fundos.capa, x: 0, y: 0, w: 13.333333, h: 7.5 });
  texto(capa, "VISÃO EXECUTIVA", 0.8, 2.48, 6, 0.35, 16, PRIMARY, true);
  texto(capa, s.titulo, 0.8, 2.98, 6.1, 1.12, 42, PRIMARY, true);
  texto(capa, `Relacionamento, desempenho e prioridades\n${s.periodo}`, 0.8, 4.28, 6, 0.72, 20);
  [[num(total), "Avaliações"], [num(s.stats.media, 2), "Nota média / 5"], [num(s.stats.empresas), "Empresas"]].forEach(([v, l], i) => {
    const x = 0.8 + i * 2.05;
    texto(capa, v, x, 5.32, 1.95, 0.7, 34, PRIMARY, true);
    texto(capa, l, x, 6.04, 1.95, 0.4, 16, MUTED);
  });

  // 02 — KPIs explicativos, sem inventar taxa de resposta da carteira.
  const k = header("Dashboard | KPIs globais", 2);
  const cards = [
    [num(total), "Avaliações recebidas", "Volume de respostas no período selecionado."],
    [num(s.stats.media, 2), "Nota média geral", "Média das notas válidas, na escala de 1 a 5."],
    [num(s.stats.empresas), "Empresas participantes", "Empresas identificadas nas respostas recebidas."],
    [num(s.stats.comentarios), "Com comentário", "Respostas com observações para análise qualitativa."],
  ];
  cards.forEach(([v, l, desc], i) => {
    const x = 0.6 + (i % 2) * 6.2, y = 1.95 + Math.floor(i / 2) * 1.85;
    bloco(k, x, y, 5.95, 1.65);
    texto(k, v, x + 0.25, y + 0.15, 1.65, 0.68, 38, PRIMARY, true);
    texto(k, l, x + 2, y + 0.17, 3.7, 0.55, 22, INK, true);
    texto(k, desc, x + 2, y + 0.78, 3.65, 0.65, 18, MUTED);
  });
  texto(k, `${num(engajamento, 1)}% das avaliações têm nota 4 ou 5 (${num(notasAltas)} de ${num(total)}).`, 0.65, 5.82, 12, 0.42, 20, PRIMARY, true);

  // 03 — Ranking compacto em um único slide; status é relativo, não meta.
  const r = header("Ranking | Desempenho das executivas", 3);
  const executivas = s.rankingExecutivas.slice(0, 8);
  const rows = executivas.map((ex, i) => {
    const status = statusDesempenhoRH(ex.media, s.stats.media);
    const cor = status === "Acima da média" ? PRIMARY : status === "Abaixo da média" ? CORAL : GOLD;
    return [...[String(i + 1), ex.nome, num(ex.media, 2), num(ex.qtd)].map(text => ({ text })), { text: status, options: { color: cor, bold: true } }];
  });
  if (rows.length) {
    const cabecalho = ["#", "Executiva", "Média / 5", "Avaliações", "Status"].map(text => ({ text, options: { bold: true, color: WHITE, fill: { color: PRIMARY } } }));
    r.addTable([cabecalho, ...rows], {
      x: 0.6, y: 1.95, w: 12.15, colW: [0.55, 4.75, 1.6, 1.55, 3.7], rowH: 0.41,
      fontSize: 18, fontFace: font, margin: 0.07, color: INK,
      border: { type: "solid", color: "D8E4DF", pt: 0.5 }, fill: { color: WHITE }, autoPage: false,
    });
  } else texto(r, "Sem avaliações identificadas por executiva neste período.", 0.6, 2.4, 12, 1, 24, MUTED);
  texto(r, `Status comparado à média global: ${num(s.stats.media, 2)} / 5. Não representa uma meta aprovada.`, 0.6, 5.95, 12.1, 0.38, 15, MUTED);
  if (s.rankingExecutivas.length > 8) texto(r, `Exibindo as 8 primeiras de ${s.rankingExecutivas.length} executivas; ranking completo disponível no dashboard.`, 0.6, 6.38, 12.1, 0.3, 14, MUTED);

  // 04 — Participação efetivamente observada, sem presumir o tamanho da carteira.
  const c = header("Clientes | Distribuição e engajamento", 4);
  const empresas = s.rankingEmpresas.slice(0, 6);
  if (empresas.length) empresas.forEach((e, i) => {
    const y = 2.05 + i * 0.72;
    texto(c, e.nome, 0.6, y, 4.1, 0.48, 18);
    bloco(c, 4.9, y + 0.1, 3.1, 0.28);
    bloco(c, 4.9, y + 0.1, 3.1 * e.qtd / Math.max(...empresas.map(item => item.qtd), 1), 0.28, PRIMARY);
    texto(c, num(e.qtd), 8.12, y, 0.65, 0.48, 20, PRIMARY, true);
  });
  else texto(c, "Sem empresas identificadas nas respostas.", 0.6, 2.4, 8, 1, 24, MUTED);
  bloco(c, 9.1, 2.05, 3.6, 4.28);
  texto(c, "DESTAQUE DE PARTICIPAÇÃO", 9.35, 2.25, 3.1, 0.65, 16, PRIMARY, true);
  texto(c, lider ? `${num(total ? lider.qtd / total * 100 : 0, 1)}%` : "—", 9.35, 3.0, 3.1, 0.88, 48, PRIMARY, true);
  texto(c, lider?.nome || "Sem dados", 9.35, 4.02, 3.1, 0.95, 22, INK, true);
  texto(c, lider ? `${num(lider.qtd)} ${lider.qtd === 1 ? "avaliação" : "avaliações"} do total. Entre os maiores volumes por empresa no período.` : "Aguardando respostas identificadas.", 9.35, 5.12, 3.1, 0.85, 18, MUTED);
  texto(c, "Top 6 por volume. Participação nas respostas, não taxa de adesão da carteira total.", 0.6, 6.45, 12, 0.32, 14, MUTED);

  // 05 — Propostas explícitas; não atribui causas nem resultados não medidos.
  const a = header("Plano de ação estratégico", 5);
  texto(a, "Propostas para validação da diretoria", 0.6, 1.82, 12, 0.4, 20, MUTED);
  const acoes = [
    ["01", "Manutenção", "Preservar o que funciona", "Compartilhar boas práticas das executivas com melhor avaliação e manter o acompanhamento do relacionamento.", "Acompanhar: média e volume de avaliações.", PRIMARY],
    ["02", "Correção", "Investigar pontos de atenção", "Revisar comentários e avaliações abaixo da média; definir retornos aos clientes e apoio às executivas.", "Acompanhar: evolução após os retornos.", CORAL],
    ["03", "Expansão", "Ampliar a escuta da carteira", "Reforçar os convites à avaliação e identificar clientes ainda não representados, antes de propor novas ações.", "Acompanhar: empresas participantes.", GOLD],
  ];
  acoes.forEach(([n, t, sub, desc, medir, cor], i) => {
    const x = 0.6 + i * 4.15;
    bloco(a, x, 2.48, 3.85, 3.98);
    texto(a, n, x + 0.25, 2.7, 0.7, 0.6, 32, cor, true);
    texto(a, t, x + 0.25, 3.45, 3.35, 0.4, 26, cor, true);
    texto(a, sub, x + 0.25, 4.02, 3.35, 0.6, 20, INK, true);
    texto(a, desc, x + 0.25, 4.74, 3.35, 1.04, 18);
    texto(a, medir, x + 0.25, 5.98, 3.35, 0.34, 14, MUTED);
  });

  // 06 — Decisões esperadas, não decisões já tomadas.
  const f = header("Diretoria | Decisões esperadas", 6);
  texto(f, "Da avaliação à execução", 0.6, 1.95, 12, 0.5, 28, PRIMARY, true);
  const decisoes = [
    ["01", "Validar prioridades", "Aprovar as frentes de manutenção, correção e expansão propostas."],
    ["02", "Definir responsáveis e prazos", "Indicar quem conduz cada frente e quando apresenta os avanços."],
    ["03", "Pactuar metas e acompanhamento", "Definir metas de qualidade e participação e a próxima revisão dos resultados."],
  ];
  decisoes.forEach(([n, t, desc], i) => {
    const y = 2.78 + i * 1.02;
    f.addShape(pptx.ShapeType.ellipse, { x: 0.65, y, w: 0.64, h: 0.64, fill: { color: PRIMARY }, line: { color: PRIMARY } });
    texto(f, n, 0.65, y + 0.13, 0.64, 0.32, 18, WHITE, true);
    texto(f, t, 1.55, y - 0.03, 10.8, 0.38, 22, INK, true);
    texto(f, desc, 1.55, y + 0.43, 10.8, 0.38, 20, MUTED);
  });
  bloco(f, 0.6, 6.02, 12.15, 0.58);
  texto(f, "Encaminhamento proposto: registrar responsáveis, prazos e critérios aprovados pela diretoria.", 0.82, 6.13, 11.7, 0.35, 18, PRIMARY, true);
  return pptx;
}

export async function exportarAvaliacoesRHPptx(s: AvaliacoesRHSnapshot) {
  const [capa, conteudo] = await Promise.all([paraDataUrl(fundoCapa), paraDataUrl(fundoConteudo)]);
  const pptx = await criarAvaliacoesRHPptx(s, { capa, conteudo });
  await pptx.writeFile({ fileName: `Avaliacao_RH_${s.periodo.replace(/[^\w]+/g, "_")}.pptx` });
}
