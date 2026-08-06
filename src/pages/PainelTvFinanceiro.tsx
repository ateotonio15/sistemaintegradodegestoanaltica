import { useEffect, useMemo, useState } from "react";
import sonicImg from "@/assets/sonic.png";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceiroRealtime } from "@/hooks/useFinanceiroRealtime";
import {
  calcularStatusFinanceiro,
  expandirAnexosPorGrupo,
  fetchEmpresaGrupoMap,
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
import { CalendarRange, Check, ChevronDown, GripVertical, ArrowUp, ArrowDown, Pin, RotateCcw, List } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
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
  dia_emissao: number | null;
  mes_referencia: string;
  faturado_antecipado: boolean;
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
  const SELECTIONS_KEY = "painel-tv-fin:competencias-fixadas";
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(SELECTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          return parsed as Record<string, string[]>;
        }
      }
    } catch {}
    return { [getCurrentMesReferencia()]: [...PERIODOS_FIN] };
  });
  // Auto-persiste qualquer alteração na seleção, garantindo que ao reabrir o
  // painel as competências/períodos escolhidos sejam restaurados.
  useEffect(() => {
    try {
      if (Object.keys(selections).length === 0) {
        localStorage.removeItem(SELECTIONS_KEY);
      } else {
        localStorage.setItem(SELECTIONS_KEY, JSON.stringify(selections));
      }
    } catch {}
  }, [selections]);
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

  // Pagadores cadastrados por empresa (para expandir "Aguardando emissão"
  // em 1 linha por pagador, alinhado ao comportamento da aba Financeiro).
  const { data: pagadoresPorEmpresa = {} } = useQuery({
    queryKey: ["tv-fin-pagadores", empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagadores")
        .select("empresa_id, nome_pagador, cnpj, ativo")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const m: Record<string, Array<{ nome: string; cnpj: string | null }>> = {};
      (data || []).forEach((p: any) => {
        if (p.ativo === false) return;
        m[p.empresa_id] = m[p.empresa_id] || [];
        m[p.empresa_id].push({ nome: p.nome_pagador, cnpj: p.cnpj });
      });
      return m;
    },
  });

  const { data: anexosMapRaw = {} } = useQuery({
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

  // Grupos financeiros: anexos são compartilhados entre contratos do mesmo grupo
  const { data: empresaGrupoMap } = useQuery({
    queryKey: ["tv-fin-empresa-grupo"],
    queryFn: () => fetchEmpresaGrupoMap(supabase as any),
  });

  const anexosMap = useMemo(() => {
    const raw = anexosMapRaw as Record<string, any[]>;
    const grupos = empresaGrupoMap ?? new Map<string, string>();
    if (grupos.size === 0) return raw;
    const flat: any[] = [];
    Object.values(raw).forEach((list) => list.forEach((a) => flat.push(a)));
    const movs = (fin as any[]).map((f) => ({
      id: f.id,
      empresa_id: f.empresa_id,
      mes_referencia: f.mes_referencia,
      periodo: f.periodo,
    }));
    const expanded = expandirAnexosPorGrupo(movs, flat, grupos);
    const out: Record<string, any[]> = {};
    expanded.forEach((list, movId) => {
      out[movId] = list;
    });
    return out;
  }, [anexosMapRaw, empresaGrupoMap, fin]);

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
        .select("user_id, display_name")
        .in("user_id", profileIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        m[p.user_id] = p.display_name || "—";
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
    const nowD = new Date();
    const currentYM = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}`;
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
      // Faturado antecipado: emissão dia 01 sendo faturada ANTES do mês de emissão.
      // Para mes_referencia=YYYY-MM com dia_emissao=01, a emissão ocorre em (MM+1)/01.
      // Portanto, qualquer faturamento feito enquanto current month <= mes_referencia
      // é antecipado (estamos faturando antes do mês de emissão).
      const faturadoAntecipado =
        f.dia_emissao === 1 && typeof f.mes_referencia === "string" && f.mes_referencia >= currentYM;

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
        dia_emissao: f.dia_emissao ?? null,
        mes_referencia: f.mes_referencia,
        faturado_antecipado: faturadoAntecipado,
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
  // Contratos do tipo permuta — não devem aparecer em "Aguardando emissão"
  const CONTRATOS_PERMUTA_EXCLUIR = new Set(["2120"]);
  const aguardandoEmissao = sortByTime(
    rows.filter(
      (r) =>
        r.status === "Aguardando nota" &&
        !CONTRATOS_PERMUTA_EXCLUIR.has((r.empresa_codigo || "").trim()),
    ),
    (r) => r.aguardando_nota_em || r.updated_at,
    sortDirs.aguardando,
  );

  // Expansão visual: 1 linha por pagador cadastrado (mantém contagem por mov
  // intacta no resto do painel — esta lista é só para renderização do card).
  const aguardandoEmissaoExpandida = useMemo(() => {
    const out: Array<typeof aguardandoEmissao[number] & { pagador_nome?: string | null }> = [];
    aguardandoEmissao.forEach((r) => {
      const pags = (pagadoresPorEmpresa as any)[r.empresa_id] || [];
      if (pags.length === 0) {
        out.push({ ...r, pagador_nome: null });
      } else {
        // A própria empresa também é um pagador (padrão), além dos cadastrados em financeiro_pagadores.
        out.push({ ...r, id: `${r.id}|__origem__`, pagador_nome: null });
        pags.forEach((p: any) => {
          out.push({ ...r, id: `${r.id}|${p.nome}`, pagador_nome: p.nome });
        });
      }
    });
    return out;
  }, [aguardandoEmissao, pagadoresPorEmpresa]);

  // Faturamento antecipado: contratos com emissão dia 01 que estão sendo
  // faturados ANTES (no mês anterior). Ficam como "Faturado" mas devem
  // entrar na meta do dia (a ação do faturamento conta como produção).
  const faturadosAntecipados = useMemo(
    () => rows.filter((r) => r.faturado_antecipado && r.status === "Faturado"),
    [rows],
  );
  const faturadosAntecipadosIds = useMemo(
    () => new Set(faturadosAntecipados.map((r) => r.id)),
    [faturadosAntecipados],
  );

  void now;

  // ============= META DIÁRIA DE EMISSÃO POR USUÁRIO =============
  // Lista dinâmica de usuários disponíveis para a escala (admins + financeiro).
  const { data: USUARIOS_DISPONIVEIS = [] } = useQuery({
    queryKey: ["tv-fin-usuarios-escala"],
    queryFn: async () => {
      const { data: roles, error: errRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["financeiro", "admin"]);
      if (errRoles) {
        console.error("[escala] erro ao carregar user_roles:", errRoles);
        return [] as string[];
      }
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [] as string[];
      const { data: profs, error: errProfs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      if (errProfs) {
        console.error("[escala] erro ao carregar profiles:", errProfs);
        return [] as string[];
      }
      const nomes = new Set<string>();
      (profs || []).forEach((p: any) => {
        const nome = (p.display_name || "").trim();
        if (nome) nomes.add(nome);
      });
      return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Meta fixa do dia (persistida no banco, compartilhada entre todos os dispositivos).
  const todayKey = new Date().toLocaleDateString("en-CA");
  const { data: metaDiariaRow, refetch: refetchMetaDiaria } = useQuery({
    queryKey: ["painel-tv-meta-diaria", todayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_tv_meta_diaria" as any)
        .select("valor, usuarios, iniciada_em, empresas_snapshot")
        .eq("data", todayKey)
        .maybeSingle();
      if (error) {
        console.error("[meta-diaria] erro ao carregar:", error);
        return null;
      }
      return (data as unknown) as { valor: number; usuarios: string[]; iniciada_em: string; empresas_snapshot: string[] } | null;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Realtime: propaga imediatamente quando outro usuário define/edita a meta.
  useEffect(() => {
    const channel = supabase
      .channel(`painel-tv-meta-diaria-${todayKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "painel_tv_meta_diaria", filter: `data=eq.${todayKey}` },
        () => {
          refetchMetaDiaria();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [todayKey, refetchMetaDiaria]);

  const metaDiariaFixa =
    metaDiariaRow && typeof metaDiariaRow.valor === "number" && metaDiariaRow.valor >= 0
      ? metaDiariaRow.valor
      : null;

  const USUARIOS_META = useMemo(() => {
    const fromDb = Array.isArray(metaDiariaRow?.usuarios) ? (metaDiariaRow!.usuarios as string[]) : [];
    return fromDb;
  }, [metaDiariaRow]);

  // IDs das empresas (movimentações) congeladas no momento em que a meta foi definida.
  // Apenas estas contam para meta/emissões. Empresas que já estavam em
  // "Em faturamento" ou "Faturado" antes da meta NÃO entram.
  const snapshotIds = useMemo<string[]>(() => {
    const raw = (metaDiariaRow as any)?.empresas_snapshot;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [metaDiariaRow]);
  const snapshotSet = useMemo(() => new Set(snapshotIds), [snapshotIds]);
  const hasSnapshot = snapshotIds.length > 0;

  // Empresas que entraram em "Em faturamento" APÓS a meta ter sido definida.
  // Estas não estavam no snapshot original, mas devem contar para a meta do dia
  // (a ação do faturamento ocorreu durante o ciclo da meta vigente).
  const posMetaIds = useMemo<Set<string>>(() => {
    if (!hasSnapshot) return new Set();
    const iniciadaEmMs = metaDiariaRow?.iniciada_em
      ? new Date(metaDiariaRow.iniciada_em).getTime()
      : 0;
    if (!iniciadaEmMs) return new Set();
    const out = new Set<string>();
    rows.forEach((r) => {
      if (snapshotSet.has(r.id)) return;
      if (!r.faturamento_iniciado_em) return;
      const t = new Date(r.faturamento_iniciado_em).getTime();
      if (!Number.isFinite(t)) return;
      if (t >= iniciadaEmMs) out.add(r.id);
    });
    return out;
  }, [rows, hasSnapshot, snapshotSet, metaDiariaRow]);




  const emitidasHojePorUsuario = useMemo(() => {
    const counts: Record<string, number> = {};
    USUARIOS_META.forEach((u) => (counts[u] = 0));
    const todayStr = new Date().toLocaleDateString("en-CA");
    const iniciadaEm = metaDiariaRow?.iniciada_em ? new Date(metaDiariaRow.iniciada_em).getTime() : 0;
    Object.entries(anexosMap as Record<string, any[]>).forEach(([movId, list]) => {
      // Restringe ao snapshot quando a meta tem snapshot definido,
      // mas permite empresas que entraram em faturamento APÓS a meta (posMetaIds).
      if (hasSnapshot && !snapshotSet.has(movId) && !posMetaIds.has(movId)) return;
      // Para faturamento antecipado (emissão dia 01 sendo faturada no mês anterior),
      // o anexo XLS conta como produção do dia (não há PDF, pois a nota só será emitida no dia 01).
      const isAntecipado = faturadosAntecipadosIds.has(movId);
      list.forEach((a) => {
        const nome = (a.nome_arquivo || "").toLowerCase();
        const mime = (a.mime_type || "").toLowerCase();
        const isPdf = mime.includes("pdf") || nome.endsWith(".pdf");
        const isXls =
          mime.includes("spreadsheet") ||
          mime.includes("excel") ||
          mime === "text/csv" ||
          nome.endsWith(".xlsx") ||
          nome.endsWith(".xls") ||
          nome.endsWith(".csv");
        const conta = isPdf || (isAntecipado && isXls);
        if (!conta || !a.uploaded_by || !a.created_at) return;
        const createdDate = new Date(a.created_at);
        if (createdDate.toLocaleDateString("en-CA") !== todayStr) return;
        if (iniciadaEm > 0 && createdDate.getTime() < iniciadaEm) return;
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
  }, [anexosMap, profileNameMap, USUARIOS_META, metaDiariaRow, hasSnapshot, snapshotSet, posMetaIds, faturadosAntecipadosIds]);

  // Universo de empresas considerado pela meta:
  // - Se houver snapshot: tamanho do snapshot + empresas que entraram após a meta.
  // - Caso contrário: cálculo dinâmico anterior + faturamentos antecipados.
  const universoMeta = useMemo(() => {
    if (hasSnapshot) return snapshotIds.length + posMetaIds.size;
    const totalEmitidasHoje = USUARIOS_META.reduce(
      (acc, u) => acc + (emitidasHojePorUsuario[u] || 0),
      0,
    );
    return aguardandoEmissao.length + faturadosAntecipados.length + totalEmitidasHoje;
  }, [hasSnapshot, snapshotIds.length, posMetaIds.size, aguardandoEmissao.length, faturadosAntecipados.length, emitidasHojePorUsuario, USUARIOS_META]);

  const metaPorUsuario = useMemo(() => {
    const totalBase = metaDiariaFixa != null ? metaDiariaFixa : universoMeta;
    const n = USUARIOS_META.length;
    if (n === 0) return [] as { nome: string; meta: number; emitidas: number; restante: number; pct: number }[];
    const base = Math.floor(totalBase / n);
    const sobra = totalBase % n;
    return USUARIOS_META.map((u, i) => {
      const meta = base + (i < sobra ? 1 : 0);
      const emitidas = emitidasHojePorUsuario[u] || 0;
      const restante = Math.max(0, meta - emitidas);
      const pct = meta > 0 ? Math.min(100, Math.round((emitidas / meta) * 100)) : 0;
      return { nome: u, meta, emitidas, restante, pct };
    });
  }, [universoMeta, emitidasHojePorUsuario, metaDiariaFixa, USUARIOS_META]);

  const metaTotal = useMemo(() => {
    const totalEmitidas = metaPorUsuario.reduce((a, m) => a + m.emitidas, 0);
    const totalMeta = metaPorUsuario.reduce((a, m) => a + m.meta, 0);
    const totalRestante = metaPorUsuario.reduce((a, m) => a + m.restante, 0);
    return {
      totalAguardando: hasSnapshot
        ? snapshotIds.length + posMetaIds.size
        : aguardandoEmissao.length + faturadosAntecipados.length,
      usuarios: USUARIOS_META.length,
      mediaPorUsuario: USUARIOS_META.length > 0 ? Math.round(totalMeta / USUARIOS_META.length) : 0,
      totalEmitidas,
      totalRestante,
      totalMeta,
    };
  }, [metaPorUsuario, aguardandoEmissao.length, faturadosAntecipados.length, USUARIOS_META, hasSnapshot, snapshotIds.length, posMetaIds.size]);

  // Sugestão: empresas em "Aguardando emissão" + faturamentos antecipados (emissão dia 01).
  const sugestaoMetaDinamica = aguardandoEmissao.length + faturadosAntecipados.length;


  const definirMetaDoDia = async (valor: number, usuarios: string[]) => {
    const v = Math.max(0, Math.floor(valor));
    const us = usuarios.map((u) => u.trim()).filter(Boolean);
    if (us.length === 0) {
      toast({ title: "Selecione ao menos um usuário", variant: "destructive" });
      return;
    }
    // Congela "Aguardando emissão" + faturamentos antecipados (emissão dia 01
    // sendo faturados no mês anterior — contam para a produção do dia).
    // Se a meta já existe (edição), preserva o snapshot anterior e apenas
    // adiciona novas empresas — assim quem já foi contabilizado permanece.
    const novoSnapshot = [
      ...aguardandoEmissao.map((r) => r.id),
      ...faturadosAntecipados.map((r) => r.id),
    ];
    const snapshotAnterior = Array.isArray((metaDiariaRow as any)?.empresas_snapshot)
      ? ((metaDiariaRow as any).empresas_snapshot as string[])
      : [];
    const snapshot = Array.from(new Set([...snapshotAnterior, ...novoSnapshot]));
    const iniciadaEm = metaDiariaRow?.iniciada_em
      ? metaDiariaRow.iniciada_em
      : new Date().toISOString();

    const { error } = await supabase
      .from("painel_tv_meta_diaria" as any)
      .upsert(
        {
          data: todayKey,
          valor: v,
          usuarios: us,
          empresas_snapshot: snapshot,
          iniciada_em: iniciadaEm,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "data" },
      );
    if (error) {
      console.error("[meta-diaria] erro ao salvar:", error);
      toast({ title: "Erro ao salvar meta", description: error.message, variant: "destructive" });
      return;
    }
    await refetchMetaDiaria();
    toast({
      title: "Meta do dia definida",
      description: `${snapshot.length} empresa(s) em Aguardando emissão congeladas, distribuídas entre ${us.length} usuário(s).`,
    });
  };


  const limparMetaDoDia = async () => {
    const { error } = await supabase
      .from("painel_tv_meta_diaria" as any)
      .delete()
      .eq("data", todayKey);
    if (error) {
      console.error("[meta-diaria] erro ao limpar:", error);
      toast({ title: "Erro ao remover meta", description: error.message, variant: "destructive" });
      return;
    }
    await refetchMetaDiaria();
    toast({ title: "Meta do dia removida", description: "Voltando ao cálculo automático em tempo real." });
  };
  // ==============================================================

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
                Atualizando em tempo real · {resumoSelecao(selections)} · Última atualização {hora}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CompetenciaPeriodoPicker
              selections={selections}
              onChange={setSelections}
            />
            {isAdmin && <MetaHistoricoButton />}
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
            value={aguardandoEmissaoExpandida.length}
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

        {/* META DIÁRIA DE EMISSÃO */}
        <MetaDiariaSection
          metaPorUsuario={metaPorUsuario}
          metaTotal={metaTotal}
          metaFixa={metaDiariaFixa}
          sugestaoMeta={sugestaoMetaDinamica}
          usuariosDisponiveis={USUARIOS_DISPONIVEIS}
          usuariosSelecionados={USUARIOS_META}
          onDefinirMeta={definirMetaDoDia}
          onLimparMeta={limparMetaDoDia}
        />




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
          const listHeight = `460px`;

          const renderCard = (key: ListKey) => {
            if (key === "aguardando")
              return (
                <ListaCard
                  title="Aguardando emissão"
                  subtitle="Operacional já enviou — emitir nota fiscal"
                  accent="yellow"
                  icon={TimerReset}
                  rows={aguardandoEmissaoExpandida}
                  contentHeight={listHeight}
                  sortDir={sortDirs.aguardando}
                  onBadgeClick={() => toggleSort("aguardando")}
                  renderRow={(r: any, i) => (
                    <RowItem
                      key={r.id}
                      index={i}
                      title={r.pagador_nome ? `${r.empresa_nome} — ${r.pagador_nome}` : r.empresa_nome}
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
    <div className="group flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 min-w-0 w-full">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-sm font-mono font-semibold text-muted-foreground tabular-nums w-7 text-right shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={cn("h-10 w-1.5 rounded-full shrink-0", accentDot)} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate leading-tight text-lg">{title}</div>
          <div className="text-base text-muted-foreground truncate mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 ml-2 min-w-[92px]">
        <Badge className={cn("font-semibold whitespace-nowrap text-sm px-2.5 py-0.5", badgeClass)}>{badgeText}</Badge>
        <div className="text-xs text-muted-foreground mt-1 tabular-nums whitespace-nowrap">{timeText}</div>
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
        "relative p-5 bg-card border border-border/60 shadow-none transition-colors",
        selectable && "cursor-pointer hover:border-border",
        selected && t.selectedRing,
        pulse && !selected && "ring-1 ring-emerald-400/50",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
          {label}
        </span>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", t.iconWrap)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("text-5xl font-bold tabular-nums leading-none tracking-tight", t.value)}>
        {value}
      </div>
      {hint && (
        <div className="mt-3 text-sm text-muted-foreground leading-snug">{hint}</div>
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

  // Rotação automática: 5 por página, troca a cada 9s
  const PAGE_SIZE = 5;
  const ROTATE_MS = 9000;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const canRotate = totalPages > 1;
  // Modo padrão: carrossel quando há mais de uma página
  const [mode, setMode] = useState<"carrossel" | "lista">("carrossel");
  const isCarrossel = canRotate && mode === "carrossel";
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (page >= totalPages) setPage(0);
  }, [totalPages, page]);
  useEffect(() => {
    if (!isCarrossel) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [isCarrossel, totalPages]);
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = isCarrossel
    ? rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
    : rows;

  return (
    <Card className="relative flex flex-col overflow-hidden border border-border/60 shadow-sm">
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", a.stripe)} aria-hidden />
      <div className="p-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-3">
          <GripVertical className="h-5 w-5 text-muted-foreground/60 shrink-0" />
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", a.iconWrap)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-2xl leading-tight truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          {canRotate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode((m) => (m === "carrossel" ? "lista" : "carrossel"));
              }}
              title={isCarrossel ? "Modo carrossel ativo — clique para ver como lista" : "Modo lista ativo — clique para ativar carrossel"}
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors hover:brightness-110 cursor-pointer",
                a.badge,
              )}
            >
              {isCarrossel ? <RotateCcw className="h-5 w-5" /> : <List className="h-5 w-5" />}
            </button>
          )}
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
              "inline-flex items-center gap-1.5 rounded-md text-2xl font-bold tabular-nums px-4 py-1.5 shrink-0 border transition-colors",
              a.badge,
              onBadgeClick && "hover:brightness-110 cursor-pointer",
            )}
          >
            {rows.length}
            {onBadgeClick && (
              sortDir === "desc"
                ? <ArrowDown className="h-4 w-4 opacity-80" />
                : <ArrowUp className="h-4 w-4 opacity-80" />
            )}
          </button>
        </div>
      </div>

      <div
        style={contentHeight ? { height: contentHeight, minHeight: 220 } : { height: 400 }}
        className={cn(isCarrossel ? "overflow-hidden" : "overflow-y-auto")}
      >
        <div className="p-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 px-4">{empty}</div>
          ) : (
            pagedRows.map((r, i) => renderRow(r, isCarrossel ? currentPage * PAGE_SIZE + i : i))
          )}
        </div>
      </div>

      {isCarrossel && (
        <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            Página {currentPage + 1}/{totalPages} · {rows.length} Contratos
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors",
                  i === currentPage ? "bg-foreground/70" : "bg-foreground/15",
                )}
              />
            ))}
          </div>
        </div>
      )}
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
            <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">Competências e períodos</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Pin className="h-3 w-3 text-primary fill-primary" />
              Sua seleção é salva automaticamente
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

// ============= META DIÁRIA DE EMISSÃO =============
type MetaUsuario = {
  nome: string;
  meta: number;
  emitidas: number;
  restante: number;
  pct: number;
};

function MetaDiariaSection({
  metaPorUsuario,
  metaTotal,
  metaFixa,
  sugestaoMeta,
  usuariosDisponiveis,
  usuariosSelecionados,
  onDefinirMeta,
  onLimparMeta,
}: {
  metaPorUsuario: MetaUsuario[];
  metaTotal: {
    totalAguardando: number;
    usuarios: number;
    mediaPorUsuario: number;
    totalEmitidas: number;
    totalRestante: number;
    totalMeta: number;
  };
  metaFixa: number | null;
  sugestaoMeta: number;
  usuariosDisponiveis: string[];
  usuariosSelecionados: string[];
  onDefinirMeta: (valor: number, usuarios: string[]) => void;
  onLimparMeta: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [valorInput, setValorInput] = useState<string>("");
  const [escalaSel, setEscalaSel] = useState<string[]>(usuariosSelecionados);

  const abrirDialog = () => {
    setValorInput(String(metaFixa ?? sugestaoMeta));
    setEscalaSel(usuariosSelecionados.length > 0 ? usuariosSelecionados : usuariosDisponiveis);
    setDialogOpen(true);
  };

  const toggleUsuario = (u: string) => {
    setEscalaSel((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  };

  const confirmar = () => {
    const n = parseInt(valorInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    if (escalaSel.length === 0) return;
    onDefinirMeta(n, escalaSel);
    setDialogOpen(false);
  };

  return (
    <section className="space-y-2">
      <Card className="p-5 space-y-4">
        {/* Linha 1: título + totais + ações */}
        <div className="flex items-center gap-3 flex-wrap">
          <Target className="h-7 w-7 text-primary shrink-0" />
          <span className="font-semibold text-xl whitespace-nowrap">Meta diária</span>
          {metaFixa != null && (
            <Badge variant="outline" className="text-base gap-1 h-9 px-3">
              Meta: <strong>{metaFixa}</strong>
            </Badge>
          )}
          <Badge variant="outline" className="text-base h-9 gap-1.5 px-3">
            <Trophy className="h-4 w-4 text-primary" />
            {metaTotal.totalEmitidas}/{metaTotal.totalMeta}
          </Badge>
          <Badge variant="outline" className="text-base h-9 px-3">
            Aguardando: <strong className="ml-1">{metaTotal.totalAguardando}</strong>
          </Badge>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {metaFixa != null ? (
              <>
                <Button variant="outline" size="sm" className="h-9 px-3 text-sm" onClick={abrirDialog}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" className="h-9 px-3 text-sm" onClick={onLimparMeta}>
                  Limpar
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" className="h-9 px-3 text-sm" onClick={abrirDialog}>
                <Target className="h-4 w-4 mr-1.5" /> Definir meta
              </Button>
            )}
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
          </div>
        </div>


        {/* Linha 2: cards por usuário — colunas se ajustam à quantidade (máx 4) */}
        {metaPorUsuario.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Defina a meta do dia para distribuir entre os usuários da escala.
          </p>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(metaPorUsuario.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {metaPorUsuario.map((u) => (
              <UsuarioMetaMini key={u.nome} usuario={u} />
            ))}
          </div>
        )}
      </Card>


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir meta diária de emissão</DialogTitle>
            <DialogDescription>
              A meta será congelada com este valor e distribuída apenas entre os usuários
              selecionados na escala do dia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meta-input">Total de empresas para emitir hoje</Label>
              <Input
                id="meta-input"
                type="number"
                min={0}
                value={valorInput}
                onChange={(e) => setValorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmar();
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Sugestão atual (aguardando emissão): <strong>{sugestaoMeta}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Usuários na escala de hoje</Label>
              <div className="space-y-2 rounded-md border p-3">
                {usuariosDisponiveis.map((u) => {
                  const checked = escalaSel.includes(u);
                  return (
                    <label
                      key={u}
                      className="flex items-center gap-2 text-sm cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleUsuario(u)}
                      />
                      <span>{u}</span>
                    </label>
                  );
                })}
              </div>
              {escalaSel.length === 0 ? (
                <p className="text-xs text-destructive">Selecione ao menos um usuário.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {escalaSel.length} usuário(s) na escala — a meta será dividida entre eles.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={escalaSel.length === 0}>
              Salvar meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function UsuarioMetaMini({ usuario }: { usuario: MetaUsuario }) {
  const concluida = usuario.meta > 0 && usuario.emitidas >= usuario.meta;
  // Sonic só aparece quando o usuário emite o DOBRO da meta definida.
  const sonic = usuario.meta > 0 && usuario.emitidas >= usuario.meta * 2;
  const iniciais = usuario.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 rounded-2xl border px-6 py-5 transition-all",
        sonic
          ? "animate-sonic-invincible bg-gradient-to-br from-blue-500/10 via-yellow-400/10 to-red-500/10"
          : concluida
            ? "border-emerald-500/40 bg-emerald-500/5"
            : usuario.emitidas > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border bg-muted/30",
      )}
      title={`${usuario.nome} · ${usuario.emitidas}/${usuario.meta} (faltam ${usuario.restante})`}
    >
      {sonic ? (
        <img
          src={sonicImg}
          alt="Sonic"
          className="h-16 w-16 rounded-full object-cover shrink-0 ring-4 ring-blue-500/60 animate-sonic-bounce bg-white"
        />
      ) : (
        <span
          className={cn(
            "h-16 w-16 rounded-full grid place-items-center text-xl font-bold shrink-0",
            concluida ? "bg-emerald-500 text-white" : "bg-primary/15 text-primary",
          )}
        >
          {iniciais || "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xl font-semibold truncate">
            {usuario.nome}
            {sonic && (
              <span className="ml-2 animate-sonic-text uppercase tracking-wider text-xl">
                Sonic
              </span>
            )}
          </span>
          <span className="text-xl tabular-nums text-muted-foreground shrink-0">
            {usuario.pct}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-xl tabular-nums leading-tight mt-1">
          <span>
            <span className="text-muted-foreground">Meta</span>{" "}
            <strong className="text-foreground text-2xl">{usuario.meta}</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-500 font-semibold">
            ✓ {usuario.emitidas}
          </span>
          <span className="text-amber-600 dark:text-amber-500 font-semibold">
            • {usuario.restante}
          </span>
        </div>
        <Progress value={usuario.pct} className="h-2.5 mt-3" />

      </div>
    </div>
  );
}





function ResumoLinha({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: "green" | "amber";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-bold tabular-nums",
          highlight ? "text-2xl text-primary" : "text-lg",
          tone === "green" && "text-emerald-600 dark:text-emerald-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function getIniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MetaUsuarioCard({ usuario }: { usuario: MetaUsuario }) {
  const { nome, meta, emitidas, restante, pct } = usuario;
  const statusInfo =
    meta === 0
      ? { label: "Sem meta", color: "text-muted-foreground", bg: "bg-muted", ring: "ring-border" }
      : pct >= 100
      ? {
          label: "Meta concluída",
          color: "text-emerald-700 dark:text-emerald-300",
          bg: "bg-emerald-500/15",
          ring: "ring-emerald-500/40",
        }
      : pct >= 50
      ? {
          label: "Em andamento",
          color: "text-blue-700 dark:text-blue-300",
          bg: "bg-blue-500/15",
          ring: "ring-blue-500/40",
        }
      : pct > 0
      ? {
          label: "Atenção",
          color: "text-amber-700 dark:text-amber-300",
          bg: "bg-amber-500/15",
          ring: "ring-amber-500/40",
        }
      : {
          label: "Não iniciado",
          color: "text-red-700 dark:text-red-300",
          bg: "bg-red-500/15",
          ring: "ring-red-500/40",
        };

  return (
    <Card className={cn("p-5 border border-border/60 ring-1 transition-all", statusInfo.ring)}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
            statusInfo.bg,
            statusInfo.color,
          )}
        >
          {getIniciais(nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-lg leading-tight truncate">{nome}</div>
          <Badge className={cn("mt-1 font-medium", statusInfo.bg, statusInfo.color, "border-0")}>
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Meta</div>
          <div className="text-2xl font-bold tabular-nums mt-0.5">{meta}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Emitidas</div>
          <div className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
            {emitidas}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Restante</div>
          <div className="text-2xl font-bold tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">
            {restante}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-bold tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2.5" />
      </div>
    </Card>
  );
}

// ============= HISTÓRICO DE METAS (ADMIN) =============
function MetaHistoricoButton() {
  const [open, setOpen] = useState(false);

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["painel-tv-meta-historico-v3", open],
    enabled: open,
    queryFn: async () => {
      // 1) últimas 60 metas (incluindo snapshot e horário de início para
      // replicar a mesma contagem do painel ao vivo)
      const { data: metas, error: errMetas } = await supabase
        .from("painel_tv_meta_diaria" as any)
        .select("data, valor, usuarios, iniciada_em, empresas_snapshot")
        .order("data", { ascending: false })
        .limit(60);
      if (errMetas) throw errMetas;
      const metasList = ((metas || []) as unknown) as Array<{
        data: string;
        valor: number;
        usuarios: string[];
        iniciada_em: string | null;
        empresas_snapshot: string[] | null;
      }>;
      if (metasList.length === 0) return [] as any[];

      const dataMin = metasList[metasList.length - 1].data;
      const dataMax = metasList[0].data;

      // 2) PDFs anexados no intervalo
      const { data: anexos, error: errAnx } = await supabase
        .from("anexos_financeiro")
        .select("uploaded_by, created_at, mime_type, nome_arquivo, financeiro_movimentacao_id")
        .gte("created_at", `${dataMin}T00:00:00`)
        .lte("created_at", `${dataMax}T23:59:59.999`);
      if (errAnx) throw errAnx;

      const pdfs = ((anexos || []) as any[]).filter((a) => {
        const isPdf =
          (a.mime_type || "").toLowerCase().includes("pdf") ||
          (a.nome_arquivo || "").toLowerCase().endsWith(".pdf");
        return isPdf && a.uploaded_by && a.created_at;
      });

      // 3) mapear uploaders -> nomes
      const uploaderIds = Array.from(new Set(pdfs.map((a) => a.uploaded_by)));
      const nomesMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", uploaderIds);
        (profs || []).forEach((p: any) => {
          nomesMap[p.user_id] = (p.display_name || "—").trim();
        });
      }

      // 4) movimentações financeiras (para empresa/cobrança/lançamento)
      const movIds = Array.from(
        new Set(pdfs.map((a) => a.financeiro_movimentacao_id).filter(Boolean)),
      );
      const movMap: Record<string, any> = {};
      const empresaIds = new Set<string>();
      if (movIds.length > 0) {
        const { data: movs } = await supabase
          .from("financeiro_movimentacoes")
          .select("id, empresa_id, mes_referencia, periodo, tipo_cobranca, tipo_lancamento")
          .in("id", movIds);
        (movs || []).forEach((m: any) => {
          movMap[m.id] = m;
          if (m.empresa_id) empresaIds.add(m.empresa_id);
        });
      }

      const empMap: Record<string, any> = {};
      if (empresaIds.size > 0) {
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, nome, codigo_contrato, cnpj")
          .in("id", Array.from(empresaIds));
        (emps || []).forEach((e: any) => (empMap[e.id] = e));
      }

      // 4b) pagadores cadastrados por empresa (para resolver o nome do pagador)
      const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
      const pagadoresPorEmpresa: Record<string, Array<{ nome: string; cnpj: string }>> = {};
      if (empresaIds.size > 0) {
        const { data: pags } = await supabase
          .from("financeiro_pagadores")
          .select("empresa_id, nome_pagador, cnpj, ativo")
          .in("empresa_id", Array.from(empresaIds));
        (pags || []).forEach((p: any) => {
          if (p.ativo === false) return;
          pagadoresPorEmpresa[p.empresa_id] = pagadoresPorEmpresa[p.empresa_id] || [];
          pagadoresPorEmpresa[p.empresa_id].push({
            nome: p.nome_pagador,
            cnpj: onlyDigits(p.cnpj),
          });
        });
      }

      // 4c) análises (financeiro_analises) → CNPJ do pagador por (mov, arquivo PDF)
      const cnpjPorAnexo: Record<string, string> = {};
      if (movIds.length > 0) {
        const { data: analises } = await supabase
          .from("financeiro_analises")
          .select("financeiro_movimentacao_id, nome_arquivo_pdf, pagador_cnpj")
          .in("financeiro_movimentacao_id", movIds);
        (analises || []).forEach((r: any) => {
          const cnpj = onlyDigits(r.pagador_cnpj);
          if (!cnpj || !r.financeiro_movimentacao_id || !r.nome_arquivo_pdf) return;
          cnpjPorAnexo[`${r.financeiro_movimentacao_id}|${r.nome_arquivo_pdf}`] = cnpj;
        });
      }

      // 4d) Grupos financeiros: para cada empresa, lista de empresas do mesmo grupo
      // (necessário para resolver o nome correto quando o anexo é compartilhado).
      const grupoCompanhiasPorEmpresa: Record<
        string,
        Array<{ id: string; nome: string; cnpj: string }>
      > = {};
      if (empresaIds.size > 0) {
        const { data: vinculosBase } = await supabase
          .from("grupos_financeiros_contratos")
          .select("grupo_id, empresa_id")
          .in("empresa_id", Array.from(empresaIds));
        const gruposEnvolvidos = Array.from(
          new Set((vinculosBase || []).map((v: any) => v.grupo_id).filter(Boolean)),
        );
        if (gruposEnvolvidos.length > 0) {
          const { data: vinculosAll } = await supabase
            .from("grupos_financeiros_contratos")
            .select("grupo_id, empresa_id")
            .in("grupo_id", gruposEnvolvidos);
          // Carrega dados das empresas vinculadas (fetch separado p/ evitar
          // dependência de embed/FK no PostgREST).
          const todasEmpresasGrupo = Array.from(
            new Set((vinculosAll || []).map((v: any) => v.empresa_id).filter(Boolean)),
          );
          const empMapExtra: Record<string, { id: string; nome: string; cnpj: string }> = {};
          if (todasEmpresasGrupo.length > 0) {
            const { data: empsExtra } = await supabase
              .from("empresas")
              .select("id, nome, cnpj")
              .in("id", todasEmpresasGrupo);
            (empsExtra || []).forEach((e: any) => {
              empMapExtra[e.id] = { id: e.id, nome: e.nome || "", cnpj: onlyDigits(e.cnpj) };
            });
          }
          const porGrupo: Record<string, Array<{ id: string; nome: string; cnpj: string }>> = {};
          (vinculosAll || []).forEach((v: any) => {
            const e = empMapExtra[v.empresa_id];
            if (!e) return;
            porGrupo[v.grupo_id] = porGrupo[v.grupo_id] || [];
            porGrupo[v.grupo_id].push(e);
          });
          (vinculosBase || []).forEach((v: any) => {
            grupoCompanhiasPorEmpresa[v.empresa_id] = porGrupo[v.grupo_id] || [];
          });
        }
      }

      // 5) movimentações operacionais para inclusão/exclusão
      const opMap: Record<string, any> = {};
      if (empresaIds.size > 0) {
        const mesesUnicos = Array.from(
          new Set(Object.values(movMap).map((m: any) => m.mes_referencia).filter(Boolean)),
        );
        if (mesesUnicos.length > 0) {
          const { data: ops } = await supabase
            .from("movimentacoes")
            .select("empresa_id, mes_referencia, periodo, tipo_movimentacao")
            .in("empresa_id", Array.from(empresaIds))
            .in("mes_referencia", mesesUnicos);
          (ops || []).forEach((o: any) => {
            opMap[`${o.empresa_id}|${o.mes_referencia}|${o.periodo}`] = o;
          });
        }
      }

      // Normaliza para comparação por filename: minúsculas, sem acentos e só alfanum/espaço
      const normalizar = (s: string) =>
        (s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 ]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      // helper: nome do pagador para um anexo (fallback: nome da empresa)
      const resolverPagador = (movId: string, nomeArquivo: string, empresaId: string | null): string => {
        const emp = empresaId ? empMap[empresaId] : null;
        const empNome = emp?.nome || "—";
        const cnpj = cnpjPorAnexo[`${movId}|${nomeArquivo}`];
        if (!empresaId) return empNome;
        const lista = pagadoresPorEmpresa[empresaId] || [];
        if (cnpj) {
          // CNPJ próprio da empresa → usa o nome da empresa
          if (onlyDigits(emp?.cnpj) === cnpj) return empNome;
          const hit = lista.find((p) => p.cnpj && p.cnpj === cnpj);
          if (hit) return hit.nome;
          // Grupo financeiro: confere se o CNPJ pertence a outra empresa do grupo
          const grupo = grupoCompanhiasPorEmpresa[empresaId] || [];
          const hitGrupo = grupo.find((g) => g.cnpj && g.cnpj === cnpj);
          if (hitGrupo) return hitGrupo.nome;
        }
        // Sem CNPJ identificado: tenta casar pelo nome do arquivo
        // contra as empresas do grupo financeiro (anexos compartilhados).
        const grupo = grupoCompanhiasPorEmpresa[empresaId] || [];
        if (grupo.length > 1 && nomeArquivo) {
          const arq = normalizar(nomeArquivo);
          // Ranking: empresa cujo nome (ou tokens significativos) aparecem no arquivo
          const candidatos = grupo
            .map((g) => {
              const nomeNorm = normalizar(g.nome);
              if (!nomeNorm) return { g, score: 0 };
              if (arq.includes(nomeNorm)) return { g, score: nomeNorm.length };
              // Casa por tokens (≥4 chars) presentes no filename
              const tokens = nomeNorm.split(" ").filter((t) => t.length >= 4);
              const hits = tokens.filter((t) => arq.includes(t));
              return { g, score: hits.join("").length };
            })
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score);
          if (candidatos.length > 0) return candidatos[0].g.nome;
        }
        // Se houver apenas 1 pagador cadastrado, usa ele
        if (lista.length === 1) return lista[0].nome;
        return empNome;
      };



      // 6) Atribuição por usuário com a MESMA lógica do contador ao vivo:
      //    fuzzy match contra a escala salva no dia (`m.usuarios`).
      //    Sem dedup por movimentação — cada PDF conta exatamente como conta no painel.
      const attributeName = (uploaderName: string, escala: string[]): string | null => {
        const name = uploaderName.trim().toLowerCase();
        if (!name) return null;
        for (const u of escala) {
          const target = u.toLowerCase();
          if (name === target || name.includes(target) || target.includes(name.split(" ")[0])) {
            return u;
          }
        }
        return uploaderName; // mantém quem emitiu mesmo sem estar na escala
      };

      type Item = {
        empresa: string;
        codigo: string | null;
        mes: string | null;
        periodo: string | null;
        tipo_cobranca: string | null;
        tipo_lancamento: string | null;
        tipo_movimentacao: string | null;
        hora: string;
      };

      pdfs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return metasList.map((meta) => {
        const escala = meta.usuarios || [];
        const snapshot = Array.isArray(meta.empresas_snapshot) ? meta.empresas_snapshot : [];
        const snapshotSet = new Set(snapshot);
        const hasSnapshot = snapshot.length > 0;
        const iniciadaEm = meta.iniciada_em ? new Date(meta.iniciada_em).getTime() : 0;

        const porUsuario: Record<string, Item[]> = {};
        pdfs.forEach((a) => {
          const created = new Date(a.created_at);
          if (created.toLocaleDateString("en-CA") !== meta.data) return;
          if (iniciadaEm > 0 && created.getTime() < iniciadaEm) return;
          if (hasSnapshot && !snapshotSet.has(a.financeiro_movimentacao_id)) return;

          const uploaderName = nomesMap[a.uploaded_by];
          if (!uploaderName) return;
          const nome = attributeName(uploaderName, escala);
          if (!nome) return;

          const m = movMap[a.financeiro_movimentacao_id];
          const emp = m?.empresa_id ? empMap[m.empresa_id] : null;
          const op = m ? opMap[`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`] : null;

          porUsuario[nome] = porUsuario[nome] || [];
          porUsuario[nome].push({
            empresa: resolverPagador(a.financeiro_movimentacao_id, a.nome_arquivo, m?.empresa_id ?? null),
            codigo: emp?.codigo_contrato ?? null,
            mes: m?.mes_referencia ?? null,
            periodo: m?.periodo ?? null,
            tipo_cobranca: m?.tipo_cobranca ?? null,
            tipo_lancamento: m?.tipo_lancamento ?? null,
            tipo_movimentacao: op?.tipo_movimentacao ?? null,
            hora: created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          });
        });

        const nomesAtivos = new Set<string>([...escala, ...Object.keys(porUsuario)]);
        const usuarios = Array.from(nomesAtivos).map((nome) => ({
          nome,
          itens: porUsuario[nome] || [],
        }));
        usuarios.sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome));
        const totalEmitidas = usuarios.reduce((s, u) => s + u.itens.length, 0);
        return { data: meta.data, valor: meta.valor, usuarios, totalEmitidas };
      });
    },
  });

  const formatarData = (s: string) => {
    const [y, mo, d] = s.split("-");
    return `${d}/${mo}/${y}`;
  };

  const labelLancamento = (t: string | null) => {
    if (!t) return null;
    const map: Record<string, string> = {
      normal: "Não-prorata",
      primeira_mensalidade: "Primeira mensalidade",
      fechamento_periodo: "Fechamento de período",
      prorata: "Prorata",
    };
    return map[t] || t;
  };

  const corTipoMov = (t: string | null) => {
    const norm = (t || "").toLowerCase();
    if (norm.includes("inclus")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    if (norm.includes("exclus")) return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="h-4 w-4 mr-1" /> Histórico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Histórico de metas diárias</DialogTitle>
            <DialogDescription>
              Detalhamento das empresas emitidas por cada usuário, com tipo de cobrança, tipo de
              movimentação (inclusão/exclusão) e tipo de lançamento (prorata/não-prorata).
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma meta registrada ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {historico.map((h: any) => {
                  const pct = h.valor > 0 ? Math.min(100, Math.round((h.totalEmitidas / h.valor) * 100)) : 0;
                  return (
                    <Card key={h.data} className="p-5 border-l-4 border-l-primary/60">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <CalendarRange className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-base">{formatarData(h.data)}</div>
                            <div className="text-xs text-muted-foreground">
                              {h.usuarios.length} usuário{h.usuarios.length !== 1 ? "s" : ""} ativo{h.usuarios.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Meta</div>
                            <div className="text-xl font-bold tabular-nums">{h.valor}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Emitidas</div>
                            <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {h.totalEmitidas}
                            </div>
                          </div>
                          <div className="text-right min-w-[60px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">%</div>
                            <div className={cn(
                              "text-xl font-bold tabular-nums",
                              pct >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                              pct >= 50 ? "text-blue-600 dark:text-blue-400" :
                              "text-amber-600 dark:text-amber-400"
                            )}>
                              {pct}%
                            </div>
                          </div>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2 mb-4" />

                      {h.usuarios.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem usuários na escala.</p>
                      ) : (
                        <div className="space-y-3">
                          {h.usuarios.map((u: any) => (
                            <div key={u.nome} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                                <div className="flex items-center gap-2">
                                  <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                                    {getIniciais(u.nome)}
                                  </span>
                                  <span className="font-semibold">{u.nome}</span>
                                </div>
                                <Badge variant="secondary" className="tabular-nums">
                                  {u.itens.length} empresa{u.itens.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                              {u.itens.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-muted-foreground italic">
                                  Nenhuma nota emitida.
                                </p>
                              ) : (
                                <ul className="divide-y divide-border">
                                  {u.itens.map((it: any, i: number) => (
                                    <li key={i} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
                                      <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-sm truncate">{it.empresa}</div>
                                          <div className="text-[11px] text-muted-foreground mt-0.5">
                                            {it.codigo || "—"}
                                            {it.mes && ` · ${formatMesReferencia(it.mes)}`}
                                            {it.periodo && ` · ${it.periodo}`}
                                            <span className="ml-2">⏱ {it.hora}</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                          {it.tipo_movimentacao && (
                                            <Badge variant="outline" className={cn("text-[10px] h-5", corTipoMov(it.tipo_movimentacao))}>
                                              {it.tipo_movimentacao}
                                            </Badge>
                                          )}
                                          {it.tipo_cobranca && (
                                            <Badge variant="outline" className="text-[10px] h-5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                                              {it.tipo_cobranca}
                                            </Badge>
                                          )}
                                          {it.tipo_lancamento && (
                                            <Badge variant="outline" className="text-[10px] h-5 bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30">
                                              {labelLancamento(it.tipo_lancamento)}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


