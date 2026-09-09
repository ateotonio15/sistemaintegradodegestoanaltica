import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoesRealtime } from "@/hooks/usePlantoes";

const CORES = [
  "hsl(var(--primary))",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#0ea5e9",
  "#f97316",
];

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function diffDias(from: string, to: string) {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function semanaDe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dt.getDay()); // domingo
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

type SortKey = "empresa" | "total" | "resolvidos" | "abertos" | "pct";

export default function PlantoesDashboard() {
  usePlantoesRealtime();
  const { user, loading: authLoading } = useAuth();
  const { data: empresas = [] } = usePlantaoEmpresas();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortAsc, setSortAsc] = useState(false);

  // período anterior de mesmo tamanho
  const tamanho = Math.max(diffDias(from, to) + 1, 1);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(tamanho - 1));

  const fetchRows = async (de: string, ate: string) => {
    let q = supabase
      .from("plantoes_atendimentos")
      .select("id, resolvido, plantao:plantoes!inner(data, empresa_id, empresa:plantoes_empresas(nome))")
      .gte("plantao.data", de)
      .lte("plantao.data", ate);
    if (empresaId !== "all") q = q.eq("plantao.empresa_id", empresaId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["plantoes-dash", from, to, empresaId],
    enabled: !authLoading && !!user,
    queryFn: () => fetchRows(from, to),
  });

  const { data: rowsAnterior = [] } = useQuery({
    queryKey: ["plantoes-dash-prev", prevFrom, prevTo, empresaId],
    enabled: !authLoading && !!user,
    queryFn: () => fetchRows(prevFrom, prevTo),
  });

  const agruparPorSemana = tamanho > 62;

  const nomesEmpresas = useMemo(() => {
    const set = new Map<string, number>();
    rows.forEach((r) => {
      const nome = r.plantao?.empresa?.nome ?? "Sem empresa";
      set.set(nome, (set.get(nome) ?? 0) + 1);
    });
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [rows]);

  const serieTemporal = useMemo(() => {
    const buckets = new Map<string, Record<string, any>>();
    rows.forEach((r) => {
      const data = r.plantao?.data as string | undefined;
      if (!data) return;
      const chave = agruparPorSemana ? semanaDe(data) : data;
      const nome = r.plantao?.empresa?.nome ?? "Sem empresa";
      const b = buckets.get(chave) ?? { periodo: chave };
      b[nome] = (b[nome] ?? 0) + 1;
      buckets.set(chave, b);
    });
    return [...buckets.values()]
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
      .map((b) => {
        const linha: Record<string, any> = { ...b, label: fmtData(b.periodo) };
        nomesEmpresas.forEach((n) => { if (linha[n] === undefined) linha[n] = 0; });
        return linha;
      });
  }, [rows, nomesEmpresas, agruparPorSemana]);

  const resumo = useMemo(() => {
    const map = new Map<string, { empresa: string; total: number; resolvidos: number; abertos: number }>();
    rows.forEach((r) => {
      const nome = r.plantao?.empresa?.nome ?? "Sem empresa";
      const cur = map.get(nome) ?? { empresa: nome, total: 0, resolvidos: 0, abertos: 0 };
      cur.total += 1;
      if (r.resolvido) cur.resolvidos += 1; else cur.abertos += 1;
      map.set(nome, cur);
    });
    return [...map.values()].map((e) => ({ ...e, pct: e.total ? (e.resolvidos / e.total) * 100 : 0 }));
  }, [rows]);

  const resumoOrdenado = useMemo(() => {
    const arr = [...resumo];
    arr.sort((a, b) => {
      const va = a[sortKey] as any;
      const vb = b[sortKey] as any;
      const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [resumo, sortKey, sortAsc]);

  const barras = useMemo(() => [...resumo].sort((a, b) => b.total - a.total).slice(0, 15), [resumo]);

  const total = rows.length;
  const resolvidos = rows.filter((r) => r.resolvido).length;
  const taxa = total ? (resolvidos / total) * 100 : 0;
  const topEmpresa = [...resumo].sort((a, b) => b.total - a.total)[0];
  const totalAnterior = rowsAnterior.length;
  const variacao = totalAnterior ? ((total - totalAnterior) / totalAnterior) * 100 : null;

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(k === "empresa"); }
  };

  const visiveis = nomesEmpresas.filter((n) => !ocultas.includes(n));

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-bold">Evolução dos Atendimentos</h1>
          <p className="text-sm text-muted-foreground">Comparativo por empresa ao longo do tempo</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/plantoes/relatorios">Relatório detalhado</Link>
        </Button>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total no período</div>
          <div className="text-2xl font-bold">{total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Taxa de resolução</div>
          <div className="text-2xl font-bold text-emerald-600">{taxa.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">{resolvidos} de {total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Maior volume</div>
          <div className="text-base font-bold truncate" title={topEmpresa?.empresa}>{topEmpresa?.empresa ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{topEmpresa?.total ?? 0} atendimentos</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Vs. período anterior</div>
          {variacao === null ? (
            <div className="text-2xl font-bold">—</div>
          ) : (
            <div className={`text-2xl font-bold flex items-center gap-1 ${variacao >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {variacao >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {variacao >= 0 ? "+" : ""}{variacao.toFixed(1)}%
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">{totalAnterior} no período anterior</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Evolução {agruparPorSemana ? "semanal" : "diária"} por empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nomesEmpresas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {nomesEmpresas.map((n, i) => {
                const ativo = !ocultas.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOcultas((o) => (o.includes(n) ? o.filter((x) => x !== n) : [...o, n]))}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${ativo ? "bg-muted" : "opacity-40"}`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: CORES[i % CORES.length] }} />
                    {n}
                  </button>
                );
              })}
            </div>
          )}
          <div className="h-[320px]">
            {serieTemporal.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieTemporal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {visiveis.map((n) => (
                    <Line
                      key={n}
                      type="monotone"
                      dataKey={n}
                      stroke={CORES[nomesEmpresas.indexOf(n) % CORES.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Total por empresa no período</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {barras.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barras} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="empresa" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" name="Atendimentos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                {([
                  ["empresa", "Empresa"],
                  ["total", "Total"],
                  ["resolvidos", "Resolvidos"],
                  ["abertos", "Em aberto"],
                  ["pct", "% Resolvido"],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} className="text-left p-2">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
                      {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumoOrdenado.map((e) => (
                <tr key={e.empresa} className="border-t">
                  <td className="p-2">{e.empresa}</td>
                  <td className="p-2 font-medium">{e.total}</td>
                  <td className="p-2 text-emerald-600">{e.resolvidos}</td>
                  <td className="p-2 text-destructive">{e.abertos}</td>
                  <td className="p-2">{e.pct.toFixed(1)}%</td>
                </tr>
              ))}
              {resumoOrdenado.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}
