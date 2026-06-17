import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  Activity,
  Clock,
  TrendingUp,
  Gauge,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDemandas } from "@/hooks/useDemandas";
import {
  getStatus,
  getDiasAberto,
  parseLocalDate,
  formatDate,
  type Demanda,
} from "@/lib/demandas-utils";

/* ===== helpers ===== */
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}
function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function diff(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function DemandasDashboard() {
  const navigate = useNavigate();
  const { data: demandas = [], isLoading } = useDemandas();

  // ===== Filtros =====
  const today = new Date();
  const def30 = new Date();
  def30.setDate(def30.getDate() - 30);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [dataIni, setDataIni] = useState<string>(toISO(def30));
  const [dataFim, setDataFim] = useState<string>(toISO(today));
  const [empresa, setEmpresa] = useState<string>("__all__");
  const [setor, setSetor] = useState<string>("__all__");
  const [executiva, setExecutiva] = useState<string>("__all__");

  const empresas = useMemo(
    () => Array.from(new Set(demandas.map((d) => d.empresa).filter(Boolean))).sort() as string[],
    [demandas],
  );
  const setores = useMemo(
    () => Array.from(new Set(demandas.map((d) => d.setor_responsavel).filter(Boolean))).sort() as string[],
    [demandas],
  );
  const executivas = useMemo(
    () => Array.from(new Set(demandas.map((d) => d.executiva).filter(Boolean))).sort() as string[],
    [demandas],
  );

  const ini = parseLocalDate(dataIni);
  const fim = parseLocalDate(dataFim);

  // dataset no período (por data_reclamacao)
  const inPeriod = (d: Demanda) => {
    const x = parseLocalDate(d.data_reclamacao);
    if (!x) return false;
    if (ini && x < ini) return false;
    if (fim && x > fim) return false;
    return true;
  };
  const matchFilters = (d: Demanda) => {
    if (empresa !== "__all__" && d.empresa !== empresa) return false;
    if (setor !== "__all__" && d.setor_responsavel !== setor) return false;
    if (executiva !== "__all__" && d.executiva !== executiva) return false;
    return true;
  };

  const filtered = useMemo(
    () => demandas.filter((d) => inPeriod(d) && matchFilters(d)),
    [demandas, dataIni, dataFim, empresa, setor, executiva],
  );

  // período anterior (mesma duração)
  const periodDays = ini && fim ? Math.max(1, diff(fim, ini) + 1) : 30;
  const prevIni = ini ? new Date(ini.getTime() - periodDays * 86400000) : null;
  const prevFim = ini ? new Date(ini.getTime() - 86400000) : null;
  const inPrev = (d: Demanda) => {
    const x = parseLocalDate(d.data_reclamacao);
    if (!x || !prevIni || !prevFim) return false;
    return x >= prevIni && x <= prevFim;
  };
  const prevFiltered = useMemo(
    () => demandas.filter((d) => inPrev(d) && matchFilters(d)),
    [demandas, dataIni, dataFim, empresa, setor, executiva],
  );

  // ===== KPIs =====
  const total = filtered.length;
  const resolvidas = filtered.filter((d) => getStatus(d) === "Finalizada");
  const slaPct =
    resolvidas.length === 0
      ? 0
      : Math.round(
          (resolvidas.filter((d) => {
            const ri = parseLocalDate(d.data_reclamacao);
            const rf = parseLocalDate(d.data_resolucao_executiva || "");
            if (!ri || !rf) return false;
            return diff(rf, ri) <= 5;
          }).length /
            resolvidas.length) *
            100,
        );
  const backlogCritico = filtered.filter(
    (d) => isOpen(d) && getDiasAberto(d) > 5,
  ).length;
  const tempos = resolvidas
    .map((d) => {
      const ri = parseLocalDate(d.data_reclamacao);
      const rf = parseLocalDate(d.data_resolucao_executiva || "");
      return ri && rf ? diff(rf, ri) : null;
    })
    .filter((x): x is number => x !== null && x >= 0);
  const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        0.5 * slaPct +
          0.3 * (1 - (total ? backlogCritico / total : 0)) * 100 +
          0.2 * (1 - Math.min(1, tempoMedio / 10)) * 100,
      ),
    ),
  );

  // ===== Trend (semana) =====
  const trendData = useMemo(() => {
    if (!ini || !fim) return [];
    const buckets = new Map<string, { semana: string; total: number; resolvidas: number; sla: number }>();
    let cur = startOfWeek(ini);
    const end = startOfWeek(fim);
    while (cur <= end) {
      const key = toISO(cur);
      buckets.set(key, { semana: fmtShort(cur), total: 0, resolvidas: 0, sla: 0 });
      cur = new Date(cur.getTime() + 7 * 86400000);
    }
    filtered.forEach((d) => {
      const x = parseLocalDate(d.data_reclamacao);
      if (!x) return;
      const key = toISO(startOfWeek(x));
      const b = buckets.get(key);
      if (!b) return;
      b.total++;
      if (getStatus(d) === "Finalizada") {
        b.resolvidas++;
        const rf = parseLocalDate(d.data_resolucao_executiva || "");
        if (rf && diff(rf, x) <= 5) b.sla++;
      }
    });
    return Array.from(buckets.values()).map((b) => ({
      semana: b.semana,
      "SLA %": b.resolvidas ? Math.round((b.sla / b.resolvidas) * 100) : 0,
      Backlog: b.total - b.resolvidas,
    }));
  }, [filtered, dataIni, dataFim]);

  // ===== Matriz Risco (setor x tipo) =====
  const matriz = useMemo(() => {
    const setores = new Set<string>();
    const tipos = new Set<string>();
    const map = new Map<string, { count: number; atrasoSum: number; atrasoN: number }>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const t = d.tipo_reclamacao || "—";
      setores.add(s);
      tipos.add(t);
      const key = `${s}||${t}`;
      const cur = map.get(key) ?? { count: 0, atrasoSum: 0, atrasoN: 0 };
      cur.count++;
      const dias = getDiasAberto(d);
      cur.atrasoSum += dias;
      cur.atrasoN++;
      map.set(key, cur);
    });
    const maxCount = Math.max(1, ...Array.from(map.values()).map((v) => v.count));
    return {
      setores: Array.from(setores).sort(),
      tipos: Array.from(tipos).sort(),
      cell: (s: string, t: string) => map.get(`${s}||${t}`),
      maxCount,
    };
  }, [filtered]);

  // ===== Volume por setor + variação =====
  const volumeSetor = useMemo(() => {
    const cur = new Map<string, number>();
    const prev = new Map<string, number>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      cur.set(s, (cur.get(s) ?? 0) + 1);
    });
    prevFiltered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      prev.set(s, (prev.get(s) ?? 0) + 1);
    });
    return Array.from(cur.entries())
      .map(([setor, n]) => {
        const p = prev.get(setor) ?? 0;
        const delta = p === 0 ? (n > 0 ? 100 : 0) : Math.round(((n - p) / p) * 100);
        return { setor, n, p, delta };
      })
      .sort((a, b) => b.n - a.n);
  }, [filtered, prevFiltered]);
  const maxVol = Math.max(1, ...volumeSetor.map((v) => v.n));

  // ===== Reincidências =====
  const reincidencias = useMemo(() => {
    const bySetor = new Map<string, Demanda[]>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const arr = bySetor.get(s) ?? [];
      arr.push(d);
      bySetor.set(s, arr);
    });
    const prevBySetor = new Map<string, Demanda[]>();
    prevFiltered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const arr = prevBySetor.get(s) ?? [];
      arr.push(d);
      prevBySetor.set(s, arr);
    });
    const reinc = (arr: Demanda[]) => {
      const counts = new Map<string, number>();
      arr.forEach((d) => {
        const k = (d.nome_cliente || "").trim().toLowerCase();
        if (!k) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
      return Array.from(counts.values()).filter((v) => v >= 2).reduce((a, b) => a + b, 0);
    };
    return Array.from(bySetor.entries())
      .map(([setor, arr]) => {
        const r = reinc(arr);
        const taxa = arr.length ? Math.round((r / arr.length) * 100) : 0;
        const pArr = prevBySetor.get(setor) ?? [];
        const pTaxa = pArr.length ? Math.round((reinc(pArr) / pArr.length) * 100) : 0;
        const tend = taxa - pTaxa;
        return { setor, total: arr.length, reinc: r, taxa, tend };
      })
      .sort((a, b) => b.taxa - a.taxa);
  }, [filtered, prevFiltered]);

  // ===== Gargalos (top tipos) =====
  const gargalos = useMemo(() => {
    const map = new Map<string, { count: number; tempoSum: number; tempoN: number }>();
    filtered.forEach((d) => {
      const t = d.tipo_reclamacao || "—";
      const cur = map.get(t) ?? { count: 0, tempoSum: 0, tempoN: 0 };
      cur.count++;
      if (getStatus(d) === "Finalizada") {
        const ri = parseLocalDate(d.data_reclamacao);
        const rf = parseLocalDate(d.data_resolucao_executiva || "");
        if (ri && rf) {
          cur.tempoSum += diff(rf, ri);
          cur.tempoN++;
        }
      }
      map.set(t, cur);
    });
    return Array.from(map.entries())
      .map(([tipo, v]) => ({
        tipo,
        count: v.count,
        tempoMedio: v.tempoN ? Math.round((v.tempoSum / v.tempoN) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filtered]);

  // ===== Alertas críticos =====
  const alertas = useMemo(
    () =>
      filtered
        .filter((d) => isOpen(d) && getDiasAberto(d) > 5)
        .sort((a, b) => getDiasAberto(b) - getDiasAberto(a))
        .slice(0, 20),
    [filtered],
  );

  // ===== Insight =====
  const insight = useMemo(() => {
    const positivo = volumeSetor.filter((v) => v.p > 0).sort((a, b) => b.delta - a.delta)[0];
    if (positivo && positivo.delta >= 20) {
      return `Setor ${positivo.setor} subiu ${positivo.delta}% no período (vs anterior).`;
    }
    if (backlogCritico > 0) {
      return `${backlogCritico} demanda${backlogCritico === 1 ? "" : "s"} em aberto há mais de 5 dias precisa${backlogCritico === 1 ? "" : "m"} de atenção.`;
    }
    if (slaPct >= 90) return `Excelente: SLA de ${slaPct}% no período.`;
    return `SLA do período: ${slaPct}%. Tempo médio de resposta: ${tempoMedio.toFixed(1)} dias.`;
  }, [volumeSetor, backlogCritico, slaPct, tempoMedio]);

  const scoreColor =
    score >= 80 ? "text-emerald-500" : score >= 60 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 max-w-[1800px] space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            to="/demandas"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar para registros
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15">
              <Gauge className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              Dashboard Executivo — Reclamações
            </h1>
            <Badge variant="secondary" className="text-xs">
              {filtered.length} no período
            </Badge>
          </div>
        </div>
      </div>

      {/* Insight banner */}
      <Card className="p-3 flex items-center gap-3 bg-primary/5 border-primary/20">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm md:text-base text-foreground/90">{insight}</p>
      </Card>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data inicial</label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data final</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Empresa</label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Setor</label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Executiva</label>
            <Select value={executiva} onValueChange={setExecutiva}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {executivas.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Activity className="h-5 w-5" />} label="SLA Geral" value={`${slaPct}%`} hint="Resolvidas dentro de 5 dias" tone={slaPct >= 80 ? "good" : slaPct >= 60 ? "warn" : "bad"} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Backlog Crítico" value={String(backlogCritico)} hint="Em aberto há > 5 dias" tone={backlogCritico === 0 ? "good" : backlogCritico < 5 ? "warn" : "bad"} />
        <KpiCard icon={<Clock className="h-5 w-5" />} label="Tempo Médio" value={`${tempoMedio.toFixed(1)} d`} hint="Reclamação → resolução" tone={tempoMedio <= 3 ? "good" : tempoMedio <= 5 ? "warn" : "bad"} />
        <KpiCard icon={<Gauge className="h-5 w-5" />} label="Score Operacional" value={String(score)} hint="0–100 ponderado" toneClass={scoreColor} />
      </div>

      {/* Trend */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">Tendência semanal</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} />
              <Legend />
              <Line type="monotone" dataKey="SLA %" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Backlog" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Matriz + Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 overflow-x-auto">
          <h2 className="text-sm font-semibold tracking-wide uppercase mb-3">Matriz de risco (setor × tipo)</h2>
          {matriz.setores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium text-muted-foreground">Setor</th>
                  {matriz.tipos.map((t) => (
                    <th key={t} className="text-left p-1.5 font-medium text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriz.setores.map((s) => (
                  <tr key={s}>
                    <td className="p-1.5 font-medium whitespace-nowrap">{s}</td>
                    {matriz.tipos.map((t) => {
                      const c = matriz.cell(s, t);
                      const intensity = c ? c.count / matriz.maxCount : 0;
                      const atraso = c && c.atrasoN ? Math.round(c.atrasoSum / c.atrasoN) : 0;
                      return (
                        <td key={t} className="p-1">
                          <div
                            className="rounded-md px-2 py-1.5 text-center"
                            style={{
                              background: c
                                ? `hsl(var(--primary) / ${0.1 + intensity * 0.6})`
                                : "hsl(var(--muted) / 0.3)",
                              color: intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                            }}
                            title={c ? `${c.count} demandas • atraso médio ${atraso}d` : "Sem dados"}
                          >
                            <div className="font-semibold">{c?.count ?? 0}</div>
                            {c && <div className="text-[10px] opacity-80">{atraso}d</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase mb-3">Volume por setor</h2>
          {volumeSetor.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-2.5">
              {volumeSetor.map((v) => {
                const pct = (v.n / maxVol) * 100;
                const tone =
                  v.delta <= 0 ? "bg-emerald-500" : v.delta <= 20 ? "bg-yellow-500" : "bg-red-500";
                const deltaCls =
                  v.delta <= 0 ? "text-emerald-600" : v.delta <= 20 ? "text-yellow-600" : "text-red-600";
                return (
                  <div key={v.setor}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate">{v.setor}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{v.n}</span>
                        <span className={cn("inline-flex items-center gap-0.5", deltaCls)}>
                          {v.delta > 0 ? <ArrowUp className="h-3 w-3" /> : v.delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(v.delta)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Reincidências + Gargalos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 overflow-x-auto">
          <h2 className="text-sm font-semibold tracking-wide uppercase mb-3">Reincidências por setor</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left p-1.5 font-medium">Setor</th>
                <th className="text-right p-1.5 font-medium">Total</th>
                <th className="text-right p-1.5 font-medium">Reincidentes</th>
                <th className="text-right p-1.5 font-medium">Taxa</th>
                <th className="text-right p-1.5 font-medium">Tendência</th>
                <th className="text-right p-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reincidencias.map((r) => {
                const status =
                  r.taxa >= 30 ? { label: "Crítico", cls: "bg-red-500/15 text-red-600" }
                  : r.taxa >= 15 ? { label: "Atenção", cls: "bg-yellow-500/15 text-yellow-600" }
                  : { label: "OK", cls: "bg-emerald-500/15 text-emerald-600" };
                return (
                  <tr key={r.setor} className="border-t border-border">
                    <td className="p-1.5 font-medium">{r.setor}</td>
                    <td className="p-1.5 text-right">{r.total}</td>
                    <td className="p-1.5 text-right">{r.reinc}</td>
                    <td className="p-1.5 text-right font-semibold">{r.taxa}%</td>
                    <td className="p-1.5 text-right">
                      <span className={cn("inline-flex items-center gap-0.5", r.tend > 0 ? "text-red-600" : r.tend < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                        {r.tend > 0 ? <ArrowUp className="h-3 w-3" /> : r.tend < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(r.tend)}pp
                      </span>
                    </td>
                    <td className="p-1.5 text-right"><span className={cn("px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-semibold", status.cls)}>{status.label}</span></td>
                  </tr>
                );
              })}
              {reincidencias.length === 0 && (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase mb-3">Gargalos — Top 5 tipos</h2>
          {gargalos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-3">
              {gargalos.map((g, i) => (
                <div key={g.tipo} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{g.tipo}</div>
                    <div className="text-xs text-muted-foreground">Tempo médio: {g.tempoMedio} dias</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{g.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Alertas críticos */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">Alertas críticos (em aberto &gt; 5 dias)</h2>
          </div>
          <Badge variant="outline">{alertas.length}</Badge>
        </div>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma demanda crítica. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left p-1.5 font-medium">Cliente</th>
                  <th className="text-left p-1.5 font-medium">Empresa</th>
                  <th className="text-left p-1.5 font-medium">Setor</th>
                  <th className="text-left p-1.5 font-medium">Executiva</th>
                  <th className="text-left p-1.5 font-medium">Reclamação</th>
                  <th className="text-right p-1.5 font-medium">Dias</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-border cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/demandas?id=${d.id}`)}
                  >
                    <td className="p-1.5 font-medium">{d.nome_cliente}</td>
                    <td className="p-1.5">{d.empresa || "—"}</td>
                    <td className="p-1.5">{d.setor_responsavel || "—"}</td>
                    <td className="p-1.5">{d.executiva || "—"}</td>
                    <td className="p-1.5">{formatDate(d.data_reclamacao)}</td>
                    <td className="p-1.5 text-right font-bold text-red-600">{getDiasAberto(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, tone, toneClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn" | "bad";
  toneClass?: string;
}) {
  const cls =
    toneClass ??
    (tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-yellow-500" : tone === "bad" ? "text-red-500" : "text-foreground");
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <span className={cn("h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center", cls)}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-3xl md:text-4xl font-bold tracking-tight", cls)}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </Card>
  );
}
