import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, Calendar, Search, Filter, ChevronDown, CheckCircle2,
  Clock, AlertTriangle, FileX, Timer, Loader2, TrendingUp, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date-utils";
import { getCurrentMesReferencia, formatMesReferencia, PERIODOS_FIN } from "@/lib/financeiro-utils";

/* ─── Types ─── */
type StatusEnvio =
  | "Concluído"
  | "Nota pendente"
  | "Financeiro atrasado"
  | "Financeiro crítico"
  | "Anexo em atraso"
  | "Sem anexo"
  | "Sem movimentação";

interface AnaliseRow {
  key: string;
  empresa_id: string;
  empresa_nome: string;
  competencia: string;
  periodo: string;
  deadlineCadastro: Date;
  primeiroAnexo: Date | null;
  envioNota: Date | null;
  atrasoCadastro: number | null; // dias (positivo = atraso)
  tempoFinanceiro: number | null; // dias entre 1º anexo e envio da nota
  status: StatusEnvio;
  mov_id: string | null;
}

const PERIODO_FIM: Record<string, number> = {
  "01-05": 5, "05-10": 10, "10-15": 15, "15-20": 20, "20-25": 25, "25-30": 30,
};

function diffDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function ultimasCompetencias(n: number): string[] {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}

function statusBadgeClass(s: StatusEnvio): string {
  switch (s) {
    case "Concluído": return "bg-success/15 text-success border border-success/30";
    case "Nota pendente": return "bg-warning/15 text-warning border border-warning/30";
    case "Financeiro atrasado": return "bg-amber-500/15 text-amber-600 border border-amber-500/30";
    case "Financeiro crítico": return "bg-destructive/15 text-destructive border border-destructive/30";
    case "Anexo em atraso": return "bg-amber-500/15 text-amber-600 border border-amber-500/30";
    case "Sem anexo": return "bg-destructive/15 text-destructive border border-destructive/30";
    case "Sem movimentação": return "bg-muted text-muted-foreground border border-border";
  }
}

const STATUS_OPTS: (StatusEnvio | "Todos")[] = [
  "Todos", "Concluído", "Nota pendente", "Financeiro atrasado", "Financeiro crítico", "Anexo em atraso", "Sem anexo", "Sem movimentação",
];

export function AnalisesEnviosPanel() {
  const mesAtual = getCurrentMesReferencia();
  const competenciasOpts = useMemo(() => ultimasCompetencias(12), []);
  const [competenciasSel, setCompetenciasSel] = useState<string[]>([mesAtual]);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<StatusEnvio | "Todos">("Todos");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<AnaliseRow | null>(null);

  /* ─── Data ─── */
  const { data: empresas = [] } = useQuery({
    queryKey: ["analises-envios-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, status_empresa, contrato_suspenso, periodo_movimentacao")
        .eq("status_empresa", "Ativa");
      if (error) throw error;
      return (data ?? []).filter((e: any) => !e.contrato_suspenso && e.periodo_movimentacao);
    },
  });

  const { data: movs = [], isLoading: loadingMovs } = useQuery({
    queryKey: ["analises-envios-movs", competenciasSel.join(",")],
    enabled: competenciasSel.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo, dia_emissao, data_envio_nota, aguardando_nota_em, data_vencimento")
        .in("mes_referencia", competenciasSel);
      if (error) throw error;
      return data ?? [];
    },
  });

  const movIds = useMemo(() => (movs as any[]).map((m) => m.id), [movs]);

  const { data: anexos = [] } = useQuery({
    queryKey: ["analises-envios-anexos", movIds.join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("id, financeiro_movimentacao_id, created_at, origem")
        .in("financeiro_movimentacao_id", movIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ─── Build rows ─── */
  const rows = useMemo<AnaliseRow[]>(() => {
    const anexosPorMov = new Map<string, any[]>();
    for (const a of anexos as any[]) {
      const list = anexosPorMov.get(a.financeiro_movimentacao_id) ?? [];
      list.push(a);
      anexosPorMov.set(a.financeiro_movimentacao_id, list);
    }
    const movMap = new Map<string, any>();
    for (const m of movs as any[]) {
      movMap.set(`${m.empresa_id}__${m.mes_referencia}__${m.periodo}`, m);
    }

    const out: AnaliseRow[] = [];
    const hoje = new Date();

    for (const comp of competenciasSel) {
      const [y, mo] = comp.split("-").map(Number);
      for (const emp of empresas as any[]) {
        const periodo = emp.periodo_movimentacao as string;
        const fim = PERIODO_FIM[periodo];
        if (!fim) continue;
        const mov = movMap.get(`${emp.id}__${comp}__${periodo}`);
        const anexosMov = mov ? (anexosPorMov.get(mov.id) ?? []) : [];
        const diaEmissao = mov?.dia_emissao ?? null;
        // Regra especial: movimentações de fim de mês (período 25-30) ou
        // emissão no dia 01 só têm nota emitida no 1º dia útil do mês seguinte.
        // Assim, o prazo do Cadastro é estendido para o dia 02 do mês seguinte.
        const emissaoNoMesSeguinte = periodo === "25-30" || diaEmissao === 1;
        const deadlineCadastro = emissaoNoMesSeguinte
          ? new Date(y, mo, 2, 12, 0, 0)
          : diaEmissao
          ? new Date(y, mo - 1, diaEmissao, 12, 0, 0)
          : new Date(y, mo - 1, fim + 2, 12, 0, 0);
        const primeiroAnexo = anexosMov[0]?.created_at ? new Date(anexosMov[0].created_at) : null;
        const envioNota = mov?.data_envio_nota ? new Date(mov.data_envio_nota) : null;

        // Tempo do Financeiro: dias entre 1º anexo e envio da nota.
        // Se ainda não enviou, conta os dias entre o 1º anexo e HOJE.
        const tempoFinanceiro = primeiroAnexo
          ? envioNota
            ? diffDays(envioNota, primeiroAnexo)
            : diffDays(hoje, primeiroAnexo)
          : null;

        let status: StatusEnvio;
        if (!mov) status = "Sem movimentação";
        else if (envioNota) status = "Concluído";
        else if (!primeiroAnexo) {
          status = hoje > deadlineCadastro ? "Sem anexo" : "Nota pendente";
        } else if (primeiroAnexo > deadlineCadastro) status = "Anexo em atraso";
        else if (tempoFinanceiro != null && tempoFinanceiro >= 5) status = "Financeiro crítico";
        else if (tempoFinanceiro != null && tempoFinanceiro >= 3) status = "Financeiro atrasado";
        else status = "Nota pendente";

        out.push({
          key: `${emp.id}__${comp}__${periodo}`,
          empresa_id: emp.id,
          empresa_nome: emp.nome,
          competencia: comp,
          periodo,
          deadlineCadastro,
          primeiroAnexo,
          envioNota,
          atrasoCadastro: primeiroAnexo ? diffDays(primeiroAnexo, deadlineCadastro) : null,
          tempoFinanceiro,
          status,
          mov_id: mov?.id ?? null,
        });
      }
    }
    return out;
  }, [empresas, movs, anexos, competenciasSel]);

  /* ─── Filters ─── */
  const rowsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (periodoFiltro !== "todos" && r.periodo !== periodoFiltro) return false;
      if (statusFiltro !== "Todos" && r.status !== statusFiltro) return false;
      if (q && !r.empresa_nome.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      // Priorizar atrasos maiores no topo
      const aa = a.atrasoCadastro ?? -999;
      const bb = b.atrasoCadastro ?? -999;
      return bb - aa;
    });
  }, [rows, periodoFiltro, statusFiltro, busca]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const total = rowsFiltrados.length;
    const concl = rowsFiltrados.filter((r) => r.status === "Concluído").length;
    const semAnexo = rowsFiltrados.filter((r) => r.status === "Sem anexo").length;
    const atraso = rowsFiltrados.filter((r) => r.status === "Anexo em atraso").length;
    const pend = rowsFiltrados.filter((r) => r.status === "Nota pendente").length;
    const atrasosCad = rowsFiltrados
      .filter((r) => r.atrasoCadastro != null && r.atrasoCadastro > 0)
      .map((r) => r.atrasoCadastro as number);
    const temposFin = rowsFiltrados
      .filter((r) => r.tempoFinanceiro != null)
      .map((r) => r.tempoFinanceiro as number);
    const mediaAtrasoCad = atrasosCad.length
      ? (atrasosCad.reduce((s, x) => s + x, 0) / atrasosCad.length).toFixed(1)
      : "0";
    const mediaTempoFin = temposFin.length
      ? (temposFin.reduce((s, x) => s + x, 0) / temposFin.length).toFixed(1)
      : "0";
    return { total, concl, semAnexo, atraso, pend, mediaAtrasoCad, mediaTempoFin };
  }, [rowsFiltrados]);

  /* ─── UI ─── */
  const toggleComp = (c: string) => {
    setCompetenciasSel((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  return (
    <Card className="rounded-2xl shadow-sm border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
                <BarChart3 className="h-5 w-5" />
              </div>
              Análises de envios
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 ml-11">
              Controle interno de prazos: quando o Cadastro anexa e quando o Financeiro envia a nota.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-2">
          {/* Multi-competência */}
          <div className="md:col-span-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-10">
                  <span className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate text-sm">
                      {competenciasSel.length === 0
                        ? "Selecione competências"
                        : competenciasSel.length === 1
                        ? formatMesReferencia(competenciasSel[0])
                        : `${competenciasSel.length} competências`}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Competências</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                      onClick={() => setCompetenciasSel(competenciasOpts)}>Todas</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                      onClick={() => setCompetenciasSel([mesAtual])}>Atual</Button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {competenciasOpts.map((c) => {
                    const on = competenciasSel.includes(c);
                    return (
                      <label
                        key={c}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                          on ? "bg-primary/10 text-foreground" : "hover:bg-accent",
                        )}
                      >
                        <Checkbox checked={on} onCheckedChange={() => toggleComp(c)} />
                        <span className="flex-1">{formatMesReferencia(c)}</span>
                        {c === mesAtual && <Badge variant="outline" className="text-[10px] h-4">atual</Badge>}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Período */}
          <div className="md:col-span-2">
            <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
              <SelectTrigger className="h-10">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os períodos</SelectItem>
                {PERIODOS_FIN.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="md:col-span-3">
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Busca */}
          <div className="md:col-span-3 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder="Buscar empresa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <KpiMini label="Total" value={kpis.total} icon={Building2} tone="default" />
          <KpiMini label="Concluídos" value={kpis.concl} icon={CheckCircle2} tone="success" />
          <KpiMini label="Nota pendente" value={kpis.pend} icon={Clock} tone="warning" />
          <KpiMini label="Anexo em atraso" value={kpis.atraso} icon={AlertTriangle} tone="amber" />
          <KpiMini label="Sem anexo" value={kpis.semAnexo} icon={FileX} tone="destructive" />
          <KpiMini label="Média atraso Cad." value={`${kpis.mediaAtrasoCad}d`} icon={Timer} tone="amber" />
          <KpiMini label="Média Financeiro" value={`${kpis.mediaTempoFin}d`} icon={TrendingUp} tone="default" />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="max-h-[65vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[240px]">Empresa</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Prazo cadastro</TableHead>
                  <TableHead>1º anexo</TableHead>
                  <TableHead className="text-center">Atraso Cad.</TableHead>
                  <TableHead>Envio nota</TableHead>
                  <TableHead className="text-center">Tempo Fin.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovs ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> Carregando...
                  </TableCell></TableRow>
                ) : rowsFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum registro para os filtros atuais.
                  </TableCell></TableRow>
                ) : rowsFiltrados.map((r) => (
                  <TableRow key={r.key} className="hover:bg-accent/40">
                    <TableCell className="font-medium">{r.empresa_nome}</TableCell>
                    <TableCell className="text-sm">{formatMesReferencia(r.competencia)}</TableCell>
                    <TableCell className="text-sm">{r.periodo}</TableCell>
                    <TableCell className="text-sm">{formatDateBR(r.deadlineCadastro.toISOString().slice(0, 10))}</TableCell>
                    <TableCell className="text-sm">
                      {r.primeiroAnexo ? formatDateBR(r.primeiroAnexo.toISOString().slice(0, 10)) : "—"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-center text-sm font-semibold",
                      r.atrasoCadastro == null ? "text-muted-foreground" :
                      r.atrasoCadastro > 0 ? "text-destructive" : "text-success",
                    )}>
                      {r.atrasoCadastro == null ? "—" : `${r.atrasoCadastro > 0 ? "+" : ""}${r.atrasoCadastro}d`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.envioNota ? formatDateBR(r.envioNota.toISOString().slice(0, 10)) : "—"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-center text-sm font-semibold",
                      r.tempoFinanceiro == null ? "text-muted-foreground" :
                      r.tempoFinanceiro >= 5 ? "text-destructive" :
                      r.tempoFinanceiro >= 3 ? "text-amber-600" : "text-success",
                    )}>
                      {r.tempoFinanceiro == null ? "—" : `${r.tempoFinanceiro}d`}
                    </TableCell>
                    <TableCell><Badge className={statusBadgeClass(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDetalhe(r)}>
                        <BarChart3 className="h-3.5 w-3.5" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      <TimelineDialog alvo={detalhe} onClose={() => setDetalhe(null)} />
    </Card>
  );
}

function KpiMini({
  label, value, icon: Icon, tone,
}: {
  label: string; value: number | string; icon: any;
  tone: "default" | "success" | "warning" | "destructive" | "amber";
}) {
  const map = {
    default: "text-foreground bg-muted",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    amber: "text-amber-600 bg-amber-500/10",
  } as const;
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-2.5">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", map[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

/* ─── Timeline dialog ─── */
function TimelineDialog({ alvo, onClose }: { alvo: AnaliseRow | null; onClose: () => void }) {
  const open = !!alvo;
  const { data } = useQuery({
    queryKey: ["analises-envios-detalhe", alvo?.mov_id],
    enabled: open && !!alvo?.mov_id,
    queryFn: async () => {
      const { data: ax } = await supabase
        .from("anexos_financeiro")
        .select("id, nome_arquivo, created_at, uploaded_by, origem")
        .eq("financeiro_movimentacao_id", alvo!.mov_id!)
        .order("created_at", { ascending: true });
      const uids = Array.from(new Set((ax ?? []).map((a: any) => a.uploaded_by).filter(Boolean))) as string[];
      let map = new Map<string, string>();
      if (uids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, display_name").in("user_id", uids);
        map = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name || "—"]));
      }
      return { anexos: ax ?? [], nomes: map };
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise detalhada de envios
          </DialogTitle>
          <DialogDescription>
            {alvo?.empresa_nome} · Período {alvo?.periodo} · {alvo && formatMesReferencia(alvo.competencia)}
          </DialogDescription>
        </DialogHeader>

        {!alvo ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricBox
                label="Atraso do Cadastro"
                value={
                  alvo.atrasoCadastro == null
                    ? "— sem anexo"
                    : `${alvo.atrasoCadastro > 0 ? "+" : ""}${alvo.atrasoCadastro} dia(s)`
                }
                hint={`Prazo: ${formatDateBR(alvo.deadlineCadastro.toISOString().slice(0, 10))}`}
                bad={alvo.atrasoCadastro != null && alvo.atrasoCadastro > 0}
                good={alvo.atrasoCadastro != null && alvo.atrasoCadastro <= 0}
              />
              <MetricBox
                label="Tempo do Financeiro"
                value={
                  alvo.tempoFinanceiro == null
                    ? alvo.primeiroAnexo ? "Nota ainda não enviada" : "—"
                    : `${alvo.tempoFinanceiro} dia(s)`
                }
                hint={
                  alvo.envioNota
                    ? `Nota enviada em ${formatDateBR(alvo.envioNota.toISOString().slice(0, 10))}`
                    : alvo.primeiroAnexo
                    ? "Contando desde o 1º anexo (limite: 2 dias)"
                    : "Aguardando envio"
                }
                bad={alvo.tempoFinanceiro != null && alvo.tempoFinanceiro >= 5}
                warn={alvo.tempoFinanceiro != null && alvo.tempoFinanceiro >= 3 && alvo.tempoFinanceiro < 5}
                good={alvo.tempoFinanceiro != null && alvo.tempoFinanceiro <= 2}
              />
                    : `${alvo.tempoFinanceiro} dia(s)`
                }
                hint={
                  alvo.envioNota
                    ? `Nota enviada em ${formatDateBR(alvo.envioNota.toISOString().slice(0, 10))}`
                    : "Aguardando envio"
                }
                bad={alvo.tempoFinanceiro != null && alvo.tempoFinanceiro > 2}
                good={alvo.tempoFinanceiro != null && alvo.tempoFinanceiro <= 2}
              />
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linha do tempo</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">Prazo do Cadastro</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(alvo.deadlineCadastro.toISOString().slice(0, 10))}
                    </p>
                  </div>
                </li>
                {(data?.anexos ?? []).length === 0 ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Nenhum anexo registrado</p>
                      <p className="text-xs text-muted-foreground">Cadastro ainda não enviou o faturamento.</p>
                    </div>
                  </li>
                ) : data!.anexos.map((a: any) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.nome_arquivo}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")} · por {data!.nomes.get(a.uploaded_by) ?? "—"}
                        {a.origem && a.origem !== "normal" ? ` · ${a.origem}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
                {alvo.envioNota ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-success shrink-0" />
                    <div>
                      <p className="font-medium">Nota enviada pelo Financeiro</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(alvo.envioNota.toISOString().slice(0, 10))}
                      </p>
                    </div>
                  </li>
                ) : (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Nota ainda não enviada</p>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricBox({
  label, value, hint, bad, good,
}: { label: string; value: string; hint: string; bad?: boolean; good?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      bad ? "border-destructive/30 bg-destructive/5" :
      good ? "border-success/30 bg-success/5" : "bg-muted/30",
    )}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold", bad ? "text-destructive" : good ? "text-success" : "text-foreground")}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}
