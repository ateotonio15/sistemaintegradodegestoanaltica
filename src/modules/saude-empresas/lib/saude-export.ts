import * as XLSX from "xlsx";
import type { Triagem, AcaoSaude } from "../hooks/useSaudeEmpresas";
import { classificarImc } from "./saude-rules";

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80);
}

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

export async function exportRelatorioPptx(acao: AcaoSaude, triagens: Triagem[]) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const empresaNome = acao.empresa?.nome ?? "Empresa";

  // Capa
  const s1 = pptx.addSlide();
  s1.background = { color: "0B1410" };
  s1.addText("Relatório de Saúde nas Empresas", { x: 0.5, y: 1.5, w: 12, h: 1, fontSize: 36, bold: true, color: "FFFFFF" });
  s1.addText(empresaNome, { x: 0.5, y: 2.6, w: 12, h: 0.8, fontSize: 24, color: "22C55E" });
  s1.addText(`Data da ação: ${acao.data_acao} · Total triagens: ${triagens.length}`, { x: 0.5, y: 3.4, w: 12, h: 0.6, fontSize: 16, color: "CADCFC" });

  // KPIs
  const total = triagens.length;
  const has = triagens.filter((t) => t.tem_has).length;
  const dm = triagens.filter((t) => t.tem_dm).length;
  const obesos = triagens.filter((t) => (t.imc ?? 0) >= 30).length;
  const risco_alto = triagens.filter((t) => t.risco_geral === "alto").length;

  const s2 = pptx.addSlide();
  s2.addText("Indicadores", { x: 0.5, y: 0.3, fontSize: 28, bold: true });
  const kpis = [
    ["Total Triagens", total],
    ["% HAS", total ? `${Math.round((has / total) * 100)}%` : "0%"],
    ["% DM", total ? `${Math.round((dm / total) * 100)}%` : "0%"],
    ["% Obesidade", total ? `${Math.round((obesos / total) * 100)}%` : "0%"],
    ["% Risco Alto", total ? `${Math.round((risco_alto / total) * 100)}%` : "0%"],
  ];
  kpis.forEach(([label, value], i) => {
    s2.addShape(pptx.ShapeType.roundRect, { x: 0.5 + i * 2.5, y: 1.5, w: 2.2, h: 2, fill: { color: "F1F5F9" }, line: { color: "E2E8F0" }, rectRadius: 0.1 });
    s2.addText(String(value), { x: 0.5 + i * 2.5, y: 1.7, w: 2.2, h: 1, fontSize: 32, bold: true, align: "center", color: "0B1410" });
    s2.addText(String(label), { x: 0.5 + i * 2.5, y: 2.7, w: 2.2, h: 0.5, fontSize: 12, align: "center", color: "475569" });
  });

  // Tabela Top risco alto
  const s3 = pptx.addSlide();
  s3.addText("Colaboradores em risco alto", { x: 0.5, y: 0.3, fontSize: 24, bold: true });
  const top = triagens.filter((t) => t.risco_geral === "alto").slice(0, 12);
  const headers = ["Nome", "Idade", "IMC", "PA", "Glicemia", "Risco"];
  const tbody = top.map((t) => [
    t.nome,
    t.idade ?? "—",
    t.imc ?? "—",
    t.classificacao_pa ?? "—",
    t.classificacao_glicemia ?? "—",
    t.risco_geral ?? "—",
  ]);
  s3.addTable([headers, ...tbody] as any, { x: 0.5, y: 1.2, w: 12, fontSize: 12, border: { type: "solid", color: "E2E8F0", pt: 1 } });

  const fname = `relatorio_saude_${safeName(empresaNome)}_${acao.data_acao}.pptx`;
  await pptx.writeFile({ fileName: fname });
}
