import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Bell, Wallet, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";

import { KpiCards } from "@/components/financeiro/KpiCards";
import { StatusChart } from "@/components/financeiro/StatusChart";
import { PeriodSummary } from "@/components/financeiro/PeriodSummary";
import { FinanceiroTable, type FinanceiroRow } from "@/components/financeiro/FinanceiroTable";
import { EditarMovimentacaoDialog } from "@/components/financeiro/EditarMovimentacaoDialog";
import { CobrancaDialog } from "@/components/financeiro/CobrancaDialog";

import {
  type FinanceiroMovimentacao,
  PERIODOS_FIN,
  calcularStatusFinanceiro,
  type StatusFinanceiro,
  getCurrentMesReferencia,
  formatMesReferencia,
  getMesesOptions,
} from "@/lib/financeiro-utils";

const STATUS_OPTIONS: StatusFinanceiro[] = ["Enviada", "Aguardando nota", "Pendente", "Fora do prazo"];

export default function Financeiro() {
  const { user, loading, isAdmin, isFinanceiro } = useAuth();
  const canManageFinanceiro = isAdmin || isFinanceiro;
  const queryClient = useQueryClient();

  const [mes, setMes] = useState(getCurrentMesReferencia());
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string | null>(null);
  const [somenteOverdue, setSomenteOverdue] = useState(false);

  const [editing, setEditing] = useState<FinanceiroMovimentacao | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cobOpen, setCobOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Movimentações financeiras do mês + dados de empresa via consulta separada
  const { data: financeiroRaw = [], isLoading } = useQuery({
    queryKey: ["financeiro", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("*")
        .eq("mes_referencia", mes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && canManageFinanceiro,
  });

  const empresaIds = useMemo(
    () => Array.from(new Set(financeiroRaw.map((f) => f.empresa_id))),
    [financeiroRaw],
  );

  const { data: empresasMap = {} } = useQuery({
    queryKey: ["financeiro-empresas", empresaIds.sort().join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return {};
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj")
        .in("id", empresaIds);
      if (error) throw error;
      const map: Record<string, { nome: string; codigo: string | null; cnpj: string | null }> = {};
      data.forEach((e: any) => {
        map[e.id] = { nome: e.nome, codigo: e.codigo_contrato, cnpj: e.cnpj };
      });
      return map;
    },
    enabled: empresaIds.length > 0,
  });

  // Movimentações operacionais do mês para detectar "envio operacional feito"
  const { data: operacionaisMap = {} } = useQuery({
    queryKey: ["financeiro-operacionais", mes, empresaIds.sort().join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return {};
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, data_envio_financeiro")
        .eq("mes_referencia", mes)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      data.forEach((m: any) => {
        if (m.data_envio_financeiro) {
          map[`${m.empresa_id}|${m.periodo}`] = true;
        }
      });
      return map;
    },
    enabled: empresaIds.length > 0,
  });

  // Contagem de anexos por movimentação
  const movIds = useMemo(() => financeiroRaw.map((f) => f.id), [financeiroRaw]);

  const { data: anexosCount = {} } = useQuery({
    queryKey: ["financeiro-anexos-counts", movIds.sort().join(",")],
    queryFn: async () => {
      if (movIds.length === 0) return {};
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("financeiro_movimentacao_id")
        .in("financeiro_movimentacao_id", movIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      data.forEach((a: any) => {
        map[a.financeiro_movimentacao_id] = (map[a.financeiro_movimentacao_id] || 0) + 1;
      });
      return map;
    },
    enabled: movIds.length > 0,
  });

  // Cobranças abertas do mês
  const { data: cobrancasAbertas = [] } = useQuery({
    queryKey: ["cobrancas-abertas", mes, movIds.sort().join(",")],
    queryFn: async () => {
      if (movIds.length === 0) return [];
      const { data, error } = await supabase
        .from("cobrancas")
        .select("id, financeiro_movimentacao_id")
        .eq("status", "aberta")
        .in("financeiro_movimentacao_id", movIds);
      if (error) throw error;
      return data;
    },
    enabled: movIds.length > 0,
  });

  // Toast 1x por sessão se houver cobranças abertas
  useEffect(() => {
    if (cobrancasAbertas.length === 0) return;
    const key = `cob-toast-${mes}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.warning(`${cobrancasAbertas.length} cobrança(s) aberta(s) neste mês`);
  }, [cobrancasAbertas.length, mes]);

  // Linhas enriquecidas
  const allRows: FinanceiroRow[] = useMemo(() => {
    return financeiroRaw.map((f) => {
      const emp = empresasMap[f.empresa_id];
      const envioOperacional = !!operacionaisMap[`${f.empresa_id}|${f.periodo}`];
      return {
        ...f,
        empresa_nome: emp?.nome || "—",
        empresa_codigo: emp?.codigo ?? null,
        empresa_cnpj: emp?.cnpj ?? null,
        status: calcularStatusFinanceiro(f, envioOperacional),
        anexos_count: anexosCount[f.id] || 0,
      };
    });
  }, [financeiroRaw, empresasMap, operacionaisMap, anexosCount]);

  // Tipos únicos para o filtro
  const tiposUnicos = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach((r) => {
      if (r.tipo_cobranca?.trim()) s.add(r.tipo_cobranca.trim());
    });
    return Array.from(s).sort();
  }, [allRows]);

  // KPI/Chart: aplica APENAS filtro de período
  const kpiRows = useMemo(() => {
    return filtroPeriodo ? allRows.filter((r) => r.periodo === filtroPeriodo) : allRows;
  }, [allRows, filtroPeriodo]);

  // PeriodSummary: contagem total (sem filtros)
  const countByPeriodo = useMemo(() => {
    const c: Record<string, number> = {};
    PERIODOS_FIN.forEach((p) => (c[p] = 0));
    allRows.forEach((r) => {
      c[r.periodo] = (c[r.periodo] || 0) + 1;
    });
    return c;
  }, [allRows]);

  // Tabela: aplica TODOS os filtros
  const filteredRows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return allRows.filter((r) => {
      if (filtroPeriodo && r.periodo !== filtroPeriodo) return false;
      if (filtroStatus !== "all" && r.status !== filtroStatus) return false;
      if (filtroTipo !== "all" && (r.tipo_cobranca || "") !== filtroTipo) return false;
      if (somenteOverdue && (r.dentro_prazo || r.data_envio_nota)) return false;
      if (q) {
        const hay = `${r.empresa_nome} ${r.empresa_codigo || ""} ${r.empresa_cnpj || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, busca, filtroStatus, filtroTipo, filtroPeriodo, somenteOverdue]);

  // KPIs
  const kpis = useMemo(() => {
    const empresasSet = new Set(kpiRows.map((r) => r.empresa_id));
    const totalAnexos = kpiRows.reduce((s, r) => s + r.anexos_count, 0);
    return {
      totalEmpresas: empresasSet.size,
      notasEnviadas: kpiRows.filter((r) => r.status === "Enviada").length,
      aguardandoNota: kpiRows.filter((r) => r.status === "Aguardando nota").length,
      pendentes: kpiRows.filter((r) => r.status === "Pendente").length,
      foraDoPrazo: kpiRows.filter((r) => r.status === "Fora do prazo").length,
      totalAnexos,
    };
  }, [kpiRows]);

  // Provisionar movimentações financeiras do mês:
  // - Todas as empresas ATIVAS com período válido
  // - + Empresas INATIVAS que tenham movimentação operacional registrada no mês
  //   (para alinhar a contagem com a aba Dashboard / "Resumo Geral por Período")
  const provisionarMutation = useMutation({
    mutationFn: async () => {
      const { data: empresas, error: empErr } = await supabase
        .from("empresas")
        .select("id, nome, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, responsavel_contrato");
      if (empErr) throw empErr;

      // Movimentações operacionais já existentes no mês (para incluir Inativas com histórico)
      const { data: movsMes, error: movErr } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mes);
      if (movErr) throw movErr;

      const operacionaisPorEmpresa = new Map<string, Set<string>>();
      (movsMes || []).forEach((m) => {
        if (!operacionaisPorEmpresa.has(m.empresa_id)) {
          operacionaisPorEmpresa.set(m.empresa_id, new Set());
        }
        operacionaisPorEmpresa.get(m.empresa_id)!.add(m.periodo);
      });

      const PERIODOS_VALIDOS = new Set(PERIODOS_FIN as readonly string[]);
      const linhas: Array<{
        empresa_id: string;
        mes_referencia: string;
        periodo: string;
        dentro_prazo: boolean;
        responsavel: string | null;
      }> = [];

      for (const e of empresas || []) {
        const ativa = e.status_empresa === "Ativa";
        const periodosOperacionais = operacionaisPorEmpresa.get(e.id);

        // Inativa sem movimentação no mês → ignorar
        if (!ativa && !periodosOperacionais) continue;

        const periodos = new Set<string>();

        // Período-base configurado na empresa (somente se Ativa)
        if (ativa) {
          let base: string | null = null;
          if (e.tipo_movimentacao === "Diária" && e.data_corte) {
            base = periodoDaDataCorte(e.data_corte);
          } else if (e.periodo_movimentacao) {
            base = e.periodo_movimentacao;
          }
          if (base && PERIODOS_VALIDOS.has(base)) periodos.add(base);
        }

        // Períodos vindos de movimentações operacionais (ativas ou inativas com histórico)
        periodosOperacionais?.forEach((p) => {
          if (PERIODOS_VALIDOS.has(p)) periodos.add(p);
        });

        periodos.forEach((periodo) => {
          linhas.push({
            empresa_id: e.id,
            mes_referencia: mes,
            periodo,
            dentro_prazo: true,
            responsavel: e.responsavel_contrato ?? null,
          });
        });
      }

      if (linhas.length === 0) {
        return { inseridas: 0, total: 0 };
      }

      // Buscar existentes para evitar duplicatas (não há índice único)
      const { data: existentes, error: exErr } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mes);
      if (exErr) throw exErr;

      const chaves = new Set((existentes || []).map((r) => `${r.empresa_id}|${r.periodo}`));
      const novas = linhas.filter((l) => !chaves.has(`${l.empresa_id}|${l.periodo}`));

      if (novas.length === 0) return { inseridas: 0, total: linhas.length };

      const { error: insErr } = await supabase.from("financeiro_movimentacoes").insert(novas);
      if (insErr) throw insErr;

      return { inseridas: novas.length, total: linhas.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      if (!res || res.total === 0) {
        toast.warning("Nenhuma empresa ativa com período financeiro válido.");
      } else if (res.inseridas === 0) {
        toast.info("Todas as movimentações deste mês já estavam provisionadas.");
      } else {
        toast.success(`${res.inseridas} movimentação(ões) financeira(s) gerada(s).`);
      }
    },
    onError: (e: any) => toast.error("Erro ao provisionar: " + e.message),
  });

  // Guards de acesso
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!canManageFinanceiro) return <Navigate to="/" replace />;

  const handleEdit = (row: FinanceiroRow) => {
    setEditing(row);
    setEditOpen(true);
  };
  const handleCobranca = (row: FinanceiroRow) => {
    setEditing(row);
    setCobOpen(true);
  };

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      toast.warning("Nenhum registro para exportar com os filtros atuais");
      return;
    }
    setIsExporting(true);
    try {
      const headers = [
        "Empresa",
        "Contrato",
        "CNPJ",
        "Responsável",
        "Tipo",
        "Status",
        "Envio nota",
        "Vencimento",
        "Anexos",
        "Cobrança registrada",
      ];

      const dataRows = filteredRows.map((r) => [
        r.empresa_nome,
        r.empresa_codigo || "",
        r.empresa_cnpj || "",
        r.responsavel || "",
        r.tipo_cobranca || "",
        r.status,
        formatDateBR(r.data_envio_nota),
        formatDateBR(r.data_vencimento),
        r.anexos_count,
        r.cobranca_registrada ? "Sim" : "Não",
      ]);

      const totals = {
        enviadas: filteredRows.filter((r) => r.status === "Enviada").length,
        aguardando: filteredRows.filter((r) => r.status === "Aguardando nota").length,
        pendentes: filteredRows.filter((r) => r.status === "Pendente").length,
        foraPrazo: filteredRows.filter((r) => r.status === "Fora do prazo").length,
        anexos: filteredRows.reduce((s, r) => s + r.anexos_count, 0),
        cobrancas: filteredRows.filter((r) => r.cobranca_registrada).length,
      };

      const totalRow = [
        `TOTAL (${filteredRows.length} registros)`,
        "",
        "",
        "",
        "",
        `Enviadas: ${totals.enviadas} | Aguardando: ${totals.aguardando} | Pendentes: ${totals.pendentes} | Fora do prazo: ${totals.foraPrazo}`,
        "",
        "",
        totals.anexos,
        totals.cobrancas,
      ];

      const aoa = [headers, ...dataRows, [], totalRow];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws["!cols"] = [
        { wch: 38 }, // Empresa
        { wch: 14 }, // Contrato
        { wch: 20 }, // CNPJ
        { wch: 22 }, // Responsável
        { wch: 16 }, // Tipo
        { wch: 18 }, // Status
        { wch: 14 }, // Envio nota
        { wch: 14 }, // Vencimento
        { wch: 10 }, // Anexos
        { wch: 20 }, // Cobrança
      ];

      // Negrito no cabeçalho e linha de total
      const totalRowIdx = aoa.length; // 1-based no Excel
      headers.forEach((_, c) => {
        const headerAddr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[headerAddr]) ws[headerAddr].s = { font: { bold: true } };
        const totalAddr = XLSX.utils.encode_cell({ r: totalRowIdx - 1, c });
        if (ws[totalAddr]) ws[totalAddr].s = { font: { bold: true } };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Financeiro");

      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const filename = `financeiro_${mes}_${stamp}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Arquivo exportado: ${filteredRows.length} registro(s)`);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e?.message || "falha desconhecida"));
    } finally {
      setIsExporting(false);
    }
  };

  const editingNome = editing ? empresasMap[editing.empresa_id]?.nome : undefined;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Controle de notas, anexos e cobranças — {formatMesReferencia(mes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => provisionarMutation.mutate()}
              disabled={provisionarMutation.isPending}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${provisionarMutation.isPending ? "animate-spin" : ""}`}
              />
              {provisionarMutation.isPending ? "Gerando..." : "Gerar movimentações"}
            </Button>
            <Label htmlFor="mes-ref" className="text-xs text-muted-foreground">
              Mês
            </Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger id="mes-ref" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMesesOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMesReferencia(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Banner cobranças abertas */}
        {cobrancasAbertas.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <Bell className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">
              {cobrancasAbertas.length} cobrança(s) aberta(s)
            </AlertTitle>
            <AlertDescription className="text-foreground/80">
              Existem cobranças pendentes de resolução para o período selecionado.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <KpiCards {...kpis} />

        {/* Período + Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PeriodSummary
              countByPeriodo={countByPeriodo}
              selected={filtroPeriodo}
              onSelect={setFiltroPeriodo}
            />
          </div>
          <StatusChart
            data={kpiRows.map((r) => ({
              status: r.status,
              tipo_cobranca: r.tipo_cobranca,
              dentro_prazo: r.dentro_prazo,
            }))}
          />
        </div>

        {/* Filtros da tabela */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Empresa, CNPJ, contrato..."
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de cobrança</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tiposUnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 h-10">
              <Label className="text-xs cursor-pointer" htmlFor="overdue">
                Apenas fora do prazo
              </Label>
              <Switch id="overdue" checked={somenteOverdue} onCheckedChange={setSomenteOverdue} />
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <FinanceiroTable
          rows={filteredRows}
          onEdit={handleEdit}
          onCobranca={handleCobranca}
          isLoading={isLoading}
        />

        {/* Diálogos */}
        <EditarMovimentacaoDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          movimentacao={editing}
          empresaNome={editingNome}
        />
        <CobrancaDialog
          open={cobOpen}
          onOpenChange={setCobOpen}
          movimentacao={editing}
          empresaNome={editingNome}
        />
      </div>
    </AppLayout>
  );
}
