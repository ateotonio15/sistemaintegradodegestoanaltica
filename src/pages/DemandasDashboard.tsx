import { useMemo, useRef, useState } from "react";
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
  CartesianGrid,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ApresentacaoIndicadores, { type ApresentacaoHandle } from "@/pages/ApresentacaoIndicadores";
import { useDemandas } from "@/hooks/useDemandas";
import { getStatus, parseLocalDate, type Demanda } from "@/lib/demandas-utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResumoExecutivo,
  SectionHeader,
  KpiExecutivo,
  ConcentracaoDemandas,
  MapaPressao,
  PontosAtencao,
  RecorrenciaSetor,
  GargalosTabela,
  PrioridadesAtuacao,
  VisaoComparativaSetores,
  InsightsExecutivos,
  type SetorAgg,
  type ExecTone,
  type Insight,
  type GargaloRow,
} from "@/components/demandas/exec/ExecSections";
import { SetorDrilldown, type SetorDetalhe } from "@/components/demandas/exec/SetorDrilldown";

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
  const { data: empresasVidas = [] } = useQuery({
    queryKey: ["empresas-vidas-min"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("nome,vidas");
      if (error) throw error;
      return (data ?? []) as { nome: string; vidas: number | null }[];
    },
  });



  // ===== Filtros =====
  const [dataIni, setDataIni] = useState<string>(toISO(firstDayOfMonth()));
  const [dataFim, setDataFim] = useState<string>(toISO(lastDayOfMonth()));
  const [empresa, setEmpresa] = useState<string>("__all__");
  const [executiva, setExecutiva] = useState<string>("__all__");
  const [setorFiltro, setSetorFiltro] = useState<string>("__all__");
  const [statusFiltro, setStatusFiltro] = useState<string>("__all__");
  const [tipoFiltro, setTipoFiltro] = useState<string>("__all__");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const apresentacaoRef = useRef<ApresentacaoHandle | null>(null);

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
  const setoresOpts = useMemo(
    () =>
      Array.from(new Set(demandas.map((d) => d.setor_responsavel).filter(Boolean))).sort() as string[],
    [demandas],
  );
  const tiposOpts = useMemo(
    () =>
      Array.from(new Set(demandas.map((d) => d.tipo_reclamacao).filter(Boolean))).sort() as string[],
    [demandas],
  );
  const statusOpts = ["Pendente", "Resolvida", "Finalizada"];

  /** Filtros que não dependem do período — aplicados também no período anterior. */
  const matchDimensoes = (d: Demanda) => {
    if (empresa !== "__all__" && d.empresa !== empresa) return false;
    if (executiva !== "__all__" && d.executiva !== executiva) return false;
    if (setorFiltro !== "__all__" && d.setor_responsavel !== setorFiltro) return false;
    if (tipoFiltro !== "__all__" && d.tipo_reclamacao !== tipoFiltro) return false;
    if (statusFiltro !== "__all__" && getStatus(d) !== statusFiltro) return false;
    return true;
  };

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
    return matchDimensoes(d);
  };

  const filtered = useMemo(() => demandas.filter(matchFilter), [
    demandas, dataIni, dataFim, empresa, executiva, setorFiltro, statusFiltro, tipoFiltro,
  ]);

  // ===== Métricas agregadas =====
  const computeMetrics = (list: Demanda[]) => {
    const total = list.length;
    const resolvidas = list.filter(isResolved).length;
    const emAberto = total - resolvidas;
    const noPrazo = list.filter((d) => !isForaPrazo(d)).length;
    const foraPrazo = total - noPrazo;
    const tempos = list.filter(isResolved).map(diasCorridos).filter((v) => v >= 0);
    const tempoMedioDias = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
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
  };
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);

  // ===== Período anterior (mês imediatamente anterior) =====
  const prevPeriod = useMemo(() => {
    if (!ini || !fim) return null;
    const pIni = new Date(ini.getFullYear(), ini.getMonth() - 1, ini.getDate());
    const pFim = new Date(fim.getFullYear(), fim.getMonth() - 1, fim.getDate());
    return { ini: pIni, fim: pFim };
  }, [ini, fim]);

  const prevFiltered = useMemo(() => {
    if (!prevPeriod) return [];
    return demandas.filter((d) => {
      const abertura = parseLocalDate(d.data_reclamacao);
      if (!abertura) return false;
      const resolvida = isResolved(d);
      const encerramento = resolvida ? dataFimEfetiva(d) : new Date();
      if (abertura > prevPeriod.fim) return false;
      if (encerramento < prevPeriod.ini) return false;
      return matchDimensoes(d);
    });
  }, [demandas, prevPeriod, empresa, executiva, setorFiltro, statusFiltro, tipoFiltro]);

  const prevMetrics = useMemo(
    () => (prevFiltered.length ? computeMetrics(prevFiltered) : null),
    [prevFiltered],
  );

  // ===== Série mensal 6 meses (para evolução em contexto) =====
  const monthlySeries6m = useMemo(() => {
    if (!fim) return [];
    const base = new Date(fim.getFullYear(), fim.getMonth(), 1);
    const out: { label: string; sla: number; fora: number; aberto: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const s = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      const label = s.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const arr = demandas.filter((d) => {
        if (!matchDimensoes(d)) return false;
        const x = parseLocalDate(d.data_reclamacao);
        return x && x >= s && x <= e;
      });
      const sla = arr.length ? Math.round((arr.filter((d) => !isForaPrazo(d) && isResolved(d)).length / arr.length) * 100) : 0;
      const fora = arr.length ? Math.round((arr.filter(isForaPrazo).length / arr.length) * 100) : 0;
      const aberto = arr.length ? Math.max(0, 100 - sla - fora) : 0;
      out.push({ label, sla, fora, aberto });
    }
    return out;
  }, [demandas, empresa, executiva, setorFiltro, statusFiltro, tipoFiltro, fim]);


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
      const execQtd = arr.filter((d) => d.resolvido_executiva).length;
      const setorQtd = arr.filter((d) => d.resolvido_setor && !d.resolvido_executiva).length;
      const resolvidas = execQtd + setorQtd;
      const execPct = resolvidas ? Math.round((execQtd / resolvidas) * 100) : 0;
      const temposMes = arr.filter(isResolved).map(diasCorridos);
      const tempoMedio = temposMes.length
        ? Math.round((temposMes.reduce((a, b) => a + b, 0) / temposMes.length) * 10) / 10
        : 0;
      return { label: m.label, sla, fora, aberto, execQtd, setorQtd, execPct, tempoMedio };
    });
  }, [filtered, ini, fim]);

  // ===== Resolução por origem (executiva vs. setor) =====
  const resolucaoOrigem = useMemo(() => {
    const serie = monthlySeries.slice(-6).map((m) => ({
      label: m.label,
      executiva: m.execPct,
      setor: m.execQtd + m.setorQtd ? 100 - m.execPct : 0,
      execQtd: m.execQtd,
      setorQtd: m.setorQtd,
      execPct: m.execPct,
    }));
    const atual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    const pctAtual = atual?.execPct ?? 0;
    const pctAnterior = anterior?.execPct ?? 0;
    const delta =
      anterior === undefined
        ? null
        : pctAnterior === 0
        ? pctAtual > 0
          ? 100
          : 0
        : Math.round(((pctAtual - pctAnterior) / pctAnterior) * 100);
    return {
      serie,
      pctAtual,
      delta,
      totalExec: atual?.execQtd ?? 0,
      totalMes: (atual?.execQtd ?? 0) + (atual?.setorQtd ?? 0),
    };
  }, [monthlySeries]);



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
      .map(([setor, n]) => ({
        setor,
        n,
        pct: Math.round((n / tot) * 100),
        pctExato: (n / tot) * 100,
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [filtered]);

  const volumeTipo = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((d) => {
      const t = d.tipo_reclamacao || "—";
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    const tot = filtered.length || 1;
    return Array.from(map.entries())
      .map(([tipo, n]) => ({ tipo, n, pct: Math.round((n / tot) * 100) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [filtered]);

  // ===== Ranking Empresas: Vidas vs. Reclamações =====
  const rankingEmpresasVidas = useMemo(() => {
    const norm = (s: string) => (s || "").trim().toUpperCase();
    const vidasMap = new Map<string, { nome: string; vidas: number }>();
    empresasVidas.forEach((e) => {
      const k = norm(e.nome);
      if (!k) return;
      const v = Number(e.vidas ?? 0);
      const cur = vidasMap.get(k);
      if (cur) cur.vidas += v;
      else vidasMap.set(k, { nome: e.nome, vidas: v });
    });
    const recMap = new Map<string, number>();
    filtered.forEach((d) => {
      const k = norm(d.empresa || "");
      if (!k) return;
      recMap.set(k, (recMap.get(k) ?? 0) + 1);
    });
    const rows: { empresa: string; vidas: number; reclamacoes: number; indice: number }[] = [];
    recMap.forEach((rec, k) => {
      const v = vidasMap.get(k);
      const vidas = v?.vidas ?? 0;
      const nome = v?.nome ?? k;
      const indice = vidas > 0 ? (rec / vidas) * 100 : 0;
      rows.push({ empresa: nome, vidas, reclamacoes: rec, indice });
    });
    return rows
      .sort((a, b) => b.reclamacoes - a.reclamacoes || b.indice - a.indice)
      .slice(0, 15);
  }, [filtered, empresasVidas]);





  // ===== Recorrência por setor =====
  // Taxa = clientes com mais de uma demanda no setor / total de clientes do setor.
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
      const clientesTotal = counts.size;
      const clientesRecorrentes = Array.from(counts.values()).filter((v) => v > 1).length;
      const taxa = clientesTotal ? Math.round((clientesRecorrentes / clientesTotal) * 100) : 0;
      return { setor, total: clientesTotal, reinc: clientesRecorrentes, taxa };
    });
    return list.sort((a, b) => b.taxa - a.taxa).slice(0, 8);
  }, [filtered]);

  // ===== Gargalos (setor + tipo) =====
  // Impacto = fora do prazo (45%) + tempo médio frente ao prazo do setor (35%) + share do volume (20%).
  const gargalos = useMemo<GargaloRow[]>(() => {
    const map = new Map<string, { setor: string; tipo: string; arr: Demanda[] }>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const t = d.tipo_reclamacao || "—";
      const key = `${s}||${t}`;
      const cur = map.get(key) ?? { setor: s, tipo: t, arr: [] };
      cur.arr.push(d);
      map.set(key, cur);
    });
    const totalGeral = filtered.length || 1;
    return Array.from(map.values())
      .map((v) => {
        const tempos = v.arr.filter(isResolved).map(diasCorridos);
        const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
        const foraPct = Math.round((v.arr.filter(isForaPrazo).length / v.arr.length) * 100);
        const prazoDias = (isAgendaCirurgica(v.setor) ? PRAZO_AGENDA_CIRURGICA_HORAS : PRAZO_PADRAO_HORAS) / 24;
        const tempoPct = Math.min(100, Math.round((tempoMedio / prazoDias) * 100));
        const sharePct = Math.round((v.arr.length / totalGeral) * 100);
        const impacto = Math.round(foraPct * 0.45 + tempoPct * 0.35 + Math.min(100, sharePct * 2) * 0.2);
        return { setor: v.setor, tipo: v.tipo, qtd: v.arr.length, tempoMedio, foraPct, impacto };
      })
      .sort((a, b) => b.impacto - a.impacto || b.tempoMedio - a.tempoMedio)
      .slice(0, 5);
  }, [filtered]);

  /* ========= Base executiva por setor ========= */
  const setorAgg = useMemo<SetorAgg[]>(() => {
    const map = new Map<string, Demanda[]>();
    filtered.forEach((d) => {
      const s = d.setor_responsavel || "—";
      const arr = map.get(s) ?? [];
      arr.push(d);
      map.set(s, arr);
    });
    const totalGeral = filtered.length || 1;
    const base = Array.from(map.entries()).map(([setor, arr]) => {
      const volume = arr.length;
      const foraPct = Math.round((arr.filter(isForaPrazo).length / volume) * 100);
      const slaPct = 100 - foraPct;
      const backlog = arr.filter((d) => !isResolved(d)).length;
      const tempos = arr.filter(isResolved).map(diasCorridos);
      const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
      const counts = new Map<string, number>();
      arr.forEach((d) => {
        const k = (d.nome_cliente || "").trim().toLowerCase();
        if (!k) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
      const clientesTotal = counts.size;
      const clientesRecorrentes = Array.from(counts.values()).filter((v) => v > 1).length;
      const recorrenciaPct = clientesTotal ? Math.round((clientesRecorrentes / clientesTotal) * 100) : 0;
      const prazoDias = (isAgendaCirurgica(setor) ? PRAZO_AGENDA_CIRURGICA_HORAS : PRAZO_PADRAO_HORAS) / 24;
      const backlogPct = Math.round((backlog / volume) * 100);
      const tempoPct = Math.min(100, Math.round((tempoMedio / Math.max(1, prazoDias)) * 100));
      const pressaoScore = Math.round(foraPct * 0.4 + backlogPct * 0.3 + tempoPct * 0.2 + recorrenciaPct * 0.1);
      const motivos: string[] = [];
      if (foraPct >= 15) motivos.push(`${foraPct}% das demandas fora do prazo`);
      if (backlogPct >= 25) motivos.push(`${backlog} demandas em aberto (${backlogPct}% do setor)`);
      if (tempoPct >= 100)
        motivos.push(`tempo médio de ${tempoMedio.toFixed(1)}d acima do prazo de ${prazoDias.toFixed(0)}d`);
      if (recorrenciaPct >= 30) motivos.push(`${recorrenciaPct}% dos clientes com mais de uma demanda`);
      return {
        setor,
        volume,
        pctVolume: Math.round((volume / totalGeral) * 100),
        pctVolumeExato: (volume / totalGeral) * 100,
        slaPct,
        foraPct,
        backlog,
        backlogPct,
        tempoMedio,
        prazoDias: Math.round(prazoDias),
        recorrenciaPct,
        clientesRecorrentes,
        clientesTotal,
        pressaoScore,
        motivos,
      };
    });
    const volumes = base.map((b) => b.volume).sort((a, b) => a - b);
    const mediana = volumes.length ? volumes[Math.floor(volumes.length / 2)] : 0;
    return base
      .map<SetorAgg>((b) => {
        const pressao: SetorAgg["pressao"] =
          b.volume < 3
            ? null
            : b.pressaoScore >= 60
            ? "CRÍTICA"
            : b.pressaoScore >= 40
            ? "ALTA"
            : b.pressaoScore >= 20
            ? "MODERADA"
            : "BAIXA";
        return { ...b, volumeAlto: b.volume >= mediana, pressao };
      })
      .sort((a, b) => b.pressaoScore - a.pressaoScore || b.volume - a.volume);
  }, [filtered]);

  const noPrazoQtd = useMemo(() => filtered.filter((d) => !isForaPrazo(d)).length, [filtered]);

  /* ========= Rótulos de período e comparação ========= */
  const fmtData = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");
  const periodoLabel = `Período: ${fmtData(ini)} a ${fmtData(fim)}`;
  const prevPeriodoLabel = prevPeriod
    ? `Período anterior (${fmtData(prevPeriod.ini)} a ${fmtData(prevPeriod.fim)})`
    : "Período anterior";
  const prevCurto = prevPeriod
    ? prevPeriod.ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "Período anterior";

  /** Comparação de quantidades: variação absoluta + percentual. */
  const cmpQtd = (atual: number, anterior: number | undefined | null, unidade = "") => {
    if (anterior === undefined || anterior === null) return null;
    const abs = atual - anterior;
    const pct = anterior === 0 ? null : (abs / anterior) * 100;
    return {
      anteriorLabel: prevCurto,
      anteriorValor: `${anterior}${unidade}`,
      variacao: `${abs > 0 ? "+" : ""}${abs}${unidade}${pct === null ? "" : ` (${abs > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%)`}`,
      direcao: (abs > 0 ? "up" : abs < 0 ? "down" : "flat") as "up" | "down" | "flat",
    };
  };

  /** Comparação de percentuais: diferença em pontos percentuais + variação relativa. */
  const cmpPP = (atual: number, anterior: number | undefined | null) => {
    if (anterior === undefined || anterior === null) return null;
    const pp = atual - anterior;
    const rel = anterior === 0 ? null : (pp / anterior) * 100;
    return {
      anteriorLabel: prevCurto,
      anteriorValor: `${anterior}%`,
      variacao: `${pp > 0 ? "+" : ""}${pp} p.p.${rel === null ? "" : ` (${pp > 0 ? "+" : ""}${rel.toFixed(1).replace(".", ",")}%)`}`,
      direcao: (pp > 0 ? "up" : pp < 0 ? "down" : "flat") as "up" | "down" | "flat",
    };
  };

  const backlogDeltaPP = prevMetrics ? metrics.emAberto - prevMetrics.emAberto : null;
  const backlogDeltaPct =
    prevMetrics && prevMetrics.emAberto > 0
      ? Math.round(((metrics.emAberto - prevMetrics.emAberto) / prevMetrics.emAberto) * 100)
      : null;

  /* ========= Pontos de atenção ========= */
  const pontosAtencao = useMemo(() => {
    const out: {
      titulo: string;
      valor: string;
      detalhe: string;
      tone: ExecTone;
      href?: string;
      linkLabel?: string;
    }[] = [];
    const piorSla = setorAgg.filter((s) => s.volume >= 3 && s.foraPct >= 15).sort((a, b) => b.foraPct - a.foraPct)[0];
    if (piorSla) {
      out.push({
        titulo: piorSla.setor,
        valor: `${piorSla.foraPct}% fora do prazo`,
        detalhe: `${piorSla.volume} demandas no período · tempo médio de ${piorSla.tempoMedio.toFixed(1)} dias (prazo ${piorSla.prazoDias}d).`,
        tone: piorSla.foraPct >= 40 ? "danger" : "warning",
        href: "/demandas/fora-do-prazo",
      });
    }
    const backlogAlto = setorAgg.filter((s) => s.volume >= 3 && s.backlogPct >= 40).sort((a, b) => b.backlog - a.backlog)[0];
    if (backlogAlto) {
      out.push({
        titulo: `Backlog · ${backlogAlto.setor}`,
        valor: `${backlogAlto.backlog} em aberto`,
        detalhe: `${backlogAlto.backlogPct}% das demandas do setor seguem sem resolução no período.`,
        tone: backlogAlto.backlogPct >= 60 ? "danger" : "warning",
      });
    }
    if (backlogDeltaPct !== null && Math.abs(backlogDeltaPct) >= 20) {
      out.push({
        titulo: "Evolução do backlog",
        valor: `${backlogDeltaPct > 0 ? "+" : ""}${backlogDeltaPct}%`,
        detalhe: `${metrics.emAberto} demandas em aberto contra ${prevMetrics?.emAberto ?? 0} no período anterior.`,
        tone: backlogDeltaPct > 0 ? "warning" : "success",
      });
    }
    const tempoAlto = setorAgg
      .filter((s) => s.volume >= 3 && s.tempoMedio > s.prazoDias)
      .sort((a, b) => b.tempoMedio - a.tempoMedio)[0];
    if (tempoAlto) {
      out.push({
        titulo: `Tempo médio · ${tempoAlto.setor}`,
        valor: `${tempoAlto.tempoMedio.toFixed(1)}d`,
        detalhe: `Acima do prazo de ${tempoAlto.prazoDias} dias aplicável ao setor.`,
        tone: "warning",
      });
    }
    const reinc = setorAgg.filter((s) => s.clientesTotal >= 3 && s.recorrenciaPct >= 30)[0];
    if (reinc) {
      out.push({
        titulo: `Recorrência · ${reinc.setor}`,
        valor: `${reinc.recorrenciaPct}%`,
        detalhe: `${reinc.clientesRecorrentes} de ${reinc.clientesTotal} clientes abriram mais de uma demanda no setor.`,
        tone: "warning",
      });
    }
    if (metrics.acimaDaMeta) {
      out.push({
        titulo: "Devolutivas fora do prazo",
        valor: `${metrics.pctForaDoPrazo}%`,
        detalhe: `Acima da meta interna de ${META_FORA_PRAZO}% para o período selecionado.`,
        tone: "danger",
        href: "/demandas/fora-do-prazo",
      });
    }
    return out.slice(0, 6);
  }, [setorAgg, backlogDeltaPct, metrics, prevMetrics]);

  /* ========= Prioridades de atuação ========= */
  const prioridades = useMemo(
    () =>
      setorAgg
        .filter((s) => s.pressao && s.pressao !== "BAIXA" && s.motivos.length > 0)
        .slice(0, 4)
        .map((s) => ({
          setor: s.setor,
          motivo: s.motivos.join(" · "),
          indicadores: `Volume ${s.volume} · SLA ${s.slaPct}% · backlog ${s.backlog} · tempo médio ${s.tempoMedio.toFixed(1)}d · recorrência ${s.recorrenciaPct}% · índice de pressão ${s.pressaoScore}`,
          status: s.pressao === "CRÍTICA" ? "Pressão crítica" : s.pressao === "ALTA" ? "Pressão alta" : "Pressão moderada",
          tone: (s.pressao === "CRÍTICA" ? "danger" : s.pressao === "ALTA" ? "warning" : "info") as ExecTone,
        })),
    [setorAgg],
  );

  /* ========= Insights automáticos (topo) ========= */
  const insightsExec = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const conc = volumeSetor[0];
    if (conc) {
      out.push({
        categoria: "Concentração",
        texto: `${conc.setor} concentra ${conc.pct}% das demandas do período (${conc.n} de ${filtered.length}).`,
        tone: "info",
      });
    }
    if (backlogDeltaPct !== null) {
      out.push({
        categoria: "Backlog",
        texto:
          backlogDeltaPct === 0
            ? `Backlog estável em ${metrics.emAberto} demandas em aberto na comparação com o período anterior.`
            : `Backlog apresentou ${backlogDeltaPct > 0 ? "aumento" : "redução"} de ${Math.abs(backlogDeltaPct)}% em relação ao período anterior (${metrics.emAberto} vs. ${prevMetrics?.emAberto ?? 0}).`,
        tone: backlogDeltaPct > 20 ? "warning" : backlogDeltaPct < 0 ? "success" : "neutral",
      });
    }
    if (prevMetrics) {
      const pp = metrics.slaNoPrazoPct - prevMetrics.slaNoPrazoPct;
      out.push({
        categoria: "SLA",
        texto: `SLA de ${metrics.slaNoPrazoPct}% (${noPrazoQtd} de ${filtered.length} no prazo), ${pp === 0 ? "sem variação" : `${pp > 0 ? "+" : ""}${pp} p.p.`} frente ao período anterior.`,
        tone: pp >= 0 ? "success" : "warning",
      });
    }
    const garg = gargalos[0];
    if (garg) {
      out.push({
        categoria: "Gargalo",
        texto: `${garg.setor} · ${garg.tipo} lidera o impacto operacional: ${garg.qtd} demandas, ${garg.tempoMedio.toFixed(1)}d de tempo médio e ${garg.foraPct}% fora do prazo.`,
        tone: garg.impacto >= 60 ? "danger" : "warning",
      });
    }
    const reinc = setorAgg.filter((s) => s.clientesTotal >= 3).sort((a, b) => b.recorrenciaPct - a.recorrenciaPct)[0];
    if (reinc && reinc.recorrenciaPct > 0) {
      out.push({
        categoria: "Recorrência",
        texto: `${reinc.setor} apresenta a maior taxa de recorrência: ${reinc.recorrenciaPct}% (${reinc.clientesRecorrentes} de ${reinc.clientesTotal} clientes).`,
        tone: reinc.recorrenciaPct >= 30 ? "warning" : "neutral",
      });
    }
    return out.slice(0, 5);
  }, [volumeSetor, filtered.length, backlogDeltaPct, metrics, prevMetrics, noPrazoQtd, gargalos, setorAgg]);

  /* ========= Resumo executivo ========= */
  const resumoBlocos = useMemo(() => {
    const conc = volumeSetor[0];
    const atencao =
      setorAgg.find((s) => s.pressao === "CRÍTICA") ??
      setorAgg.find((s) => s.pressao === "ALTA") ??
      null;
    const movimento =
      backlogDeltaPct !== null
        ? {
            value: `Backlog ${backlogDeltaPct === 0 ? "estável" : backlogDeltaPct > 0 ? `+${backlogDeltaPct}%` : `${backlogDeltaPct}%`}`,
            hint: `${metrics.emAberto} em aberto vs. ${prevMetrics?.emAberto ?? 0} no período anterior`,
          }
        : prevMetrics
        ? {
            value: `SLA ${metrics.slaNoPrazoPct - prevMetrics.slaNoPrazoPct > 0 ? "+" : ""}${metrics.slaNoPrazoPct - prevMetrics.slaNoPrazoPct} p.p.`,
            hint: `${metrics.slaNoPrazoPct}% agora, ${prevMetrics.slaNoPrazoPct}% no período anterior`,
          }
        : { value: "Sem base comparativa", hint: "Não há registros no período anterior" };
    return [
      {
        label: "Cenário",
        value: `${filtered.length} demandas · SLA ${metrics.slaNoPrazoPct}% · backlog ${metrics.emAberto}`,
        hint: `Tempo médio de resolução de ${metrics.tempoMedioDias.toFixed(1)} dias`,
      },
      { label: "Principal movimento", value: movimento.value, hint: movimento.hint },
      {
        label: "Principal concentração",
        value: conc ? `${conc.setor} · ${conc.pct}%` : "—",
        hint: conc ? `${conc.n} demandas do total de ${filtered.length}` : "Sem dados no período",
      },
      {
        label: "Principal ponto de atenção",
        value: atencao
          ? `${atencao.setor} · pressão ${atencao.pressao?.toLowerCase()}`
          : metrics.acimaDaMeta
          ? `Devolutivas fora do prazo em ${metrics.pctForaDoPrazo}%`
          : "Nenhum indicador fora da faixa",
        hint: atencao
          ? atencao.motivos[0] ?? `Índice de pressão ${atencao.pressaoScore}`
          : `Meta interna de devolutivas fora do prazo: ≤ ${META_FORA_PRAZO}%`,
      },
    ];
  }, [volumeSetor, setorAgg, backlogDeltaPct, metrics, prevMetrics, filtered.length]);

  const ultimaAtualizacao = useMemo(() => {
    const ts = demandas
      .map((d) => new Date(d.updated_at || d.created_at).getTime())
      .filter((n) => !Number.isNaN(n));
    if (ts.length === 0) return null;
    return new Date(Math.max(...ts)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }, [demandas]);

  /* ========= Drill-down por setor ========= */
  const [setorDrill, setSetorDrill] = useState<string | null>(null);
  const setorDetalhe = useMemo<SetorDetalhe | null>(() => {
    if (!setorDrill) return null;
    const agg = setorAgg.find((s) => s.setor === setorDrill);
    if (!agg) return null;
    const arr = filtered.filter((d) => (d.setor_responsavel || "—") === setorDrill);

    const evolucao: SetorDetalhe["evolucao"] = [];
    if (ini && fim) {
      const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
      const last = new Date(fim.getFullYear(), fim.getMonth(), 1);
      while (cur <= last) {
        const s = new Date(cur);
        const e = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const mes = arr.filter((d) => {
          const x = parseLocalDate(d.data_reclamacao);
          return x && x >= s && x <= e;
        });
        const tempos = mes.filter(isResolved).map(diasCorridos);
        evolucao.push({
          label: s.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
          volume: mes.length,
          sla: mes.length ? Math.round((mes.filter((d) => !isForaPrazo(d)).length / mes.length) * 100) : 0,
          backlog: mes.filter((d) => !isResolved(d)).length,
          tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const tipoMap = new Map<string, Demanda[]>();
    arr.forEach((d) => {
      const t = d.tipo_reclamacao || "—";
      const lista = tipoMap.get(t) ?? [];
      lista.push(d);
      tipoMap.set(t, lista);
    });
    const tipos = Array.from(tipoMap.entries())
      .map(([tipo, lista]) => ({
        tipo,
        n: lista.length,
        pct: Math.round((lista.length / arr.length) * 100),
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);

    const gargalosSetor = Array.from(tipoMap.entries())
      .map(([tipo, lista]) => {
        const tempos = lista.filter(isResolved).map(diasCorridos);
        return {
          tipo,
          qtd: lista.length,
          tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0,
          foraPct: Math.round((lista.filter(isForaPrazo).length / lista.length) * 100),
        };
      })
      .sort((a, b) => b.foraPct - a.foraPct || b.tempoMedio - a.tempoMedio)
      .slice(0, 5);

    const atrasadas = arr
      .filter((d) => !isResolved(d) && isForaPrazo(d))
      .map((d) => ({
        cliente: d.nome_cliente || "—",
        empresa: d.empresa || "—",
        tipo: d.tipo_reclamacao || "—",
        dias: diasCorridos(d),
        abertura: parseLocalDate(d.data_reclamacao)?.toLocaleDateString("pt-BR") ?? "—",
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 12);

    return { agg, evolucao, tipos, gargalos: gargalosSetor, atrasadas };
  }, [setorDrill, setorAgg, filtered, ini, fim]);

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
    setSetorFiltro("__all__");
    setStatusFiltro("__all__");
    setTipoFiltro("__all__");
    setSetorDrill(null);
  };

  const exportar = async () => {
    try {
      if (activeTab === "apresentacao") {
        if (!apresentacaoRef.current) {
          toast({ title: "Aguarde", description: "Apresentação ainda carregando.", variant: "destructive" });
          return;
        }
        toast({ title: "Gerando apresentação", description: "Capturando slides..." });
        await apresentacaoRef.current.exportPptx();
      } else {
        await exportDashboardReclamacoesPptx({
          periodo: { inicio: dataIni, fim: dataFim },
          periodoAnterior: prevPeriod
            ? { inicio: toISO(prevPeriod.ini), fim: toISO(prevPeriod.fim) }
            : null,
          filtros: {
            empresa: empresa === "__all__" ? "Todas" : empresa,
            executiva: executiva === "__all__" ? "Todas" : executiva,
          },
          metrics,
          metricsAnterior: prevMetrics,
          temposSegmentados,
          tendencias,
          monthlySeries: monthlySeries6m,
          volumeSetor,
          volumeTipo,
          rankingEmpresasVidas,
          reincidencias,
          gargalos,
          insights: insights.map((i) => i.text),
        });
      }
      toast({ title: "Apresentação gerada", description: "O arquivo .pptx foi baixado." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar PPT", description: err?.message ?? String(err), variant: "destructive" });
    }
  };

  const slaTone: ExecTone =
    metrics.slaNoPrazoPct >= 95 ? "success" : metrics.slaNoPrazoPct >= 85 ? "warning" : "danger";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-[1600px] space-y-8 px-4 py-6 lg:px-8">
        {/* ===== 1. Cabeçalho executivo ===== */}
        <header className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <Link
            to="/demandas"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar para registros
          </Link>
          <div className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">Samel</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-[28px]">
                Gestão preventiva de carteira
              </h1>
              <p className="text-sm font-medium text-muted-foreground">Inteligência de relacionamento</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Visão executiva de demandas, SLA, backlog e eficiência operacional
              </p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field label="Período — início">
                  <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
                </Field>
                <Field label="Período — fim">
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
                </Field>
                <Field label="Empresa">
                  <Select value={empresa} onValueChange={setEmpresa}>
                    <SelectTrigger className="h-9" aria-label="Filtrar por empresa"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Executiva">
                  <Select value={executiva} onValueChange={setExecutiva}>
                    <SelectTrigger className="h-9" aria-label="Filtrar por executiva"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {executivas.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Setor">
                  <Select value={setorFiltro} onValueChange={setSetorFiltro}>
                    <SelectTrigger className="h-9" aria-label="Filtrar por setor"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {setoresOpts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="h-9" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {statusOpts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo de demanda">
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger className="h-9" aria-label="Filtrar por tipo de demanda"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {tiposOpts.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {ultimaAtualizacao ? `Última atualização: ${ultimaAtualizacao}` : "Última atualização indisponível"}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8" onClick={limpar}>Limpar</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={activeTab === "dashboard" && filtered.length === 0}
                    onClick={exportar}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Exportar relatório
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Visão executiva</TabsTrigger>
            <TabsTrigger value="apresentacao">Apresentação executiva</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-8 animate-in fade-in duration-300">
            {isLoading && (
              <div className="space-y-4">
                <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <Card className="flex flex-col items-center gap-3 p-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Sem dados para o período selecionado.</h3>
                <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar os indicadores.</p>
                <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
              </Card>
            )}

            {!isLoading && filtered.length > 0 && (
              <>
                {/* ===== 2. Resumo executivo ===== */}
                <ResumoExecutivo periodoLabel={periodoLabel} blocos={resumoBlocos} />
                <InsightsExecutivos itens={insightsExec} />

                {/* ===== 3. KPIs principais ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Como está?"
                    title="Indicadores principais"
                    subtitle={`Período selecionado, comparado ao ${prevPeriodoLabel.toLowerCase()}`}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    <KpiExecutivo
                      label="Demandas no período"
                      value={String(metrics.total)}
                      comparacao={cmpQtd(metrics.total, prevMetrics?.total)}
                      descricao={`${metrics.resolvidas} resolvidas · ${metrics.emAberto} em aberto`}
                      metodologia="Demandas cuja vigência (abertura até encerramento) intersecta o período filtrado. Aumento de volume indica mais demandas recebidas, não necessariamente pior desempenho."
                    />
                    <KpiExecutivo
                      label="SLA cumprido"
                      value={`${metrics.slaNoPrazoPct}%`}
                      comparacao={cmpPP(metrics.slaNoPrazoPct, prevMetrics?.slaNoPrazoPct)}
                      descricao={`${noPrazoQtd} de ${metrics.total} demandas dentro do prazo`}
                      status={metrics.slaNoPrazoPct >= 95 ? "Saudável" : metrics.slaNoPrazoPct >= 85 ? "Atenção" : "Crítico"}
                      tone={slaTone}
                      metodologia="Prazo de 72h úteis (168h para Agenda Cirúrgica), medido sobre o total de demandas do período. Aumento do índice indica evolução."
                    />
                    <KpiExecutivo
                      label="Backlog atual"
                      value={String(metrics.emAberto)}
                      comparacao={cmpQtd(metrics.emAberto, prevMetrics?.emAberto)}
                      descricao={`${metrics.pctEmAberto}% do total ainda sem resolução${backlogDeltaPP === null ? "" : backlogDeltaPP < 0 ? ` · ${Math.abs(backlogDeltaPP)} demandas em aberto a menos que no período anterior` : backlogDeltaPP > 0 ? ` · ${backlogDeltaPP} demandas em aberto a mais que no período anterior` : ""}`}
                      status={metrics.emAberto === 0 ? "Zerado" : metrics.pctEmAberto > 30 ? "Atenção" : "Controlado"}
                      tone={metrics.emAberto === 0 ? "success" : metrics.pctEmAberto > 30 ? "warning" : "info"}
                      metodologia="Fotografia do momento: demandas do período que seguem sem resolução do setor ou da executiva. Redução significa menos demandas em aberto."
                    />
                    <KpiExecutivo
                      label="Tempo médio de resolução"
                      value={`${fmt1(metrics.tempoMedioDias)}d`}
                      comparacao={
                        prevMetrics
                          ? {
                              anteriorLabel: prevCurto,
                              anteriorValor: `${fmt1(prevMetrics.tempoMedioDias)}d`,
                              variacao: `${metrics.tempoMedioDias - prevMetrics.tempoMedioDias > 0 ? "+" : ""}${fmt1(metrics.tempoMedioDias - prevMetrics.tempoMedioDias)}d`,
                              direcao:
                                metrics.tempoMedioDias > prevMetrics.tempoMedioDias
                                  ? "up"
                                  : metrics.tempoMedioDias < prevMetrics.tempoMedioDias
                                    ? "down"
                                    : "flat",
                            }
                          : null
                      }
                      descricao={`Agenda Cirúrgica ${temposSegmentados.cirurgica.horas.toFixed(0)}h · demais setores ${temposSegmentados.demais.horas.toFixed(0)}h`}
                      metodologia="Média de dias corridos entre abertura e resolução, considerando apenas demandas já resolvidas no período."
                    />
                    <KpiExecutivo
                      label="Devolutivas fora do prazo"
                      value={`${metrics.pctForaDoPrazo}%`}
                      comparacao={cmpPP(metrics.pctForaDoPrazo, prevMetrics?.pctForaDoPrazo)}
                      descricao={`${metrics.total - noPrazoQtd} de ${metrics.total} demandas excederam o prazo`}
                      meta={{
                        texto: `≤ ${META_FORA_PRAZO}%`,
                        diferenca: `${metrics.pctForaDoPrazo - META_FORA_PRAZO > 0 ? "+" : ""}${metrics.pctForaDoPrazo - META_FORA_PRAZO} p.p.`,
                      }}
                      status={metrics.acimaDaMeta ? "Acima da meta" : "Dentro da meta"}
                      tone={metrics.acimaDaMeta ? "danger" : "success"}
                      metodologia="Percentual de demandas que excederam o prazo aplicável ao setor. Meta interna cadastrada no sistema."
                    />
                    <KpiExecutivo
                      label="Eficiência operacional"
                      value={String(metrics.score)}
                      comparacao={cmpQtd(metrics.score, prevMetrics?.score, " pts")}
                      descricao="Índice de 0 a 100 ponderando SLA, resolução, prazo e backlog"
                      status={scoreStatus === "saudavel" ? "Saudável" : scoreStatus === "atencao" ? "Atenção" : "Crítico"}
                      tone={scoreStatus === "saudavel" ? "success" : scoreStatus === "atencao" ? "warning" : "danger"}
                      metodologia="SLA (40%) + resolvidas (30%) + aderência ao prazo (20%) + backlog controlado (10%)."
                    />
                  </div>
                </section>

                {/* ===== 4. Desempenho operacional ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="O que aconteceu?"
                    title="Desempenho operacional"
                    subtitle="Evolução mensal dentro do período filtrado"
                  />
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <TrendLineCard
                      delay={0}
                      title="Evolução do SLA"
                      subtitle="% de demandas no prazo por mês"
                      icon={<Activity className="h-4 w-4" />}
                      tone="success"
                      data={monthlySeries.map((m) => ({ label: m.label, value: m.sla }))}
                      unit="%"
                      footer="Evolução mensal — difere do SLA do período, que consolida todas as demandas."
                    />
                    <TrendLineCard
                      delay={80}
                      title="Evolução do backlog"
                      subtitle="Demandas em aberto por mês de abertura"
                      icon={<Layers className="h-4 w-4" />}
                      tone="info"
                      inverse
                      data={monthlySeries.map((m) => ({ label: m.label, value: m.aberto }))}
                      footer="Distribuição mensal — o backlog atual é a soma em aberto no momento."
                    />
                    <TrendLineCard
                      delay={160}
                      title="Tempo médio de resolução"
                      subtitle="Dias corridos por mês"
                      icon={<Clock className="h-4 w-4" />}
                      tone="warning"
                      inverse
                      data={monthlySeries.map((m) => ({ label: m.label, value: m.tempoMedio }))}
                      unit="d"
                      meta={3}
                      footer="Referência: 3 dias (72h) para setores gerais."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <TrendLineCard
                      delay={0}
                      title="Devolutivas fora do prazo"
                      subtitle="% fora do prazo por mês"
                      icon={<AlertTriangle className="h-4 w-4" />}
                      tone="danger"
                      inverse
                      data={monthlySeries.map((m) => ({ label: m.label, value: m.fora }))}
                      actionHref="/demandas/fora-do-prazo"
                      actionLabel="Ver detalhes"
                      unit="%"
                      meta={META_FORA_PRAZO}
                      footer={`Meta: ≤ ${META_FORA_PRAZO}%`}
                    />
                    <div className="lg:col-span-2">
                      <ResolucaoOrigemCard delay={120} {...resolucaoOrigem} />
                    </div>
                  </div>
                </section>

                {/* ===== 5. Concentração de demandas ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Onde está concentrado?"
                    title="Concentração de demandas"
                    subtitle="Volume por setor responsável — volume alto não indica, por si só, problema"
                  />
                  <ConcentracaoDemandas data={volumeSetor} total={filtered.length} />
                </section>

                {/* ===== 6. Mapa de pressão operacional ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Onde existe pressão?"
                    title="Mapa de pressão operacional"
                    subtitle="Cruzamento de volume e impacto (prazo, backlog, tempo médio e recorrência)"
                  />
                  <MapaPressao rows={setorAgg} />
                  <MatrizRiscoSetores data={matrizSetores} />
                </section>

                {/* ===== 7. Pontos de atenção ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Onde estão os problemas?"
                    title="Pontos de atenção"
                    subtitle="Situações identificadas a partir dos indicadores do período"
                  />
                  <PontosAtencao itens={pontosAtencao} />
                </section>

                {/* ===== 8. Recorrência por setor ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Por que está acontecendo?"
                    title="Recorrência por setor"
                    subtitle="Clientes com mais de uma demanda no mesmo setor"
                  />
                  <RecorrenciaSetor rows={setorAgg.filter((s) => s.clientesTotal > 0).slice(0, 10)} />
                </section>

                {/* ===== 9. Gargalos operacionais ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Por que está acontecendo?"
                    title="Gargalos operacionais"
                    subtitle="Top 5 combinações de setor e tipo de demanda com maior impacto"
                  />
                  <GargalosTabela rows={gargalos} />
                </section>

                {/* ===== 10. Prioridades de atuação ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Onde acompanhar?"
                    title="Prioridades de atuação"
                    subtitle="Setores que merecem acompanhamento, segundo os indicadores do período"
                  />
                  <PrioridadesAtuacao itens={prioridades} />
                </section>

                {/* ===== 11. Visão comparativa dos setores ===== */}
                <section className="space-y-3">
                  <SectionHeader
                    eyebrow="Como cada setor está?"
                    title="Visão comparativa dos setores"
                    subtitle="Leitura conjunta de volume, SLA, backlog, tempo médio e recorrência"
                  />
                  <VisaoComparativaSetores rows={setorAgg} onSelect={(s) => setSetorDrill(s)} />
                  <p className="text-[11px] text-muted-foreground">
                    Dados referentes ao período selecionado. Clique em um setor para abrir o detalhamento.
                  </p>
                  <SetorDrilldown
                    detalhe={setorDetalhe}
                    periodoLabel={periodoLabel}
                    onClose={() => setSetorDrill(null)}
                  />
                </section>
              </>
            )}
          </TabsContent>


          <TabsContent value="apresentacao" className="mt-6 animate-in fade-in duration-300 -mx-4 lg:-mx-8">
            <ApresentacaoIndicadores
              ref={apresentacaoRef}
              dataIni={dataIni}
              dataFim={dataFim}
              empresa={empresa === "__all__" ? undefined : empresa}
              executiva={executiva === "__all__" ? undefined : executiva}
            />
          </TabsContent>
        </Tabs>
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

function ResolucaoOrigemCard({
  serie, pctAtual, delta, totalExec, totalMes, delay = 0,
}: {
  serie: { label: string; executiva: number; setor: number; execPct: number }[];
  pctAtual: number;
  delta: number | null;
  totalExec: number;
  totalMes: number;
  delay?: number;
}) {
  const data = serie.length === 1 ? [serie[0], { ...serie[0] }] : serie;
  const showTrend = typeof delta === "number";
  const isUp = (delta ?? 0) > 0;
  const TrendIcon = isUp ? ArrowUp : ArrowDown;
  const execColor = "#2a78d6";
  const setorColor = "#8a8a8a";

  return (
    <Card
      className="p-5 shadow-sm animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-info/10 text-info">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Resolução por Origem</p>
            <p className="text-[11px] text-muted-foreground">Executiva vs. setor / mês</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-info">{pctAtual}%</p>
          {showTrend && (
            <span className={cn(
              "inline-flex items-center text-[11px] font-semibold gap-0.5",
              isUp ? "text-success" : "text-destructive",
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(delta!)}%
            </span>
          )}
        </div>
      </div>

      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <RTooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, k: any) => [`${v}%`, k === "executiva" ? "Executiva" : "Setor"]}
            />
            <Line type="monotone" dataKey="executiva" stroke={execColor} strokeWidth={2} dot={false} name="Executiva" />
            <Line type="monotone" dataKey="setor" stroke={setorColor} strokeWidth={2} dot={false} name="Setor" />
          </LineChart>
        </ResponsiveContainer>
      </div>


      <div className="mt-2 flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-4 rounded-full" style={{ background: execColor }} /> Executiva
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-4 rounded-full" style={{ background: setorColor }} /> Setor
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {totalMes > 0
            ? `${pctAtual}% das demandas dependeram de decisão direta da executiva neste mês (${totalExec} de ${totalMes}).`
            : "Sem demandas resolvidas no mês atual."}
        </p>
        <Link
          to="/demandas"
          className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Ver detalhes →
        </Link>
      </div>
    </Card>
  );
}
