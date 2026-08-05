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
  AlertTriangle,
  Download,
  FileText,
  ArrowLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  ClipboardList,
  BellRing,
} from "lucide-react";
import { AlertasVencimentoFinanceiro } from "./AlertasVencimentoFinanceiro";
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
import { AlertaRetroativosParaCobrar } from "@/components/reajustes/AlertaRetroativosParaCobrar";
import { AnalisesEnviosPanel } from "@/components/financeiro/AnalisesEnviosPanel";
import { MultiSelectFiltro } from "./MultiSelectFiltro";
import { RelatorioStatusFinanceiro } from "./RelatorioStatusFinanceiro";


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

  const cobrancasAbertas = cobrancas.filter((c) => c.status === "aberta");
  const cobrancasMinhas = cobrancasAbertas.filter((c) => minhasEmpresasIds.has(c.empresa_id));

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






  return (
    <div className="space-y-6">
      <AlertaRetroativosParaCobrar />
      <AlertasVencimentoFinanceiro />

      {cobrancasMinhas.length > 0 && (
        <Card className="rounded-xl border-warning/40 bg-warning/10 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Você possui {cobrancasMinhas.length} cobrança{cobrancasMinhas.length > 1 ? "s" : ""} pendente
                {cobrancasMinhas.length > 1 ? "s" : ""} nas suas empresas
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {cobrancasMinhas[0].empresa_nome} — {cobrancasMinhas[0].motivo}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/financeiro")} className="shrink-0">
              Registrar cobrança
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contratos com status Pendente */}
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
        <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
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

      {/* Relatório diário por status (Excel / PDF) */}
      <RelatorioStatusFinanceiro />

      {/* Análises de envios — substitui "Empresas fora do prazo" */}
      <AnalisesEnviosPanel />

      {/* Previsão financeira */}
      <PrevisaoFinanceira />
    </div>
  );
}
