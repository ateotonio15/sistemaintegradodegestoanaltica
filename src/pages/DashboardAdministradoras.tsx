import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, CalendarClock, FileSignature, ArrowLeftRight, ListChecks, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateBR } from "@/lib/date-utils";

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

  const mesRef = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Administradoras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão exclusiva dos contratos de administradoras
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={Building2} label="Total Administradoras" value={ativas.length} />
        <KpiCard icon={Users} label="Vidas Ativas" value={totalVidas.toLocaleString("pt-BR")} />
        <KpiCard
          icon={CalendarClock}
          label="Próximo Fechamento"
          value={proximoFechamento ? formatDateBR(proximoFechamento.toISOString().slice(0, 10)) : "—"}
        />
        <KpiCard icon={FileSignature} label="Contratos Pendentes" value={aguardando.length} />
        <KpiCard icon={ArrowLeftRight} label="Movimentações do Mês" value={movsMes.length} />
      </div>

      {/* Próximos fechamentos por corte */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Próximos fechamentos por data de corte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CORTE_OPTIONS.map((dia) => {
              const list = proximosFechamentosPorCorte[dia] ?? [];
              return (
                <div key={dia} className="rounded-lg border border-border/60 bg-accent/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Dia {String(dia).padStart(2, "0")}
                    </span>
                    <Badge variant="secondary" className="rounded-md">{list.length}</Badge>
                  </div>
                  <p className="text-sm mt-1 text-foreground/80">
                    {list.length === 0 ? "Nenhuma" : `${list.length} contrato(s)`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Movimentações pendentes */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Movimentações pendentes — {mesRef}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movsPendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação pendente neste mês.</p>
          ) : (
            <p className="text-sm">
              <span className="text-2xl font-bold text-primary">{movsPendentes.length}</span>{" "}
              <span className="text-muted-foreground">movimentação(ões) aguardando envio ao financeiro.</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-lg"
            />
          </div>
          <Select value={corteFilter} onValueChange={setCorteFilter}>
            <SelectTrigger className="w-[180px] rounded-lg"><SelectValue placeholder="Período corte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cortes</SelectItem>
              {CORTE_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>Dia {String(d).padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Inativa">Inativa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={implFilter} onValueChange={setImplFilter}>
            <SelectTrigger className="w-[200px] rounded-lg"><SelectValue placeholder="Implantação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas implantações</SelectItem>
              <SelectItem value="implantada">Implantadas</SelectItem>
              <SelectItem value="aguardando">Aguardando</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista de contratos */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Contratos ({filtered.length})
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
                  <TableHead className="font-semibold text-right">Vidas</TableHead>
                  <TableHead className="font-semibold">Data Corte</TableHead>
                  <TableHead className="font-semibold">Implantação</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma administradora encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.cnpj || "—"}</TableCell>
                      <TableCell className="text-sm">{e.codigo_contrato || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{(e.vidas ?? 0).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{e.data_corte ? `Dia ${String(e.data_corte).padStart(2, "0")}` : "—"}</TableCell>
                      <TableCell>{e.data_implantacao ? formatDateBR(e.data_implantacao) : <Badge variant="outline" className="rounded-md">Aguardando</Badge>}</TableCell>
                      <TableCell>
                        <Badge
                          variant={e.status_empresa === "Ativa" ? "default" : "secondary"}
                          className="rounded-md"
                        >
                          {e.status_empresa}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
