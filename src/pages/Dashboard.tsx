import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Clock, CheckCircle2, RotateCcw, RefreshCw, Users, Pencil, TrendingUp, AlertTriangle } from "lucide-react";
import { NewCompanyBanner } from "@/components/NewCompanyBanner";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  getCurrentMesReferencia,
  getCurrentPeriodo,
  formatMesReferencia,
  calcularStatusPeriodoEmpresa,
  formatDateBR,
  formatPeriodoEmpresa,
  periodoDaDataCorte,
} from "@/lib/movimentacao-utils";

export default function Dashboard() {
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>(getCurrentPeriodo());
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [showEmpresasAtivasModal, setShowEmpresasAtivasModal] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<Movimentacao | null>(null);
  const [editForm, setEditForm] = useState({ data_envio_empresa: "", data_envio_financeiro: "" });
  const queryClient = useQueryClient();
  const { user, isAdmin, isExecutivo, role, isViewOnly } = useAuth();
  const { toast } = useToast();
  const canEditDates = !isViewOnly && (isAdmin || role === "comum");

  const { data: allEmpresas = [] } = useQuery({
    queryKey: ["empresas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Tables<"empresas">[];
    },
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  const { data: comunUsersEmpresas = [] } = useQuery({
    queryKey: ["comum-users-empresa-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return data as { user_id: string; display_name: string; empresa_count: number }[];
    },
    enabled: !!user,
  });

  const visibleEmpresas = useMemo(() => {
    return allEmpresas;
  }, [allEmpresas]);

  const empresasAtivas = useMemo(() => visibleEmpresas.filter((e) => e.status_empresa === "Ativa"), [visibleEmpresas]);
  const empresasEmPeriodo = useMemo(() => empresasAtivas.filter((e) => calcularStatusPeriodoEmpresa(e) === "Em período"), [empresasAtivas]);

  const empresasPorResponsavel = useMemo(() => {
    return comunUsersEmpresas
      .map((u) => ({
        responsavel: u.display_name?.trim() || "Sem nome",
        total: Number(u.empresa_count),
      }))
      .sort((a, b) => b.total - a.total || a.responsavel.localeCompare(b.responsavel));
  }, [comunUsersEmpresas]);

  const { data: movimentacoes = [], isLoading, isFetching } = useQuery({
    queryKey: ["movimentacoes-dashboard", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Movimentacao & { empresas?: { responsavel_contrato: string | null } | null })[];
    },
    enabled: !!user,
  });

  const updateMov = useMutation({
    mutationFn: async (values: { id: string; data_envio_empresa: string | null; data_envio_financeiro: string | null }) => {
      const { error } = await supabase.from("movimentacoes").update({
        data_envio_empresa: values.data_envio_empresa,
        data_envio_financeiro: values.data_envio_financeiro,
      }).eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      setEditDialogOpen(false);
      setEditingMov(null);
      toast({ title: "Movimentação atualizada!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const openEditFromDashboard = (m: Movimentacao) => {
    setEditingMov(m);
    setEditForm({
      data_envio_empresa: m.data_envio_empresa ?? "",
      data_envio_financeiro: m.data_envio_financeiro ?? "",
    });
    setEditDialogOpen(true);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
  };

  const handleGenerateAll = async () => {
    if (!user || isGenerating) return;
    setIsGenerating(true);
    try {
      const mesRef = filterMes;
      // Get existing movimentações for this month to avoid duplicates
      const { data: existing } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mesRef);

      const existingSet = new Set(
        (existing || []).map((e) => `${e.empresa_id}__${e.periodo}`)
      );

      // Build inserts for all active empresas
      const toInsert: TablesInsert<"movimentacoes">[] = [];
      for (const emp of empresasAtivas) {
        let periodo = "01-05";
        if (emp.tipo_movimentacao === "Diária" && emp.data_corte) {
          periodo = periodoDaDataCorte(emp.data_corte);
        } else if (emp.periodo_movimentacao) {
          periodo = emp.periodo_movimentacao;
        }

        const key = `${emp.id}__${periodo}`;
        if (!existingSet.has(key)) {
          toInsert.push({
            empresa_id: emp.id,
            mes_referencia: mesRef,
            periodo,
            tipo_movimentacao: emp.tipo_movimentacao || "Fechada",
            responsavel_movimentacao: emp.responsavel_contrato || null,
          });
        }
      }

      if (toInsert.length === 0) {
        toast({ title: "Todas as empresas já possuem movimentações neste mês." });
      } else {
        // Insert in batches of 50
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error } = await supabase.from("movimentacoes").insert(batch);
          if (error) throw error;
        }
        toast({ title: `${toInsert.length} movimentações geradas com sucesso!` });
        handleRefresh();
      }
    } catch (err: any) {
      console.error("Erro ao gerar movimentações:", err);
      toast({ title: "Erro ao gerar movimentações", description: err?.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const mesesOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const responsaveis = useMemo(() => {
    const set = new Set(movimentacoes.map((m) => m.responsavel_movimentacao).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [movimentacoes]);

  const activeMovimentacoes = useMemo(() => movimentacoes.filter((m) => (m.empresas as any)?.status_empresa === "Ativa"), [movimentacoes]);
  const withStatus = useMemo(() => activeMovimentacoes.map((m) => ({ ...m, status: calcularStatus(m) })), [activeMovimentacoes]);

  const filteredByResponsavel = useMemo(() => {
    if (filterResponsavel === "all") return withStatus;
    return withStatus.filter((m) => m.responsavel_movimentacao === filterResponsavel);
  }, [withStatus, filterResponsavel]);

  const periodItems = useMemo(() => {
    return filteredByResponsavel.filter((m) => m.periodo === filterPeriodo);
  }, [filteredByResponsavel, filterPeriodo]);

  const totalNoPeriodo = periodItems.length;
  const enviadas = periodItems.filter((m) => m.status === "Enviado para empresa").length;
  const pendentes = periodItems.filter((m) => m.status === "Aguardando envio" || m.status === "Fora do prazo").length;
  const concluidas = periodItems.filter((m) => m.status === "Enviado ao financeiro").length;
  const foraDoPrazo = filteredByResponsavel.filter((m) => m.status === "Fora do prazo");

  const listaTrabalho = useMemo(() => {
    return periodItems.filter((m) => m.status !== "Enviado ao financeiro");
  }, [periodItems]);

  const listaConcluidas = useMemo(() => {
    return periodItems.filter((m) => m.status === "Enviado ao financeiro");
  }, [periodItems]);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Real-time new company alerts */}
        <NewCompanyBanner />
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral das movimentações e empresas</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="rounded-lg gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mês de Referência</Label>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[150px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mesesOptions.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Período</Label>
                <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                  <SelectTrigger className="w-[130px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                  <SelectTrigger className="w-[170px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card className="cursor-pointer hover:shadow-md transition-all duration-200 rounded-xl border-border/60" onClick={() => setShowEmpresasAtivasModal(true)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresas Ativas</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{empresasAtivas.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Clique para ver detalhes</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Em Período</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-success">{empresasEmPeriodo.length}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total no Período</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{totalNoPeriodo}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enviadas p/ Empresa</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                <RotateCcw className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-info">{enviadas}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pendentes</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-warning">{pendentes}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financeiro</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-success">{concluidas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por período */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Resumo Geral por Período</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = filteredByResponsavel.filter((m) => m.periodo === p);
                const done = items.filter((m) => m.status === "Enviado ao financeiro").length;
                const late = items.filter((m) => m.status === "Fora do prazo").length;
                const isActiveP = p === filterPeriodo;
                return (
                  <button
                    key={p}
                    onClick={() => setFilterPeriodo(p)}
                    className={`rounded-xl border p-4 text-center space-y-1.5 transition-all duration-200 ${isActiveP ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20" : "hover:bg-accent hover:shadow-sm border-border/60"}`}
                  >
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success font-medium">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive font-medium">{late} fora do prazo</div>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Empresas no Período */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="bg-accent/30 border-b">
            <CardTitle className="text-base font-semibold">
              Movimentações no Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Movimentação</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">Período</TableHead>
                    <TableHead className="font-semibold">Envio Empresa</TableHead>
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {canEditDates && <TableHead className="w-12 font-semibold">Editar</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={canEditDates ? 9 : 8} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                  ) : listaTrabalho.length === 0 ? (
                    <TableRow><TableCell colSpan={canEditDates ? 9 : 8} className="text-center text-muted-foreground py-12">Nenhuma pendência neste período 🎉</TableCell></TableRow>
                  ) : (
                    listaTrabalho.map((m) => (
                      <TableRow key={m.id} className={`transition-colors ${m.status === "Fora do prazo" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-accent/50"}`}>
                        <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>
                        <TableCell>{m.empresas?.tipo_movimentacao || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                        <TableCell>{formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                        <TableCell><Badge className={`${statusColor(m.status)} rounded-md`}>{m.status}</Badge></TableCell>
                        {canEditDates && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditFromDashboard(m)} className="rounded-lg hover:bg-primary/10">
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Enviadas ao Financeiro */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="bg-success/5 border-b">
            <CardTitle className="text-base font-semibold">
              Enviadas ao Financeiro — Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Movimentação</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">Período</TableHead>
                    <TableHead className="font-semibold">Envio Empresa</TableHead>
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaConcluidas.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Nenhuma movimentação enviada ao financeiro neste período</TableCell></TableRow>
                  ) : (
                    listaConcluidas.map((m) => (
                      <TableRow key={m.id} className="hover:bg-accent/50 transition-colors">
                        <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>
                        <TableCell>{m.empresas?.tipo_movimentacao || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                        <TableCell>{formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                        <TableCell><Badge className={`${statusColor(m.status)} rounded-md`}>{m.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Empresas Ativas Modal */}
        <Dialog open={showEmpresasAtivasModal} onOpenChange={setShowEmpresasAtivasModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>Empresas Ativas por Responsável</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-accent/20 hover:bg-accent/20">
                  <TableHead className="font-semibold">Responsável</TableHead>
                  <TableHead className="text-right font-semibold">Total de Empresas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasPorResponsavel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      Nenhum responsável encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  empresasPorResponsavel.map(({ responsavel, total }) => (
                    <TableRow key={responsavel} className="hover:bg-accent/50 transition-colors">
                      <TableCell className="font-medium">{responsavel}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Edit Movimentação Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingMov(null); }}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>Editar Movimentação</DialogTitle>
            </DialogHeader>
            {editingMov && (
              <div className="space-y-5">
                <div className="text-sm text-muted-foreground p-3 bg-accent/50 rounded-lg">
                  <span className="font-medium text-foreground">{(editingMov as any).empresas?.nome}</span>
                  {" — "}{(editingMov as any).empresas?.codigo_contrato || ""}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data Envio p/ Empresa</Label>
                    <Input type="date" value={editForm.data_envio_empresa} onChange={(e) => setEditForm({ ...editForm, data_envio_empresa: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data Envio Financeiro</Label>
                    <Input type="date" value={editForm.data_envio_financeiro} onChange={(e) => setEditForm({ ...editForm, data_envio_financeiro: e.target.value })} className="rounded-lg" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEditDialogOpen(false); setEditingMov(null); }} className="rounded-lg">Cancelar</Button>
                  <Button
                    className="rounded-lg"
                    onClick={() => updateMov.mutate({
                      id: editingMov.id,
                      data_envio_empresa: editForm.data_envio_empresa || null,
                      data_envio_financeiro: editForm.data_envio_financeiro || null,
                    })}
                    disabled={updateMov.isPending}
                  >
                    {updateMov.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
