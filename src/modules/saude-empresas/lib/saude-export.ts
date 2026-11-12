import * as XLSX from "xlsx";
import type { Triagem, AcaoSaude } from "../hooks/useSaudeEmpresas";
import { classificarImc, classificarPa, classificarGlicemia, PA_ALTERADAS } from "./saude-rules";
import { aplicarLayoutSamel, estilizarLinhaSamel, type ColunaPadrao } from "./saude-excel-layout";
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
// EXCEL — layout padronizado (cabeçalho verde, colunas fixas)
// ============================================================
const up = (v: any) =>
  v === null || v === undefined || v === "" ? "" : String(v).toUpperCase();

export async function exportTriagensExcel(acao: AcaoSaude, triagens: Triagem[]) {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const empresaNome = acao.empresa?.nome ?? "empresa";

  const wb = new (ExcelJS as any).Workbook();
  const ws = wb.addWorksheet("Aferições");

  const cols: ColunaPadrao[] = [
    { header: "NOME", key: "nome", width: 34, align: "left" },
    { header: "CPF", key: "cpf", width: 18, align: "left" },
    { header: "PAS", key: "pas", width: 9, align: "center" },
    { header: "PAD", key: "pad", width: 9, align: "center" },
    { header: "CLASSIF. PA", key: "cpa", width: 23, align: "left" },
    { header: "GLICEMIA", key: "gli", width: 13, align: "center" },
    { header: "JEJUM", key: "jejum", width: 11, align: "center" },
    { header: "CLASSIF. GLICEMIA", key: "cgli", width: 25, align: "left" },
    { header: "HAS", key: "has", width: 9, align: "center" },
    { header: "DM", key: "dm", width: 9, align: "center" },
    { header: "RISCO", key: "risco", width: 12, align: "center" },
  ];

  aplicarLayoutSamel(
    ws,
    cols,
    `${up(empresaNome)}  ·  AFERIÇÕES DE ${formatDateBR(acao.data_acao)}  ·  ${triagens.length} PARTICIPANTE(S)`,
  );

  triagens.forEach((t, i) => {
    const semPa = t.pas_mmhg == null || t.pad_mmhg == null;
    const row = ws.addRow({
      nome: up(t.nome),
      cpf: t.cpf ?? "",
      pas: semPa ? "" : t.pas_mmhg,
      pad: semPa ? "" : t.pad_mmhg,
      cpa: semPa ? "NÃO REALIZADO" : up(t.classificacao_pa ?? classificarPa(t.pas_mmhg, t.pad_mmhg)),
      gli: t.glicemia_mg_dl ?? "",
      jejum: t.jejum ? "SIM" : "NÃO",
      cgli: up(t.classificacao_glicemia ?? classificarGlicemia(t.glicemia_mg_dl, t.jejum) ?? ""),
      has: t.tem_has ? "SIM" : "NÃO",
      dm: t.tem_dm ? "SIM" : "NÃO",
      risco: up(t.risco_geral ?? ""),
    });
    estilizarLinhaSamel(row, cols, i);
  });


  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `triagens_${safeName(empresaNome)}_${acao.data_acao}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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
// EXPORT PRINCIPAL — APRESENTAÇÃO À DIRETORIA (6 páginas, 16:9)
// Somente dados agregados (LGPD). Linguagem de triagem.
// ============================================================
export async function exportRelatorioPptx(acao: AcaoSaude, triagens: Triagem[]) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const { resumoApresentacao, pctDe } = await import("./apresentacao-saude");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.title = `Resultados da Campanha de Saúde - ${acao.empresa?.nome ?? ""}`;

  const [bgCapa, bgConteudo] = await Promise.all([fetchDataUri(bgCapaAsset.url), fetchDataUri(bgConteudoAsset.url)]);

  const C = {
    VERDE: "2E5F2E", PETROLEO: "1E3A4C", CINZA: "5B6B77",
    OK: "2E8B57", OK_ESCURO: "1F6B40", ATENCAO: "E0A800", ALERTA: "E67E22", PRIORIDADE: "C0392B",
    NR: "B8C2CA", BRANCO: "FFFFFF", BORDA: "E3E8EC",
  };
  const FONT = "Calibri";
  const W = 13.333, MX = 0.6, CW = W - 2 * MX;
  const TOP = 1.95; // área de conteúdo
  const BOTTOM = 6.55;

  const m = calcularMetricas(triagens);
  const r = resumoApresentacao({ total: m.total, paCounts: m.paCounts, gliCounts: m.gliCounts, encaminhamentos: m.encaminhamentos });
  const gl = m.gliCounts as Record<string, number>;
  const pa = m.paCounts as Record<string, number>;
  const empresaNome = (acao.empresa?.nome ?? "Empresa").toUpperCase();
  const dataBR = formatDateBR(acao.data_acao);
  const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

  let pagina = 1;
  const novaPagina = (titulo: string) => {
    pagina++;
    const s = pptx.addSlide();
    s.background = { data: bgConteudo };
    s.addText(titulo, { x: MX, y: 0.95, w: CW, h: 0.85, fontSize: 34, bold: true, color: C.PETROLEO, fontFace: FONT, valign: "middle", fit: "shrink" });
    s.addText("Samel · Programa Saúde nas Empresas", { x: MX, y: 7.0, w: 6, h: 0.3, fontSize: 12, color: C.CINZA, fontFace: FONT });
    s.addText(String(pagina), { x: W - MX - 1, y: 7.0, w: 1, h: 0.3, fontSize: 12, color: C.CINZA, fontFace: FONT, align: "right" });
    return s;
  };
  const cartao = (s: any, x: number, y: number, w: number, h: number) =>
    s.addShape("roundRect", {
      x, y, w, h, fill: { color: C.BRANCO }, line: { color: C.BORDA, width: 0.5 }, rectRadius: 0.12,
      shadow: { type: "outer", blur: 6, offset: 2, angle: 90, color: "000000", opacity: 0.08 },
    });
  const nota = (s: any, texto: string) =>
    s.addText(texto, { x: MX, y: BOTTOM + 0.05, w: CW, h: 0.38, fontSize: 12, color: C.CINZA, fontFace: FONT, valign: "top", fit: "shrink" });
  const rosca = (s: any, x: number, y: number, w: number, h: number, itens: { l: string; v: number; c: string }[], opts: any = {}) => {
    const vis = itens.filter((i) => i.v > 0);
    if (!vis.length) {
      s.addText("Sem aferições nesta ação", { x, y, w, h, fontSize: 14, color: C.CINZA, fontFace: FONT, align: "center", valign: "middle" });
      return;
    }
    s.addChart(pptx.ChartType.doughnut, [{ name: "Colaboradores", labels: vis.map((i) => i.l), values: vis.map((i) => i.v) }], {
      x, y, w, h, holeSize: 58, chartColors: vis.map((i) => i.c),
      showValue: true, showPercent: false, dataLabelColor: C.BRANCO, dataLabelFontSize: 14, dataLabelFontBold: true,
      showLegend: true, legendPos: "b", legendFontSize: 13, legendFontFace: FONT, legendColor: C.PETROLEO,
      ...opts,
    });
  };

  // ---------------- 1. CAPA ----------------
  const s1 = pptx.addSlide();
  s1.background = { data: bgCapa };
  s1.addText("Resultados da Campanha de Saúde", { x: 0.7, y: 2.9, w: 7.6, h: 1.2, fontSize: 40, bold: true, color: C.PETROLEO, fontFace: FONT, valign: "bottom", fit: "shrink" });
  s1.addText(empresaNome, { x: 0.7, y: 4.15, w: 7.6, h: 0.6, fontSize: 22, bold: true, color: C.VERDE, fontFace: FONT, fit: "shrink" });
  s1.addText(`Apresentação à diretoria · Ação realizada em ${dataBR}`, { x: 0.7, y: 4.85, w: 7.6, h: 0.4, fontSize: 15, color: C.PETROLEO, fontFace: FONT });
  s1.addText(
    `Enfermeira responsável: ${acao.enfermeira_nome ?? "Lorenn Brandão — COREN-AM 977.099"} · ${m.total} ${plural(m.total, "colaborador triado", "colaboradores triados")}`,
    { x: 0.7, y: 5.3, w: 7.6, h: 0.7, fontSize: 14, color: C.CINZA, fontFace: FONT, valign: "top", fit: "shrink" },
  );

  // ---------------- 2. NÚMEROS ----------------
  const s2 = novaPagina(r.tituloNumeros);
  const kpis = [
    { v: String(m.total), c: C.PETROLEO, l: "Colaboradores triados", sub: "Participação na ação" },
    { v: `${r.pctPaAlt}%`, c: C.PRIORIDADE, l: "Com PA alterada", sub: `${r.paAlt} de ${r.basePa} aferidos` },
    { v: `${r.pctGliAlt}%`, c: C.PRIORIDADE, l: "Com glicemia alterada", sub: `${r.gliAlt} de ${r.baseGli} avaliados` },
    { v: String(m.encaminhamentos), c: C.ATENCAO, l: "Encaminhamentos", sub: `${r.pctEnc}% do total triado` },
  ];
  const g2 = 0.3, kW = (CW - g2 * 3) / 4, kH = 3.6, kY = TOP + 0.35;
  kpis.forEach((k, i) => {
    const x = MX + i * (kW + g2);
    cartao(s2, x, kY, kW, kH);
    s2.addText(k.v, { x: x + 0.2, y: kY + 0.45, w: kW - 0.4, h: 1.4, fontSize: 64, bold: true, color: k.c, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" });
    s2.addText(k.l, { x: x + 0.2, y: kY + 2.0, w: kW - 0.4, h: 0.5, fontSize: 17, bold: true, color: C.PETROLEO, fontFace: FONT, align: "center" });
    s2.addText(k.sub, { x: x + 0.2, y: kY + 2.55, w: kW - 0.4, h: 0.6, fontSize: 14, color: C.CINZA, fontFace: FONT, align: "center", valign: "top" });
  });
  nota(s2, `Base de cálculo: ${r.basePa} aferições de PA e ${r.baseGli} de glicemia. Resultados referem-se exclusivamente aos colaboradores avaliados nesta ação. Triagem não substitui avaliação médica.`);

  // ---------------- 3. GLICEMIA ----------------
  const paginaGlicemia = () => {
    const s = novaPagina(r.tituloGlicemia);
    const lw = CW * 0.52, h = BOTTOM - TOP;
    cartao(s, MX, TOP, lw, h);
    rosca(s, MX + 0.2, TOP + 0.15, lw - 0.4, h - 0.3, [
      { l: "Normal", v: gl["Normal"] ?? 0, c: C.OK },
      { l: "Pré-diabetes", v: gl["Pré-Diabetes"] ?? 0, c: C.ATENCAO },
      { l: "Alterada pós-prandial", v: gl["Alterada pós-prandial"] ?? 0, c: C.ALERTA },
      { l: "Diabetes", v: gl["Diabetes"] ?? 0, c: C.PRIORIDADE },
    ]);
    const rx = MX + lw + 0.3, rw = CW - lw - 0.3, ch = (h - 0.3) / 2;
    const pre = gl["Pré-Diabetes"] ?? 0, dia = gl["Diabetes"] ?? 0;
    [
      { p: pctDe(pre, r.baseGli), c: C.ATENCAO, a: `${pre} ${plural(pre, "colaborador com pré-diabetes", "colaboradores com pré-diabetes")}`, b: "Fase ainda reversível com mudança de hábitos" },
      { p: pctDe(dia, r.baseGli), c: C.PRIORIDADE, a: `${dia} ${plural(dia, "colaborador na faixa de diabetes", "colaboradores na faixa de diabetes")}`, b: "Sugere avaliação clínica prioritária" },
    ].forEach((k, i) => {
      const y = TOP + i * (ch + 0.3);
      cartao(s, rx, y, rw, ch);
      s.addText(`${k.p}%`, { x: rx + 0.3, y: y + 0.2, w: rw - 0.6, h: 0.95, fontSize: 48, bold: true, color: k.c, fontFace: FONT, valign: "middle" });
      s.addText(k.a, { x: rx + 0.3, y: y + 1.15, w: rw - 0.6, h: 0.4, fontSize: 16, bold: true, color: C.PETROLEO, fontFace: FONT, fit: "shrink" });
      s.addText(k.b, { x: rx + 0.3, y: y + 1.55, w: rw - 0.6, h: 0.4, fontSize: 14, color: C.CINZA, fontFace: FONT, fit: "shrink" });
    });
    nota(s, `Base: ${r.baseGli} avaliados. ${r.gliNR} ${plural(r.gliNR, "colaborador sem aferição de glicemia ficou", "colaboradores sem aferição de glicemia ficaram")} fora do cálculo.`);
  };

  // ---------------- 4. PRESSÃO ARTERIAL ----------------
  const paginaPa = () => {
    const s = novaPagina(r.tituloPa);
    const lw = CW * 0.56, h = BOTTOM - TOP;
    cartao(s, MX, TOP, lw, h);
    const barras = [
      { l: "Ótima", v: pa["Ótima"] ?? 0, c: C.OK_ESCURO },
      { l: "Normal", v: pa["Normal"] ?? 0, c: C.OK },
      { l: "PA elevada", v: pa["PA Elevada"] ?? 0, c: C.ATENCAO },
      { l: "Hipertensão estágio 1", v: pa["Hipertensão Estágio 1"] ?? 0, c: C.ALERTA },
      { l: "Hipertensão estágio 2", v: pa["Hipertensão Estágio 2"] ?? 0, c: C.PRIORIDADE },
      { l: "Hipertensão estágio 3", v: pa["Hipertensão Estágio 3"] ?? 0, c: C.PRIORIDADE },
    ];
    const max = Math.max(1, ...barras.map((b) => b.v));
    const labelW = 2.5, trackX = MX + 0.3 + labelW, trackW = lw - 0.6 - labelW - 0.7, rowH = (h - 0.5) / barras.length;
    barras.forEach((b, i) => {
      const y = TOP + 0.25 + i * rowH;
      s.addText(b.l, { x: MX + 0.3, y, w: labelW, h: rowH, fontSize: 14, color: C.PETROLEO, fontFace: FONT, valign: "middle" });
      const bw = b.v > 0 ? Math.max((trackW * b.v) / max, 0.08) : 0;
      if (bw > 0) s.addShape("roundRect", { x: trackX, y: y + rowH * 0.22, w: bw, h: rowH * 0.56, fill: { color: b.c }, line: { color: b.c, width: 0 }, rectRadius: 0.05 });
      s.addText(String(b.v), { x: trackX + bw + 0.1, y, w: 0.7, h: rowH, fontSize: 15, bold: true, color: C.PETROLEO, fontFace: FONT, valign: "middle" });
    });
    const rx = MX + lw + 0.3, rw = CW - lw - 0.3, ch = (h - 0.4) / 3;
    [
      { n: r.paOk, c: C.OK, a: `dentro do esperado (${pctDe(r.paOk, r.basePa)}%)`, b: "Ótima ou normal" },
      { n: r.paAtencao, c: C.ATENCAO, a: "com PA elevada ou hipertensão estágio 1", b: "Acompanhamento preventivo" },
      { n: r.paGrave, c: C.PRIORIDADE, a: "com hipertensão estágio 2 ou 3", b: "Prioridade clínica" },
    ].forEach((k, i) => {
      const y = TOP + i * (ch + 0.2);
      cartao(s, rx, y, rw, ch);
      s.addText(String(k.n), { x: rx + 0.25, y, w: 1.3, h: ch, fontSize: 40, bold: true, color: k.c, fontFace: FONT, align: "center", valign: "middle" });
      s.addText(k.a, { x: rx + 1.6, y: y + 0.15, w: rw - 1.8, h: ch * 0.55, fontSize: 15, bold: true, color: C.PETROLEO, fontFace: FONT, valign: "bottom", fit: "shrink" });
      s.addText(k.b, { x: rx + 1.6, y: y + 0.15 + ch * 0.55, w: rw - 1.8, h: ch * 0.35, fontSize: 13, color: C.CINZA, fontFace: FONT, valign: "top" });
    });
    nota(s, `Base: ${r.basePa} aferidos. ${r.paNR} ${plural(r.paNR, "colaborador", "colaboradores")} sem aferição de PA.`);
  };

  if (r.paPrimeiro) { paginaPa(); paginaGlicemia(); } else { paginaGlicemia(); paginaPa(); }

  // ---------------- 5. ONDE AGIR PRIMEIRO ----------------
  const s5 = novaPagina(`Onde agir primeiro: ${m.encaminhamentos} ${plural(m.encaminhamentos, "colaborador foi encaminhado", "colaboradores foram encaminhados")}`);
  {
    const lw = CW * 0.36, h = BOTTOM - TOP;
    cartao(s5, MX, TOP, lw, h);
    const naoEnc = Math.max(0, m.total - m.encaminhamentos);
    rosca(s5, MX + 0.3, TOP + 0.2, lw - 0.6, h - 1.4, [
      { l: "Encaminhados", v: m.encaminhamentos, c: C.ATENCAO },
      { l: "Não encaminhados", v: naoEnc, c: C.OK },
    ], { showLegend: false, showValue: false, holeSize: 70 });
    s5.addText(`${r.pctEnc}%`, { x: MX + 0.3, y: TOP + 0.2 + (h - 1.4) / 2 - 0.45, w: lw - 0.6, h: 0.9, fontSize: 36, bold: true, color: C.PETROLEO, fontFace: FONT, align: "center", valign: "middle" });
    s5.addText("do total triado foi encaminhado para acompanhamento", { x: MX + 0.3, y: TOP + h - 1.15, w: lw - 0.6, h: 0.9, fontSize: 14, color: C.CINZA, fontFace: FONT, align: "center", valign: "middle" });

    const rx = MX + lw + 0.3, rw = CW - lw - 0.3, ch = (h - 0.4) / 3;
    const diab = gl["Diabetes"] ?? 0, pre = gl["Pré-Diabetes"] ?? 0, gNorm = gl["Normal"] ?? 0;
    [
      { c: C.PRIORIDADE, t: "PRIORIDADE CLÍNICA", a: `${diab} na faixa de diabetes · ${r.paGrave} com hipertensão estágio 2 ou 3`, b: "Sugere avaliação clínica e acompanhamento formal pela Medicina do Trabalho" },
      { c: C.ATENCAO, t: "ATENÇÃO", a: `${pre} com pré-diabetes · ${r.paAtencao} com PA elevada ou estágio 1`, b: "Intervenção de estilo de vida: ainda é possível reverter o quadro" },
      { c: C.OK, t: "DENTRO DO ESPERADO", a: `${gNorm} com glicemia normal · ${r.paOk} com PA ótima ou normal`, b: "Manter o monitoramento periódico" },
    ].forEach((k, i) => {
      const y = TOP + i * (ch + 0.2);
      cartao(s5, rx, y, rw, ch);
      s5.addShape("ellipse", { x: rx + 0.3, y: y + 0.28, w: 0.24, h: 0.24, fill: { color: k.c }, line: { color: k.c, width: 0 } });
      s5.addText(k.t, { x: rx + 0.65, y: y + 0.18, w: rw - 0.9, h: 0.42, fontSize: 14, bold: true, color: k.c, fontFace: FONT, valign: "middle" });
      s5.addText(k.a, { x: rx + 0.65, y: y + 0.6, w: rw - 0.9, h: 0.4, fontSize: 15, bold: true, color: C.PETROLEO, fontFace: FONT, fit: "shrink" });
      s5.addText(k.b, { x: rx + 0.65, y: y + 1.0, w: rw - 0.9, h: 0.4, fontSize: 13, color: C.CINZA, fontFace: FONT, fit: "shrink" });
    });
  }
  nota(s5, "Contagens por indicador; um mesmo colaborador pode aparecer em mais de uma linha.");

  // ---------------- 6. IMPACTO ----------------
  const s6 = novaPagina("Achados silenciosos hoje viram afastamentos amanhã");
  const imp = [
    { t: "Afastamentos", d: "Diabetes e hipertensão sem acompanhamento são causas frequentes de afastamento e de complicações agudas." },
    { t: "Produtividade", d: "Quadros metabólicos não controlados reduzem a disposição e aumentam o absenteísmo e as paradas na operação." },
    { t: "Custo assistencial", d: "Intervir na fase de pré-diabetes e de PA elevada é simples e de baixo custo, e evita tratamentos complexos depois." },
  ];
  const g6 = 0.3, iW = (CW - g6 * 2) / 3, iH = 3.4;
  imp.forEach((k, i) => {
    const x = MX + i * (iW + g6);
    cartao(s6, x, TOP, iW, iH);
    s6.addShape("ellipse", { x: x + 0.35, y: TOP + 0.35, w: 0.75, h: 0.75, fill: { color: C.VERDE }, line: { color: C.VERDE, width: 0 } });
    s6.addText(String(i + 1), { x: x + 0.35, y: TOP + 0.35, w: 0.75, h: 0.75, fontSize: 24, bold: true, color: C.BRANCO, fontFace: FONT, align: "center", valign: "middle" });
    s6.addText(k.t, { x: x + 0.35, y: TOP + 1.3, w: iW - 0.7, h: 0.5, fontSize: 20, bold: true, color: C.PETROLEO, fontFace: FONT });
    s6.addText(k.d, { x: x + 0.35, y: TOP + 1.85, w: iW - 0.7, h: 1.4, fontSize: 14, color: C.PETROLEO, fontFace: FONT, valign: "top", fit: "shrink" });
  });
  s6.addText("A atuação preventiva sobre esse perfil tende a reduzir afastamentos e custos assistenciais no médio prazo.", {
    x: MX, y: TOP + iH + 0.4, w: CW, h: 0.7, fontSize: 18, italic: true, color: C.VERDE, fontFace: FONT, align: "center", valign: "middle",
  });

  const fname = `Saude_${safeName(acao.empresa?.nome ?? "Empresa")}_${acao.data_acao.split("-").reverse().join("-")}.pptx`;
  await pptx.writeFile({ fileName: fname });
}
