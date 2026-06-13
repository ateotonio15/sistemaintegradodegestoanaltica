import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceiroRealtime } from "@/hooks/useFinanceiroRealtime";
import {
  calcularStatusFinanceiro,
  formatMesReferencia,
  getCurrentMesReferencia,
  getMesesOptions,
  isPdfAnexo,
  isXlsAnexo,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

type Row = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  empresa_codigo: string | null;
  periodo: string;
  tipo_cobranca: string | null;
  responsavel: string | null;
  status: StatusFinanceiro;
  data_envio_nota: string | null;
  faturamento_iniciado_em: string | null;
  aguardando_nota_em: string | null;
  updated_at: string;
};

function tempoDesde(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ${diffMin % 60}min`;
  const dias = Math.floor(h / 24);
  return `${dias}d ${h % 24}h`;
}

const STATUS_ORDER: StatusFinanceiro[] = [
  "Pendente",
  "Aguardando nota",
  "Em faturamento",
  "Nota emitida",
  "Enviada",
  "Faturado",
];

const STATUS_COLORS: Record<string, string> = {
  Pendente: "#94a3b8",
  "Aguardando nota": "#f59e0b",
  "Em faturamento": "#3b82f6",
  "Nota emitida": "#a855f7",
  Enviada: "#10b981",
  Faturado: "#06b6d4",
  "Aguardando validação": "#d946ef",
  "Fora do prazo": "#ef4444",
};

export default function PainelTvFinanceiro() {
  const navigate = useNavigate();
  const { user, role, isAdmin, isFinanceiro } = useAuth();
  const podeVer = isAdmin || isFinanceiro || role === "diretora";

  const [mes, setMes] = useState<string>(getCurrentMesReferencia());
  const [selectedList, setSelectedList] = useState<"aguardando" | "notas" | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useFinanceiroRealtime({ enabled: !!user && podeVer, mesReferencia: mes });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setTvMode(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setTvMode(false);
    }
  };

  const { data: fin = [], isLoading, refetch } = useQuery({
    queryKey: ["tv-financeiro-mov", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("*")
        .eq("mes_referencia", mes);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && podeVer,
    refetchInterval: 15000,
  });

  const empresaIds = useMemo(
    () => Array.from(new Set(fin.map((f: any) => f.empresa_id))),
    [fin],
  );
  const movIds = useMemo(() => fin.map((f: any) => f.id), [fin]);

  const { data: empresasMap = {} } = useQuery({
    queryKey: ["tv-fin-empresas", empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, exige_po_pc")
        .in("id", empresaIds);
      if (error) throw error;
      const m: Record<string, any> = {};
      (data || []).forEach((e: any) => (m[e.id] = e));
      return m;
    },
  });

  const { data: anexosMap = {} } = useQuery({
    queryKey: ["tv-fin-anexos", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("financeiro_movimentacao_id, mime_type, nome_arquivo, origem")
        .in("financeiro_movimentacao_id", movIds);
      if (error) throw error;
      const m: Record<string, any[]> = {};
      (data || []).forEach((a: any) => {
        if (a.origem === "retroativo") return;
        if (!m[a.financeiro_movimentacao_id]) m[a.financeiro_movimentacao_id] = [];
        m[a.financeiro_movimentacao_id].push(a);
      });
      return m;
    },
  });

  const { data: envioOpMap = {} } = useQuery({
    queryKey: ["tv-fin-envio-op", mes, empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, data_envio_financeiro")
        .eq("mes_referencia", mes)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const m: Record<string, boolean> = {};
      (data || []).forEach((r: any) => {
        if (r.data_envio_financeiro) m[`${r.empresa_id}|${r.periodo}`] = true;
      });
      return m;
    },
  });

  useEffect(() => {
    setLastUpdate(Date.now());
  }, [fin, anexosMap, envioOpMap]);

  const rows: Row[] = useMemo(() => {
    return (fin as any[]).map((f) => {
      const emp = (empresasMap as any)[f.empresa_id];
      const anexos = (anexosMap as any)[f.id] || [];
      const envioOp = !!(envioOpMap as any)[`${f.empresa_id}|${f.periodo}`];
      const status = calcularStatusFinanceiro(
        f,
        envioOp,
        anexos,
        !!emp?.exige_po_pc,
      );
      return {
        id: f.id,
        empresa_id: f.empresa_id,
        empresa_nome: emp?.nome || "—",
        empresa_codigo: emp?.codigo_contrato ?? null,
        periodo: f.periodo,
        tipo_cobranca: f.tipo_cobranca,
        responsavel: f.responsavel,
        status,
        data_envio_nota: f.data_envio_nota,
        faturamento_iniciado_em: f.faturamento_iniciado_em,
        aguardando_nota_em: f.aguardando_nota_em,
        updated_at: f.updated_at,
      };
    });
  }, [fin, empresasMap, anexosMap, envioOpMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      total: rows.length,
      Pendente: 0,
      "Aguardando nota": 0,
      "Em faturamento": 0,
      "Nota emitida": 0,
      Enviada: 0,
      Faturado: 0,
    };
    rows.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [rows]);

  const concluidas = counts.Enviada + counts.Faturado;
  const pctConcluidas = counts.total > 0 ? Math.round((concluidas / counts.total) * 100) : 0;
  const emAndamento = counts["Aguardando nota"] + counts["Em faturamento"] + counts["Nota emitida"];
  const pendentes = counts.Pendente;

  // Pie data — apenas status com valor
  const pieData = STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => ({
    name: s,
    value: counts[s],
    color: STATUS_COLORS[s],
  }));

  // Bar data — funil de progresso
  const funilData = STATUS_ORDER.map((s) => ({
    nome: s,
    quantidade: counts[s],
    fill: STATUS_COLORS[s],
  }));

  // Radial — % concluídas
  const radialData = [{ name: "Concluídas", value: pctConcluidas, fill: "#10b981" }];

  // Top responsáveis (Em faturamento + Aguardando nota + Nota emitida)
  const topResponsaveis = useMemo(() => {
    const map = new Map<string, number>();
    rows
      .filter((r) => r.status === "Em faturamento" || r.status === "Aguardando nota" || r.status === "Nota emitida")
      .forEach((r) => {
        const k = r.responsavel || "Sem responsável";
        map.set(k, (map.get(k) || 0) + 1);
      });
    return Array.from(map.entries())
      .map(([nome, q]) => ({ nome, quantidade: q }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [rows]);

  const notasAguardandoEnvio = rows.filter((r) => r.status === "Nota emitida");
  const emFaturamento = rows.filter((r) => r.status === "Em faturamento");
  const aguardandoEmissao = rows.filter((r) => r.status === "Aguardando nota");

  void now;

  if (!podeVer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao setor financeiro.</p>
      </div>
    );
  }

  const hora = new Date(lastUpdate).toLocaleTimeString("pt-BR");

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground",
        tvMode && "fixed inset-0 z-50 overflow-auto",
      )}
    >
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {!tvMode && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Painel Financeiro em Tempo Real
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Atualizando em tempo real · Competência {formatMesReferencia(mes)} · Última
                atualização {hora}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMesesOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMesReferencia(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {tvMode ? (
                <><Minimize2 className="h-4 w-4 mr-1" /> Sair</>
              ) : (
                <><Maximize2 className="h-4 w-4 mr-1" /> Modo TV</>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 md:p-8 space-y-8 max-w-[1800px] mx-auto">
        {/* HEROES — 4 KPIs grandes */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <HeroKpi
            label="Total da competência"
            value={counts.total}
            icon={TrendingUp}
            tone="neutral"
            hint={`${concluidas} concluídas · ${pctConcluidas}%`}
          />
          <HeroKpi
            label="Pendentes"
            value={pendentes}
            icon={Clock}
            tone="muted"
            hint={counts.total > 0 ? `${Math.round((pendentes / counts.total) * 100)}% do total` : undefined}
          />
          <HeroKpi
            label="Aguardando emissão"
            value={aguardandoEmissao.length}
            icon={TimerReset}
            tone="amber"
            hint="Operacional enviou — emitir nota"
            selectable
            selected={selectedList === "aguardando"}
            onClick={() =>
              setSelectedList((s) => (s === "aguardando" ? null : "aguardando"))
            }
          />
          <HeroKpi
            label="Notas — enviar ao cliente"
            value={counts["Nota emitida"]}
            icon={Send}
            tone="purple"
            hint="Prontas para envio"
            pulse={counts["Nota emitida"] > 0}
            selectable
            selected={selectedList === "notas"}
            onClick={() =>
              setSelectedList((s) => (s === "notas" ? null : "notas"))
            }
          />
        </section>

        {/* LISTA SELECIONADA */}
        {selectedList === "aguardando" && (
          <section>
            <ListaCard
              title="Aguardando emissão"
              subtitle="Operacional já enviou — emitir nota fiscal"
              accent="yellow"
              icon={TimerReset}
              rows={aguardandoEmissao}
              renderRow={(r, i) => (
                <RowItem
                  key={r.id}
                  index={i}
                  title={r.empresa_nome}
                  subtitle={`${r.empresa_codigo || "—"} · ${r.periodo}${r.responsavel ? ` · ${r.responsavel}` : ""}`}
                  badgeText="Emitir"
                  badgeClass="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30"
                  timeText={tempoDesde(r.aguardando_nota_em || r.updated_at)}
                  accentDot="bg-yellow-500"
                />
              )}
              empty="Nenhuma empresa aguardando emissão 🎉"
            />
          </section>
        )}

        {selectedList === "notas" && (
          <section>
            <ListaCard
              title="Notas emitidas — enviar"
              subtitle="Prontas aguardando envio ao cliente"
              accent="purple"
              icon={Send}
              rows={notasAguardandoEnvio}
              renderRow={(r, i) => (
                <RowItem
                  key={r.id}
                  index={i}
                  title={r.empresa_nome}
                  subtitle={`${r.empresa_codigo || "—"} · ${r.periodo}`}
                  badgeText="Enviar"
                  badgeClass="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  timeText={tempoDesde(r.updated_at)}
                  accentDot="bg-purple-500"
                />
              )}
              empty="Nenhuma nota aguardando envio 🎉"
            />
          </section>
        )}

        {selectedList === null && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Selecione um dos cards acima para ver os detalhes.
          </div>
        )}

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        )}
      </main>
    </div>
  );
}

function RowItem({
  index,
  title,
  subtitle,
  badgeText,
  badgeClass,
  timeText,
  accentDot,
}: {
  index: number;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeClass: string;
  timeText: string;
  accentDot: string;
}) {
  return (
    <div className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-mono font-semibold text-muted-foreground tabular-nums w-6 text-right">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={cn("h-8 w-1 rounded-full shrink-0", accentDot)} />
        <div className="min-w-0">
          <div className="font-semibold truncate leading-tight">{title}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <Badge className={cn("font-medium", badgeClass)}>{badgeText}</Badge>
        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">{timeText}</div>
      </div>
    </div>
  );
}

function HeroKpi({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  pulse,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "neutral" | "muted" | "blue" | "purple" | "amber";
  hint?: string;
  pulse?: boolean;
}) {
  const toneMap = {
    neutral: {
      bg: "from-emerald-500/10 via-card to-card",
      iconWrap: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      value: "text-foreground",
      ring: "ring-emerald-500/20",
    },
    muted: {
      bg: "from-slate-500/10 via-card to-card",
      iconWrap: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
      value: "text-foreground",
      ring: "ring-slate-500/20",
    },
    blue: {
      bg: "from-blue-500/10 via-card to-card",
      iconWrap: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      value: "text-blue-700 dark:text-blue-300",
      ring: "ring-blue-500/20",
    },
    amber: {
      bg: "from-amber-500/10 via-card to-card",
      iconWrap: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-500/20",
    },
    purple: {
      bg: "from-purple-500/10 via-card to-card",
      iconWrap: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
      value: "text-purple-700 dark:text-purple-300",
      ring: "ring-purple-500/20",
    },
  };
  const t = toneMap[tone];
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 bg-gradient-to-br border border-border/60 shadow-sm hover:shadow-md transition-all",
        t.bg,
        "ring-1",
        t.ring,
        pulse && "ring-2 ring-purple-400/70 shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.iconWrap)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className={cn("text-5xl md:text-6xl font-bold tabular-nums leading-none tracking-tight", t.value)}>
        {value}
      </div>
      {hint && (
        <div className="mt-3 text-xs text-muted-foreground font-medium">{hint}</div>
      )}
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
        </span>
      )}
    </Card>
  );
}

function ListaCard<T>({
  title,
  subtitle,
  accent,
  icon: Icon,
  rows,
  renderRow,
  empty,
}: {
  title: string;
  subtitle?: string;
  accent: "purple" | "blue" | "yellow";
  icon: any;
  rows: T[];
  renderRow: (r: T, index: number) => React.ReactNode;
  empty: string;
}) {
  const accentMap = {
    purple: {
      stripe: "bg-gradient-to-b from-purple-500 to-purple-500/30",
      iconWrap: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
      badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    },
    blue: {
      stripe: "bg-gradient-to-b from-blue-500 to-blue-500/30",
      iconWrap: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
      badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    yellow: {
      stripe: "bg-gradient-to-b from-yellow-500 to-yellow-500/30",
      iconWrap: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-300",
      badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    },
  };
  const a = accentMap[accent];
  return (
    <Card className="relative flex flex-col overflow-hidden border border-border/60 shadow-sm">
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", a.stripe)} aria-hidden />
      <div className="p-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", a.iconWrap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Badge variant="secondary" className={cn("text-base font-bold tabular-nums px-3 py-1", a.badge)}>
            {rows.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 px-4">{empty}</div>
          ) : (
            rows.map((r, i) => renderRow(r, i))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
