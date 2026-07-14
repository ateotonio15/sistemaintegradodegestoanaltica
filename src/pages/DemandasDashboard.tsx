import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  Gauge,
  Target,
  Inbox,
  Sparkles,
  Layers,
  Users,
  Repeat,
  Zap,
  FileDown,
} from "lucide-react";
import { exportDashboardReclamacoesPptx } from "@/lib/demandas-dashboard-pptx";
import { toast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
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
import { parseLocalDate, type Demanda } from "@/lib/demandas-utils";

/* ============================================================
   Constantes de SLA / Negócio
============================================================ */
const PRAZO_PADRAO_HORAS = 72;
const PRAZO_AGENDA_CIRURGICA_HORAS = 168;
const DIAS_CRITICA = 15;
const META_FORA_PRAZO = 8; // %

const FERIADOS_BR: Record<string, true> = (() => {
  const out: Record<string, true> = {};
  const fixos = [
    "01-01", "04-21", "05-01", "09-07", "10-12",
    "11-02", "11-15", "11-20", "12-25",
  ];
  for (let y = 2023; y <= 2030; y++) {
    fixos.forEach((md) => (out[`${y}-${md}`] = true));
  }
  return out;
})();

const isUtil = (d: Date) => {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !FERIADOS_BR[key];
};

/** Horas úteis entre duas datas, 8h/dia útil. */
function horasUteis(ini: Date, fim: Date): number {
  if (fim <= ini) return 0;
  let horas = 0;
  const cur = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
  const end = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  while (cur <= end) {
    if (isUtil(cur)) horas += 8;
    cur.setDate(cur.getDate() + 1);
  }
  // ajuste fracionário simples baseado em dias inteiros
  const diasInteiros = Math.max(0, (end.getTime() - ini.getTime()) / 86400000);
  if (diasInteiros < 1 && isUtil(ini)) {
    return Math.max(0, (fim.getTime() - ini.getTime()) / 3600000);
  }
  return horas;
}

function isAgendaCirurgica(setor?: string | null): boolean {
  return (setor || "").toLowerCase().includes("agenda cir");
}

function prazoHorasOf(d: Demanda): number {
  return isAgendaCirurgica(d.setor_responsavel)
    ? PRAZO_AGENDA_CIRURGICA_HORAS
    : PRAZO_PADRAO_HORAS;
}

function isResolved(d: Demanda): boolean {
  return d.resolvido_setor || d.resolvido_executiva;
}

function dataFimEfetiva(d: Demanda): Date {
  const rf =
    parseLocalDate(d.data_resolucao_executiva || "") ||
    parseLocalDate(d.data_resolucao_setor || "");
  return rf ?? new Date();
}

function horasAbertoOuTotal(d: Demanda): number {
  const ri = parseLocalDate(d.data_reclamacao);
  if (!ri) return 0;
  return horasUteis(ri, dataFimEfetiva(d));
}

function isForaPrazo(d: Demanda): boolean {
  return horasAbertoOuTotal(d) > prazoHorasOf(d);
}

function diasCorridos(d: Demanda): number {
  const ri = parseLocalDate(d.data_reclamacao);
  if (!ri) return 0;
  const fim = dataFimEfetiva(d);
  return Math.max(0, Math.round((fim.getTime() - ri.getTime()) / 86400000));
}

function isCritica(d: Demanda): boolean {
  return !isResolved(d) && diasCorridos(d) > DIAS_CRITICA;
}

/* ============================================================
   Helpers
============================================================ */
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/* ============================================================
   Página
============================================================ */
export default function DemandasDashboard() {
  const { data: demandas = [], isLoading } = useDemandas();

  // ===== Filtros =====
  const [dataIni, setDataIni] = useState<string>(toISO(firstDayOfMonth()));
  const [dataFim, setDataFim] = useState<string>(toISO(lastDayOfMonth()));
  const [empresa, setEmpresa] = useState<string>("__all__");
  const [executiva, setExecutiva] = useState<string>("__all__");

  const empresas = useMemo(
    () =>
      Array.from(new Set(demandas.map((d) => d.empresa).filter(Boolean))).sort() as string[],
    [demandas],
  );
  const executivas = useMemo(
    () =>
      Array.from(new Set(demandas.map((d) => d.executiva).filter(Boolean))).sort() as string[],
    [demandas],
  );

  const ini = parseLocalDate(dataIni);
  const fim = parseLocalDate(dataFim);

  const matchFilter = (d: Demanda) => {
    const abertura = parseLocalDate(d.data_reclamacao);
    if (!abertura) return false;
    const resolvida = isResolved(d);
    const encerramento = resolvida ? dataFimEfetiva(d) : new Date();
    // Vigência da demanda intersecta o período filtrado
    if (fim && abertura > fim) return false;
    if (ini && encerramento < ini) return false;
    if (empresa !== "__all__" && d.empresa !== empresa) return false;
    if (executiva !== "__all__" && d.executiva !== executiva) return false;
    return true;
  };

  const filtered = useMemo(() => demandas.filter(matchFilter), [
    demandas, dataIni, dataFim, empresa, executiva,
  ]);

  // ===== Métricas agregadas =====
  const metrics = useMemo(() => {
    const total = filtered.length;
    const resolvidas = filtered.filter(isResolved).length;
    const emAberto = total - resolvidas;
    const noPrazo = filtered.filter((d) => !isForaPrazo(d)).length;
    const foraPrazo = total - noPrazo;
    const tempos = filtered
      .filter(isResolved)
      .map(diasCorridos)
      .filter((v) => v >= 0);
    const tempoMedioDias = tempos.length
      ? tempos.reduce((a, b) => a + b, 0) / tempos.length
      : 0;
    const pctResolvidas = total ? Math.round((resolvidas / total) * 100) : 0;
    const pctEmAberto = total ? Math.round((emAberto / total) * 100) : 0;
    const slaNoPrazoPct = total ? Math.round((noPrazo / total) * 100) : 0;
    const pctForaDoPrazo = total ? Math.round((foraPrazo / total) * 100) : 0;
    const acimaDaMeta = pctForaDoPrazo > META_FORA_PRAZO;
    const score = Math.round(
      slaNoPrazoPct * 0.4 +
        pctResolvidas * 0.3 +
        (100 - pctForaDoPrazo) * 0.2 +
        (100 - pctEmAberto) * 0.1,
    );
    return {
      total, resolvidas, emAberto, pctResolvidas, pctEmAberto,
      slaNoPrazoPct, tempoMedioDias, pctForaDoPrazo, acimaDaMeta, score,
    };
  }, [filtered]);

  const scoreStatus =
    metrics.score >= 85 ? "saudavel" : metrics.score >= 70 ? "atencao" : "critico";

  // ===== Tempo médio segmentado =====
  const temposSegmentados = useMemo(() => {
    const cir = filtered.filter((d) => isAgendaCirurgica(d.setor_responsavel) && isResolved(d));
    const out = filtered.filter((d) => !isAgendaCirurgica(d.setor_responsavel) && isResolved(d));
    const avg = (arr: Demanda[]) =>
      arr.length
        ? arr.reduce((s, d) => s + horasAbertoOuTotal(d), 0) / arr.length
        : 0;
    const pctSemSla = (arr: Demanda[], horas: number) =>
      arr.length
        ? Math.round((arr.filter((d) => horasAbertoOuTotal(d) > horas).length / arr.length) * 100)
        : 0;
    return {
      cirurgica: { horas: avg(cir), foraPct: pctSemSla(cir, PRAZO_AGENDA_CIRURGICA_HORAS) },
      demais: { horas: avg(out), foraPct: pctSemSla(out, PRAZO_PADRAO_HORAS) },
    };
  }, [filtered]);

  // ===== Tendências (split do período em duas metades) =====
  const tendencias = useMemo(() => {
    if (!ini || !fim) return null;
    const meio = new Date((ini.getTime() + fim.getTime()) / 2);
    const ant = filtered.filter((d) => {
      const x = parseLocalDate(d.data_reclamacao);
      return x && x < meio;
    });
    const rec = filtered.filter((d) => {
      const x = parseLocalDate(d.data_reclamacao);
      return x && x >= meio;
    });
    const sla = (arr: Demanda[]) =>
      arr.length ? Math.round((arr.filter((d) => !isForaPrazo(d)).length / arr.length) * 100) : 0;
    const aberto = (arr: Demanda[]) => arr.filter((d) => !isResolved(d)).length;
    const foraPct = (arr: Demanda[]) =>
      arr.length ? Math.round((arr.filter(isForaPrazo).length / arr.length) * 100) : 0;
    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
    return {
      slaDelta: pct(sla(rec), sla(ant)),
      backlogDelta: pct(aberto(rec), aberto(ant)),
      foraDelta: pct(foraPct(rec), foraPct(ant)),
    };
  }, [filtered, ini, fim]);

  // ===== Série mensal (até 8 últimos meses do período) =====
  const monthlySeries = useMemo(() => {
    if (!ini || !fim) return [];
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const last = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (cur <= last) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: cur.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        start: new Date(cur),
        end: new Date(cur.getFullYear(), cur.getMonth() + 1, 0),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.slice(-8).map((m) => {
      const arr = filtered.filter((d) => {
        const x = parseLocalDate(d.data_reclamacao);
        return x && x >= m.start && x <= m.end;
      });
      const sla = arr.length
        ? Math.round((arr.filter((d) => !isForaPrazo(d)).length / arr.length) * 100)
        : 0;
      const fora = arr.length
        ? Math.round((arr.filter(isForaPrazo).length / arr.length) * 100)
        : 0;
      const aberto = arr.filter((d) => !isResolved(d)).length;
      return { label: m.label, sla, fora, aberto };
    });
  }, [filtered, ini, fim]);

  // ===== Matriz de risco (setor) =====
  const matrizSetores = useMemo(() => {
    const map = new Map<string, { volume: number; fora: number }>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const cur = map.get(s) ?? { volume: 0, fora: 0 };
      cur.volume++;
      if (isForaPrazo(d)) cur.fora++;
      map.set(s, cur);
    });
    return Array.from(map.entries()).map(([setor, v]) => ({
      setor,
      x: v.volume,
      y: v.volume ? Math.round((v.fora / v.volume) * 100) : 0,
      z: v.volume,
    }));
  }, [filtered]);

  // ===== Volume por setor =====
  const volumeSetor = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      map.set(s, (map.get(s) ?? 0) + 1);
    });
    const tot = filtered.length || 1;
    return Array.from(map.entries())
      .map(([setor, n]) => ({ setor, n, pct: Math.round((n / tot) * 100) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [filtered]);

  // ===== Reincidências =====
  const reincidencias = useMemo(() => {
    const bySetor = new Map<string, Demanda[]>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const arr = bySetor.get(s) ?? [];
      arr.push(d);
      bySetor.set(s, arr);
    });
    const list = Array.from(bySetor.entries()).map(([setor, arr]) => {
      const counts = new Map<string, number>();
      arr.forEach((d) => {
        const k = (d.nome_cliente || "").trim().toLowerCase();
        if (!k) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
      const reincidentes = Array.from(counts.values()).filter((v) => v > 1).reduce((a, b) => a + b, 0);
      const taxa = arr.length ? Math.round((reincidentes / arr.length) * 100) : 0;
      return { setor, total: arr.length, reinc: reincidentes, taxa };
    });
    return list.sort((a, b) => b.taxa - a.taxa).slice(0, 8);
  }, [filtered]);

  // ===== Gargalos (setor + tipo) =====
  const gargalos = useMemo(() => {
    const map = new Map<string, { setor: string; tipo: string; arr: Demanda[] }>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const t = d.tipo_reclamacao || "—";
      const key = `${s}||${t}`;
      const cur = map.get(key) ?? { setor: s, tipo: t, arr: [] };
      cur.arr.push(d);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((v) => {
        const tempos = v.arr.filter(isResolved).map(diasCorridos);
        const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
        const foraPct = v.arr.length
          ? Math.round((v.arr.filter(isForaPrazo).length / v.arr.length) * 100)
          : 0;
        return { setor: v.setor, tipo: v.tipo, qtd: v.arr.length, tempoMedio, foraPct };
      })
      .sort((a, b) => b.tempoMedio * b.qtd - a.tempoMedio * a.qtd)
      .slice(0, 5);
  }, [filtered]);

  // ===== Insights =====
  const insights = useMemo(() => {
    const out: { icon: any; text: string }[] = [];
    if (volumeSetor[0] && volumeSetor[0].pct >= 30) {
      out.push({
        icon: Target,
        text: `${volumeSetor[0].setor} concentra ${volumeSetor[0].pct}% das demandas do período.`,
      });
    }
    if (metrics.acimaDaMeta) {
      out.push({
        icon: AlertTriangle,
        text: `Devolutivas fora do prazo em ${metrics.pctForaDoPrazo}% — acima da meta de ${META_FORA_PRAZO}%.`,
      });
    }
    if (tendencias && tendencias.backlogDelta > 20) {
      out.push({
        icon: TrendingUp,
        text: `Backlog em alta: +${tendencias.backlogDelta}% comparado ao início do período.`,
      });
    } else if (tendencias && tendencias.backlogDelta < -10) {
      out.push({
        icon: TrendingDown,
        text: `Backlog recuando: ${tendencias.backlogDelta}% no período. Boa execução.`,
      });
    }
    return out.slice(0, 3);
  }, [volumeSetor, metrics, tendencias]);

  const limpar = () => {
    setDataIni(toISO(firstDayOfMonth()));
    setDataFim(toISO(lastDayOfMonth()));
    setEmpresa("__all__");
    setExecutiva("__all__");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-6 max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/demandas"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 w-fit"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para registros
            </Link>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Painel Executivo
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Visão estratégica
          </h1>
          <p className="text-sm text-muted-foreground">
            SLA, risco operacional e tendências para a diretoria
          </p>
        </div>

        {/* Filtros */}
        <Card className="p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="Data inicial">
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
            </Field>
            <Field label="Data final">
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
            </Field>
            <Field label="Empresa">
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Executiva">
              <Select value={executiva} onValueChange={setExecutiva}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {executivas.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Button variant="outline" onClick={limpar} className="h-9">Limpar</Button>
          </div>
        </Card>

        {/* Estado vazio */}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-12 flex flex-col items-center text-center gap-3">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhuma demanda registrada no período</h3>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar dados.</p>
            <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
          </Card>
        )}

        {filtered.length > 0 && (
          <>
            {/* Insights */}
            {insights.length > 0 && (
              <Card className="p-4 border-primary/30 bg-primary/[0.04] animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit">
                    <Sparkles className="h-3 w-3" /> Insights — Análise automática
                  </span>
                  <div className="flex-1 flex flex-col gap-1.5">
                    {insights.map((ins, i) => {
                      const Icon = ins.icon;
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                          <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{ins.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiExecCard
                delay={0}
                icon={<Activity className="h-5 w-5" />}
                label="SLA Executivo Geral"
                value={`${metrics.slaNoPrazoPct}%`}
                tone={metrics.slaNoPrazoPct >= 95 ? "success" : metrics.slaNoPrazoPct >= 85 ? "warning" : "danger"}
                badge={metrics.slaNoPrazoPct >= 95 ? "Saudável" : metrics.slaNoPrazoPct >= 85 ? "Atenção" : "Crítico"}
                trendPct={tendencias?.slaDelta}
                description={`${metrics.total - metrics.pctEmAberto * metrics.total / 100 | 0} de ${metrics.total} dentro do prazo`}
              />
              <KpiExecCard
                delay={80}
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Backlog Crítico"
                value={String(metrics.emAberto)}
                tone={metrics.emAberto === 0 ? "success" : metrics.pctEmAberto > 30 ? "danger" : "warning"}
                badge={
                  tendencias && tendencias.backlogDelta > 20
                    ? "Em alta"
                    : tendencias && tendencias.backlogDelta < -10
                    ? "Recuando"
                    : "Estável"
                }
                trendPct={tendencias?.backlogDelta}
                trendInverse
                description={`${metrics.pctEmAberto}% do total ainda em aberto`}
              />
              <KpiExecCard
                delay={160}
                icon={<Clock className="h-5 w-5" />}
                label="Tempo Médio de Resposta"
                tone="info"
                customValue={
                  <div className="grid grid-cols-2 gap-3 w-full mt-1">
                    <SubMetric
                      titulo="Agenda Cirúrgica"
                      sub="SLA 168h"
                      valor={`${temposSegmentados.cirurgica.horas.toFixed(0)}h`}
                      foraPct={temposSegmentados.cirurgica.foraPct}
                    />
                    <SubMetric
                      titulo="Demais setores"
                      sub="SLA 72h"
                      valor={`${temposSegmentados.demais.horas.toFixed(0)}h`}
                      foraPct={temposSegmentados.demais.foraPct}
                    />
                  </div>
                }
              />
              <KpiExecCard
                delay={240}
                icon={<Gauge className="h-5 w-5" />}
                label="Pontuação Operacional"
                value={`${metrics.score}`}
                tone={scoreStatus === "saudavel" ? "success" : scoreStatus === "atencao" ? "warning" : "danger"}
                badge={scoreStatus === "saudavel" ? "Saudável" : scoreStatus === "atencao" ? "Atenção" : "Crítico"}
                description="Eficiência ponderada de SLA, resolução e backlog."
                bar={metrics.score}
              />
            </div>

            {/* Tendências */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TrendLineCard
                delay={0}
                title="Evolução do SLA"
                subtitle="% no prazo por mês"
                icon={<Activity className="h-4 w-4" />}
                tone="success"
                data={monthlySeries.map((m) => ({ label: m.label, value: m.sla }))}
                unit="%"
              />
              <TrendLineCard
                delay={80}
                title="Evolução do Backlog"
                subtitle="Demandas em aberto / mês"
                icon={<Layers className="h-4 w-4" />}
                tone="info"
                inverse
                data={monthlySeries.map((m) => ({ label: m.label, value: m.aberto }))}
              />
              <TrendLineCard
                delay={160}
                title="Devolutivas fora do prazo"
                subtitle="% fora do prazo / mês"
                icon={<AlertTriangle className="h-4 w-4" />}
                tone="danger"
                inverse
                data={monthlySeries.map((m) => ({ label: m.label, value: m.fora }))}
                actionHref="/demandas/fora-do-prazo"
                actionLabel="Ver detalhes"
                unit="%"
                meta={META_FORA_PRAZO}
                footer="Meta: ≤ 8%"
              />
            </div>

            {/* Matriz de risco */}
            <MatrizRiscoSetores data={matrizSetores} />

            {/* Gestão preventiva */}
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Gestão preventiva de carteira
                </p>
                <h2 className="text-xl font-semibold tracking-tight">Inteligência de relacionamento</h2>
              </div>
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <VolumeReclamacoesSetor data={volumeSetor} />
                <ReincidenciasSetores data={reincidencias} />
              </div>
            </div>

            {/* Gargalos */}
            <GargalosPanel data={gargalos} />
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Sub-componentes
============================================================ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

type Tone = "success" | "warning" | "danger" | "info";
const toneClasses: Record<Tone, { text: string; bg: string; ring: string; chart: string }> = {
  success: { text: "text-success", bg: "bg-success/10", ring: "ring-success/20", chart: "hsl(var(--success))" },
  warning: { text: "text-warning", bg: "bg-warning/10", ring: "ring-warning/20", chart: "hsl(var(--warning))" },
  danger:  { text: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/20", chart: "hsl(var(--destructive))" },
  info:    { text: "text-info", bg: "bg-info/10", ring: "ring-info/20", chart: "hsl(var(--info))" },
};

function KpiExecCard({
  icon, label, value, customValue, tone, badge, trendPct, trendInverse,
  description, bar, delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  customValue?: React.ReactNode;
  tone: Tone;
  badge?: string;
  trendPct?: number;
  trendInverse?: boolean;
  description?: string;
  bar?: number;
  delay?: number;
}) {
  const t = toneClasses[tone];
  const showTrend = typeof trendPct === "number" && !isNaN(trendPct);
  const isUp = (trendPct ?? 0) > 0;
  const positive = trendInverse ? !isUp : isUp;
  const TrendIcon = isUp ? ArrowUp : ArrowDown;
  return (
    <Card
      className="p-5 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center ring-1", t.bg, t.ring, t.text)}>
          {icon}
        </div>
        {badge && (
          <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full", t.bg, t.text)}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {customValue ?? (
        <div className="flex items-baseline gap-2 mt-1">
          <span className={cn("text-5xl font-semibold tabular-nums tracking-tight", t.text)}>{value}</span>
          {showTrend && (
            <span className={cn(
              "inline-flex items-center text-xs font-semibold gap-0.5",
              positive ? "text-success" : "text-destructive",
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trendPct!)}%
            </span>
          )}
        </div>
      )}
      {typeof bar === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", t.text.replace("text-", "bg-"))}
               style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      )}
    </Card>
  );
}

function SubMetric({ titulo, sub, valor, foraPct }: { titulo: string; sub: string; valor: string; foraPct: number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="text-[9px] text-muted-foreground/70">{sub}</p>
      <p className="text-2xl font-semibold tabular-nums mt-0.5">{valor}</p>
      <p className={cn("text-[10px] font-medium", foraPct > META_FORA_PRAZO ? "text-destructive" : "text-success")}>
        {foraPct}% sem SLA
      </p>
    </div>
  );
}

function TrendLineCard({
  title, subtitle, icon, data, tone, unit = "", decimals = 0, meta, inverse, delay = 0, footer, actionHref, actionLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  data: { label: string; value: number }[];
  tone: Tone;
  unit?: string;
  decimals?: number;
  meta?: number;
  inverse?: boolean;
  delay?: number;
  footer?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const t = toneClasses[tone];
  // Garante segmento visível se tiver só 1 ponto
  const series = data.length === 1 ? [data[0], { ...data[0] }] : data;
  const last = data[data.length - 1]?.value ?? 0;
  const first = data[0]?.value ?? 0;
  const delta = first === 0 ? 0 : Math.round(((last - first) / Math.max(1, first)) * 100);
  const isUp = delta > 0;
  const positive = inverse ? !isUp : isUp;
  const TrendIcon = isUp ? ArrowUp : ArrowDown;
  return (
    <Card
      className="p-5 shadow-sm animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", t.bg, t.text)}>{icon}</div>
          <div>
            <p className="text-sm font-semibold leading-tight">{title}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-semibold tabular-nums", t.text)}>
            {last.toFixed(decimals)}{unit}
          </p>
          {data.length > 1 && (
            <span className={cn(
              "inline-flex items-center text-[11px] font-semibold gap-0.5",
              positive ? "text-success" : "text-destructive",
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      </div>
      <div className="h-24">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`g-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.chart} stopOpacity={0.25} />
                <stop offset="100%" stopColor={t.chart} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <RTooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${Number(v).toFixed(decimals)}${unit}`, title]}
            />
            {typeof meta === "number" && (
              <ReferenceLine y={meta} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
            )}
            <Area type="monotone" dataKey="value" stroke={t.chart} strokeWidth={2.5}
                  fill={`url(#g-${title.replace(/\s/g, "")})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {footer ? <p className="text-[11px] text-muted-foreground">{footer}</p> : <span />}
        {actionHref && (
          <Link
            to={actionHref}
            className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {actionLabel ?? "Ver detalhes"} →
          </Link>
        )}
      </div>
    </Card>
  );
}

function MatrizRiscoSetores({ data }: { data: { setor: string; x: number; y: number; z: number }[] }) {
  if (data.length === 0) return null;
  const medX = data.map((d) => d.x).sort((a, b) => a - b)[Math.floor(data.length / 2)];
  const medY = data.map((d) => d.y).sort((a, b) => a - b)[Math.floor(data.length / 2)];
  const colorOf = (d: { x: number; y: number }) => {
    if (d.y >= medY && d.x >= medX) return "hsl(var(--destructive))";
    if (d.y >= medY) return "hsl(var(--warning))";
    if (d.x >= medX) return "hsl(var(--info))";
    return "hsl(var(--success))";
  };
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matriz de risco</p>
          <h3 className="text-lg font-semibold">Setores por volume × atraso</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Legenda cor="hsl(var(--success))" txt="Controlado" />
          <Legenda cor="hsl(var(--info))" txt="Vigiar volume" />
          <Legenda cor="hsl(var(--warning))" txt="Reagir rápido" />
          <Legenda cor="hsl(var(--destructive))" txt="Crítico" />
        </div>
      </div>
      <div className="h-80 relative">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
            <XAxis
              type="number" dataKey="x" name="Volume"
              label={{ value: "Volume de reclamações", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="number" dataKey="y" name="% fora prazo" unit="%"
              label={{ value: "% fora do prazo", angle: -90, position: "insideLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <ZAxis type="number" dataKey="z" range={[80, 600]} />
            <ReferenceLine x={medX} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <ReferenceLine y={medY} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <RTooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, k: string) => [v, k === "x" ? "Volume" : k === "y" ? "% fora prazo" : "Tam."]}
              labelFormatter={(_, payload: any) => payload?.[0]?.payload?.setor ?? ""}
            />
            <Scatter data={data}>
              {data.map((d, i) => (
                <Cell key={i} fill={colorOf(d)} fillOpacity={0.7} stroke={colorOf(d)} strokeWidth={1.5} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Legenda({ cor, txt }: { cor: string; txt: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
      <span className="text-muted-foreground">{txt}</span>
    </span>
  );
}

function VolumeReclamacoesSetor({ data }: { data: { setor: string; n: number; pct: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const colorOf = (pct: number) =>
    pct > 25 ? "bg-destructive" : pct >= 10 ? "bg-warning" : "bg-success";
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Volume de Reclamações por Setor</h3>
          <p className="text-[11px] text-muted-foreground">Top 8 setores no período</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.setor}>
            <div className="flex justify-between text-xs mb-1">
              <span className="truncate text-foreground/90">{d.setor}</span>
              <span className="tabular-nums text-muted-foreground">
                <strong className="text-foreground">{d.n}</strong> · {d.pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", colorOf(d.pct))}
                style={{ width: `${(d.n / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </div>
    </Card>
  );
}

function ReincidenciasSetores({ data }: { data: { setor: string; total: number; reinc: number; taxa: number }[] }) {
  const badge = (taxa: number) =>
    taxa > 30
      ? { txt: "ALTA", cls: "bg-destructive/10 text-destructive" }
      : taxa >= 15
      ? { txt: "MÉDIA", cls: "bg-warning/10 text-warning" }
      : { txt: "BAIXA", cls: "bg-success/10 text-success" };
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
          <Repeat className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Reincidências por Setor</h3>
          <p className="text-[11px] text-muted-foreground">Clientes com mais de uma demanda no mesmo setor</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.map((d) => {
          const b = badge(d.taxa);
          return (
            <div key={d.setor}>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="truncate text-foreground/90">{d.setor}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{d.reinc}/{d.total}</span>
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", b.cls)}>
                    {b.txt} {d.taxa}%
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    d.taxa > 30 ? "bg-destructive" : d.taxa >= 15 ? "bg-warning" : "bg-success",
                  )}
                  style={{ width: `${Math.min(100, d.taxa)}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </div>
    </Card>
  );
}

function GargalosPanel({ data }: { data: { setor: string; tipo: string; qtd: number; tempoMedio: number; foraPct: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.tempoMedio));
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Gargalos operacionais</h3>
          <p className="text-[11px] text-muted-foreground">Top 5 combinações setor × tipo com maior atraso médio</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem gargalos identificados no período.</p>
      ) : (
        <div className="divide-y divide-border">
          {data.map((d, i) => (
            <div key={`${d.setor}-${d.tipo}`} className="py-3 first:pt-0 last:pb-0 grid grid-cols-12 items-center gap-3">
              <div className="col-span-12 md:col-span-5">
                <p className="text-sm font-medium text-foreground">{d.setor}</p>
                <p className="text-[11px] text-muted-foreground">{d.tipo}</p>
              </div>
              <div className="col-span-4 md:col-span-2 text-sm tabular-nums">
                <span className="text-muted-foreground text-[11px] block">Qtd</span>
                <strong>{d.qtd}</strong>
              </div>
              <div className="col-span-4 md:col-span-2 text-sm tabular-nums">
                <span className="text-muted-foreground text-[11px] block">Tempo médio</span>
                <strong>{d.tempoMedio.toFixed(1)}d</strong>
              </div>
              <div className="col-span-4 md:col-span-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Severidade</span>
                  <span>{d.foraPct}% fora prazo</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      d.foraPct > 30 ? "bg-destructive" : d.foraPct >= 10 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${(d.tempoMedio / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
