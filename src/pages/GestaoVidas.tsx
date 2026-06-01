import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGestaoVidas, type VidasFilters } from "@/hooks/useGestaoVidas";
import { exportGestaoVidasExcel } from "@/lib/gestao-vidas-export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  FileDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMesLabel(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: "default" | "up" | "down" | "warn";
  hint?: string;
}) {
  const toneCls =
    tone === "up"
      ? "text-emerald-400 bg-emerald-500/10"
      : tone === "down"
        ? "text-rose-400 bg-rose-500/10"
        : tone === "warn"
          ? "text-amber-400 bg-amber-500/10"
          : "text-primary bg-primary/10";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GestaoVidas() {
  const { isDiretora, isAdmin, isAdministradoras, isVendas, isComum } = useAuth();
  const canExport = !isVendas;

  const [mesRef, setMesRef] = useState<string>(currentMonth());
  const [tipoContrato, setTipoContrato] = useState<VidasFilters["tipoContrato"]>("TODOS");
  const [status, setStatus] = useState<string>("TODOS");
  const [search, setSearch] = useState("");

  const filters: VidasFilters = { mesRef, tipoContrato, status, search };
  const { data, isLoading } = useGestaoVidas(filters);

  const empresas = data?.empresas ?? [];
  const historico = data?.historico ?? [];

  const kpis = useMemo(() => {
    const ativas = empresas.reduce((s, e) => s + (e.total_atual || 0), 0);
    const ent = empresas.reduce((s, e) => s + (e.entradas || 0), 0);
    const sai = empresas.reduce((s, e) => s + (e.saidas || 0), 0);
    const empresarial = empresas.filter((e) => e.tipo_contrato === "EMPRESARIAL");
    const adms = empresas.filter((e) => e.tipo_contrato === "ADMINISTRADORA");
    const ativasEmpresarial = empresarial.reduce((s, e) => s + (e.total_atual || 0), 0);
    const ativasAdms = adms.reduce((s, e) => s + (e.total_atual || 0), 0);
    return {
      ativas,
      ent,
      sai,
      saldo: ent - sai,
      contratos: empresas.length,
      empresarial,
      adms,
      ativasEmpresarial,
      ativasAdms,
    };
  }, [empresas]);

  const top = useMemo(
    () => [...empresas].sort((a, b) => (b.total_atual || 0) - (a.total_atual || 0)).slice(0, 10),
    [empresas],
  );

  const ranking = useMemo(() => {
    const sorted = [...empresas].sort((a, b) => b.saldo - a.saldo);
    return {
      crescimento: sorted.filter((e) => e.saldo > 0).slice(0, 5),
      reducao: sorted.filter((e) => e.saldo < 0).slice(-5).reverse(),
    };
  }, [empresas]);

  const alertas = useMemo(() => {
    const out: { tipo: "reducao" | "aumento" | "sem_mov"; empresa: string; detalhe: string }[] = [];
    empresas.forEach((e) => {
      const base = e.total_anterior || 0;
      if (base > 0) {
        const variacao = ((e.total_atual - base) / base) * 100;
        if (variacao <= -10) out.push({ tipo: "reducao", empresa: e.nome, detalhe: `${variacao.toFixed(1)}%` });
        else if (variacao >= 20) out.push({ tipo: "aumento", empresa: e.nome, detalhe: `+${variacao.toFixed(1)}%` });
      }
      if (e.entradas === 0 && e.saidas === 0) {
        out.push({ tipo: "sem_mov", empresa: e.nome, detalhe: "sem entradas/saídas no mês" });
      }
    });
    return out.slice(0, 30);
  }, [empresas]);

  const setQuick = (preset: "mes" | "3m" | "6m" | "ano") => {
    // Para a UX: o mês de referência é sempre o atual; presets afetam apenas a janela do gráfico (futuro).
    setMesRef(currentMonth());
  };

  const scopeLabel = isAdmin || isDiretora
    ? "Visão Global"
    : isAdministradoras
      ? "Sua Administradora"
      : isComum
        ? "Seus Contratos"
        : isVendas
          ? "Somente Leitura"
          : "—";

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Gestão de Vidas
          </h1>
          <p className="text-sm text-muted-foreground">
            Centro analítico de vidas ativas, entradas e saídas — {scopeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={mesRef}
            onChange={(e) => setMesRef(e.target.value || currentMonth())}
            className="w-[160px]"
          />
          <Select value={tipoContrato} onValueChange={(v) => setTipoContrato(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os tipos</SelectItem>
              <SelectItem value="EMPRESARIAL">Empresarial</SelectItem>
              <SelectItem value="ADMINISTRADORA">Administradora</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Suspensa">Suspensa</SelectItem>
              <SelectItem value="Rescindida">Rescindida</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar empresa/contrato/CNPJ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[260px]"
          />
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportGestaoVidasExcel(empresas, historico, mesRef)}
              disabled={isLoading || empresas.length === 0}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Excel
            </Button>
          )}
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["mes", "3m", "6m", "ano"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setQuick(p)}
            className="px-3 py-1 rounded-full border border-border/60 text-muted-foreground hover:bg-accent"
          >
            {p === "mes" ? "Mês Atual" : p === "3m" ? "Últimos 3M" : p === "6m" ? "Últimos 6M" : "Ano"}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Vidas Ativas" value={kpis.ativas.toLocaleString("pt-BR")} icon={Users} />
        <Kpi label="Entradas" value={`+${kpis.ent}`} icon={TrendingUp} tone="up" />
        <Kpi label="Saídas" value={`-${kpis.sai}`} icon={TrendingDown} tone="down" />
        <Kpi
          label="Saldo do Mês"
          value={`${kpis.saldo >= 0 ? "+" : ""}${kpis.saldo}`}
          icon={kpis.saldo >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={kpis.saldo >= 0 ? "up" : "down"}
        />
        <Kpi label="Vidas Ativas Empresariais" value={kpis.ativasEmpresarial.toLocaleString("pt-BR")} icon={Users} />
        <Kpi label="Vidas Ativas Administradoras" value={kpis.ativasAdms.toLocaleString("pt-BR")} icon={Users} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="empresarial">Empresarial</TabsTrigger>
          <TabsTrigger value="administradoras">Administradoras</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas {alertas.length > 0 && <Badge variant="secondary" className="ml-2">{alertas.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução Mensal — Entradas vs Saídas</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historico.map((h) => ({ ...h, mesLabel: fmtMesLabel(h.mes) }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="mesLabel" fontSize={11} />
                      <YAxis fontSize={11} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="entradas" fill="hsl(var(--primary))" name="Entradas" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saidas" fill="hsl(0 70% 55%)" name="Saídas" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Vidas Ativas por Mês</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historico.map((h) => ({ ...h, mesLabel: fmtMesLabel(h.mes) }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="mesLabel" fontSize={11} />
                      <YAxis fontSize={11} />
                      <RTooltip />
                      <Line type="monotone" dataKey="vidas_ativas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Vidas Ativas" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 Contratos por Vidas</CardTitle></CardHeader>
            <CardContent className="h-[360px]">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={top} margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="nome" fontSize={11} width={200} />
                    <RTooltip />
                    <Bar dataKey="total_atual" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Vidas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMPRESARIAL */}
        <TabsContent value="empresarial">
          <TabelaEmpresas linhas={kpis.empresarial} loading={isLoading} titulo="Contratos Empresariais" />
        </TabsContent>

        {/* ADMINISTRADORAS */}
        <TabsContent value="administradoras">
          <TabelaEmpresas linhas={kpis.adms} loading={isLoading} titulo="Contratos via Administradoras" />
        </TabsContent>

        {/* RANKING */}
        <TabsContent value="ranking">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankingCard titulo="Maior Crescimento" linhas={ranking.crescimento} positivo />
            <RankingCard titulo="Maior Redução" linhas={ranking.reducao} positivo={false} />
          </div>
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Alertas</CardTitle></CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta no período.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {alertas.map((a, i) => (
                    <li key={i} className="py-2 flex items-center gap-3 text-sm">
                      {a.tipo === "reducao" && <ArrowDownRight className="h-4 w-4 text-rose-400" />}
                      {a.tipo === "aumento" && <ArrowUpRight className="h-4 w-4 text-emerald-400" />}
                      {a.tipo === "sem_mov" && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium flex-1 truncate">{a.empresa}</span>
                      <span className="text-muted-foreground text-xs">{a.detalhe}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabelaEmpresas({
  linhas,
  loading,
  titulo,
}: {
  linhas: ReturnType<typeof useGestaoVidas>["data"] extends infer T
    ? T extends { empresas: infer E }
      ? E
      : never
    : never;
  loading: boolean;
  titulo: string;
}) {
  const list = linhas ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo} ({list.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-right">Vidas Ativas</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Última Atualização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum contrato.</TableCell></TableRow>
            ) : (
              list.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.codigo_contrato ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.total_atual.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400">+{l.entradas}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-400">-{l.saidas}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${l.saldo > 0 ? "text-emerald-400" : l.saldo < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                    {l.saldo >= 0 ? "+" : ""}{l.saldo}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.ultima_atualizacao ? new Date(l.ultima_atualizacao).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RankingCard({
  titulo,
  linhas,
  positivo,
}: {
  titulo: string;
  linhas: { id: string; nome: string; saldo: number; total_atual: number }[];
  positivo: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <ol className="space-y-2">
            {linhas.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                <span className="flex-1 truncate">{l.nome}</span>
                <span className={`tabular-nums font-medium ${positivo ? "text-emerald-400" : "text-rose-400"}`}>
                  {l.saldo >= 0 ? "+" : ""}{l.saldo}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{l.total_atual} ativas</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
