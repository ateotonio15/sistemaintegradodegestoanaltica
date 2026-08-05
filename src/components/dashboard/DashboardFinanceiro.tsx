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
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
import { AnalisesEnviosPanel } from "@/components/financeiro/AnalisesEnviosPanel";
import { MultiSelectFiltro } from "./MultiSelectFiltro";
import { RelatorioStatusFinanceiro } from "./RelatorioStatusFinanceiro";
import { periodoVencido, competenciasJanelaPadrao } from "@/lib/financeiro-utils";



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
          "id, nome, codigo_contrato, responsavel_contrato, status_empresa, contrato_suspenso, responsavel_user_id, executiva_user_id, data_vencimento_fatura, periodo_movimentacao",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["fin-dash-movs-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, data_envio_nota");
      if (error) throw error;
      return data ?? [];
    },
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("mes_referencia, periodo")
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  // Todas as movimentações financeiras com status calculado "Pendente"
  const { data: pendentes = [] } = useQuery<
    { id: string; empresa_id: string; mes_referencia: string | null; periodo: string | null }[]
  >({
    queryKey: ["fin-dash-pendentes"],
    queryFn: async () => {
      const { data: fins, error } = await supabase
        .from("financeiro_movimentacoes")
        .select(
          "id, empresa_id, mes_referencia, periodo, data_envio_nota, dentro_prazo, faturamento_iniciado_em",
        )
        .is("data_envio_nota", null)
        .is("faturamento_iniciado_em", null)
        .limit(20000);
      if (error) throw error;
      const rows = fins ?? [];
      if (rows.length === 0) return [];

      // Anexos financeiros existentes → deixam de ser "Pendente"
      const comAnexo = new Set<string>();
      const ids = rows.map((r: any) => r.id);
      for (let i = 0; i < ids.length; i += 500) {
        const { data: anx } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id, origem")
          .in("financeiro_movimentacao_id", ids.slice(i, i + 500));
        (anx ?? []).forEach((a: any) => {
          const origem = (a.origem || "normal").toLowerCase();
          if (origem !== "retroativo" && origem !== "reajuste")
            comAnexo.add(a.financeiro_movimentacao_id);
        });
      }

      // Envio operacional (Cadastro → Financeiro) → status "Aguardando nota"
      const { data: ops } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
        .not("data_envio_financeiro", "is", null)
        .limit(20000);
      const envioSet = new Set(
        (ops ?? []).map((m: any) => `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`),
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

  const pendentesFiltrados = useMemo(
    () =>
      pendentes
        .filter(
          (p) =>
            (competenciasSel.length === 0 || (p.mes_referencia && competenciasSel.includes(p.mes_referencia))) &&
            (periodosSel.length === 0 || (p.periodo && periodosSel.includes(p.periodo))),
        )
        .map((p) => ({
          ...p,
          empresa_nome: empresaNomeMap.get(p.empresa_id) ?? "—",
          codigo_contrato: empresaContratoMap.get(p.empresa_id) ?? "",
          responsavel: empresaResponsavelMap.get(p.empresa_id) ?? "",
          pagadores: pagadoresPorEmpresa.get(p.empresa_id) ?? [],
        }))
        .sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome)),
    [pendentes, competenciasSel, periodosSel, empresaNomeMap, empresaContratoMap, empresaResponsavelMap, pagadoresPorEmpresa],

  );

  async function exportarPendentes() {
    if (pendentesFiltrados.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pendentes");
    ws.columns = [
      { header: "Empresa", key: "empresa", width: 40 },
      { header: "Contrato", key: "contrato", width: 18 },
      { header: "Responsável", key: "responsavel", width: 26 },
      { header: "Competência", key: "competencia", width: 16 },
      { header: "Período", key: "periodo", width: 14 },
      { header: "Pagador", key: "pagador", width: 40 },
      { header: "CNPJ do pagador", key: "cnpj", width: 24 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } } as any;
    pendentesFiltrados.forEach((p) => {
      const base = {
        empresa: p.empresa_nome,
        contrato: p.codigo_contrato || "",
        responsavel: p.responsavel || "",
        competencia: formatCompetencia(p.mes_referencia),
        periodo: p.periodo ?? "",
      };
      if (p.pagadores.length === 0) {
        ws.addRow({ ...base, pagador: "", cnpj: "" });
      } else {
        p.pagadores.forEach((pg) => {
          ws.addRow({ ...base, pagador: pg.nome_pagador, cnpj: pg.cnpj ?? "" });
        });
      }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];

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
    const hoje = new Date().toLocaleDateString("pt-BR");

    doc.setFontSize(14);
    doc.text("Contratos pendentes", 40, 40);
    doc.setFontSize(9);
    const filtros = [
      competenciasSel.length
        ? `Competências: ${competenciasSel.map(formatCompetencia).join(", ")}`
        : "Competências: todas",
      periodosSel.length ? `Períodos: ${periodosSel.join(", ")}` : "Períodos: todos",
      `Total: ${pendentesFiltrados.length}`,
      `Emitido em ${hoje}`,
    ].join("  |  ");
    doc.text(filtros, 40, 58);

    const body: string[][] = [];
    pendentesFiltrados.forEach((p) => {
      const base = [
        p.empresa_nome,
        p.codigo_contrato || "—",
        p.responsavel || "—",
        formatCompetencia(p.mes_referencia),
        p.periodo ?? "—",
      ];
      if (p.pagadores.length === 0) {
        body.push([...base, "—", "—"]);
      } else {
        p.pagadores.forEach((pg) => body.push([...base, pg.nome_pagador, pg.cnpj ?? "—"]));
      }
    });

    autoTable(doc, {
      startY: 72,
      head: [["Empresa", "Contrato", "Responsável", "Competência", "Período", "Pagador", "CNPJ do pagador"]],
      body,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      columnStyles: { 0: { cellWidth: 180 }, 5: { cellWidth: 160 } },
      margin: { left: 40, right: 40 },
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
      badge: pendentes.length > 0 ? { label: `${pendentes.length}`, variant: "destructive" } : undefined,
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
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Contratos pendentes
            <Badge variant="outline" className="ml-1">{pendentesFiltrados.length}</Badge>
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
      <CardContent className="space-y-2 max-h-[520px] overflow-y-auto">
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
              <Badge variant="outline" className="shrink-0">Pendente</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );


  // Visão de módulo selecionado
  if (moduloAtivo) {
    return (
      <div className="space-y-4">
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

        {modulo === "pendentes" && conteudoPendentes}
        {modulo === "relatorio" && <RelatorioStatusFinanceiro />}
        {modulo === "analises" && <AnalisesEnviosPanel />}
        {modulo === "previsao" && <PrevisaoFinanceira />}
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
