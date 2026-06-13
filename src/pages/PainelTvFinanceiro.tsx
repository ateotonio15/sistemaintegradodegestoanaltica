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
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  anexos_count: number;
  tem_pdf: boolean;
  tem_xls: boolean;
  exige_po_pc: boolean;
  divergente: boolean;
  dentro_prazo: boolean | null;
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

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  Pendente: { label: "Pendentes", color: "bg-muted text-foreground", icon: Clock },
  "Aguardando nota": {
    label: "Aguardando emissão",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    icon: TimerReset,
  },
  "Em faturamento": {
    label: "Em faturamento",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
    icon: Activity,
  },
  "Nota emitida": {
    label: "Nota emitida — enviar",
    color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30",
    icon: Send,
  },
  Enviada: {
    label: "Enviadas",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    icon: CheckCircle2,
  },
  Faturado: {
    label: "Faturadas",
    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30",
    icon: CheckCircle2,
  },
  "Aguardando validação": {
    label: "Validação PO/PC",
    color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30",
    icon: FileText,
  },
  "Fora do prazo": {
    label: "Fora do prazo",
    color: "bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30",
    icon: AlertTriangle,
  },
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

  // tick a cada 30s para atualizar "tempo no status"
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // fullscreen toggle
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setTvMode(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setTvMode(false);
    }
  };

  // fetch financeiro_movimentacoes + empresas + analises + anexos + envio operacional
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

  const { data: analiseStatusMap = {} } = useQuery({
    queryKey: ["tv-fin-analise", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_analises")
        .select("financeiro_movimentacao_id, status_analise")
        .in("financeiro_movimentacao_id", movIds);
      if (error) throw error;
      const m: Record<string, boolean> = {};
      (data || []).forEach((r: any) => {
        const s = String(r.status_analise || "").toLowerCase();
        if (s === "divergente" || s === "divergencia" || s === "divergência") {
          m[r.financeiro_movimentacao_id] = true;
        }
      });
      return m;
    },
  });

  useEffect(() => {
    setLastUpdate(Date.now());
  }, [fin, anexosMap, envioOpMap, analiseStatusMap]);

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
        anexos_count: anexos.length,
        tem_pdf: anexos.some(isPdfAnexo),
        tem_xls: anexos.some(isXlsAnexo),
        exige_po_pc: !!emp?.exige_po_pc,
        divergente: !!(analiseStatusMap as any)[f.id],
        dentro_prazo: f.dentro_prazo,
      };
    });
  }, [fin, empresasMap, anexosMap, envioOpMap, analiseStatusMap]);

  const counts = useMemo(() => {
    const c = {
      total: rows.length,
      pendente: 0,
      aguardando_nota: 0,
      em_faturamento: 0,
      nota_emitida: 0,
      enviada: 0,
      faturado: 0,
      validacao: 0,
      fora_prazo: 0,
      divergente: 0,
      sem_excel: 0,
      sem_pdf: 0,
    };
    rows.forEach((r) => {
      if (r.status === "Pendente") c.pendente++;
      if (r.status === "Aguardando nota") c.aguardando_nota++;
      if (r.status === "Em faturamento") c.em_faturamento++;
      if (r.status === "Nota emitida") c.nota_emitida++;
      if (r.status === "Enviada") c.enviada++;
      if (r.status === "Faturado") c.faturado++;
      if (r.status === "Aguardando validação") c.validacao++;
      if (r.status === "Fora do prazo") c.fora_prazo++;
      if (r.divergente) c.divergente++;
      if (!r.tem_xls) c.sem_excel++;
      if (!r.tem_pdf) c.sem_pdf++;
    });
    return c;
  }, [rows]);

  const emFaturamento = rows.filter((r) => r.status === "Em faturamento");
  const notasAguardandoEnvio = rows.filter((r) => r.status === "Nota emitida");
  const foraPrazo = rows.filter((r) => r.status === "Fora do prazo");
  const divergentes = rows.filter((r) => r.divergente);

  void now; // referenced for re-render of tempo

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
      {/* HEADER */}
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
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar agora
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {tvMode ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-1" /> Sair
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-1" /> Modo TV
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <KpiCard label="Total" value={counts.total} icon={TrendingUp} color="bg-foreground/5" />
          <KpiCard
            label="Pendentes"
            value={counts.pendente}
            total={counts.total}
            icon={Clock}
            color="bg-muted"
          />
          <KpiCard
            label="Aguardando emissão"
            value={counts.aguardando_nota}
            total={counts.total}
            icon={TimerReset}
            color="bg-amber-500/15 text-amber-700 dark:text-amber-300"
          />
          <KpiCard
            label="Em faturamento"
            value={counts.em_faturamento}
            total={counts.total}
            icon={Activity}
            color="bg-blue-500/15 text-blue-700 dark:text-blue-300"
          />
          <KpiCard
            label="Nota emitida — enviar"
            value={counts.nota_emitida}
            total={counts.total}
            icon={Send}
            color="bg-purple-500/15 text-purple-700 dark:text-purple-300"
            highlight={counts.nota_emitida > 0}
          />
          <KpiCard
            label="Enviadas"
            value={counts.enviada}
            total={counts.total}
            icon={CheckCircle2}
            color="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          />
          <KpiCard
            label="Fora do prazo"
            value={counts.fora_prazo}
            total={counts.total}
            icon={AlertTriangle}
            color="bg-red-500/15 text-red-600 dark:text-red-300"
          />
          <KpiCard
            label="Divergentes"
            value={counts.divergente}
            total={counts.total}
            icon={AlertTriangle}
            color="bg-red-500/15 text-red-600 dark:text-red-300"
          />
          <KpiCard
            label="Validação PO/PC"
            value={counts.validacao}
            total={counts.total}
            icon={FileText}
            color="bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300"
          />
          <KpiCard
            label="Faturadas"
            value={counts.faturado}
            total={counts.total}
            icon={CheckCircle2}
            color="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
          />
          <KpiCard
            label="Sem Excel"
            value={counts.sem_excel}
            total={counts.total}
            icon={FileSpreadsheet}
            color="bg-orange-500/10 text-orange-700 dark:text-orange-300"
          />
          <KpiCard
            label="Sem PDF"
            value={counts.sem_pdf}
            total={counts.total}
            icon={FileText}
            color="bg-orange-500/10 text-orange-700 dark:text-orange-300"
          />
        </section>

        {/* COLUNAS */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ListaCard
            title="Notas emitidas — enviar para empresa"
            subtitle="Nota pronta aguardando envio ao cliente"
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
            title="Empresas em faturamento"
            subtitle="Faturamento iniciado e em andamento"
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
                    Em faturamento
                  </Badge>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {tempoDesde(r.faturamento_iniciado_em || r.updated_at)}
                  </div>
                </div>
              </div>
            )}
            empty="Nenhuma empresa em faturamento agora."
          />

          <ListaCard
            title="Alertas"
            subtitle="Fora do prazo, divergências e pendências críticas"
            accent="red"
            icon={AlertTriangle}
            rows={[...foraPrazo, ...divergentes.filter((d) => !foraPrazo.some((f) => f.id === d.id))]}
            renderRow={(r) => {
              const motivo = r.status === "Fora do prazo"
                ? "Fora do prazo"
                : r.divergente
                ? "Divergência na análise"
                : r.status;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.empresa_nome}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.empresa_codigo || "—"} · {r.periodo} · {motivo}
                    </div>
                  </div>
                  <Badge className="bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 shrink-0">
                    Atenção
                  </Badge>
                </div>
              );
            }}
            empty="Sem alertas no momento."
          />
        </section>

        {/* Pendências documentais */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ListaCard
            title="Sem Excel"
            subtitle="Pendência documental — falta planilha"
            accent="orange"
            icon={FileSpreadsheet}
            rows={rows.filter((r) => !r.tem_xls && r.status !== "Enviada")}
            renderRow={(r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 text-sm">
                <span className="truncate">{r.empresa_nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{r.periodo}</span>
              </div>
            )}
            empty="Todas com Excel anexado."
          />
          <ListaCard
            title="Sem PDF"
            subtitle="Pendência documental — falta nota fiscal"
            accent="orange"
            icon={FileText}
            rows={rows.filter((r) => !r.tem_pdf && r.status !== "Enviada")}
            renderRow={(r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 text-sm">
                <span className="truncate">{r.empresa_nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{r.periodo}</span>
              </div>
            )}
            empty="Todas com PDF anexado."
          />
        </section>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  total,
  icon: Icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  total?: number;
  icon: any;
  color: string;
  highlight?: boolean;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <Card
      className={cn(
        "p-4 transition-all",
        color,
        highlight && value > 0 && "ring-2 ring-purple-400/60 animate-pulse",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold">{value}</span>
        {pct !== null && (
          <span className="text-xs opacity-70">/ {total} · {pct}%</span>
        )}
      </div>
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
  accent: "purple" | "blue" | "red" | "orange";
  icon: any;
  rows: T[];
  renderRow: (r: T) => React.ReactNode;
  empty: string;
}) {
  const accentMap = {
    purple: "border-l-4 border-purple-500",
    blue: "border-l-4 border-blue-500",
    red: "border-l-4 border-red-500",
    orange: "border-l-4 border-orange-500",
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
