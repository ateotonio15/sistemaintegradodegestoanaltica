import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Users, CalendarClock, FileSignature, ArrowLeftRight, Search, Paperclip, FileSpreadsheet, TrendingUp, TrendingDown, Scale, RefreshCw, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateBR, todayLocalISO } from "@/lib/date-utils";
import { getCurrentPeriodo, periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";
import { AnexosViewerDialog } from "@/components/dashboard/AnexosViewerDialog";
import { ImportarAdministradorasDialog } from "@/components/dashboard/ImportarAdministradorasDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { computeEntradasSaidas, type EmpresaEntradaSaida } from "@/lib/entradas-saidas-analyzer";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";

type Empresa = Tables<"empresas">;
type Movimentacao = Tables<"movimentacoes">;

const CORTE_OPTIONS = [1, 5, 10, 20] as const;

function nextCorteDate(dia: number): Date {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const candidate = new Date(y, m, dia);
  if (candidate < new Date(y, m, today.getDate())) {
    return new Date(y, m + 1, dia);
  }
  return candidate;
}

export default function DashboardAdministradoras() {
  const [search, setSearch] = useState("");
  const [corteFilter, setCorteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [implFilter, setImplFilter] = useState<string>("all");
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [editEnvio, setEditEnvio] = useState<string>("");
  const [anexosViewer, setAnexosViewer] = useState<{ empresa: Empresa; periodo: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { isAdmin, isComum } = useAuth();
  const queryClient = useQueryClient();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-administradoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("tipo_contrato", "ADMINISTRADORA")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const empresaIds = useMemo(() => empresas.map((e) => e.id), [empresas]);

  // Mês/Ano selecionados
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const mesRef = useMemo(() => `${ano}-${String(mes).padStart(2, "0")}`, [ano, mes]);

  const { data: movsMes = [] } = useQuery({
    queryKey: ["movs-administradoras", mesRef, empresaIds.join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .in("empresa_id", empresaIds)
        .eq("mes_referencia", mesRef);
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: empresaIds.length > 0,
  });

  const movIds = useMemo(() => movsMes.map((m) => m.id), [movsMes]);

  const { data: anexosCount = {} } = useQuery({
    queryKey: ["anexos-count-administradoras", movIds.join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("movimentacao_id")
        .in("movimentacao_id", movIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((a: any) => {
        counts[a.movimentacao_id] = (counts[a.movimentacao_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  // Histórico de entradas/saídas para o mês selecionado
  const { data: historicoMes = [] } = useQuery({
    queryKey: ["vidas-historico-adm", mesRef, empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidas_historico_administradoras")
        .select("*")
        .eq("mes_referencia", mesRef)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Histórico dos últimos 6 meses (gráfico evolução)
  const ultimos6 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, [ano, mes]);

  const { data: historico6 = [] } = useQuery({
    queryKey: ["vidas-historico-adm-6", ultimos6.join(","), empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidas_historico_administradoras")
        .select("mes_referencia, entradas, saidas, total_atual")
        .in("mes_referencia", ultimos6)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const entradasSaidasPorEmpresa = useMemo(() => {
    const map: Record<string, EmpresaEntradaSaida> = {};
    for (const h of historicoMes as any[]) {
      map[h.empresa_id] = {
        empresa_id: h.empresa_id,
        entradas: h.entradas,
        saidas: h.saidas,
        total_atual: h.total_atual,
        total_anterior: h.total_anterior,
      };
    }
    return map;
  }, [historicoMes]);

  const totalEntradas = useMemo(
    () => Object.values(entradasSaidasPorEmpresa).reduce((s, e) => s + e.entradas, 0),
    [entradasSaidasPorEmpresa]
  );
  const totalSaidas = useMemo(
    () => Object.values(entradasSaidasPorEmpresa).reduce((s, e) => s + e.saidas, 0),
    [entradasSaidasPorEmpresa]
  );
  const saldoVidas = totalEntradas - totalSaidas;

  const evolucaoChart = useMemo(() => {
    const grouped: Record<string, { mes: string; entradas: number; saidas: number; total: number }> = {};
    for (const m of ultimos6) {
      const [y, mm] = m.split("-");
      grouped[m] = { mes: `${mm}/${y.slice(2)}`, entradas: 0, saidas: 0, total: 0 };
    }
    for (const h of historico6 as any[]) {
      if (!grouped[h.mes_referencia]) continue;
      grouped[h.mes_referencia].entradas += h.entradas;
      grouped[h.mes_referencia].saidas += h.saidas;
      grouped[h.mes_referencia].total += h.total_atual;
    }
    return Object.values(grouped);
  }, [ultimos6, historico6]);

  const [calculando, setCalculando] = useState(false);
  const [progressoCalc, setProgressoCalc] = useState<{ done: number; total: number } | null>(null);
  const handleCalcular = async () => {
    if (empresaIds.length === 0) return;
    setCalculando(true);
    setProgressoCalc({ done: 0, total: empresaIds.length });
    try {
      await computeEntradasSaidas(empresaIds, mesRef, (done, total) => {
        setProgressoCalc({ done, total });
      });
      toast.success("Entradas e saídas recalculadas");
      queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm"] });
      queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm-6"] });
    } catch (e: any) {
      toast.error("Erro ao calcular: " + (e?.message ?? String(e)));
    } finally {
      setCalculando(false);
      setProgressoCalc(null);
    }
  };


  const ativas = useMemo(() => empresas.filter((e) => e.status_empresa === "Ativa"), [empresas]);
  const totalVidas = useMemo(() => ativas.reduce((s, e) => s + (e.vidas ?? 0), 0), [ativas]);
  const implantadas = useMemo(() => ativas.filter((e) => !!e.data_implantacao), [ativas]);
  const aguardando = useMemo(() => ativas.filter((e) => !e.data_implantacao), [ativas]);

  const movsPendentes = useMemo(
    () => movsMes.filter((m) => !m.data_envio_financeiro),
    [movsMes]
  );

  const proximoFechamento = useMemo(() => {
    const datas = ativas
      .filter((e) => CORTE_OPTIONS.includes((e.data_corte ?? 0) as 1 | 5 | 10 | 20))
      .map((e) => nextCorteDate(e.data_corte!));
    if (datas.length === 0) return null;
    return new Date(Math.min(...datas.map((d) => d.getTime())));
  }, [ativas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return empresas
      .filter((e) => statusFilter === "all" ? true : e.status_empresa === statusFilter)
      .filter((e) => corteFilter === "all" ? true : String(e.data_corte ?? "") === corteFilter)
      .filter((e) => {
        if (implFilter === "all") return true;
        if (implFilter === "implantada") return !!e.data_implantacao;
        return !e.data_implantacao;
      })
      .filter((e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.codigo_contrato ?? "").toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q)
      );
  }, [empresas, search, corteFilter, statusFilter, implFilter]);

  const proximosFechamentosPorCorte = useMemo(() => {
    const groups: Record<number, Empresa[]> = {};
    for (const e of ativas) {
      const d = e.data_corte ?? 0;
      if (!CORTE_OPTIONS.includes(d as 1 | 5 | 10 | 20)) continue;
      groups[d] = groups[d] || [];
      groups[d].push(e);
    }
    return groups;
  }, [ativas]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Administradoras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão exclusiva dos contratos de administradoras
          </p>
        </div>
        {(isAdmin || isComum) && (
          <Button onClick={() => setImportOpen(true)} className="rounded-lg">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Administradoras
          </Button>
        )}
      </div>

      <ImportarAdministradorasDialog open={importOpen} onOpenChange={setImportOpen} />


      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={Building2} label="Total Administradoras" value={ativas.length} />
        <KpiCard icon={Users} label="Vidas Ativas" value={totalVidas.toLocaleString("pt-BR")} />
        <KpiCard
          icon={CalendarClock}
          label="Próximo Fechamento"
          value={proximoFechamento ? formatDateBR(proximoFechamento.toISOString().slice(0, 10)) : "—"}
          highlight
        />
        <KpiCard icon={FileSignature} label="Contratos Pendentes" value={aguardando.length} />
        <KpiCard icon={ArrowLeftRight} label="Movimentações do Mês" value={movsMes.length} accent="amber" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Filters + Table */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, código ou CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-lg"
                />
              </div>
              <Select value={corteFilter} onValueChange={setCorteFilter}>
                <SelectTrigger className="w-[160px] rounded-lg"><SelectValue placeholder="Período corte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cortes</SelectItem>
                  {CORTE_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>Dia {String(d).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={implFilter} onValueChange={setImplFilter}>
                <SelectTrigger className="w-[180px] rounded-lg"><SelectValue placeholder="Implantação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas implantações</SelectItem>
                  <SelectItem value="implantada">Implantadas</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Contratos <span className="text-muted-foreground font-normal ml-1">({filtered.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-accent/20 hover:bg-accent/20">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">CNPJ</TableHead>
                      <TableHead className="font-semibold">Código</TableHead>
                      <TableHead className="font-semibold text-center">Vidas Ativas</TableHead>
                      <TableHead className="font-semibold">Corte</TableHead>
                      <TableHead className="font-semibold">Implantação</TableHead>
                      <TableHead className="font-semibold">Enviado Financ.</TableHead>
                      <TableHead className="font-semibold text-center">Anexos</TableHead>
                      <TableHead className="font-semibold text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma administradora encontrada</TableCell></TableRow>
                    ) : (
                      filtered.map((e) => {
                        const mov = movsMes.find((m) => m.empresa_id === e.id);
                        const enviado = !!mov?.data_envio_financeiro;
                        const qtdAnexos = mov ? (anexosCount[mov.id] ?? 0) : 0;
                        return (
                        <TableRow
                          key={e.id}
                          className="hover:bg-accent/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedEmpresa(e);
                            setEditEnvio(mov?.data_envio_financeiro ?? "");
                          }}
                        >
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.cnpj || "—"}</TableCell>
                          <TableCell className="text-sm">{e.codigo_contrato || "—"}</TableCell>
                          <TableCell className="text-center tabular-nums">{(e.vidas ?? 0).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>
                            {e.data_corte ? (
                              <Badge variant="secondary" className="rounded-md">Dia {String(e.data_corte).padStart(2, "0")}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{e.data_implantacao ? formatDateBR(e.data_implantacao) : <Badge variant="outline" className="rounded-md">Aguardando</Badge>}</TableCell>
                          <TableCell>
                            {enviado ? (
                              <Badge variant="outline" className="rounded-md border-success/40 text-success">
                                {formatDateBR(mov!.data_envio_financeiro)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`rounded-md gap-1 ${qtdAnexos > 0 ? "border-info/40 text-info cursor-pointer hover:bg-info/10" : "text-muted-foreground"}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (qtdAnexos > 0 && mov) {
                                  setAnexosViewer({ empresa: e, periodo: mov.periodo });
                                }
                              }}
                            >
                              <Paperclip className="h-3 w-3" /> {qtdAnexos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={e.status_empresa === "Ativa" ? "default" : "secondary"}
                              className="rounded-md"
                            >
                              {e.status_empresa}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );})


                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar alerts + schedules */}
        <div className="lg:col-span-1 space-y-6">
          {/* Pending Alert */}
          <Card className="rounded-xl border-primary/30 bg-primary/5 relative overflow-hidden">
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Movimentações Pendentes
                </h4>
              </div>
              {movsPendentes.length === 0 ? (
                <>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Nenhuma pendência neste mês.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">{movsPendentes.length} pendência{movsPendentes.length > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">
                    — {mesRef}. Aguardando envio ao financeiro.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Schedules */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5" />
                Próximos Fechamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {CORTE_OPTIONS.map((dia) => {
                const list = proximosFechamentosPorCorte[dia] ?? [];
                const has = list.length > 0;
                const isActive = corteFilter === String(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setCorteFilter(isActive ? "all" : String(dia))}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isActive
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : has
                          ? "bg-primary/10 border-primary/20 hover:bg-primary/15"
                          : "bg-accent/10 border-border/40 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Dia {String(dia).padStart(2, "0")}
                      </p>
                      <p className={`text-sm font-semibold ${has ? "text-foreground" : "text-muted-foreground"}`}>
                        {has ? `${list.length} contrato${list.length > 1 ? "s" : ""}` : "Nenhuma"}
                      </p>
                    </div>
                    {has && <span className={`w-1 h-8 rounded-full ${isActive ? "bg-primary" : "bg-primary/70"}`} />}
                  </button>
                );
              })}
              {corteFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setCorteFilter("all")}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-accent/30 transition-colors"
                >
                  Limpar filtro
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EnvioFinanceiroDialog
        empresa={selectedEmpresa}
        mesRef={mesRef}
        editEnvio={editEnvio}
        setEditEnvio={setEditEnvio}
        existingMov={selectedEmpresa ? movsMes.find((m) => m.empresa_id === selectedEmpresa.id) ?? null : null}
        onClose={() => setSelectedEmpresa(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["movs-administradoras"] });
          queryClient.invalidateQueries({ queryKey: ["anexos-count-administradoras"] });
        }}
      />

      <AnexosViewerDialog
        open={!!anexosViewer}
        onOpenChange={(v) => !v && setAnexosViewer(null)}
        empresaId={anexosViewer?.empresa.id ?? null}
        empresaNome={anexosViewer?.empresa.nome ?? ""}
        mesReferencia={mesRef}
        periodo={anexosViewer?.periodo ?? ""}
      />
    </div>
  );
}

function EnvioFinanceiroDialog({
  empresa,
  mesRef,
  editEnvio,
  setEditEnvio,
  existingMov,
  onClose,
  onSaved,
}: {
  empresa: Empresa | null;
  mesRef: string;
  editEnvio: string;
  setEditEnvio: (v: string) => void;
  existingMov: Movimentacao | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [movId, setMovId] = useState<string | null>(existingMov?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [ensuring, setEnsuring] = useState(false);

  useEffect(() => {
    setMovId(existingMov?.id ?? null);
  }, [existingMov?.id, empresa?.id]);

  // Auto-cria a movimentação ao abrir o diálogo para permitir anexos imediatos
  useEffect(() => {
    if (!empresa || movId || ensuring) return;
    setEnsuring(true);
    (async () => {
      try {
        const periodo = empresa.periodo_movimentacao || "Mensal";
        const { data, error } = await supabase
          .from("movimentacoes")
          .insert({
            empresa_id: empresa.id,
            mes_referencia: mesRef,
            periodo,
          })
          .select("id")
          .single();
        if (error) throw error;
        setMovId(data.id);
      } catch (err: any) {
        toast.error("Erro ao preparar anexos: " + err.message);
      } finally {
        setEnsuring(false);
      }
    })();
  }, [empresa, movId, mesRef, ensuring]);

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    try {
      let id = movId;
      if (!id) {
        const periodo = empresa.periodo_movimentacao || "Mensal";
        const { data, error } = await supabase
          .from("movimentacoes")
          .insert({
            empresa_id: empresa.id,
            mes_referencia: mesRef,
            periodo,
            data_envio_financeiro: editEnvio || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setMovId(id);
      } else {
        const { error } = await supabase
          .from("movimentacoes")
          .update({ data_envio_financeiro: editEnvio || null })
          .eq("id", id);
        if (error) throw error;
      }
      toast.success(editEnvio ? "Envio ao financeiro registrado" : "Data de envio limpa");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!empresa} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle>Contrato — Envio ao Financeiro</DialogTitle>
        </DialogHeader>
        {empresa && (
          <div className="space-y-5">
            <div className="text-sm p-3 bg-accent/40 rounded-lg">
              <p className="font-medium text-foreground">{empresa.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {empresa.codigo_contrato || "—"} · {empresa.cnpj || "—"}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Data de envio ao Financeiro</Label>
              <Input
                type="date"
                value={editEnvio}
                onChange={(e) => setEditEnvio(e.target.value)}
                max={todayLocalISO()}
                className="rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Ao preencher, os documentos anexados ficam disponíveis para o Financeiro.
              </p>
            </div>

            <AnexosMovimentacao
              movimentacaoId={movId}
              empresaId={empresa.id}
              required={!!editEnvio}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-lg" disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="rounded-lg" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function KpiCard({
  icon: Icon,
  label,
  value,
  highlight,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  highlight?: boolean;
  accent?: "amber";
}) {
  const iconBg = accent === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary";
  return (
    <Card className={`rounded-xl shadow-sm ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${highlight ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
