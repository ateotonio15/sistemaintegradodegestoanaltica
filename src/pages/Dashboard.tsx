import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  getCurrentMesReferencia,
  getCurrentPeriodo,
  formatMesReferencia,
} from "@/lib/movimentacao-utils";

export default function Dashboard() {
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes-dashboard", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas(nome, codigo_contrato)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
  });

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

  const currentPeriodo = getCurrentPeriodo();

  // Stats
  const withStatus = useMemo(() => movimentacoes.map((m) => ({ ...m, status: calcularStatus(m) })), [movimentacoes]);

  const filteredByResponsavel = useMemo(() => {
    if (filterResponsavel === "all") return withStatus;
    return withStatus.filter((m) => m.responsavel_movimentacao === filterResponsavel);
  }, [withStatus, filterResponsavel]);

  // Painel: only current period, pending items
  const painelItems = useMemo(() => {
    return filteredByResponsavel.filter(
      (m) => m.periodo === currentPeriodo && m.status !== "Enviado ao financeiro"
    );
  }, [filteredByResponsavel, currentPeriodo]);

  const totalEmpresas = filteredByResponsavel.length;
  const foraDoPrazo = filteredByResponsavel.filter((m) => m.status === "Fora do prazo").length;
  const concluidas = filteredByResponsavel.filter((m) => m.status === "Enviado ao financeiro").length;
  const pendentes = totalEmpresas - concluidas;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Painel Inicial</h1>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Movimentações</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalEmpresas}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{pendentes}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fora do Prazo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{foraDoPrazo}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{concluidas}</div></CardContent>
          </Card>
        </div>

        {/* Painel — lista de trabalho do dia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lista de Trabalho — Período {currentPeriodo} ({formatMesReferencia(filterMes)})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cód. Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : painelItems.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma pendência no período atual 🎉</TableCell></TableRow>
                ) : (
                  painelItems.map((m) => (
                    <TableRow key={m.id} className={m.status === "Fora do prazo" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                      <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                      <TableCell>{m.periodo}</TableCell>
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
          <CardHeader><CardTitle className="text-base">Resumo por Período</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = filteredByResponsavel.filter((m) => m.periodo === p);
                const done = items.filter((m) => m.status === "Enviado ao financeiro").length;
                const late = items.filter((m) => m.status === "Fora do prazo").length;
                return (
                  <div key={p} className="rounded-lg border p-3 text-center space-y-1">
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive">{late} fora do prazo</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
