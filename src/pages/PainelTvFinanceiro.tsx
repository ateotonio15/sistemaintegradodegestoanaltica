import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  PERIODOS_FIN,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CalendarRange, Check, ChevronDown, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  User as UserIcon,
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
  faturamento_iniciado_por_nome: string | null;
  enviado_por_nome: string | null;
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

  // Seleção: { mes_referencia: [periodos...] }. Periodos = subset de PERIODOS_FIN.
  const [selections, setSelections] = useState<Record<string, string[]>>(() => ({
    [getCurrentMesReferencia()]: [...PERIODOS_FIN],
  }));
  const mesesSelecionados = useMemo(
    () => Object.keys(selections).filter((m) => selections[m]?.length > 0).sort(),
    [selections],
  );
  const selectionKey = useMemo(
    () => mesesSelecionados.map((m) => `${m}:${selections[m].join(",")}`).join("|"),
    [mesesSelecionados, selections],
  );
  const mesPrincipal = mesesSelecionados[0] || getCurrentMesReferencia();

  type ListKey = "aguardando" | "notas" | "faturamento";
  // Ordem manual das listas selecionadas (suporta drag-and-drop)
  const [listOrder, setListOrder] = useState<ListKey[]>([]);
  const selectedLists = useMemo(() => new Set(listOrder), [listOrder]);
  const toggleList = (k: ListKey) =>
    setListOrder((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  const [dragKey, setDragKey] = useState<ListKey | null>(null);
  const [sortDirs, setSortDirs] = useState<Record<ListKey, "desc" | "asc">>({
    aguardando: "desc",
    notas: "desc",
    faturamento: "desc",
  });
  const toggleSort = (k: ListKey) =>
    setSortDirs((prev) => ({ ...prev, [k]: prev[k] === "desc" ? "asc" : "desc" }));
  const moveList = (from: ListKey, to: ListKey) => {
    if (from === to) return;
    setListOrder((prev) => {
      const arr = [...prev];
      const fi = arr.indexOf(from);
      const ti = arr.indexOf(to);
      if (fi < 0 || ti < 0) return prev;
      arr.splice(fi, 1);
      arr.splice(ti, 0, from);
      return arr;
    });
  };
  // Layout preset — sempre completa as linhas (sem cards "pela metade") em qualquer combinação.
  type LayoutMode = "cols" | "stacked" | "two-one" | "one-two" | "side";
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("cols");
  // Retorna spans em colunas de 12 para cada card, na ordem atual.
  const computeSpans = (order: ListKey[], mode: LayoutMode): number[] => {
    const n = order.length;
    if (n === 0) return [];
    if (n === 1) return [12];
    if (n === 2) return mode === "stacked" ? [12, 12] : [6, 6];
    if (mode === "stacked") return [12, 12, 12];
    if (mode === "two-one") return [8, 4, 12];
    if (mode === "one-two") return [12, 8, 4];
    return [4, 4, 4];
  };
  const [tvMode, setTvMode] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const qc = useQueryClient();
  useFinanceiroRealtime({ enabled: !!user && podeVer, mesReferencia: mesPrincipal });

  // Realtime dedicado do Painel TV: invalida queries "tv-*" sempre que
  // alguma tabela relevante muda, garantindo atualização ao vivo
  // (faturamento iniciado, anexos enviados, novas empresas/movimentações etc.)
  useEffect(() => {
    if (!user || !podeVer) return;
    const tables = [
      "financeiro_movimentacoes",
      "anexos_financeiro",
      "movimentacoes",
      "anexos_movimentacao",
      "empresas",
      "financeiro_pagadores",
    ];
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["tv-financeiro-mov"] });
        qc.invalidateQueries({ queryKey: ["tv-fin-empresas"] });
        qc.invalidateQueries({ queryKey: ["tv-fin-anexos"] });
        qc.invalidateQueries({ queryKey: ["tv-fin-envio-op"] });
        setLastUpdate(Date.now());
      }, 400);
    };
    const channel = supabase.channel(`painel-tv-financeiro-${mesPrincipal}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        trigger,
      );
    });
    channel.subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [user, podeVer, mesPrincipal]);

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

  const { data: finRaw = [], isLoading, refetch } = useQuery({
    queryKey: ["tv-financeiro-mov", selectionKey],
    queryFn: async () => {
      if (mesesSelecionados.length === 0) return [];
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("*")
        .in("mes_referencia", mesesSelecionados);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && podeVer && mesesSelecionados.length > 0,
    refetchInterval: 15000,
  });

  // Filtra rows pelos periodos escolhidos dentro de cada competência
  const fin = useMemo(
    () =>
      (finRaw as any[]).filter((f) =>
        (selections[f.mes_referencia] || []).includes(f.periodo),
      ),
    [finRaw, selections],
  );

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
        .select("financeiro_movimentacao_id, mime_type, nome_arquivo, origem, uploaded_by, created_at")
        .in("financeiro_movimentacao_id", movIds)
        .order("created_at", { ascending: false });
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

  // Mapa: para cada movimentação, o user_id de quem anexou o PDF mais recente
  const pdfUploaderByMov = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(anexosMap as Record<string, any[]>).forEach(([movId, list]) => {
      const pdf = list.find(
        (a) =>
          a.uploaded_by &&
          ((a.mime_type || "").toLowerCase().includes("pdf") ||
            (a.nome_arquivo || "").toLowerCase().endsWith(".pdf")),
      );
      if (pdf) map[movId] = pdf.uploaded_by;
    });
    return map;
  }, [anexosMap]);

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(pdfUploaderByMov).forEach((id) => id && ids.add(id));
    (fin as any[]).forEach((f) => {
      if (f.faturamento_iniciado_por) ids.add(f.faturamento_iniciado_por);
    });
    return Array.from(ids);
  }, [pdfUploaderByMov, fin]);

  const { data: profileNameMap = {} } = useQuery({
    queryKey: ["tv-fin-profiles", profileIds.sort().join(",")],
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", profileIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        m[p.user_id] = p.display_name || p.username || "—";
      });
      return m;
    },
  });

  const { data: envioOpMap = {} } = useQuery({
    queryKey: ["tv-fin-envio-op", selectionKey, empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0 && mesesSelecionados.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
        .in("mes_referencia", mesesSelecionados)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const m: Record<string, boolean> = {};
      (data || []).forEach((r: any) => {
        if (r.data_envio_financeiro) m[`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`] = true;
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
      const envioOp = !!(envioOpMap as any)[`${f.empresa_id}|${f.mes_referencia}|${f.periodo}`];
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
        faturamento_iniciado_por_nome: f.faturamento_iniciado_por
          ? (profileNameMap as any)[f.faturamento_iniciado_por] || null
          : null,
        enviado_por_nome: (pdfUploaderByMov as any)[f.id]
          ? (profileNameMap as any)[(pdfUploaderByMov as any)[f.id]] || null
          : null,
      };
    });
  }, [fin, empresasMap, anexosMap, envioOpMap, pdfUploaderByMov, profileNameMap]);

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

  const sortByTime = <T extends Record<string, any>>(arr: T[], field: (r: T) => string | null | undefined, dir: "desc" | "asc") => {
    const copy = [...arr];
    copy.sort((a, b) => {
      const ta = new Date(field(a) || 0).getTime();
      const tb = new Date(field(b) || 0).getTime();
      return dir === "desc" ? tb - ta : ta - tb;
    });
    return copy;
  };
  const notasAguardandoEnvio = sortByTime(
    rows.filter((r) => r.status === "Nota emitida"),
    (r) => r.updated_at,
    sortDirs.notas,
  );
  const emFaturamento = sortByTime(
    rows.filter((r) => r.status === "Em faturamento" || r.status === "Faturado"),
    (r) => r.faturamento_iniciado_em || r.updated_at,
    sortDirs.faturamento,
  );
  const aguardandoEmissao = sortByTime(
    rows.filter((r) => r.status === "Aguardando nota"),
    (r) => r.aguardando_nota_em || r.updated_at,
    sortDirs.aguardando,
  );

  void now;

  if (!podeVer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao setor financeiro.</p>
      </div>
  );

  // ============= META DIÁRIA DE EMISSÃO POR USUÁRIO =============
  const USUARIOS_META = ["João Victor", "Karen", "Maria Lucena"];
  const emitidasHojePorUsuario = useMemo(() => {
    const counts: Record<string, number> = {};
    USUARIOS_META.forEach((u) => (counts[u] = 0));
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
    Object.values(anexosMap as Record<string, any[]>).forEach((list) => {
      list.forEach((a) => {
        const isPdf =
          (a.mime_type || "").toLowerCase().includes("pdf") ||
          (a.nome_arquivo || "").toLowerCase().endsWith(".pdf");
        if (!isPdf || !a.uploaded_by || !a.created_at) return;
        const created = new Date(a.created_at).toLocaleDateString("en-CA");
        if (created !== todayStr) return;
        const name = ((profileNameMap as any)[a.uploaded_by] || "")
          .trim()
          .toLowerCase();
        if (!name) return;
        for (const u of USUARIOS_META) {
          const target = u.toLowerCase();
          if (name === target || name.includes(target) || target.includes(name.split(" ")[0])) {
            counts[u]++;
            break;
          }
        }
      });
    });
    return counts;
  }, [anexosMap, profileNameMap]);

  const metaPorUsuario = useMemo(() => {
    const totalAguardando = aguardandoEmissao.length;
    const totalEmitidasHoje = USUARIOS_META.reduce(
      (acc, u) => acc + (emitidasHojePorUsuario[u] || 0),
      0,
    );
    const totalBase = totalAguardando + totalEmitidasHoje;
    const n = USUARIOS_META.length;
    const base = Math.floor(totalBase / n);
    const sobra = totalBase % n;
    return USUARIOS_META.map((u, i) => {
      const meta = base + (i < sobra ? 1 : 0);
      const emitidas = emitidasHojePorUsuario[u] || 0;
      const restante = Math.max(0, meta - emitidas);
      const pct = meta > 0 ? Math.min(100, Math.round((emitidas / meta) * 100)) : 0;
      return { nome: u, meta, emitidas, restante, pct };
    });
  }, [aguardandoEmissao.length, emitidasHojePorUsuario]);

  const metaTotal = useMemo(() => {
    const totalEmitidas = metaPorUsuario.reduce((a, m) => a + m.emitidas, 0);
    const totalMeta = metaPorUsuario.reduce((a, m) => a + m.meta, 0);
    const totalRestante = metaPorUsuario.reduce((a, m) => a + m.restante, 0);
    return {
      totalAguardando: aguardandoEmissao.length,
      usuarios: USUARIOS_META.length,
      mediaPorUsuario: Math.round(totalMeta / USUARIOS_META.length),
      totalEmitidas,
      totalRestante,
      totalMeta,
    };
  }, [metaPorUsuario, aguardandoEmissao.length]);
  // ==============================================================

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
                Atualizando em tempo real · {resumoSelecao(selections)} · Última atualização {hora}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CompetenciaPeriodoPicker
              selections={selections}
              onChange={setSelections}
            />
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
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
            selected={selectedLists.has("aguardando")}
            onClick={() => toggleList("aguardando")}
          />
          <HeroKpi
            label="Em faturamento"
            value={emFaturamento.length}
            icon={Activity}
            tone="blue"
            hint="Processo iniciado"
            selectable
            selected={selectedLists.has("faturamento")}
            onClick={() => toggleList("faturamento")}
          />
          <HeroKpi
            label="Notas — enviar ao cliente"
            value={counts["Nota emitida"]}
            icon={Send}
            tone="green"
            hint="Prontas para envio"
            pulse={counts["Nota emitida"] > 0}
            selectable
            selected={selectedLists.has("notas")}
            onClick={() => toggleList("notas")}
          />
        </section>


        {/* LAYOUT preset selector */}
        {listOrder.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Layout:</span>
            {(listOrder.length === 2
              ? ([
                  { k: "cols", label: "Lado a lado" },
                  { k: "stacked", label: "Empilhado" },
                ] as { k: LayoutMode; label: string }[])
              : ([
                  { k: "cols", label: "3 colunas" },
                  { k: "two-one", label: "2 em cima + 1 abaixo" },
                  { k: "one-two", label: "1 em cima + 2 abaixo" },
                  { k: "stacked", label: "Empilhado" },
                ] as { k: LayoutMode; label: string }[])
            ).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setLayoutMode(opt.k)}
                className={cn(
                  "px-2.5 py-1 rounded-md border transition-colors",
                  layoutMode === opt.k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* LISTAS SELECIONADAS — ordem manual via drag-and-drop, layout sempre completo */}
        {listOrder.length > 0 && (() => {
          const spans = computeSpans(listOrder, layoutMode);
          // Agrupa cards em linhas cujos spans somam 12
          const rows: { key: ListKey; span: number }[][] = [];
          let buf: { key: ListKey; span: number }[] = [];
          let acc = 0;
          listOrder.forEach((k, i) => {
            const s = spans[i];
            buf.push({ key: k, span: s });
            acc += s;
            if (acc >= 12) {
              rows.push(buf);
              buf = [];
              acc = 0;
            }
          });
          if (buf.length) rows.push(buf);
          // Altura fixa para mostrar ~5 empresas por card (scroll se houver mais).
          const listHeight = `320px`;

          const renderCard = (key: ListKey) => {
            if (key === "aguardando")
              return (
                <ListaCard
                  title="Aguardando emissão"
                  subtitle="Operacional já enviou — emitir nota fiscal"
                  accent="yellow"
                  icon={TimerReset}
                  rows={aguardandoEmissao}
                  contentHeight={listHeight}
                  sortDir={sortDirs.aguardando}
                  onBadgeClick={() => toggleSort("aguardando")}
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
              );
            if (key === "notas")
              return (
                <ListaCard
                  title="Notas emitidas — enviar"
                  subtitle="Prontas aguardando envio ao cliente"
                  accent="green"
                  icon={Send}
                  rows={notasAguardandoEnvio}
                  contentHeight={listHeight}
                  sortDir={sortDirs.notas}
                  onBadgeClick={() => toggleSort("notas")}
                  renderRow={(r, i) => (
                    <RowItem
                      key={r.id}
                      index={i}
                      title={r.empresa_nome}
                      subtitle={`${r.empresa_codigo || "—"} · ${r.periodo}${r.enviado_por_nome ? ` · ${r.enviado_por_nome}` : ""}`}
                      badgeText="Enviar"
                      badgeClass="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      timeText={tempoDesde(r.updated_at)}
                      accentDot="bg-emerald-500"
                    />
                  )}
                  empty="Nenhuma nota aguardando envio 🎉"
                />
              );
            return (
              <ListaCard
                title="Em faturamento"
                subtitle="Processo iniciado e em andamento"
                accent="blue"
                icon={Activity}
                rows={emFaturamento}
                contentHeight={listHeight}
                sortDir={sortDirs.faturamento}
                onBadgeClick={() => toggleSort("faturamento")}
                renderRow={(r, i) => {
                  const isFaturado = r.status === "Faturado";
                  return (
                    <RowItem
                      key={r.id}
                      index={i}
                      title={r.empresa_nome}
                      subtitle={`${r.empresa_codigo || "—"} · ${r.periodo}${r.faturamento_iniciado_por_nome ? ` · ${r.faturamento_iniciado_por_nome}` : r.responsavel ? ` · ${r.responsavel}` : ""}`}
                      badgeText={isFaturado ? "Faturado" : "Ativo"}
                      badgeClass={
                        isFaturado
                          ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                      }
                      timeText={tempoDesde(r.faturamento_iniciado_em || r.updated_at)}
                      accentDot={isFaturado ? "bg-cyan-500" : "bg-blue-500"}
                    />
                  );
                }}
                empty="Nenhuma empresa em faturamento agora."
              />
            );
          };

          return (
            <section className="space-y-5">
              {rows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-12 gap-5 items-start">
                  {row.map(({ key, span }) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => {
                        setDragKey(key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragKey(null)}
                      onDragOver={(e) => {
                        if (dragKey && dragKey !== key) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragKey) moveList(dragKey, key);
                        setDragKey(null);
                      }}
                      style={{ gridColumn: `span ${span} / span ${span}` }}
                      className={cn(
                        "relative transition-opacity",
                        dragKey === key && "opacity-50",
                        dragKey && dragKey !== key && "outline-dashed outline-2 outline-primary/40 outline-offset-2 rounded-xl",
                      )}
                    >
                      {renderCard(key)}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          );
        })()}


        {selectedLists.size === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Selecione um ou mais cards acima para ver os detalhes.
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
    <div className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 min-w-0 w-full">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-mono font-semibold text-muted-foreground tabular-nums w-6 text-right shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={cn("h-8 w-1 rounded-full shrink-0", accentDot)} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate leading-tight">{title}</div>
          <div className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 ml-2 min-w-[72px]">
        <Badge className={cn("font-medium whitespace-nowrap", badgeClass)}>{badgeText}</Badge>
        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums whitespace-nowrap">{timeText}</div>
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
  selectable,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "neutral" | "muted" | "blue" | "purple" | "amber" | "green";
  hint?: string;
  pulse?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const toneMap = {
    neutral: {
      iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      value: "text-foreground",
      selectedRing: "ring-1 ring-emerald-500/60",
    },
    muted: {
      iconWrap: "bg-muted text-muted-foreground",
      value: "text-foreground",
      selectedRing: "ring-1 ring-slate-400/60",
    },
    blue: {
      iconWrap: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      value: "text-blue-600 dark:text-blue-400",
      selectedRing: "ring-1 ring-blue-500/60",
    },
    amber: {
      iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      value: "text-amber-600 dark:text-amber-400",
      selectedRing: "ring-1 ring-amber-500/60",
    },
    purple: {
      iconWrap: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      value: "text-purple-600 dark:text-purple-400",
      selectedRing: "ring-1 ring-purple-500/60",
    },
    green: {
      iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-600 dark:text-emerald-400",
      selectedRing: "ring-1 ring-emerald-500/60",
    },
  };
  const t = toneMap[tone];
  return (
    <Card
      onClick={selectable ? onClick : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative p-4 bg-card border border-border/60 shadow-none transition-colors",
        selectable && "cursor-pointer hover:border-border",
        selected && t.selectedRing,
        pulse && !selected && "ring-1 ring-emerald-400/50",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground leading-tight">
          {label}
        </span>
        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", t.iconWrap)}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className={cn("text-3xl font-semibold tabular-nums leading-none tracking-tight", t.value)}>
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-[11px] text-muted-foreground leading-snug">{hint}</div>
      )}
      {pulse && (
        <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
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
  contentHeight,
  sortDir,
  onBadgeClick,
}: {
  title: string;
  subtitle?: string;
  accent: "purple" | "blue" | "yellow" | "green";
  icon: any;
  rows: T[];
  renderRow: (r: T, index: number) => React.ReactNode;
  empty: string;
  contentHeight?: string;
  sortDir?: "desc" | "asc";
  onBadgeClick?: () => void;
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
    green: {
      stripe: "bg-gradient-to-b from-emerald-500 to-emerald-500/30",
      iconWrap: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
  };
  const a = accentMap[accent];
  return (
    <Card className="relative flex flex-col overflow-hidden border border-border/60 shadow-sm">
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", a.stripe)} aria-hidden />
      <div className="p-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", a.iconWrap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-lg leading-tight truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onBadgeClick}
            disabled={!onBadgeClick}
            title={
              onBadgeClick
                ? sortDir === "desc"
                  ? "Ordenado: mais recente → mais antigo (clique para inverter)"
                  : "Ordenado: mais antigo → mais recente (clique para inverter)"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md text-base font-bold tabular-nums px-3 py-1 shrink-0 border transition-colors",
              a.badge,
              onBadgeClick && "hover:brightness-110 cursor-pointer",
            )}
          >
            {rows.length}
            {onBadgeClick && (
              sortDir === "desc"
                ? <ArrowDown className="h-3.5 w-3.5 opacity-80" />
                : <ArrowUp className="h-3.5 w-3.5 opacity-80" />
            )}
          </button>
        </div>
      </div>
      <div
        style={contentHeight ? { height: contentHeight, minHeight: 220 } : { height: 400 }}
        className="overflow-y-auto overflow-x-hidden"
      >
        <div className="p-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 px-4">{empty}</div>
          ) : (
            rows.map((r, i) => renderRow(r, i))
          )}
        </div>
      </div>
    </Card>
  );
}

function resumoSelecao(selections: Record<string, string[]>): string {
  const meses = Object.keys(selections).filter((m) => selections[m]?.length > 0).sort();
  if (meses.length === 0) return "Nenhuma competência selecionada";
  const partes = meses.map((m) => {
    const ps = selections[m];
    const completo = ps.length === PERIODOS_FIN.length;
    return `${formatMesReferencia(m)}${completo ? "" : ` (${ps.join(", ")})`}`;
  });
  if (partes.length <= 2) return partes.join(" · ");
  return `${partes.slice(0, 2).join(" · ")} +${partes.length - 2}`;
}

function CompetenciaPeriodoPicker({
  selections,
  onChange,
}: {
  selections: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}) {
  const meses = useMemo(() => getMesesOptions(), []);
  const totalMeses = Object.keys(selections).filter((m) => selections[m]?.length > 0).length;

  const toggleMes = (mes: string, completo: boolean) => {
    const next = { ...selections };
    if (completo) next[mes] = [...PERIODOS_FIN];
    else delete next[mes];
    onChange(next);
  };

  const togglePeriodo = (mes: string, periodo: string) => {
    const next = { ...selections };
    const atual = new Set(next[mes] || []);
    if (atual.has(periodo)) atual.delete(periodo);
    else atual.add(periodo);
    if (atual.size === 0) delete next[mes];
    else next[mes] = [...PERIODOS_FIN].filter((p) => atual.has(p));
    onChange(next);
  };

  const limpar = () => onChange({});
  const mesAtual = () => onChange({ [getCurrentMesReferencia()]: [...PERIODOS_FIN] });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[220px] justify-between">
          <span className="flex items-center gap-2 min-w-0">
            <CalendarRange className="h-4 w-4 shrink-0" />
            <span className="truncate text-left">
              {totalMeses === 0
                ? "Selecionar competências"
                : `${totalMeses} competência${totalMeses > 1 ? "s" : ""}`}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">Competências e períodos</div>
            <div className="text-xs text-muted-foreground">
              Selecione meses completos ou períodos específicos.
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={mesAtual}>
              Mês atual
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limpar}>
              Limpar
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="p-2">
            {meses.map((mes) => {
              const ps = selections[mes] || [];
              const completo = ps.length === PERIODOS_FIN.length;
              const parcial = ps.length > 0 && !completo;
              return (
                <div
                  key={mes}
                  className={cn(
                    "rounded-md px-2 py-2 mb-1 hover:bg-muted/50 transition-colors",
                    ps.length > 0 && "bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={completo ? true : parcial ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleMes(mes, !!v)}
                      id={`mes-${mes}`}
                    />
                    <label
                      htmlFor={`mes-${mes}`}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {formatMesReferencia(mes)}
                    </label>
                    {ps.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {completo ? "Completo" : `${ps.length}/${PERIODOS_FIN.length}`}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 pl-6">
                    {PERIODOS_FIN.map((p) => {
                      const sel = ps.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePeriodo(mes, p)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono tabular-nums border transition-colors",
                            sel
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {sel && <Check className="h-3 w-3" />}
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
