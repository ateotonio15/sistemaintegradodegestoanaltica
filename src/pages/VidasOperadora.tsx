import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Building2, Users, PieChart as PieIcon, RefreshCw, Briefcase, Building, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetchVidasOperadoraAgrupado } from "@/lib/vidasOperadoraApi";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--accent))"];

export default function VidasOperadora() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["vidas-operadora-agrupado"],
    queryFn: fetchVidasOperadoraAgrupado,
    staleTime: 5 * 60_000,
  });

  const [search, setSearch] = useState("");

  const totalGeral = useMemo(
    () => (data?.porClassificacao ?? []).reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0),
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
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="rounded-lg">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
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
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.porClassificacao ?? []}
                    dataKey="QT_VIDAS"
                    nameKey="DS_CLASSIFICACAO"
                    outerRadius={90}
                    label={(e: any) => `${e.DS_CLASSIFICACAO}: ${e.QT_VIDAS.toLocaleString("pt-BR")}`}
                  >
                    {(data?.porClassificacao ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
