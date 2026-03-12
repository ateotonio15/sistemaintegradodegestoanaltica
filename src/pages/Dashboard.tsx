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
import { Building2, Clock, CheckCircle2, RotateCcw, RefreshCw, Users, Pencil } from "lucide-react";
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
  const { user, isAdmin, isExecutivo, role } = useAuth();
  const { toast } = useToast();
  const canEditDates = isAdmin || role === "comum";

  // Fetch empresas to compute period status from source of truth
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

  // Use SECURITY DEFINER function so all users can see comum users + their empresa counts
  const { data: comunUsersEmpresas = [] } = useQuery({
    queryKey: ["comum-users-empresa-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return data as { user_id: string; display_name: string; empresa_count: number }[];
    },
    enabled: !!user,
  });

  // RLS already filters empresas for comum users (via responsavel_user_id or empresa_usuarios)
  // So we just use allEmpresas directly
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
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano)")
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 text-icon ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Mês de Referência</Label>
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {mesesOptions.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowEmpresasAtivasModal(true)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
              <Users className="h-4 w-4 text-icon" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{empresasAtivas.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Período</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{empresasEmPeriodo.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total no Período</CardTitle>
              <Building2 className="h-4 w-4 text-icon" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalNoPeriodo}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enviadas p/ Empresa</CardTitle>
              <RotateCcw className="h-4 w-4 text-icon" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-info">{enviadas}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-icon" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{pendentes}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enviadas ao Financeiro</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-icon" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{concluidas}</div></CardContent>
          </Card>
        </div>


        {/* Resumo por período */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo Geral por Período</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = filteredByResponsavel.filter((m) => m.periodo === p);
                const done = items.filter((m) => m.status === "Enviado ao financeiro").length;
                const late = items.filter((m) => m.status === "Fora do prazo").length;
                const isActive = p === filterPeriodo;
                return (
                  <button
                    key={p}
                    onClick={() => setFilterPeriodo(p)}
                    className={`rounded-lg border p-3 text-center space-y-1 transition-colors ${isActive ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                  >
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive">{late} fora do prazo</div>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Empresas no Período */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Movimentações no Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Empresa</TableHead>
                    <TableHead>Cód. Contrato</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Resp. Contrato</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Envio Empresa</TableHead>
                    <TableHead>Financeiro</TableHead>
                    <TableHead>Status</TableHead>
                    {canEditDates && <TableHead className="w-12">Editar</TableHead>}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                     <TableRow><TableCell colSpan={canEditDates ? 9 : 8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                   ) : listaTrabalho.length === 0 ? (
                     <TableRow><TableCell colSpan={canEditDates ? 9 : 8} className="text-center text-muted-foreground py-8">Nenhuma pendência neste período 🎉</TableCell></TableRow>
                  ) : (
                   listaTrabalho.map((m) => (
                     <TableRow key={m.id} className={m.status === "Fora do prazo" ? "bg-destructive/10" : ""}>
                       <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                        <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                        <TableCell>{m.empresas?.tipo_movimentacao || "—"}</TableCell>
                        <TableCell>{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                        <TableCell>{m.empresas?.periodo_movimentacao || m.periodo}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                        <TableCell><Badge className={statusColor(m.status)}>{m.status}</Badge></TableCell>
                       {canEditDates && (
                         <TableCell>
                           <Button variant="ghost" size="icon" onClick={() => openEditFromDashboard(m)}>
                             <Pencil className="h-4 w-4 text-icon" />
                           </Button>
                         </TableCell>
                       )}
                     </TableRow>
                   ))
                 )}
               </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Enviadas ao Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Enviadas ao Financeiro — Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cód. Contrato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resp. Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Envio Empresa</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaConcluidas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma movimentação enviada ao financeiro neste período</TableCell></TableRow>
                ) : (
                  listaConcluidas.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                      <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                      <TableCell>{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                      <TableCell>{m.empresas?.periodo_movimentacao || m.periodo}</TableCell>
                      <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                      <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                      <TableCell><Badge className={statusColor(m.status)}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showEmpresasAtivasModal} onOpenChange={setShowEmpresasAtivasModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Empresas Ativas por Responsável</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Total de Empresas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasPorResponsavel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                      Nenhum responsável encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  empresasPorResponsavel.map(({ responsavel, total }) => (
                    <TableRow key={responsavel}>
                      <TableCell className="font-medium">{responsavel}</TableCell>
                      <TableCell className="text-right font-bold">{total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Edit Movimentação Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingMov(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Movimentação</DialogTitle>
            </DialogHeader>
            {editingMov && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{(editingMov as any).empresas?.nome}</span>
                  {" — "}{(editingMov as any).empresas?.codigo_contrato || ""}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data Envio p/ Empresa</Label>
                    <Input type="date" value={editForm.data_envio_empresa} onChange={(e) => setEditForm({ ...editForm, data_envio_empresa: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Envio Financeiro</Label>
                    <Input type="date" value={editForm.data_envio_financeiro} onChange={(e) => setEditForm({ ...editForm, data_envio_financeiro: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEditDialogOpen(false); setEditingMov(null); }}>Cancelar</Button>
                  <Button
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
