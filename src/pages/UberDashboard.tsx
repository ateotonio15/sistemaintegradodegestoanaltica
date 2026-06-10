import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Car, DollarSign, TrendingUp, Ban, Users } from "lucide-react";
import { useUberCorridas } from "@/hooks/useUberCorridas";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function UberDashboard() {
  const { data: corridas = [], isLoading } = useUberCorridas();
  const [periodo, setPeriodo] = useState("90");

  const filtered = useMemo(() => {
    if (periodo === "all") return corridas;
    const limite = new Date(); limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - Number(periodo));
    return corridas.filter((c) => {
      const [y, m, d] = c.data.split("-").map(Number);
      return new Date(y, m - 1, d) >= limite;
    });
  }, [corridas, periodo]);

  const kpis = useMemo(() => {
    const validas = filtered.filter((c) => !c.cancelada);
    const totalValor = validas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const ticket = validas.length ? totalValor / validas.length : 0;
    return {
      total: filtered.length,
      ativas: validas.length,
      canceladas: filtered.length - validas.length,
      valor: totalValor,
      ticket,
      colaboradores: new Set(filtered.map((c) => c.colaborador)).size,
    };
  }, [filtered]);

  const porDia = useMemo(() => {
    const map = new Map<string, { data: string; qtd: number; valor: number }>();
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const cur = map.get(c.data) ?? { data: c.data, qtd: 0, valor: 0 };
      cur.qtd += 1; cur.valor += Number(c.valor || 0);
      map.set(c.data, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-30)
      .map((r) => ({ ...r, label: r.data.slice(5).replace("-", "/") }));
  }, [filtered]);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filtered.filter((c) => !c.cancelada && c.empresa).forEach((c) => {
      const k = c.empresa!;
      const cur = map.get(k) ?? { nome: k, qtd: 0, valor: 0 };
      cur.qtd += 1; cur.valor += Number(c.valor || 0);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  const porColaborador = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const cur = map.get(c.colaborador) ?? { nome: c.colaborador, qtd: 0, valor: 0 };
      cur.qtd += 1; cur.valor += Number(c.valor || 0);
      map.set(c.colaborador, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filtered]);

  const porMotivo = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const k = c.motivo || "Sem motivo";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  }, [filtered]);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/uber"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Car className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Dashboard Uber</h1>
            <p className="text-sm text-muted-foreground">KPIs, gastos e ranking de utilização</p>
          </div>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Car className="h-3.5 w-3.5" />Corridas</div><div className="text-2xl font-bold mt-1">{kpis.total}</div></Card>
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Ativas</div><div className="text-2xl font-bold mt-1 text-emerald-600">{kpis.ativas}</div></Card>
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Ban className="h-3.5 w-3.5" />Canceladas</div><div className="text-2xl font-bold mt-1 text-rose-600">{kpis.canceladas}</div></Card>
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" />Gasto total</div><div className="text-xl font-bold mt-1">{fmtMoney(kpis.valor)}</div></Card>
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" />Ticket médio</div><div className="text-xl font-bold mt-1">{fmtMoney(kpis.ticket)}</div></Card>
            <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Colaboradores</div><div className="text-2xl font-bold mt-1">{kpis.colaboradores}</div></Card>
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Tendência (últimos {Math.min(30, porDia.length)} dias)</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <RTooltip formatter={(v: any, n) => n === "valor" ? fmtMoney(Number(v)) : v} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="qtd" name="Corridas" stroke="#3b82f6" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="valor" name="Valor (R$)" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Top empresas por gasto</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porEmpresa} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={140} />
                  <RTooltip formatter={(v: any) => fmtMoney(Number(v))} />
                  <Bar dataKey="valor" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Top colaboradores por gasto</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porColaborador} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={120} />
                  <RTooltip formatter={(v: any) => fmtMoney(Number(v))} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-semibold mb-3">Distribuição por motivo</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porMotivo} dataKey="valor" nameKey="nome" outerRadius={100} label={(e) => `${e.nome} (${e.valor})`}>
                    {porMotivo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
