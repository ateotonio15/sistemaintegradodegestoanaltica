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

      <main className="p-6 space-y-6">
        {/* HEROES — 4 KPIs grandes */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroKpi label="Total competência" value={counts.total} icon={TrendingUp} tone="neutral" />
          <HeroKpi label="Pendentes" value={pendentes} icon={Clock} tone="muted" />
          <HeroKpi label="Aguardando emissão" value={emAndamento} icon={Activity} tone="blue" />
          <HeroKpi
            label="Notas — enviar ao cliente"
            value={counts["Nota emitida"]}
            icon={Send}
            tone="purple"
            pulse={counts["Nota emitida"] > 0}
          />
        </section>

        {/* GRÁFICOS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Radial concluídas */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Progresso da competência</h2>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="h-[260px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={12} fill="#10b981" />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                  {pctConcluidas}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {concluidas} de {counts.total} concluídas
                </span>
              </div>
            </div>
          </Card>

          {/* Pie distribuição */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Distribuição por status</h2>
            </div>
            <div className="h-[260px]">
              {pieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconType="circle"
                      layout="horizontal"
                      verticalAlign="bottom"
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Funil bar */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Funil de faturamento</h2>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funilData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[0, 6, 6, 0]}>
                    {funilData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* RANKING + LISTAS PRINCIPAIS */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Ranking — operação ativa</h2>
              <Badge variant="secondary">{topResponsaveis.reduce((a, b) => a + b.quantidade, 0)}</Badge>
            </div>
            {topResponsaveis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem operação ativa.</p>
            ) : (
              <div className="space-y-3">
                {topResponsaveis.map((r) => {
                  const max = topResponsaveis[0].quantidade || 1;
                  const pct = (r.quantidade / max) * 100;
                  return (
                    <div key={r.nome}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate font-medium">{r.nome}</span>
                        <span className="text-muted-foreground tabular-nums">{r.quantidade}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <ListaCard
            title="Notas emitidas — enviar"
            subtitle="Prontas aguardando envio ao cliente"
            accent="purple"
            icon={Send}
            rows={notasAguardandoEnvio}
            renderRow={(r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.empresa_nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.empresa_codigo || "—"} · {r.periodo}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                    Enviar
                  </Badge>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {tempoDesde(r.updated_at)}
                  </div>
                </div>
              </div>
            )}
            empty="Nenhuma nota aguardando envio 🎉"
          />

          <ListaCard
            title="Em faturamento"
            subtitle="Processo iniciado e em andamento"
            accent="blue"
            icon={Activity}
            rows={emFaturamento}
            renderRow={(r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.empresa_nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.empresa_codigo || "—"} · {r.periodo}
                    {r.responsavel ? ` · ${r.responsavel}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    Ativo
                  </Badge>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {tempoDesde(r.faturamento_iniciado_em || r.updated_at)}
                  </div>
                </div>
              </div>
            )}
            empty="Nenhuma empresa em faturamento agora."
          />
        </section>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        )}
      </main>
    </div>
  );
}

function HeroKpi({
  label,
  value,
  icon: Icon,
  tone,
  pulse,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "neutral" | "muted" | "blue" | "purple";
  pulse?: boolean;
}) {
  const toneMap = {
    neutral: "from-foreground/5 to-foreground/0",
    muted: "from-slate-400/10 to-slate-400/0",
    blue: "from-blue-500/15 to-blue-500/0 text-blue-700 dark:text-blue-300",
    purple: "from-purple-500/15 to-purple-500/0 text-purple-700 dark:text-purple-300",
  };
  return (
    <Card
      className={cn(
        "p-5 bg-gradient-to-br border-0 shadow-sm",
        toneMap[tone],
        pulse && "ring-2 ring-purple-400/60 animate-pulse",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</span>
        <Icon className="h-5 w-5 opacity-70" />
      </div>
      <div className="text-5xl font-bold tabular-nums">{value}</div>
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
  accent: "purple" | "blue";
  icon: any;
  rows: T[];
  renderRow: (r: T) => React.ReactNode;
  empty: string;
}) {
  const accentMap = {
    purple: "border-l-4 border-purple-500",
    blue: "border-l-4 border-blue-500",
  };
  return (
    <Card className={cn("flex flex-col", accentMap[accent])}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <h2 className="font-semibold text-lg">{title}</h2>
          <Badge variant="secondary" className="ml-auto">{rows.length}</Badge>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <ScrollArea className="h-[360px]">
        <div className="p-4 pt-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
          ) : (
            rows.map(renderRow)
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
