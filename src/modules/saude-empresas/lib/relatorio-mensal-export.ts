// Geração automática de Relatório Mensal de Ações Preventivas
// Reusa o "template" visual do sistema (paleta + backgrounds do PPT executivo).

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import bgCapaAsset from "@/assets/saude_bg_capa.png.asset.json";
import bgConteudoAsset from "@/assets/saude_bg_conteudo.png.asset.json";
import { MESES_PT } from "./palestras-calendario";

const sb = supabase as any;

// ============================================================
// Paleta (mesmo template institucional)
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

const SAFE = { x: 0.55, y: 1.7, w: 12.23, h: 4.9 } as const;

// ============================================================
// Tipos
// ============================================================
export type TipoAcaoFiltro =
  | "todos" | "palestras" | "sinais_vitais" | "psa" | "preventivo" | "outros";

export interface FiltrosRelatorio {
  mes: number;          // 1-12
  ano: number;
  empresaId?: string | null;
  empresaNome?: string | null;
  executiva?: string | null;
  enfermeira?: string | null;
  tipo?: TipoAcaoFiltro;
}

export interface AcaoUnificada {
  id: string;
  tipoOriginal: "palestra" | "sinais_vitais" | "psa" | "preventivo";
  tipoLabel: string;
  campanha: string;
  data: string;               // ISO
  horarioInicio: string | null;
  horarioFim: string | null;
  empresaId: string | null;
  empresaNome: string;
  cidade: string | null;
  tema: string | null;
  executiva: string | null;
  enfermeira: string | null;
  responsavel: string | null; // fallback (criador/editor)
  status: string;
}

// ============================================================
// Helpers
// ============================================================
function safeName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .toUpperCase().slice(0, 80);
}

function formatDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

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

function nomeMes(m: number): string {
  return MESES_PT[m - 1] ?? String(m);
}

function rangeMes(ano: number, mes: number): { ini: string; fim: string } {
  const iniD = new Date(ano, mes - 1, 1);
  const fimD = new Date(ano, mes, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { ini: iso(iniD), fim: iso(fimD) };
}

function tipoAcaoLabel(t: AcaoUnificada["tipoOriginal"]): string {
  switch (t) {
    case "palestra": return "Palestra";
    case "sinais_vitais": return "Sinais Vitais";
    case "psa": return "PSA";
    case "preventivo": return "Coleta Preventiva";
  }
}

// Mapa de palavras-chave → campanha (para agrupamento de palestras)
const CAMPANHA_KEYWORDS: Array<{ nome: string; keys: RegExp }> = [
  { nome: "Outubro Rosa", keys: /outubro\s*rosa|c[aâ]ncer.*mama/i },
  { nome: "Novembro Azul", keys: /novembro\s*azul|c[aâ]ncer.*pr[óo]stata|sa[uú]de.*homem/i },
  { nome: "Janeiro Branco", keys: /janeiro\s*branco|sa[uú]de\s*mental/i },
  { nome: "Setembro Amarelo", keys: /setembro\s*amarelo|preven[cç][aã]o.*suic[íi]dio/i },
  { nome: "Hepatites Virais", keys: /hepatite/i },
  { nome: "SIPAT", keys: /sipat/i },
  { nome: "Dezembro Vermelho", keys: /dezembro\s*vermelho|ist|dsts?/i },
  { nome: "Junho Vermelho", keys: /junho\s*vermelho|doa[cç][aã]o.*sangue/i },
];

function inferCampanha(tema: string | null, tipo: AcaoUnificada["tipoOriginal"]): string {
  if (tipo === "sinais_vitais") return "Sinais Vitais";
  if (tipo === "psa") return "PSA";
  if (tipo === "preventivo") return "Coletas Preventivas";
  if (!tema) return "Palestras Gerais";
  for (const c of CAMPANHA_KEYWORDS) if (c.keys.test(tema)) return c.nome;
  return "Palestras Gerais";
}

// ============================================================
// Fetch + unificação
// ============================================================
export async function fetchDadosRelatorio(f: FiltrosRelatorio): Promise<AcaoUnificada[]> {
  const { ini, fim } = rangeMes(f.ano, f.mes);
  const acoes: AcaoUnificada[] = [];

  // ---------- palestras_saude ----------
  if (!f.tipo || f.tipo === "todos" || f.tipo === "palestras" || f.tipo === "outros") {
    let q = sb.from("palestras_saude").select("*").gte("data", ini).lte("data", fim);
    if (f.empresaNome) q = q.eq("empresa", f.empresaNome);
    if (f.executiva) q = q.eq("executiva", f.executiva);
    const { data, error } = await q;
    if (error) throw error;
    (data ?? []).forEach((p: any) => {
      if (p.status === "cancelado") return;
      acoes.push({
        id: p.id,
        tipoOriginal: "palestra",
        tipoLabel: "Palestra",
        campanha: inferCampanha(p.tema, "palestra"),
        data: p.data,
        horarioInicio: p.horario_inicio,
        horarioFim: p.horario_fim,
        empresaId: null,
        empresaNome: p.empresa,
        cidade: null,
        tema: p.tema,
        executiva: p.executiva,
        enfermeira: null,
        responsavel: p.editado_por ?? p.criado_por,
        status: p.status,
      });
    });
  }

  // ---------- acoes_preventivas ----------
  if (!f.tipo || f.tipo === "todos" || f.tipo === "sinais_vitais" || f.tipo === "psa" || f.tipo === "preventivo" || f.tipo === "outros") {
    let q = sb.from("acoes_preventivas")
      .select("*, empresa:empresas(id,nome,endereco)")
      .gte("data", ini).lte("data", fim);
    if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
    if (f.executiva) q = q.eq("executiva_nome", f.executiva);
    if (f.tipo === "sinais_vitais") q = q.eq("tipo", "sinais_vitais");
    if (f.tipo === "psa") q = q.eq("tipo", "psa");
    if (f.tipo === "preventivo") q = q.eq("tipo", "preventivo");
    const { data, error } = await q;
    if (error) throw error;
    (data ?? []).forEach((a: any) => {
      if (a.status === "cancelado") return;
      const tipo = a.tipo as "sinais_vitais" | "psa" | "preventivo";
      acoes.push({
        id: a.id,
        tipoOriginal: tipo,
        tipoLabel: tipoAcaoLabel(tipo),
        campanha: inferCampanha(null, tipo),
        data: a.data,
        horarioInicio: a.horario_inicio,
        horarioFim: a.horario_fim,
        empresaId: a.empresa_id,
        empresaNome: a.empresa?.nome ?? "—",
        cidade: a.empresa?.endereco ?? null,
        tema: null,
        executiva: a.executiva_nome,
        enfermeira: null,
        responsavel: a.responsavel ?? a.updated_by_nome ?? a.created_by_nome,
        status: a.status,
      });
    });
  }

  // filtro enfermeira/responsável (post-filter — casa contra qualquer campo)
  const enf = f.enfermeira?.trim().toLowerCase();
  const filtered = enf
    ? acoes.filter((a) =>
        (a.enfermeira ?? "").toLowerCase().includes(enf) ||
        (a.responsavel ?? "").toLowerCase().includes(enf))
    : acoes;

  filtered.sort((a, b) => (a.data + (a.horarioInicio ?? "")).localeCompare(b.data + (b.horarioInicio ?? "")));
  return filtered;
}

// ============================================================
// Métricas
// ============================================================
export interface MetricasRelatorio {
  totalAcoes: number;
  totalEmpresas: number;
  totalPalestras: number;
  totalPsa: number;
  totalSinaisVitais: number;
  totalPreventivas: number;
  totalCampanhas: number;
  porEmpresa: Array<{ nome: string; qtd: number }>;
  porTipo: Array<{ tipo: string; qtd: number }>;
  porSemana: Array<{ semana: string; qtd: number }>;
  porCampanha: Array<{ campanha: string; empresas: number; qtd: number }>;
  empresaTop: { nome: string; qtd: number } | null;
  tipoTop: { tipo: string; qtd: number; pct: number } | null;
  mediaSemanal: number;
}

function calcularMetricas(acoes: AcaoUnificada[], ano: number, mes: number): MetricasRelatorio {
  const total = acoes.length;
  const empresas = new Set(acoes.map((a) => a.empresaNome));
  const palestras = acoes.filter((a) => a.tipoOriginal === "palestra").length;
  const psa = acoes.filter((a) => a.tipoOriginal === "psa").length;
  const sv = acoes.filter((a) => a.tipoOriginal === "sinais_vitais").length;
  const prev = acoes.filter((a) => a.tipoOriginal === "preventivo").length;

  const empMap = new Map<string, number>();
  acoes.forEach((a) => empMap.set(a.empresaNome, (empMap.get(a.empresaNome) ?? 0) + 1));
  const porEmpresa = [...empMap.entries()].map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  const tipoMap = new Map<string, number>();
  acoes.forEach((a) => tipoMap.set(a.tipoLabel, (tipoMap.get(a.tipoLabel) ?? 0) + 1));
  const porTipo = [...tipoMap.entries()].map(([tipo, qtd]) => ({ tipo, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  // Semanas do mês (dividido em blocos de 7 dias a partir do dia 1)
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const numSemanas = Math.ceil(ultimoDia / 7);
  const semanas: Array<{ semana: string; qtd: number }> = [];
  for (let s = 0; s < numSemanas; s++) {
    const ini = s * 7 + 1;
    const fim = Math.min((s + 1) * 7, ultimoDia);
    semanas.push({ semana: `Sem ${s + 1} (${ini}–${fim})`, qtd: 0 });
  }
  acoes.forEach((a) => {
    const dia = Number(a.data.split("-")[2]);
    const idx = Math.min(Math.floor((dia - 1) / 7), numSemanas - 1);
    semanas[idx].qtd++;
  });

  const campMap = new Map<string, { empresas: Set<string>; qtd: number }>();
  acoes.forEach((a) => {
    const cur = campMap.get(a.campanha) ?? { empresas: new Set(), qtd: 0 };
    cur.empresas.add(a.empresaNome);
    cur.qtd++;
    campMap.set(a.campanha, cur);
  });
  const porCampanha = [...campMap.entries()].map(([campanha, v]) =>
    ({ campanha, empresas: v.empresas.size, qtd: v.qtd })).sort((a, b) => b.qtd - a.qtd);

  const empresaTop = porEmpresa[0] ?? null;
  const tipoTop = porTipo[0]
    ? { tipo: porTipo[0].tipo, qtd: porTipo[0].qtd, pct: pct(porTipo[0].qtd, total) }
    : null;

  const mediaSemanal = numSemanas > 0 ? Math.round((total / numSemanas) * 10) / 10 : 0;

  return {
    totalAcoes: total,
    totalEmpresas: empresas.size,
    totalPalestras: palestras,
    totalPsa: psa,
    totalSinaisVitais: sv,
    totalPreventivas: prev,
    totalCampanhas: porCampanha.length,
    porEmpresa, porTipo, porSemana: semanas, porCampanha,
    empresaTop, tipoTop, mediaSemanal,
  };
}

// ============================================================
// Comparativo mês anterior
// ============================================================
async function totalMesAnterior(f: FiltrosRelatorio): Promise<number | null> {
  const prevMes = f.mes === 1 ? 12 : f.mes - 1;
  const prevAno = f.mes === 1 ? f.ano - 1 : f.ano;
  try {
    const acoes = await fetchDadosRelatorio({ ...f, mes: prevMes, ano: prevAno });
    return acoes.length;
  } catch {
    return null;
  }
}

// ============================================================
// Helpers de layout PPT
// ============================================================
function slideTitle(slide: any, titulo: string, subtitulo?: string) {
  slide.addText(titulo, {
    x: SAFE.x, y: 0.55, w: 8.6, h: 0.5,
    fontSize: 26, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: SAFE.x, y: 1.05, w: 8.6, h: 0.35,
      fontSize: 13, color: COLORS.GREEN, fontFace: "Calibri",
    });
  }
}

function kpiCard(slide: any, x: number, y: number, w: number, h: number,
  label: string, valor: string | number, cor: string, sub?: string) {
  slide.addShape("rect", { x, y, w: 0.1, h, fill: { color: cor }, line: { color: cor } });
  slide.addShape("roundRect", {
    x: x + 0.1, y, w: w - 0.1, h,
    fill: { color: COLORS.WHITE },
    line: { color: COLORS.BORDER, width: 0.75 },
    rectRadius: 0.06,
  });
  slide.addText(label.toUpperCase(), {
    x: x + 0.25, y: y + 0.1, w: w - 0.35, h: 0.3,
    fontSize: 10, bold: true, color: COLORS.GREY, charSpacing: 2, fontFace: "Calibri",
  });
  const strVal = String(valor);
  const size = strVal.length <= 3 ? 42 : strVal.length <= 5 ? 34 : 26;
  slide.addText(strVal, {
    x: x + 0.25, y: y + 0.45, w: w - 0.35, h: h - 0.9,
    fontSize: size, bold: true, color: cor, fontFace: "Calibri", valign: "middle",
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
    x, y, w, h, fill: { color: COLORS.WHITE },
    line: { color: COLORS.BORDER, width: 0.75 }, rectRadius: 0.08,
  });
  slide.addText(titulo, {
    x: x + 0.25, y: y + 0.15, w: w - 0.5, h: 0.4,
    fontSize: 13, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
}

function semDados(slide: any) {
  slide.addText("Sem dados para o período selecionado", {
    x: SAFE.x, y: SAFE.y + SAFE.h / 2 - 0.3, w: SAFE.w, h: 0.6,
    fontSize: 18, italic: true, color: COLORS.GREY, align: "center", fontFace: "Calibri",
  });
}

// ============================================================
// PPTX
// ============================================================
export async function gerarPptxRelatorio(
  f: FiltrosRelatorio, acoes: AcaoUnificada[], m: MetricasRelatorio, totalMesAnt: number | null,
): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const periodo = `${nomeMes(f.mes)} de ${f.ano}`;
  pptx.title = `Relatório Mensal de Ações Preventivas — ${periodo}`;

  const [bgCapa, bgConteudo] = await Promise.all([
    fetchDataUri(bgCapaAsset.url),
    fetchDataUri(bgConteudoAsset.url),
  ]);
  const capaBg = { data: bgCapa };
  const conteudoBg = { data: bgConteudo };

  const geradoEm = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  // Slide 1 — Capa
  const s1 = pptx.addSlide();
  s1.background = capaBg;
  s1.addText("PROGRAMA SAÚDE NAS EMPRESAS", {
    x: 0.7, y: 3.05, w: 8.2, h: 0.4,
    fontSize: 12, bold: true, color: COLORS.GREEN, charSpacing: 6, fontFace: "Calibri",
  });
  s1.addText("Relatório Mensal de Ações Preventivas", {
    x: 0.7, y: 3.45, w: 8.2, h: 0.8,
    fontSize: 28, bold: true, color: COLORS.NAVY, fontFace: "Calibri",
  });
  s1.addText(periodo.toUpperCase(), {
    x: 0.7, y: 4.3, w: 8.2, h: 0.6,
    fontSize: 22, bold: true, color: COLORS.GREEN, fontFace: "Calibri",
  });
  const metaLines: any[] = [
    { text: `Gerado em: ${geradoEm}\n`, options: {} },
  ];
  if (f.empresaNome) metaLines.push({ text: `Empresa: ${f.empresaNome}\n`, options: {} });
  if (f.executiva) metaLines.push({ text: `Executiva: ${f.executiva}\n`, options: {} });
  if (f.enfermeira) metaLines.push({ text: `Responsável: ${f.enfermeira}\n`, options: {} });
  s1.addText(metaLines as any, {
    x: 0.7, y: 5.0, w: 8.2, h: 1.4,
    fontSize: 13, color: COLORS.NAVY, fontFace: "Calibri", paraSpaceAfter: 4,
  });

  // Slide 2 — Resumo Geral
  const s2 = pptx.addSlide();
  s2.background = conteudoBg;
  slideTitle(s2, "Resumo Geral", periodo);
  if (m.totalAcoes === 0) { semDados(s2); }
  else {
    const gap = 0.2;
    const allKpis = [
      { label: "Total de ações", valor: m.totalAcoes, cor: COLORS.NAVY, sub: "Realizadas no período" },
      { label: "Empresas atendidas", valor: m.totalEmpresas, cor: COLORS.GREEN, sub: "Distintas" },
      { label: "Palestras", valor: m.totalPalestras, cor: COLORS.AMBER },
      { label: "PSA", valor: m.totalPsa, cor: COLORS.RED },
      { label: "Sinais Vitais", valor: m.totalSinaisVitais, cor: COLORS.NAVY },
      { label: "Coletas Preventivas", valor: m.totalPreventivas, cor: COLORS.GREEN },
      { label: "Campanhas", valor: m.totalCampanhas, cor: COLORS.AMBER, sub: "Diferentes" },
      { label: "Média semanal", valor: m.mediaSemanal, cor: COLORS.RED, sub: "Ações/semana" },
    ];
    // Regra: ocultar KPIs zerados (mantém apenas com valor > 0)
    const kpis = allKpis.filter((k) => Number(k.valor) > 0);
    const cols = Math.min(4, Math.max(1, kpis.length));
    const rowsCount = Math.ceil(kpis.length / cols);
    const kW = (SAFE.w - gap * (cols - 1)) / cols;
    const kH = rowsCount > 1 ? (SAFE.h - gap) / 2 : SAFE.h * 0.55;
    kpis.forEach((k, i) => {
      const col = i % cols; const row = Math.floor(i / cols);
      kpiCard(s2, SAFE.x + col * (kW + gap), SAFE.y + row * (kH + gap), kW, kH, k.label, k.valor, k.cor, k.sub);
    });
  }

  // Slide 3 — Indicadores
  const s3 = pptx.addSlide();
  s3.background = conteudoBg;
  slideTitle(s3, "Indicadores", "Distribuição por empresa, tipo e semana");
  if (m.totalAcoes === 0) semDados(s3);
  else {
    const chartW = (SAFE.w - 0.3) / 2;
    const chartH = (SAFE.h - 0.3) / 2;
    const topEmp = m.porEmpresa.slice(0, 8).map((e) => ({
      ...e,
      nome: e.nome.length > 26 ? e.nome.slice(0, 24) + "…" : e.nome,
    }));
    s3.addChart(pptx.ChartType.bar,
      [{ name: "Ações", labels: topEmp.map((e) => e.nome), values: topEmp.map((e) => e.qtd) }],
      {
        x: SAFE.x, y: SAFE.y, w: chartW, h: chartH,
        barDir: "bar", chartColors: [COLORS.NAVY], barGapWidthPct: 45,
        showTitle: true, title: "Ações por empresa (top 8)",
        titleFontSize: 12, titleColor: COLORS.NAVY,
        showValue: true,
        dataLabelPosition: "outEnd",
        dataLabelFontSize: 9, dataLabelColor: COLORS.NAVY, dataLabelFontBold: true,
        showLegend: false,
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
        valAxisMinVal: 0,
      });
    s3.addChart(pptx.ChartType.doughnut,
      [{ name: "Tipo", labels: m.porTipo.map((t) => t.tipo), values: m.porTipo.map((t) => t.qtd) }],
      {
        x: SAFE.x + chartW + 0.3, y: SAFE.y, w: chartW, h: chartH,
        chartColors: [COLORS.NAVY, COLORS.GREEN, COLORS.AMBER, COLORS.RED, COLORS.GREY],
        showLegend: true, legendPos: "b", legendFontSize: 10,
        showTitle: true, title: "Ações por tipo",
        titleFontSize: 12, titleColor: COLORS.NAVY,
        showPercent: true, dataLabelColor: COLORS.WHITE, dataLabelFontSize: 10, dataLabelFontBold: true,
      });
    s3.addChart(pptx.ChartType.line,
      [{ name: "Ações", labels: m.porSemana.map((s) => s.semana), values: m.porSemana.map((s) => s.qtd) }],
      {
        x: SAFE.x, y: SAFE.y + chartH + 0.3, w: SAFE.w, h: chartH,
        chartColors: [COLORS.GREEN], lineSize: 3,
        showTitle: true, title: "Evolução semanal",
        titleFontSize: 12, titleColor: COLORS.NAVY,
        showValue: true, showLegend: false,
        dataLabelPosition: "t", dataLabelFontSize: 9, dataLabelColor: COLORS.NAVY,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      });
  }

  // Helper: renderiza uma tabela paginada respeitando SAFE.h
  const ROWS_PER_PAGE = 15;
  const renderTablePaged = (
    titulo: string,
    subtitulo: (page: number, total: number, from: number, to: number, totalRows: number) => string,
    header: string[],
    allRows: string[][],
    colW: number[],
  ) => {
    if (allRows.length === 0) {
      const s = pptx.addSlide();
      s.background = conteudoBg;
      slideTitle(s, titulo, subtitulo(1, 1, 0, 0, 0));
      semDados(s);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
    for (let p = 0; p < totalPages; p++) {
      const from = p * ROWS_PER_PAGE;
      const to = Math.min(from + ROWS_PER_PAGE, allRows.length);
      const slide = pptx.addSlide();
      slide.background = conteudoBg;
      slideTitle(slide, titulo, subtitulo(p + 1, totalPages, from + 1, to, allRows.length));
      const chunk = allRows.slice(from, to);
      const headerRow = header.map((h) => ({
        text: h,
        options: { bold: true, color: COLORS.WHITE, fill: { color: COLORS.NAVY }, align: "left", valign: "middle" },
      }));
      const bodyRows = chunk.map((row, i) =>
        row.map((cell) => ({
          text: cell,
          options: {
            color: COLORS.NAVY,
            fill: { color: i % 2 === 0 ? COLORS.WHITE : COLORS.LIGHT },
            valign: "middle",
          },
        })));
      slide.addTable([headerRow as any, ...bodyRows] as any, {
        x: SAFE.x, y: SAFE.y, w: SAFE.w,
        colW,
        rowH: 0.3,
        fontSize: 9, fontFace: "Calibri",
        border: { pt: 0.5, color: COLORS.BORDER },
        margin: 0.06,
      });
    }
  };

  // Slide(s) 4 — Empresas Atendidas
  {
    const header = ["Empresa", "Cidade", "Data", "Tipo", "Executiva", "Responsável"];
    const rows = acoes.map((a) => [
      a.empresaNome, a.cidade ?? "—", formatDateBR(a.data),
      a.tipoLabel, a.executiva ?? "—", a.enfermeira ?? a.responsavel ?? "—",
    ]);
    renderTablePaged(
      "Empresas Atendidas",
      (p, tp, from, to, tot) => tp > 1
        ? `${m.totalEmpresas} empresas · ${m.totalAcoes} ações · Página ${p}/${tp} (registros ${from}–${to} de ${tot})`
        : `${m.totalEmpresas} empresas · ${m.totalAcoes} ações`,
      header, rows,
      [3.2, 2.2, 1.0, 1.6, 2.3, 1.93],
    );
  }

  // Slide(s) 5 — Ações Realizadas
  {
    const header = ["Empresa", "Tema", "Campanha", "Data", "Horário", "Responsável"];
    const rows = acoes.map((a) => [
      a.empresaNome, a.tema ?? "—", a.campanha, formatDateBR(a.data),
      `${a.horarioInicio?.slice(0, 5) ?? "--:--"} – ${a.horarioFim?.slice(0, 5) ?? "--:--"}`,
      a.executiva ?? a.responsavel ?? "—",
    ]);
    renderTablePaged(
      "Ações Realizadas",
      (p, tp, from, to, tot) => tp > 1
        ? `Detalhamento das ações · Página ${p}/${tp} (registros ${from}–${to} de ${tot})`
        : "Detalhamento das ações do período",
      header, rows,
      [2.8, 2.6, 1.9, 1.0, 1.6, 2.33],
    );
  }

  // Slide 6 — Campanhas
  const s6 = pptx.addSlide();
  s6.background = conteudoBg;
  slideTitle(s6, "Campanhas Realizadas", "Agrupamento por campanha ou tema");
  if (m.porCampanha.length === 0) semDados(s6);
  else {
    const header = ["Campanha", "Empresas atendidas", "Ações realizadas"];
    const rows = m.porCampanha.map((c) => [c.campanha, String(c.empresas), String(c.qtd)]);
    s6.addTable([header, ...rows] as any, {
      x: SAFE.x, y: SAFE.y, w: SAFE.w,
      colW: [6.5, 2.8, 2.93],
      fontSize: 12, fontFace: "Calibri",
      border: { pt: 0.5, color: COLORS.BORDER },
      fill: { color: COLORS.WHITE },
    });
  }

  // Slide 7 — Análise Inteligente
  const s7 = pptx.addSlide();
  s7.background = conteudoBg;
  slideTitle(s7, "Análise Inteligente", "Indicadores consolidados do período");
  if (m.totalAcoes === 0) semDados(s7);
  else {
    const colW = (SAFE.w - 0.3) / 2;
    painel(s7, SAFE.x, SAFE.y, colW, SAFE.h, "Destaques");
    const linhas: string[] = [];
    if (m.empresaTop) linhas.push(`Empresa com mais ações: ${m.empresaTop.nome} (${m.empresaTop.qtd})`);
    if (m.tipoTop) linhas.push(`Tipo mais realizado: ${m.tipoTop.tipo} — ${m.tipoTop.qtd} (${m.tipoTop.pct}%)`);
    linhas.push(`Média semanal: ${m.mediaSemanal} ações/semana`);
    s7.addText(linhas.map((t) => ({ text: t, options: { bullet: { code: "25CF" }, color: COLORS.NAVY } })) as any, {
      x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: colW - 0.6, h: SAFE.h - 1.0,
      fontSize: 14, fontFace: "Calibri", paraSpaceAfter: 8,
    });

    painel(s7, SAFE.x + colW + 0.3, SAFE.y, colW, SAFE.h, "Comparativo com mês anterior");
    let compTxt: any[];
    if (totalMesAnt == null || totalMesAnt === 0) {
      compTxt = [{ text: "Não há dados suficientes para realizar o comparativo com o mês anterior.", options: { italic: true, color: COLORS.GREY } }];
    } else {
      const diff = m.totalAcoes - totalMesAnt;
      const perc = pct(Math.abs(diff), totalMesAnt);
      const rotulo = diff >= 0 ? "Crescimento" : "Redução";
      compTxt = [
        { text: `${nomeMes(f.mes)}: ${m.totalAcoes} ações\n`, options: { bold: true, color: COLORS.NAVY } },
        { text: `${nomeMes(f.mes === 1 ? 12 : f.mes - 1)}: ${totalMesAnt} ações\n`, options: { color: COLORS.NAVY } },
        { text: `${rotulo} de ${perc}%`, options: { bold: true, color: diff >= 0 ? COLORS.GREEN : COLORS.RED } },
      ];
    }
    s7.addText(compTxt as any, {
      x: SAFE.x + colW + 0.6, y: SAFE.y + 0.9, w: colW - 0.6, h: SAFE.h - 1.2,
      fontSize: 15, fontFace: "Calibri", paraSpaceAfter: 8, valign: "top",
    });
  }

  // Slide 8 — Conclusão
  const s8 = pptx.addSlide();
  s8.background = conteudoBg;
  slideTitle(s8, "Conclusão", "Resumo executivo do período");
  painel(s8, SAFE.x, SAFE.y, SAFE.w, SAFE.h, "Síntese do mês");
  const resumo = m.totalAcoes === 0
    ? "Não foram registradas ações para o período selecionado."
    : `Em ${periodo} foram realizadas ${m.totalAcoes} ações preventivas em ${m.totalEmpresas} empresa(s), incluindo ${m.totalPalestras} palestra(s), ${m.totalSinaisVitais} ação(ões) de sinais vitais, ${m.totalPsa} ação(ões) de PSA e ${m.totalPreventivas} coleta(s) preventiva(s), distribuídas em ${m.totalCampanhas} campanha(s). Os dados apresentados refletem exclusivamente os registros cadastrados no sistema durante o período analisado.`;
  s8.addText(resumo, {
    x: SAFE.x + 0.3, y: SAFE.y + 0.7, w: SAFE.w - 0.6, h: SAFE.h - 1.0,
    fontSize: 15, color: COLORS.NAVY, fontFace: "Calibri", valign: "top", paraSpaceAfter: 8,
  });

  const fname = `Relatorio_Mensal_${safeName(nomeMes(f.mes))}_${f.ano}.pptx`;
  await pptx.writeFile({ fileName: fname });
}

// ============================================================
// PDF
// ============================================================
export function gerarPdfRelatorio(
  f: FiltrosRelatorio, acoes: AcaoUnificada[], m: MetricasRelatorio, totalMesAnt: number | null,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const periodo = `${nomeMes(f.mes)} de ${f.ano}`;
  const geradoEm = new Date().toLocaleString("pt-BR");

  const navy: [number, number, number] = [27, 58, 75];
  const green: [number, number, number] = [44, 95, 45];
  const grey: [number, number, number] = [107, 114, 128];

  // Capa
  doc.setFillColor(...navy);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("PROGRAMA SAÚDE NAS EMPRESAS", 50, 120);
  doc.setFontSize(32);
  doc.text("Relatório Mensal de Ações Preventivas", 50, 180);
  doc.setFontSize(24).setTextColor(180, 220, 180);
  doc.text(periodo.toUpperCase(), 50, 230);
  doc.setFontSize(12).setTextColor(220, 230, 235).setFont("helvetica", "normal");
  doc.text(`Gerado em: ${geradoEm}`, 50, 280);
  if (f.empresaNome) doc.text(`Empresa: ${f.empresaNome}`, 50, 300);
  if (f.executiva) doc.text(`Executiva: ${f.executiva}`, 50, 320);
  if (f.enfermeira) doc.text(`Responsável: ${f.enfermeira}`, 50, 340);

  const secao = (titulo: string) => {
    doc.addPage();
    doc.setTextColor(...navy).setFont("helvetica", "bold").setFontSize(20);
    doc.text(titulo, 40, 50);
    doc.setDrawColor(...green).setLineWidth(2);
    doc.line(40, 58, 780, 58);
    doc.setTextColor(0, 0, 0).setFont("helvetica", "normal").setFontSize(11);
  };

  // Resumo
  secao("Resumo Geral");
  const kpisAll: Array<[string, number]> = [
    ["Total de ações", m.totalAcoes], ["Empresas atendidas", m.totalEmpresas],
    ["Palestras", m.totalPalestras], ["PSA", m.totalPsa],
    ["Sinais Vitais", m.totalSinaisVitais], ["Coletas Preventivas", m.totalPreventivas],
    ["Campanhas", m.totalCampanhas], ["Média semanal", m.mediaSemanal],
  ];
  const kpis = kpisAll.filter(([, v]) => Number(v) > 0);
  autoTable(doc, {
    startY: 80,
    head: [["Indicador", "Valor"]],
    body: kpis.map(([k, v]) => [String(k), String(v)]),
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 12 },
  });

  // Empresas Atendidas
  secao("Empresas Atendidas");
  autoTable(doc, {
    startY: 80,
    head: [["Empresa", "Cidade", "Data", "Tipo", "Executiva", "Responsável"]],
    body: acoes.length
      ? acoes.map((a) => [a.empresaNome, a.cidade ?? "—", formatDateBR(a.data), a.tipoLabel, a.executiva ?? "—", a.enfermeira ?? a.responsavel ?? "—"])
      : [["Sem dados para o período selecionado", "", "", "", "", ""]],
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Ações Realizadas
  secao("Ações Realizadas");
  autoTable(doc, {
    startY: 80,
    head: [["Empresa", "Tema", "Campanha", "Data", "Horário", "Responsável"]],
    body: acoes.length
      ? acoes.map((a) => [
          a.empresaNome, a.tema ?? "—", a.campanha, formatDateBR(a.data),
          `${a.horarioInicio?.slice(0, 5) ?? "--:--"} – ${a.horarioFim?.slice(0, 5) ?? "--:--"}`,
          a.executiva ?? a.responsavel ?? "—",
        ])
      : [["Sem dados para o período selecionado", "", "", "", "", ""]],
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Campanhas
  secao("Campanhas Realizadas");
  autoTable(doc, {
    startY: 80,
    head: [["Campanha", "Empresas atendidas", "Ações realizadas"]],
    body: m.porCampanha.length
      ? m.porCampanha.map((c) => [c.campanha, String(c.empresas), String(c.qtd)])
      : [["Sem dados para o período selecionado", "", ""]],
    headStyles: { fillColor: navy, textColor: 255 },
    styles: { fontSize: 11 },
  });

  // Análise
  secao("Análise Inteligente");
  const analise: string[] = [];
  if (m.empresaTop) analise.push(`• Empresa com mais ações: ${m.empresaTop.nome} (${m.empresaTop.qtd})`);
  if (m.tipoTop) analise.push(`• Tipo mais realizado: ${m.tipoTop.tipo} — ${m.tipoTop.qtd} (${m.tipoTop.pct}%)`);
  analise.push(`• Média semanal: ${m.mediaSemanal} ações/semana`);
  if (totalMesAnt == null || totalMesAnt === 0) {
    analise.push("• Comparativo: não há dados suficientes para realizar o comparativo com o mês anterior.");
  } else {
    const diff = m.totalAcoes - totalMesAnt;
    const perc = pct(Math.abs(diff), totalMesAnt);
    analise.push(`• ${nomeMes(f.mes)}: ${m.totalAcoes} ações · ${nomeMes(f.mes === 1 ? 12 : f.mes - 1)}: ${totalMesAnt} · ${diff >= 0 ? "Crescimento" : "Redução"} de ${perc}%`);
  }
  doc.setFontSize(13);
  analise.forEach((t, i) => doc.text(t, 40, 90 + i * 22));

  // Conclusão
  secao("Conclusão");
  const resumo = m.totalAcoes === 0
    ? "Não foram registradas ações para o período selecionado."
    : `Em ${periodo} foram realizadas ${m.totalAcoes} ações preventivas em ${m.totalEmpresas} empresa(s), incluindo ${m.totalPalestras} palestra(s), ${m.totalSinaisVitais} ação(ões) de sinais vitais, ${m.totalPsa} ação(ões) de PSA e ${m.totalPreventivas} coleta(s) preventiva(s), distribuídas em ${m.totalCampanhas} campanha(s). Os dados apresentados refletem exclusivamente os registros cadastrados no sistema durante o período analisado.`;
  doc.setFontSize(13);
  const linhas = doc.splitTextToSize(resumo, 750);
  doc.text(linhas, 40, 90);

  doc.setFontSize(9).setTextColor(...grey);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.text(`Gerado em ${geradoEm} · Página ${i}/${total}`, 40, 570);
  }

  doc.save(`Relatorio_Mensal_${safeName(nomeMes(f.mes))}_${f.ano}.pdf`);
}

// ============================================================
// Excel
// ============================================================
export function gerarExcelRelatorio(
  f: FiltrosRelatorio, acoes: AcaoUnificada[], m: MetricasRelatorio, totalMesAnt: number | null,
): void {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ["Relatório Mensal de Ações Preventivas"],
    [`Período: ${nomeMes(f.mes)}/${f.ano}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Indicador", "Valor"],
    ["Total de ações", m.totalAcoes],
    ["Empresas atendidas", m.totalEmpresas],
    ["Palestras", m.totalPalestras],
    ["PSA", m.totalPsa],
    ["Sinais Vitais", m.totalSinaisVitais],
    ["Coletas Preventivas", m.totalPreventivas],
    ["Campanhas", m.totalCampanhas],
    ["Média semanal", m.mediaSemanal],
    ["Empresa com mais ações", m.empresaTop ? `${m.empresaTop.nome} (${m.empresaTop.qtd})` : "—"],
    ["Tipo mais realizado", m.tipoTop ? `${m.tipoTop.tipo} (${m.tipoTop.qtd} · ${m.tipoTop.pct}%)` : "—"],
    ["Total mês anterior", totalMesAnt ?? "Sem dados"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  const acoesRows = acoes.map((a) => ({
    Data: formatDateBR(a.data),
    "Horário início": a.horarioInicio?.slice(0, 5) ?? "",
    "Horário fim": a.horarioFim?.slice(0, 5) ?? "",
    Empresa: a.empresaNome,
    Cidade: a.cidade ?? "",
    Tipo: a.tipoLabel,
    Campanha: a.campanha,
    Tema: a.tema ?? "",
    Executiva: a.executiva ?? "",
    Enfermeira: a.enfermeira ?? "",
    "Responsável": a.responsavel ?? "",
    Status: a.status,
  }));
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(acoesRows.length ? acoesRows : [{ Info: "Sem dados para o período selecionado" }]),
    "Ações");

  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(m.porEmpresa.length ? m.porEmpresa : [{ Info: "Sem dados" }]), "Por Empresa");
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(m.porTipo.length ? m.porTipo : [{ Info: "Sem dados" }]), "Por Tipo");
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(m.porSemana), "Por Semana");
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(m.porCampanha.length ? m.porCampanha : [{ Info: "Sem dados" }]), "Por Campanha");

  XLSX.writeFile(wb, `Relatorio_Mensal_${safeName(nomeMes(f.mes))}_${f.ano}.xlsx`);
}

// ============================================================
// API pública
// ============================================================
export async function gerarRelatorioMensal(
  f: FiltrosRelatorio, formatos: Array<"pptx" | "pdf" | "xlsx">,
): Promise<{ metricas: MetricasRelatorio; totalAcoes: number }> {
  const acoes = await fetchDadosRelatorio(f);
  const metricas = calcularMetricas(acoes, f.ano, f.mes);
  const totalMesAnt = await totalMesAnterior(f);

  if (formatos.includes("pptx")) await gerarPptxRelatorio(f, acoes, metricas, totalMesAnt);
  if (formatos.includes("pdf")) gerarPdfRelatorio(f, acoes, metricas, totalMesAnt);
  if (formatos.includes("xlsx")) gerarExcelRelatorio(f, acoes, metricas, totalMesAnt);

  return { metricas, totalAcoes: acoes.length };
}
