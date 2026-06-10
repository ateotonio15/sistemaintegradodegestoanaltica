import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck2, Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "../components/MetricCard";

const sb = supabase as any;
const RISCO_COLORS = { alto: "#ef4444", medio: "#eab308", baixo: "#22c55e" } as const;

export default function SaudeVisaoGeral() {
  const { user, loading } = useAuth();

  const { data } = useQuery({
    queryKey: ["saude_visao_geral"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const mesIni = new Date(); mesIni.setDate(1);
      const isoMes = mesIni.toISOString().slice(0, 10);
      const [{ data: acoes }, { data: tris }] = await Promise.all([
        sb.from("acoes_saude").select("id,empresa_id,data_acao,status,total_atendidos,empresa:empresas(nome)").gte("data_acao", isoMes),
        sb.from("triagens").select("risco_geral,empresa_id"),
      ]);
      return { acoes: acoes ?? [], tris: tris ?? [] };
    },
  });

  const kpis = useMemo(() => {
    const empresas = new Set((data?.acoes ?? []).map((a: any) => a.empresa_id)).size;
    const concluidas = (data?.acoes ?? []).filter((a: any) => a.status === "concluida").length;
    const triagensMes = (data?.acoes ?? []).reduce((s: number, a: any) => s + (a.total_atendidos ?? 0), 0);
    const totalTris = (data?.tris ?? []).length;
    const alto = (data?.tris ?? []).filter((t: any) => t.risco_geral === "alto").length;
    return { empresas, concluidas, triagensMes, pctAlto: totalTris ? Math.round((alto / totalTris) * 100) : 0 };
  }, [data]);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { nome: string; v: number }>();
    (data?.acoes ?? []).forEach((a: any) => {
      const k = a.empresa_id;
      const cur = map.get(k) ?? { nome: a.empresa?.nome ?? "—", v: 0 };
      cur.v += a.total_atendidos ?? 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.v - a.v).slice(0, 8);
  }, [data]);

  const riscoData = useMemo(() => {
    const c = { alto: 0, medio: 0, baixo: 0 } as Record<string, number>;
    (data?.tris ?? []).forEach((t: any) => { if (t.risco_geral) c[t.risco_geral] = (c[t.risco_geral] ?? 0) + 1; });
    return Object.entries(c).map(([k, v]) => ({ name: k, value: v }));
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/saude-empresas"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão Geral · Saúde nas Empresas</h1>
          <p className="text-sm text-muted-foreground">Indicadores do mês corrente</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Building2} label="Empresas atendidas (mês)" value={kpis.empresas} />
        <MetricCard icon={CalendarCheck2} label="Ações concluídas" value={kpis.concluidas} />
        <MetricCard icon={Activity} label="Triagens (mês)" value={kpis.triagensMes} />
        <MetricCard icon={AlertTriangle} label="% Risco alto (histórico)" value={`${kpis.pctAlto}%`} tone={kpis.pctAlto > 0 ? "danger" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Triagens por empresa (mês)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porEmpresa} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribuição de risco</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={riscoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {riscoData.map((d) => <Cell key={d.name} fill={RISCO_COLORS[d.name as keyof typeof RISCO_COLORS]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
