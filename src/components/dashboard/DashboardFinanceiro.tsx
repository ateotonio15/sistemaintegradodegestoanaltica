import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Download,
  FileText,
  ArrowLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import samelIcon from "@/assets/samel-icon.png.asset.json";
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
import { AnalisesEnviosPanel } from "@/components/financeiro/AnalisesEnviosPanel";
import { MultiSelectFiltro } from "./MultiSelectFiltro";
import { RelatorioStatusFinanceiro } from "./RelatorioStatusFinanceiro";
import { competenciasJanelaPadrao, expandirAnexosPorGrupo, fetchEmpresaGrupoMap, situacaoPrazoEmissao } from "@/lib/financeiro-utils";



type ModuloId = "pendentes" | "alertas" | "relatorio" | "analises" | "previsao";

interface CobrancaRow {
  id: string;
  motivo: string;
  data: string;
  observacao: string | null;
  status: string;
  financeiro_movimentacao_id: string;
  empresa_id: string;
  empresa_nome: string;
  mes_referencia: string | null;
  periodo: string | null;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function formatCompetencia(c?: string | null) {
  if (!c) return "—";
  const m = c.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1]}` : c;
}

/** Busca todas as linhas em páginas (o backend limita cada resposta a 1000 registros). */
async function fetchTodas<T = any>(
  build: (from: number, to: number) => any,
  page = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export function DashboardFinanceiro() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modulo, setModulo] = useState<ModuloId | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["fin-dash-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nome, codigo_contrato, responsavel_contrato, status_empresa, contrato_suspenso, responsavel_user_id, executiva_user_id, data_vencimento_fatura, data_emissao_fatura, periodo_movimentacao",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["fin-dash-movs-basic"],
    queryFn: async () =>
      fetchTodas((from, to) =>
        supabase
          .from("financeiro_movimentacoes")
          .select("id, empresa_id, data_envio_nota")
          .order("id")
          .range(from, to),
      ),
  });

  const { data: cobrancas = [] } = useQuery<CobrancaRow[]>({
    queryKey: ["fin-dash-cobrancas"],
    queryFn: async () => {
      const { data: cobs, error } = await supabase
        .from("cobrancas")
        .select("id, motivo, data, observacao, status, financeiro_movimentacao_id")
        .order("data", { ascending: false });
      if (error) throw error;
      if (!cobs || cobs.length === 0) return [];
      const movIds = cobs.map((c: any) => c.financeiro_movimentacao_id);
      const { data: ms } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("id", movIds);
      const movMap = new Map((ms ?? []).map((m: any) => [m.id, m]));
      const empIds = Array.from(new Set((ms ?? []).map((m: any) => m.empresa_id)));
      const { data: emps } = await supabase.from("empresas").select("id, nome").in("id", empIds);
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.nome]));
      return cobs.map((c: any) => {
        const m: any = movMap.get(c.financeiro_movimentacao_id);
        return {
          ...c,
          empresa_id: m?.empresa_id ?? "",
          empresa_nome: empMap.get(m?.empresa_id ?? "") ?? "—",
          mes_referencia: m?.mes_referencia ?? null,
          periodo: m?.periodo ?? null,
        };
      });
    },
  });

  const { data: opcoesMov = [] } = useQuery<{ mes_referencia: string | null; periodo: string | null }[]>({
    queryKey: ["fin-dash-mov-opcoes"],
    queryFn: async () =>
      fetchTodas((from, to) =>
        supabase
          .from("financeiro_movimentacoes")
          .select("mes_referencia, periodo")
          .order("mes_referencia", { ascending: false })
          .range(from, to),
      ),
  });

  // Todas as movimentações financeiras com status calculado "Pendente"
  const { data: pendentes = [] } = useQuery<
    { id: string; empresa_id: string; mes_referencia: string | null; periodo: string | null; dia_emissao: number | null }[]
  >({
    queryKey: ["fin-dash-pendentes"],
    queryFn: async () => {
      const rows = await fetchTodas<any>((from, to) =>
        supabase
          .from("financeiro_movimentacoes")
          .select(
            "id, empresa_id, mes_referencia, periodo, dia_emissao, data_envio_nota, dentro_prazo, faturamento_iniciado_em",
          )
          .is("data_envio_nota", null)
          .is("faturamento_iniciado_em", null)
          .order("id")
          .range(from, to),
      );
      if (rows.length === 0) return [];

      // Anexos financeiros existentes → deixam de ser "Pendente"
      const ids = rows.map((r: any) => r.id);
      const anexosAll: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data: anx } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id, origem")
          .in("financeiro_movimentacao_id", ids.slice(i, i + 500));
        (anx ?? []).forEach((a: any) => {
          const origem = (a.origem || "normal").toLowerCase();
          if (origem !== "retroativo" && origem !== "reajuste") anexosAll.push(a);
        });
      }
      // Anexos compartilhados no Grupo Financeiro contam para todos os contratos
      const empresaGrupo = await fetchEmpresaGrupoMap(supabase as any);
      const anexosMap = expandirAnexosPorGrupo(rows as any, anexosAll, empresaGrupo);
      const comAnexo = new Set<string>(
        Array.from(anexosMap.entries())
          .filter(([, list]) => list.length > 0)
          .map(([id]) => id),
      );


      // Envio operacional (Cadastro → Financeiro) → status "Aguardando nota"
      const ops = await fetchTodas<any>((from, to) =>
        supabase
          .from("movimentacoes")
          .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
          .not("data_envio_financeiro", "is", null)
          .order("id")
          .range(from, to),
      );
      const envioSet = new Set(
        ops.map((m: any) => `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`),
      );

      return rows.filter(
        (r: any) =>
          !comAnexo.has(r.id) &&
          r.dentro_prazo !== false &&
          !envioSet.has(`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`),
      );

    },
  });

  const minhasEmpresasIds = useMemo(() => {

    if (!user) return new Set<string>();
    return new Set(empresas.filter((e: any) => e.responsavel_user_id === user.id).map((e: any) => e.id));
  }, [empresas, user]);


  const [competenciasSel, setCompetenciasSel] = useState<string[]>([]);
  const [periodosSel, setPeriodosSel] = useState<string[]>([]);


  const competenciasDisponiveis = useMemo(
    () =>
      Array.from(
        new Set([
          ...cobrancas.map((c) => c.mes_referencia),
          ...opcoesMov.map((m) => m.mes_referencia),
        ].filter((v): v is string => !!v)),
      ).sort((a, b) => b.localeCompare(a)),
    [cobrancas, opcoesMov],
  );

  const periodosDisponiveis = useMemo(
    () =>
      Array.from(
        new Set([
          ...cobrancas.map((c) => c.periodo),
          ...opcoesMov.map((m) => m.periodo),
        ].filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [cobrancas, opcoesMov],
  );

  const empresaNomeMap = useMemo(
    () => new Map(empresas.map((e: any) => [e.id, e.nome as string])),
    [empresas],
  );

  const empresaContratoMap = useMemo(
    () => new Map(empresas.map((e: any) => [e.id, (e.codigo_contrato ?? "") as string])),
    [empresas],
  );

  const empresaResponsavelMap = useMemo(
    () => new Map(empresas.map((e: any) => [e.id, (e.responsavel_contrato ?? "") as string])),
    [empresas],
  );

  const { data: pagadores = [] } = useQuery<
    { empresa_id: string; nome_pagador: string; cnpj: string | null }[]
  >({
    queryKey: ["fin-dash-pagadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagadores")
        .select("empresa_id, nome_pagador, cnpj")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const pagadoresPorEmpresa = useMemo(() => {
    const m = new Map<string, { nome_pagador: string; cnpj: string | null }[]>();
    pagadores.forEach((p) => {
      const list = m.get(p.empresa_id) ?? [];
      list.push({ nome_pagador: p.nome_pagador, cnpj: p.cnpj });
      m.set(p.empresa_id, list);
    });
    return m;
  }, [pagadores]);

  // Janela padrão: mês vigente + mês anterior (quando nenhuma competência é escolhida)
  const janelaPadrao = useMemo(() => competenciasJanelaPadrao(), []);

  const empresaEmissaoMap = useMemo(
    () => new Map(empresas.map((e: any) => [e.id, (e.data_emissao_fatura ?? null) as number | null])),
    [empresas],
  );

  const pendentesJanela = useMemo(
    () => pendentes.filter((p) => p.mes_referencia && janelaPadrao.includes(p.mes_referencia)),
    [pendentes, janelaPadrao],
  );

  const pendentesFiltrados = useMemo(
    () =>
      (competenciasSel.length === 0 ? pendentesJanela : pendentes)
        .filter(
          (p) =>
            (competenciasSel.length === 0 || (p.mes_referencia && competenciasSel.includes(p.mes_referencia))) &&
            (periodosSel.length === 0 || (p.periodo && periodosSel.includes(p.periodo))),
        )
        .map((p) => {
          const diaEmissao = p.dia_emissao ?? empresaEmissaoMap.get(p.empresa_id) ?? null;
          const prazo = situacaoPrazoEmissao(p.mes_referencia, diaEmissao);
          return {
            ...p,
            dia_emissao_efetivo: diaEmissao,
            prazo,
            prazo_label: prazo.limite
              ? prazo.atrasado
                ? `Em atraso · ${prazo.diasAtraso} dia${prazo.diasAtraso === 1 ? "" : "s"}`
                : "No prazo"
              : "Prazo sem base",
            empresa_nome: empresaNomeMap.get(p.empresa_id) ?? "—",
            codigo_contrato: empresaContratoMap.get(p.empresa_id) ?? "",
            responsavel: empresaResponsavelMap.get(p.empresa_id) ?? "",
            pagadores: pagadoresPorEmpresa.get(p.empresa_id) ?? [],
          };
        })
        .sort((a, b) => {
          if (a.prazo.atrasado !== b.prazo.atrasado) return a.prazo.atrasado ? -1 : 1;
          if (a.prazo.atrasado && b.prazo.atrasado) return b.prazo.diasAtraso - a.prazo.diasAtraso;
          return a.empresa_nome.localeCompare(b.empresa_nome);
        }),
    [pendentes, pendentesJanela, competenciasSel, periodosSel, empresaNomeMap, empresaContratoMap, empresaResponsavelMap, empresaEmissaoMap, pagadoresPorEmpresa],

  );

  const totalAtrasados = useMemo(
    () => pendentesFiltrados.filter((p) => p.prazo.atrasado).length,
    [pendentesFiltrados],
  );


  const resumoFiltros = () => [
    competenciasSel.length
      ? `Competências: ${competenciasSel.map(formatCompetencia).join(", ")}`
      : `Competências: ${janelaPadrao.map(formatCompetencia).join(" e ")} (mês vigente e anterior)`,
    periodosSel.length ? `Períodos: ${periodosSel.join(", ")}` : "Períodos: todos",
  ];

  async function exportarPendentes() {
    if (pendentesFiltrados.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const VERDE = "FF32A976";
    const VERDE_CLARO = "FFEAF6F0";
    const CINZA = "FF6B7280";


    const wb = new ExcelJS.Workbook();
    wb.creator = "SIGA";
    const ws = wb.addWorksheet("Contratos pendentes", {
      views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [
      { width: 52 },
      { width: 16 },
      { width: 30 },
      { width: 12 },
      { width: 28 },
      { width: 46 },
    ];

    // Cabeçalho institucional (verde e branco)
    ws.mergeCells(1, 1, 1, 6);
    const t = ws.getCell("A1");
    t.value = "Contratos pendentes";
    t.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
    t.alignment = { vertical: "middle", indent: 1 };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    ws.getRow(1).height = 34;
    for (let c = 2; c <= 6; c++) {
      ws.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    }

    ws.mergeCells(2, 1, 2, 6);
    const s = ws.getCell("A2");
    s.value = `${resumoFiltros().join("   ·   ")}   ·   Total: ${pendentesFiltrados.length}   ·   Emitido em ${new Date().toLocaleString("pt-BR")}`;
    s.font = { size: 10, color: { argb: CINZA } };
    s.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 8;

    // Agrupado por competência — visual de blocos, sem grade de tabela
    const grupos = new Map<string, typeof pendentesFiltrados>();
    pendentesFiltrados.forEach((p) => {
      const k = formatCompetencia(p.mes_referencia);
      const arr = grupos.get(k) ?? [];
      arr.push(p);
      grupos.set(k, arr);
    });

    Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([competencia, itens]) => {
        const atrasadosGrupo = itens.filter((i) => i.prazo.atrasado).length;
        const secao = ws.addRow([
          `${competencia}  ·  ${itens.length} contrato(s)  ·  ${atrasadosGrupo} em atraso  ·  ${itens.length - atrasadosGrupo} no prazo`,
        ]);
        ws.mergeCells(secao.number, 1, secao.number, 6);
        secao.height = 24;
        const cel = ws.getCell(secao.number, 1);
        cel.font = { bold: true, size: 12, color: { argb: VERDE } };
        cel.alignment = { vertical: "middle", indent: 1 };
        for (let c = 1; c <= 6; c++) {
          ws.getCell(secao.number, c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: VERDE_CLARO },
          };
        }

        const rotulos = ws.addRow(["Empresa", "Contrato", "Responsável", "Período", "Situação do prazo", "Pagador"]);
        rotulos.height = 16;
        rotulos.eachCell((cell) => {
          cell.font = { size: 9, bold: true, color: { argb: CINZA } };
          cell.alignment = { vertical: "middle", indent: 1 };
        });

        itens.forEach((p) => {
          const pagadores = p.pagadores.length
            ? p.pagadores.map((pg) => pg.nome_pagador).join(" · ")
            : "—";
          const prazoTexto = p.prazo.limite
            ? `${p.prazo_label} · limite ${p.prazo.limite.toLocaleDateString("pt-BR")}`
            : "Sem dia de emissão";
          const row = ws.addRow([
            p.empresa_nome,
            p.codigo_contrato || "—",
            p.responsavel || "—",
            p.periodo ?? "—",
            prazoTexto,
            pagadores,
          ]);
          row.height = 20;
          row.eachCell((cell, col) => {
            cell.font = {
              size: 10,
              bold: col === 1,
              color: { argb: col === 5 && p.prazo.atrasado ? "FFB91C1C" : "FF111827" },
            };
            cell.alignment = {
              vertical: "middle",
              indent: 1,
              horizontal: col === 4 ? "center" : "left",
              wrapText: col === 1 || col === 6,
            };
            cell.border = { bottom: { style: "hair", color: { argb: "FFD6EAE0" } } };
          });
        });

        ws.addRow([]).height = 10;
      });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contratos-pendentes-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarPendentesPDF() {
    if (pendentesFiltrados.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const hoje = new Date().toLocaleString("pt-BR");

    // Logo Samel (somente o símbolo, monocromático)
    let logoData: string | null = null;
    try {
      const resp = await fetch(samelIcon.url);
      const blob = await resp.blob();
      logoData = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch {
      logoData = null;
    }

    // Faixa de cabeçalho (verde Samel)
    doc.setFillColor(50, 169, 118);
    doc.rect(0, 0, pageW, 64, "F");

    const textX = logoData ? 108 : 40;
    if (logoData) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(32, 12, 56, 40, 6, 6, "F");
      doc.addImage(logoData, "PNG", 44, 17, 32, 30, undefined, "FAST");
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Contratos pendentes", textX, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 244, 236);
    doc.text(`Faturamento · SIGA · Emitido em ${hoje}`, textX, 48);


    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(String(pendentesFiltrados.length), pageW - 40, 32, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("contratos pendentes", pageW - 40, 46, { align: "right" });

    // Filtros aplicados
    doc.setTextColor(75, 85, 99);
    doc.setFontSize(9);
    resumoFiltros().forEach((linha, i) => doc.text(linha, 40, 84 + i * 13));

    const body: string[][] = [];
    pendentesFiltrados.forEach((p) => {
      const base = [
        p.empresa_nome,
        p.codigo_contrato || "—",
        p.responsavel || "—",
        formatCompetencia(p.mes_referencia),
        p.periodo ?? "—",
      ];
      const pagadores = p.pagadores.length
        ? p.pagadores.map((pg) => pg.nome_pagador).join(" · ")
        : "—";
      const prazoTexto = p.prazo.limite
        ? `${p.prazo_label} · limite ${p.prazo.limite.toLocaleDateString("pt-BR")}`
        : "Sem dia de emissão";
      body.push([...base, prazoTexto, pagadores]);
    });

    autoTable(doc, {
      startY: 84 + resumoFiltros().length * 13 + 10,
      head: [["Empresa", "Contrato", "Responsável", "Competência", "Período", "Pagador"]],
      body,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 6, valign: "middle", textColor: [17, 24, 39] },
      headStyles: { fillColor: [50, 169, 118], textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [234, 246, 240] },

      columnStyles: {
        0: { cellWidth: 210, fontStyle: "bold" },
        1: { cellWidth: 80 },
        2: { cellWidth: 130 },
        3: { cellWidth: 75, halign: "center" },
        4: { cellWidth: 60, halign: "center" },
        5: { cellWidth: "auto" },
      },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Emitido em ${hoje}`, 40, pageH - 20);
        doc.text(`Página ${page}`, pageW - 40, pageH - 20, { align: "right" });
      },
    });


    doc.save(`contratos-pendentes-${new Date().toISOString().slice(0, 10)}.pdf`);
  }







  const modulos: {
    id: ModuloId;
    titulo: string;
    descricao: string;
    icon: any;
    accent: string;
    bg: string;
    badge?: { label: string; variant: "default" | "secondary" | "outline" | "destructive" };
  }[] = [
    {
      id: "pendentes",
      titulo: "Contratos pendentes",
      descricao: "Contratos sem nota emitida, com filtros por competência e período e exportação em Excel/PDF.",
      icon: AlertCircle,
      accent: "text-destructive",
      bg: "bg-destructive/10",
      badge: pendentesJanela.length > 0 ? { label: `${pendentesJanela.length}`, variant: "destructive" } : undefined,
    },
    {
      id: "relatorio",
      titulo: "Relatório diário por status",
      descricao: "Produção diária e por usuário: movimentações, notas enviadas, faturamentos e anexos.",
      icon: ClipboardList,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
    {
      id: "analises",
      titulo: "Análises de envios",
      descricao: "Acompanhamento dos envios do Cadastro para o Financeiro e prazos de emissão.",
      icon: BarChart3,
      accent: "text-success",
      bg: "bg-success/10",
    },
    {
      id: "previsao",
      titulo: "Previsão financeira",
      descricao: "Projeção de faturamento e vencimentos das próximas competências.",
      icon: TrendingUp,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  const moduloAtivo = modulos.find((m) => m.id === modulo);

  const conteudoPendentes = (
    <Card className="rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
      <CardHeader className="pb-3 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Contratos pendentes
            <Badge variant="outline" className="ml-1">{pendentesFiltrados.length}</Badge>
            {totalAtrasados > 0 && (
              <Badge variant="destructive" className="ml-1">{totalAtrasados} em atraso</Badge>
            )}
            {pendentesFiltrados.length - totalAtrasados > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendentesFiltrados.length - totalAtrasados} no prazo
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFiltro
              label="Competências"
              width="w-[190px]"
              options={competenciasDisponiveis.map((c) => ({ value: c, label: formatCompetencia(c) }))}
              selected={competenciasSel}
              onChange={setCompetenciasSel}
            />
            <MultiSelectFiltro
              label="Períodos"
              width="w-[170px]"
              options={periodosDisponiveis.map((p) => ({ value: p, label: p }))}
              selected={periodosSel}
              onChange={setPeriodosSel}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={exportarPendentes}
              disabled={pendentesFiltrados.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={exportarPendentesPDF}
              disabled={pendentesFiltrados.length === 0}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {pendentesFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum contrato pendente 🎉</p>
        ) : (
          pendentesFiltrados.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate("/financeiro")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.empresa_nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.codigo_contrato ? `Contrato ${p.codigo_contrato} · ` : ""}
                  {formatCompetencia(p.mes_referencia)}
                  {p.periodo ? ` · ${p.periodo}` : ""}
                  {p.dia_emissao_efetivo
                    ? ` · Emissão dia ${String(p.dia_emissao_efetivo).padStart(2, "0")}`
                    : ""}
                </p>
                <p className="text-xs mt-0.5">
                  {p.prazo.limite ? (
                    p.prazo.atrasado ? (
                      <span className="text-destructive font-medium">
                        Em atraso há {p.prazo.diasAtraso} dia{p.prazo.diasAtraso === 1 ? "" : "s"} · limite{" "}
                        {p.prazo.limite.toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Ainda no prazo · limite {p.prazo.limite.toLocaleDateString("pt-BR")}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Sem dia de emissão cadastrado</span>
                  )}
                </p>
                {p.pagadores.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.pagadores.map((pg, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {pg.nome_pagador}
                        {pg.cnpj ? ` · ${pg.cnpj}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline">Pendente</Badge>
                <Badge variant={p.prazo.atrasado ? "destructive" : "secondary"}>
                  {p.prazo_label}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );


  // Visão de módulo selecionado
  if (moduloAtivo) {
    return (
      <div className="flex flex-col gap-4 h-[calc(100vh-12.5rem)] min-h-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setModulo(null)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar ao painel
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${moduloAtivo.bg}`}>
              <moduloAtivo.icon className={`h-4 w-4 ${moduloAtivo.accent}`} />
            </div>
            <h2 className="text-base font-semibold truncate">{moduloAtivo.titulo}</h2>
          </div>
        </div>

        {modulo === "pendentes" ? (
          conteudoPendentes
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {modulo === "relatorio" && <RelatorioStatusFinanceiro />}
            {modulo === "analises" && <AnalisesEnviosPanel />}
            {modulo === "previsao" && <PrevisaoFinanceira />}
          </div>
        )}
      </div>
    );
  }

  // Seletor de módulos
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Escolha uma função</h2>
        <p className="text-sm text-muted-foreground">
          Selecione o módulo que você quer trabalhar agora.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modulos.map((m) => (
          <button key={m.id} type="button" onClick={() => setModulo(m.id)} className="text-left">
            <Card className="h-full rounded-xl shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${m.bg}`}>
                    <m.icon className={`h-5 w-5 ${m.accent}`} />
                  </div>
                  {m.badge && (
                    <Badge variant={m.badge.variant} className="shrink-0">
                      {m.badge.label}
                    </Badge>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{m.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.descricao}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  Abrir
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
