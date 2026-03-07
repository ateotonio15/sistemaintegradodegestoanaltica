import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Clock, CheckCircle2, RotateCcw, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  getCurrentMesReferencia,
  getCurrentPeriodo,
  formatMesReferencia,
  calcularStatusPeriodoEmpresa,
} from "@/lib/movimentacao-utils";

export default function Dashboard() {
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>(getCurrentPeriodo());
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [showEmpresasAtivasModal, setShowEmpresasAtivasModal] = useState(false);
  const queryClient = useQueryClient();
  const { user, isAdmin, isExecutivo, role } = useAuth();

  // Fetch empresas to compute period status from source of truth
  const { data: allEmpresas = [] } = useQuery({
    queryKey: ["empresas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Tables<"empresas">[];
    },
  });

  // Use SECURITY DEFINER function so all users can see comum users + their empresa counts
  const { data: comunUsersEmpresas = [] } = useQuery({
    queryKey: ["comum-users-empresa-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return data as { user_id: string; display_name: string; empresa_count: number }[];
    },
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
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Movimentacao & { empresas?: { responsavel_contrato: string | null } | null })[];
    },
  });

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
                  <TableHead>Resp. Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resp. Movimentação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : listaTrabalho.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma pendência neste período 🎉</TableCell></TableRow>
                ) : (
                  listaTrabalho.map((m) => (
                    <TableRow key={m.id} className={m.status === "Fora do prazo" ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                      <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                      <TableCell>{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                      <TableCell>{m.empresas?.periodo_movimentacao || m.periodo}</TableCell>
                      <TableCell><Badge className={statusColor(m.status)}>{m.status}</Badge></TableCell>
                      <TableCell>{m.responsavel_movimentacao || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

        {/* Modal Empresas Ativas por Responsável */}
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
      </div>
    </AppLayout>
  );
}
