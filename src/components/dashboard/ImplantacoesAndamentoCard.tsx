import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Building2,
  UserCheck,
  FileWarning,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_META } from "@/lib/implantacao-status";
import { formatDateBR } from "@/lib/date-utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type ImplRow = {
  id: string;
  nome_empresa: string | null;
  codigo_contrato: string | null;
  status: string;
  etapa_atual: number;
  progresso: number;
  total_vidas: number | null;
  vidas_titulares: number | null;
  vidas_dependentes: number | null;
  inicio_atendimento: string | null;
  data_vigencia: string | null;
  data_vencimento: string | null;
  created_at: string;
  updated_at: string;
  created_by_nome: string | null;
  enviado_diretoria_em: string | null;
  enviado_diretoria_por_nome: string | null;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  enviado_cadastro_em: string | null;
  implantado_em: string | null;
  implantado_por_nome: string | null;
  motivo_correcao: string | null;
  relatorio_validacao: any;
};

function progressColor(pct: number, atrasado: boolean) {
  if (atrasado) return "bg-red-500";
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function isAtrasado(row: ImplRow) {
  if (!row.data_vigencia) return false;
  if (["implantado", "rejeitado"].includes(row.status)) return false;
  return new Date(row.data_vigencia) < new Date();
}

const FAIXAS_VIDAS = [
  { value: "all", label: "Todas as faixas" },
  { value: "lt50", label: "< 50 vidas" },
  { value: "50-200", label: "50–200 vidas" },
  { value: "200-500", label: "200–500 vidas" },
  { value: "gt500", label: "500+ vidas" },
];

const STATUS_OPTIONS = [
  "em_implantacao",
  "documentacao_pendente",
  "em_analise_diretoria",
  "aprovado_diretoria",
  "enviado_cadastro",
  "necessita_correcao",
  "implantado",
  "rejeitado",
];

function MiniTimeline({ row }: { row: ImplRow }) {
  const steps = [
    { key: "created_at", label: "Criação", date: row.created_at },
    { key: "enviado_diretoria_em", label: "Diretoria", date: row.enviado_diretoria_em },
    { key: "aprovado_em", label: "Aprovação", date: row.aprovado_em },
    { key: "enviado_cadastro_em", label: "Cadastro", date: row.enviado_cadastro_em },
    { key: "implantado_em", label: "Implantado", date: row.implantado_em },
  ];
  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((s, i) => {
        const done = !!s.date;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                  done
                    ? "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                    : "bg-background border-muted-foreground/30"
                }`}
                title={s.date ? `${s.label}: ${formatDateBR(s.date)}` : s.label}
              />
              <span className={`text-[10px] leading-none ${done ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 ${done ? "bg-primary/60" : "bg-muted-foreground/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImplantacoesAndamentoCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isVendas } = useAuth();
  const canDelete = isAdmin || isVendas;
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("excluir_implantacao" as any, { p_id: deleteTarget.id });
      if (error) throw error;
      const paths = ((data as any)?.storage_paths || []) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("implantacao-anexos").remove(paths).catch(() => {});
      }
      toast.success("Implantação excluída");
      queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
      queryClient.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
      queryClient.invalidateQueries({ queryKey: ["implantacao-alertas-count"] });
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir implantação");
    } finally {
      setDeleting(false);
    }
  };
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterResponsavel, setFilterResponsavel] = useState("all");
  const [filterMes, setFilterMes] = useState("all");
  const [filterVidas, setFilterVidas] = useState("all");
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  const { data: implantacoes = [], isLoading } = useQuery({
    queryKey: ["implantacoes-andamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos")
        .select(
          "id, nome_empresa, codigo_contrato, status, etapa_atual, progresso, total_vidas, vidas_titulares, vidas_dependentes, inicio_atendimento, data_vigencia, data_vencimento, created_at, updated_at, created_by_nome, enviado_diretoria_em, enviado_diretoria_por_nome, aprovado_em, aprovado_por_nome, enviado_cadastro_em, implantado_em, implantado_por_nome, motivo_correcao, relatorio_validacao"
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ImplRow[];
    },
  });

  const { data: alertasCount = {} } = useQuery({
    queryKey: ["implantacao-alertas-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_alertas")
        .select("implantacao_id, status")
        .eq("status", "Pendente");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        map[a.implantacao_id] = (map[a.implantacao_id] || 0) + 1;
      });
      return map;
    },
  });

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    implantacoes.forEach((r) => {
      if (r.aprovado_por_nome) set.add(r.aprovado_por_nome);
    });
    return Array.from(set).sort();
  }, [implantacoes]);

  const meses = useMemo(() => {
    const set = new Set<string>();
    implantacoes.forEach((r) => {
      const d = r.inicio_atendimento || r.created_at;
      if (d) set.add(d.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [implantacoes]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("impl-andamento-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "implantacoes_contratos" },
        () => queryClient.invalidateQueries({ queryKey: ["implantacoes-andamento"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "implantacao_alertas" },
        () => queryClient.invalidateQueries({ queryKey: ["implantacao-alertas-count"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const list = implantacoes.filter((r) => {
      if (!mostrarConcluidos && ["implantado", "rejeitado"].includes(r.status)) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterResponsavel !== "all" && r.aprovado_por_nome !== filterResponsavel) return false;
      if (filterMes !== "all") {
        const d = r.inicio_atendimento || r.created_at;
        if (!d || !d.startsWith(filterMes)) return false;
      }
      if (filterVidas !== "all") {
        const v = r.total_vidas || 0;
        if (filterVidas === "lt50" && v >= 50) return false;
        if (filterVidas === "50-200" && (v < 50 || v > 200)) return false;
        if (filterVidas === "200-500" && (v < 200 || v > 500)) return false;
        if (filterVidas === "gt500" && v <= 500) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (r.nome_empresa || "").toLowerCase().includes(q) ||
          (r.codigo_contrato || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    // Prioriza "Disponível para análise" no topo
    return [...list].sort((a, b) => {
      const aP = a.status === "em_analise_diretoria" ? 0 : 1;
      const bP = b.status === "em_analise_diretoria" ? 0 : 1;
      return aP - bP;
    });
  }, [implantacoes, mostrarConcluidos, filterStatus, filterResponsavel, filterMes, filterVidas, search]);

  const kpis = useMemo(() => {
    const base = implantacoes.filter((r) => !["implantado", "rejeitado"].includes(r.status));
    return {
      total: base.length,
      aguardando: base.filter((r) => r.status === "em_analise_diretoria").length,
      correcao: base.filter((r) => r.status === "necessita_correcao").length,
      atrasadas: base.filter((r) => isAtrasado(r)).length,
      vidas: base.reduce((acc, r) => acc + (r.total_vidas || 0), 0),
    };
  }, [implantacoes]);

  return (
    <Card className="rounded-xl shadow-sm overflow-hidden border-primary/10">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Implantações em Andamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhamento de contratos em implantação
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => navigate("/implantacao")}
          >
            Ver todas <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <KpiBox icon={<Activity className="h-4 w-4" />} label="Em andamento" value={kpis.total} tone="primary" />
          <KpiBox icon={<Clock className="h-4 w-4" />} label="Aguard. Diretoria" value={kpis.aguardando} tone="blue" />
          <KpiBox icon={<FileWarning className="h-4 w-4" />} label="Em correção" value={kpis.correcao} tone="amber" />
          <KpiBox icon={<AlertTriangle className="h-4 w-4" />} label="Atrasadas" value={kpis.atrasadas} tone="red" />
          <KpiBox icon={<Users className="h-4 w-4" />} label="Total vidas" value={kpis.vidas} tone="emerald" />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa ou contrato..."
              className="pl-8 h-9 rounded-lg"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[180px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s]?.label || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
            <SelectTrigger className="h-9 w-[180px] rounded-lg"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMes} onValueChange={setFilterMes}>
            <SelectTrigger className="h-9 w-[150px] rounded-lg"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterVidas} onValueChange={setFilterVidas}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg"><SelectValue placeholder="Vidas" /></SelectTrigger>
            <SelectContent>
              {FAIXAS_VIDAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={mostrarConcluidos ? "default" : "outline"}
            size="sm"
            className="rounded-lg h-9"
            onClick={() => setMostrarConcluidos((v) => !v)}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Concluídos
          </Button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando implantações...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma implantação encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.map((row) => {
              const atrasado = isAtrasado(row);
              const meta = STATUS_META[row.status];
              const pendencias = alertasCount[row.id] || 0;
              const rel: any = row.relatorio_validacao || {};
              const vidasAtivas = rel.vidas_ativas ?? rel.ativas ?? null;
              const vidasAguardando = rel.vidas_aguardando ?? rel.aguardando ?? null;
              const vidasProcessadas = rel.vidas_processadas ?? rel.processadas ?? null;

              return (
                <div
                  key={row.id}
                  onClick={() => navigate(`/implantacao?id=${row.id}`)}
                  className="group relative rounded-xl border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all cursor-pointer p-4 shadow-sm hover:shadow-md"
                >
                  {atrasado && (
                    <div className="absolute top-0 left-0 h-full w-1 bg-red-500 rounded-l-xl" />
                  )}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold truncate">{row.nome_empresa || "Sem nome"}</span>
                        {row.codigo_contrato && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {row.codigo_contrato}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {row.aprovado_por_nome || row.enviado_diretoria_por_nome || row.created_by_nome || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {row.inicio_atendimento ? formatDateBR(row.inicio_atendimento) : "Sem data"}
                        </span>
                        {row.data_vigencia && (
                          <span className={`flex items-center gap-1 ${atrasado ? "text-red-600 font-medium" : ""}`}>
                            <Clock className="h-3 w-3" />
                            Prazo: {formatDateBR(row.data_vigencia)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        {meta && (
                          <Badge className={`${meta.badge} border text-[10px]`} variant="outline">
                            {meta.label}
                          </Badge>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: row.id, nome: row.nome_empresa || "Sem nome" });
                            }}
                            title="Excluir implantação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {pendencias > 0 && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-[10px]" variant="outline">
                          {pendencias} pendência{pendencias > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progresso */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Etapa {row.etapa_atual || 0}/7 · Progresso
                      </span>
                      <span className="font-semibold">{row.progresso || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${progressColor(row.progresso || 0, atrasado)} transition-all`}
                        style={{ width: `${Math.min(100, Math.max(0, row.progresso || 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Vidas */}
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <VidasBox label="Total" value={row.total_vidas} />
                    <VidasBox label="Ativas" value={vidasAtivas} accent="emerald" />
                    <VidasBox label="Aguard." value={vidasAguardando} accent="amber" />
                    <VidasBox label="Proc." value={vidasProcessadas} accent="primary" />
                  </div>

                  {/* Correção */}
                  {row.motivo_correcao && row.status === "necessita_correcao" && (
                    <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700">
                      <strong>Correção solicitada:</strong> {row.motivo_correcao}
                    </div>
                  )}

                  {/* Timeline */}
                  <MiniTimeline row={row} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir implantação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o contrato <strong>{deleteTarget?.nome}</strong>,
              seus anexos, alertas e histórico. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function KpiBox({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "blue" | "amber" | "red" | "emerald";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    red: "bg-red-500/10 text-red-600 border-red-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon} {label}
      </div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function VidasBox({ label, value, accent }: { label: string; value: number | null | undefined; accent?: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    primary: "text-primary",
  };
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${accent ? tones[accent] : ""}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
