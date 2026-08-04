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
  slideTitle(s2, "Resumo Executivo", `${empresaNome} · ${dataBR}`);


  const gap = 0.22;
  const cols = 3;
  const kW = (SAFE.w - gap * (cols - 1)) / cols;
  const kH = (SAFE.h - gap) / 2;

  const kpis = [
    { label: "Total triado", valor: total, cor: COLORS.NAVY, sub: "Colaboradores atendidos" },
    { label: "PA alterada", valor: `${pct(paAlt, totalPa)}%`, cor: COLORS.RED, sub: `${paAlt} de ${totalPa} avaliados em PA` },
    { label: "PA normal", valor: `${pct(paNormal, totalPa)}%`, cor: COLORS.GREEN, sub: `${paNormal} de ${totalPa} avaliados em PA` },
    { label: "Glicemia alterada", valor: `${pct(gliAlt, totalGli)}%`, cor: COLORS.RED, sub: `${gliAlt} de ${totalGli} avaliados em glicemia` },
    { label: "Glicemia normal", valor: `${pct(gliNormal, totalGli)}%`, cor: COLORS.GREEN, sub: `${gliNormal} de ${totalGli} avaliados em glicemia` },
    { label: "Encaminhamentos", valor: encaminhamentos, cor: COLORS.AMBER, sub: `${pct(encaminhamentos, total)}% do total triado` },
  ];


  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = SAFE.x + col * (kW + gap);
    const y = SAFE.y + row * (kH + gap);
    kpiCard(s2, x, y, kW, kH, k.label, k.valor, k.cor, k.sub);
  });

  // ============================================================
  // Slide 3 — DIAGNÓSTICO EXECUTIVO (barras horizontais)
  // ============================================================
  const s3 = pptx.addSlide();
  s3.background = conteudoBg;
  slideTitle(s3, "Diagnóstico Executivo", "Distribuição dos colaboradores avaliados na ação");

  const panelW = (SAFE.w - 0.4) / 2;
  const panelH = 2.75;

  const barraGrupo = (
    slide: any,
    px: number, py: number, pw: number, ph: number,
    titulo: string, subtitulo: string,
    itens: { label: string; valor: number; base: number; cor: string }[],
  ) => {
    painel(slide, px, py, pw, ph, titulo);
    slide.addText(subtitulo, {
      x: px + 0.25, y: py + 0.55, w: pw - 0.5, h: 0.28,
      fontSize: 10, color: COLORS.GREY, fontFace: "Calibri",
    });
    const trackX = px + 0.25;
    const trackW = pw - 1.55;
    let by = py + 1.0;
    itens.forEach((it) => {
      const p = it.base > 0 ? it.valor / it.base : 0;
      slide.addText(`${it.label}`, {
        x: trackX, y: by, w: trackW, h: 0.25,
        fontSize: 11, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
      });
      slide.addShape("roundRect", {
        x: trackX, y: by + 0.28, w: trackW, h: 0.34,
        fill: { color: "EEF2F6" }, line: { color: COLORS.BORDER, width: 0.5 }, rectRadius: 0.05,
      });
      if (p > 0) {
        slide.addShape("roundRect", {
          x: trackX, y: by + 0.28, w: Math.max(trackW * p, 0.12), h: 0.34,
          fill: { color: it.cor }, line: { color: it.cor }, rectRadius: 0.05,
        });
      }
      slide.addText(`${pct(it.valor, it.base)}%  ·  ${it.valor}`, {
        x: trackX + trackW + 0.12, y: by + 0.26, w: 1.15, h: 0.38,
        fontSize: 11, bold: true, color: it.cor, fontFace: "Calibri", valign: "middle",
      });
      by += 0.85;
    });
  };

  barraGrupo(
    s3, SAFE.x, SAFE.y, panelW, panelH,
    "Pressão Arterial", `Base: ${totalPa} colaboradores aferidos`,
    [
      { label: "Normal", valor: paNormal, base: totalPa, cor: COLORS.GREEN },
      { label: "Alterada", valor: paAlt, base: totalPa, cor: COLORS.RED },
    ],
  );

  barraGrupo(
    s3, SAFE.x + panelW + 0.4, SAFE.y, panelW, panelH,
    "Glicemia", `Base: ${totalGli} colaboradores avaliados`,
    [
      { label: "Normal", valor: gliNormal, base: totalGli, cor: COLORS.GREEN },
      { label: "Alterada", valor: gliAlt, base: totalGli, cor: COLORS.RED },
    ],
  );

  const paPctAlt = pct(paAlt, totalPa);
  const gliPctAlt = pct(gliAlt, totalGli);
  const encPct = pct(encaminhamentos, total);
  const hasGrave = ((paCounts as any)["Hipertensão Estágio 2"] ?? 0) + ((paCounts as any)["Hipertensão Estágio 3"] ?? 0);
  const diabetes = (gliCounts as any)["Diabetes"] ?? 0;
  const preDiabetes = (gliCounts as any)["Pré-Diabetes"] ?? 0;
  const naoRealizadas = ((paCounts as any)["Não realizado"] ?? 0) + ((gliCounts as any)["Não realizado"] ?? 0);
  const predominante = gliPctAlt > paPctAlt ? "glicêmicas" : paPctAlt > gliPctAlt ? "de pressão arterial" : "metabólicas e cardiovasculares";
  const secundario = gliPctAlt > paPctAlt ? "de pressão arterial" : "glicêmicas";

  const leituraTxt =
    `A ação evidenciou maior prevalência de alterações ${predominante} entre os colaboradores avaliados, ` +
    `configurando o principal fator de atenção identificado durante a campanha. Também foram observadas alterações ${secundario} ` +
    `que justificam acompanhamento preventivo. ` +
    (encPct >= 40
      ? "O volume de encaminhamentos reforça a importância da continuidade das ações de promoção da saúde e do monitoramento periódico dos participantes. "
      : "Os encaminhamentos realizados indicam a necessidade de acompanhamento dirigido dos casos identificados. ") +
    `Insight executivo: a atuação preventiva sobre esse perfil tende a reduzir afastamentos e custos assistenciais no médio prazo. ` +
    `Os resultados referem-se exclusivamente aos colaboradores avaliados nesta ação.`;

  painel(s3, SAFE.x, SAFE.y + panelH + 0.1, panelW, 1.55, "Leitura Executiva");
  s3.addText(leituraTxt, {
    x: SAFE.x + 0.22, y: SAFE.y + panelH + 0.6, w: panelW - 0.44, h: 1.0,
    fontSize: 9.5, color: COLORS.NAVY, fontFace: "Calibri", valign: "top",
  });

  const achados: string[] = [];
  achados.push(`Predomínio de alterações ${predominante} entre os colaboradores avaliados.`);
  if (hasGrave > 0) achados.push("Casos com necessidade de avaliação clínica prioritária identificados.");
  if (diabetes > 0 || preDiabetes > 0) achados.push("Perfil metabólico exige reforço das ações de controle glicêmico.");
  if (encPct >= 40) achados.push("Elevado número de encaminhamentos preventivos gerados na ação.");
  else achados.push("Encaminhamentos preventivos direcionados aos casos prioritários.");
  if (naoRealizadas > 0) achados.push("Adesão parcial às aferições sinaliza espaço para maior engajamento.");
  if (achados.length < 3) achados.push("Oportunidade de fortalecimento das ações de educação em saúde.");

  const achX = SAFE.x + panelW + 0.4;
  painel(s3, achX, SAFE.y + panelH + 0.1, panelW, 1.55, "Principais Achados");
  s3.addText(
    achados.slice(0, 5).map((a) => ({ text: a, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: achX + 0.22, y: SAFE.y + panelH + 0.6, w: panelW - 0.44, h: 1.0,
      fontSize: 9.5, fontFace: "Calibri", valign: "top", paraSpaceAfter: 2,
    },
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
  slideTitle(s6, "Observações e Recomendações", "Análise consultiva e direcionamentos para a gestão");

  const colW = (SAFE.w - 0.3) / 2;

  // Coluna 1: Principais Achados (síntese qualitativa)
  const sintese: string[] = [];
  sintese.push(
    `O perfil de saúde dos colaboradores avaliados aponta as alterações ${predominante} como o principal fator de atenção da campanha, ` +
    `com relevância clínica suficiente para orientar as prioridades do próximo ciclo preventivo.`,
  );
  if (hasGrave > 0 || diabetes > 0) {
    sintese.push("Parte dos participantes apresenta condições que demandam avaliação clínica prioritária e acompanhamento formal pela Medicina do Trabalho.");
  }
  if (preDiabetes > 0) {
    sintese.push("Há um grupo em estágio intermediário de risco metabólico, cujo desfecho ainda pode ser revertido por meio de intervenções de estilo de vida.");
  }
  if (naoRealizadas > 0) {
    sintese.push("A adesão parcial às aferições limita a leitura completa do quadro e indica espaço para maior mobilização interna nas próximas ações.");
  }
  sintese.push("Insight executivo: agir agora sobre esse grupo tende a reduzir absenteísmo, afastamentos e custos assistenciais futuros.");

  painel(s6, SAFE.x, SAFE.y, colW, SAFE.h, "Principais Achados");
  s6.addText(
    sintese.map((t) => ({ text: t, options: { color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 12.5, fontFace: "Calibri", color: COLORS.NAVY, valign: "top",
      paraSpaceAfter: 8,
    },
  );

  // Coluna 2: Recomendações Estratégicas
  painel(s6, SAFE.x + colW + 0.3, SAFE.y, colW, SAFE.h, "Recomendações Estratégicas");
  const recomendacoes: string[] = [];
  if (gliPctAlt >= paPctAlt) {
    recomendacoes.push("Intensificar ações de educação em saúde voltadas ao controle glicêmico.");
  } else {
    recomendacoes.push("Intensificar ações de prevenção cardiovascular e controle da pressão arterial.");
  }
  if (hasGrave > 0 || diabetes > 0) {
    recomendacoes.push("Assegurar acompanhamento clínico formal dos casos de maior risco identificados.");
  }
  recomendacoes.push("Estimular hábitos saudáveis: alimentação equilibrada, atividade física e sono adequado.");
  recomendacoes.push("Manter o monitoramento dos colaboradores encaminhados até a conclusão do cuidado.");
  if (naoRealizadas > 0) {
    recomendacoes.push("Ampliar a mobilização interna para elevar a adesão às aferições na próxima ação.");
  }
  recomendacoes.push("Planejar nova ação preventiva para comparação de indicadores ao longo do tempo.");
  recomendacoes.push("Integrar os resultados às diretrizes do PCMSO e do PGR da empresa.");
  s6.addText(
    recomendacoes.slice(0, 7).map((r) => ({ text: r, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any,
    {
      x: SAFE.x + colW + 0.6, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 12.5, fontFace: "Calibri", paraSpaceAfter: 6,
    },
  );


  // ============================================================
  // Slide 7B — CONSIDERAÇÕES FINAIS
  // ============================================================
  const sFim = pptx.addSlide();
  sFim.background = conteudoBg;
  slideTitle(sFim, "Considerações Finais", "Encerramento executivo · Saúde corporativa como estratégia de gestão");

  const focoTxt =
    diabetes > 0 || hasGrave > 0
      ? "com destaque para situações que demandam acompanhamento clínico mais próximo"
      : "predominando alterações de caráter leve, passíveis de reversão com acompanhamento e mudança de hábitos";
  const adesaoTxt =
    naoRealizadas > 0
      ? " A adesão observada indica ainda espaço para ampliar o alcance das próximas ações, fortalecendo a cultura de prevenção interna."
      : " O engajamento observado demonstra maturidade da empresa na condução de iniciativas de saúde preventiva.";

  const resumoTxt =
    `A ação realizada permitiu identificar, entre os colaboradores participantes, sinais precoces relacionados a risco cardiovascular e metabólico, ${focoTxt}. ` +
    `Achados dessa natureza costumam evoluir de forma silenciosa e, quando reconhecidos em fase inicial, permitem intervenções simples, de baixo custo e alto impacto — evitando afastamentos, perda de produtividade e agravos assistenciais futuros.` +
    adesaoTxt;

  painel(sFim, SAFE.x, SAFE.y, SAFE.w, 1.85, "Resumo Executivo");
  sFim.addText(resumoTxt, {
    x: SAFE.x + 0.3, y: SAFE.y + 0.62, w: SAFE.w - 0.6, h: 1.1,
    fontSize: 12.5, color: COLORS.NAVY, fontFace: "Calibri", valign: "top",
  });

  const colFimW = (SAFE.w - 0.4) / 2;
  const yBloco = SAFE.y + 2.05;

  painel(sFim, SAFE.x, yBloco, colFimW, 1.85, "Promoção da Saúde no Ambiente Corporativo");
  sFim.addText(
    "A promoção da saúde no ambiente corporativo vai além da identificação de alterações clínicas. Ela representa uma estratégia para incentivar hábitos saudáveis, contribuir para a qualidade de vida dos colaboradores e apoiar a construção de ambientes de trabalho mais seguros e produtivos.",
    {
      x: SAFE.x + 0.3, y: yBloco + 0.62, w: colFimW - 0.6, h: 1.1,
      fontSize: 12, color: COLORS.NAVY, fontFace: "Calibri", valign: "top",
    },
  );

  painel(sFim, SAFE.x + colFimW + 0.4, yBloco, colFimW, 1.85, "Compromisso Samel");
  sFim.addText(
    "A Samel agradece a confiança depositada em nossa equipe e reafirma seu compromisso em apoiar empresas na promoção da saúde ocupacional, por meio de ações preventivas, acompanhamento contínuo e soluções que contribuam para o bem-estar dos colaboradores.",
    {
      x: SAFE.x + colFimW + 0.7, y: yBloco + 0.62, w: colFimW - 0.6, h: 1.1,
      fontSize: 12, color: COLORS.NAVY, fontFace: "Calibri", valign: "top",
    },
  );

  sFim.addText(
    "Cuidar da saúde é investir no futuro das pessoas e no desenvolvimento sustentável das organizações.",
    {
      x: SAFE.x, y: SAFE.y + SAFE.h - 0.45, w: SAFE.w, h: 0.35,
      fontSize: 11.5, italic: true, color: COLORS.GREEN, fontFace: "Calibri", align: "center",
    },
  );



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
