import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Building2, Users, PieChart as PieIcon, RefreshCw, Briefcase, Building, Layers, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetchVidasOperadoraAgrupado } from "@/lib/vidasOperadoraApi";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--accent))"];



export default function VidasOperadora() {
  const [classificacao, setClassificacao] = useState<string>("TODOS");

  // Lista completa (sem filtro) para popular o dropdown de classificações
  const { data: dataFull } = useQuery({
    queryKey: ["vidas-operadora-agrupado", "TODOS"],
    queryFn: () => fetchVidasOperadoraAgrupado(),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["vidas-operadora-agrupado", classificacao],
    queryFn: () => fetchVidasOperadoraAgrupado(classificacao),
    staleTime: 5 * 60_000,
  });

  const classificacoesOptions = useMemo(() => {
    const list = (dataFull?.porClassificacao ?? [])
      .map((c) => c.DS_CLASSIFICACAO)
      .filter(Boolean);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dataFull]);

  const [search, setSearch] = useState("");

  const totalGeral = useMemo(
    () => (data?.porClassificacao ?? []).reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0),
    [data],
  );

  const sumByClassificacao = (predicate: (ds: string) => boolean) =>
    (data?.porClassificacao ?? [])
      .filter((c) => predicate((c.DS_CLASSIFICACAO ?? "").toUpperCase()))
      .reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0);

  const totalEmpresarial = useMemo(
    () => sumByClassificacao((ds) => ds.includes("EMPRESARIAL") && !ds.includes("PME")),
    [data],
  );
  const totalPME = useMemo(
    () => sumByClassificacao((ds) => ds.includes("PME") && !ds.includes("PLURAL")),
    [data],
  );
  const totalPlural = useMemo(
    () =>
      (data?.porEmpresa ?? [])
        .filter((e) => (e.NM_ESTIPULANTE ?? "").toUpperCase().includes("PLURAL"))
        .reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0),
    [data],
  );

  const empresasFiltradas = useMemo(() => {
    const list = (data?.porEmpresa ?? []).slice().sort((a, b) => b.QT_VIDAS - a.QT_VIDAS);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((e) => e.NM_ESTIPULANTE.toLowerCase().includes(q));
  }, [data, search]);

  const topEmpresas = useMemo(() => empresasFiltradas.slice(0, 15), [empresasFiltradas]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Vidas na Operadora
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quantitativo agrupado por empresa, faixa etária e classificação (fonte: API Samel).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={classificacao} onValueChange={setClassificacao}>
              <SelectTrigger className="w-[200px] rounded-lg">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="TODOS">Todas as classificações</SelectItem>
                {classificacoesOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="rounded-lg">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>



      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Falha ao consultar a API: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de vidas</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : totalGeral.toLocaleString("pt-BR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : (data?.porEmpresa.length ?? 0).toLocaleString("pt-BR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Classificações</CardTitle>
            <PieIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : (data?.porClassificacao.length ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresarial</CardTitle>
            <Building className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : totalEmpresarial.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Classificação Empresarial</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">PME</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : totalPME.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Todas as classificações com PME</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plural</CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? "..." : totalPlural.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Empresas com "Plural" no nome</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faixa Etária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.porFaixaEtaria ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="FAIXA_ETARIA" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => [v.toLocaleString("pt-BR"), "Vidas"]}
                  />
                  <Bar dataKey="QT_VIDAS" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(data?.porClassificacao ?? []).slice().sort((a, b) => b.QT_VIDAS - a.QT_VIDAS)}
                      dataKey="QT_VIDAS"
                      nameKey="DS_CLASSIFICACAO"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={1}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {(data?.porClassificacao ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number, name: string) => [`${v.toLocaleString("pt-BR")} vidas`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">{totalGeral.toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
                {(data?.porClassificacao ?? [])
                  .slice()
                  .sort((a, b) => b.QT_VIDAS - a.QT_VIDAS)
                  .map((c, i) => {
                    const pct = totalGeral > 0 ? (c.QT_VIDAS / totalGeral) * 100 : 0;
                    const originalIndex = (data?.porClassificacao ?? []).findIndex((x) => x.DS_CLASSIFICACAO === c.DS_CLASSIFICACAO);
                    return (
                      <div key={c.DS_CLASSIFICACAO + i} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-3 w-3 rounded-sm shrink-0"
                          style={{ background: COLORS[originalIndex % COLORS.length] }}
                        />
                        <span className="flex-1 truncate" title={c.DS_CLASSIFICACAO}>
                          {c.DS_CLASSIFICACAO}
                        </span>
                        <span className="font-mono font-semibold">{c.QT_VIDAS.toLocaleString("pt-BR")}</span>
                        <span className="font-mono text-muted-foreground w-12 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Top empresas por vidas</CardTitle>
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <div className="h-72 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEmpresas} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="NM_ESTIPULANTE"
                  width={220}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [v.toLocaleString("pt-BR"), "Vidas"]}
                />
                <Bar dataKey="QT_VIDAS" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border rounded-md overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Empresa (NM_ESTIPULANTE)</TableHead>
                  <TableHead className="text-right">Vidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasFiltradas.map((e, i) => (
                  <TableRow key={e.NM_ESTIPULANTE + i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{e.NM_ESTIPULANTE}</TableCell>
                    <TableCell className="text-right font-mono">
                      {e.QT_VIDAS.toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {empresasFiltradas.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      Nenhum resultado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
