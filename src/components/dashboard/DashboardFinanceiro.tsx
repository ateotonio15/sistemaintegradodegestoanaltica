import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Building2,
  CalendarClock,
  AlertTriangle,
  Wallet,
  Clock,
  X,
  TimerOff,
  BarChart3,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date-utils";
import { FaturamentosEnviadoFinanceiro } from "./FaturamentosEnviadoFinanceiro";
import { AlertasVencimentoFinanceiro } from "./AlertasVencimentoFinanceiro";
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
import { AlertaRetroativosParaCobrar } from "@/components/reajustes/AlertaRetroativosParaCobrar";


import { ImplantacoesAguardandoFechamentoCard } from "./ImplantacoesAguardandoFechamentoCard";
import { calcularStatusFinanceiro, getCurrentMesReferencia, formatMesReferencia, PERIODOS_FIN } from "@/lib/financeiro-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface CobrancaRow {
  id: string;
  motivo: string;
  data: string;
  observacao: string | null;
  status: string;
  financeiro_movimentacao_id: string;
  empresa_id: string;
  empresa_nome: string;
}

interface ForaPrazoItem {
  empresa_id: string;
  empresa_nome: string;
  periodo: string;
  data_limite: Date;
  dias_atraso: number;
  responsavel_user_id: string | null;
  mov_id: string | null;
}


/* ─── Helpers para "Fora do prazo" ─── */
const PERIODO_FIM: Record<string, number> = {
  "01-05": 5,
  "05-10": 10,
  "10-15": 15,
  "15-20": 20,
  "20-25": 25,
  "25-30": 30,
};

function getDataLimitePeriodo(mesRef: string, periodo: string): Date | null {
  const fim = PERIODO_FIM[periodo];
  if (!fim) return null;
  const [y, m] = mesRef.split("-").map(Number);
  // limite = fim do período + 2 dias (data até a qual ainda está no prazo)
  const d = new Date(y, m - 1, fim + 2, 23, 59, 59, 999);
  return d;
}

export function DashboardFinanceiro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mesAtual = getCurrentMesReferencia();
  const [competenciaSel, setCompetenciaSel] = useState<string>(mesAtual);
  const [foraPrazoFiltro, setForaPrazoFiltro] = useState<string>("todos");
  const [removerAlvo, setRemoverAlvo] = useState<{ empresa_id: string; empresa_nome: string; periodo: string } | null>(
    null,
  );
  const [analiseAlvo, setAnaliseAlvo] = useState<ForaPrazoItem | null>(null);
  const [cobrancaOpen, setCobrancaOpen] = useState(false);

  // Últimas 12 competências (mês/ano) — YYYY-MM
  const competenciasOptions = useMemo(() => {
    const arr: string[] = [];
    const [y, m] = mesAtual.split("-").map(Number);
    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 1 - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, [mesAtual]);


  const { data: empresas = [] } = useQuery({
    queryKey: ["fin-dash-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nome, status_empresa, contrato_suspenso, responsavel_user_id, executiva_user_id, data_vencimento_fatura, periodo_movimentacao",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["fin-dash-movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo, data_envio_nota, data_vencimento, dentro_prazo, aguardando_nota_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["fin-dash-anexos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("id, financeiro_movimentacao_id, mime_type, nome_arquivo, created_at, uploaded_by, origem");
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: cobrancas = [] } = useQuery<CobrancaRow[]>({
    queryKey: ["fin-dash-cobrancas"],
    queryFn: async () => {
      const { data: cobs, error } = await supabase
        .from("cobrancas")
        .select("id, motivo, data, observacao, status, financeiro_movimentacao_id")
        .order("data", { ascending: false });
      if (error) throw error;
      if (!cobs || cobs.length === 0) return [];
      const movIds = cobs.map((c: any) => c.financeiro_movimentacao_id);
      const { data: ms } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id")
        .in("id", movIds);
      const movMap = new Map((ms ?? []).map((m: any) => [m.id, m.empresa_id]));
      const empIds = Array.from(new Set((ms ?? []).map((m: any) => m.empresa_id)));
      const { data: emps } = await supabase.from("empresas").select("id, nome").in("id", empIds);
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.nome]));
      return cobs.map((c: any) => ({
        ...c,
        empresa_id: movMap.get(c.financeiro_movimentacao_id) ?? "",
        empresa_nome: empMap.get(movMap.get(c.financeiro_movimentacao_id) ?? "") ?? "—",
      }));
    },
  });

  const { data: exclusoes = [] } = useQuery({
    queryKey: ["fora-prazo-exclusoes", competenciaSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fora_prazo_exclusoes")
        .select("empresa_id, periodo, mes_referencia")
        .eq("mes_referencia", competenciaSel);
      if (error) throw error;
      return data ?? [];
    },
  });

  const removerExclusaoMutation = useMutation({
    mutationFn: async (alvo: { empresa_id: string; periodo: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      const { error } = await supabase.from("fora_prazo_exclusoes").insert({
        empresa_id: alvo.empresa_id,
        periodo: alvo.periodo,
        mes_referencia: competenciaSel,
        removido_por: user?.id,
        removido_por_nome: profile?.display_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fora-prazo-exclusoes", competenciaSel] });
      toast({ title: "Empresa removida", description: "Empresa removida do painel para esta competência." });
      setRemoverAlvo(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });


  const minhasEmpresasIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(empresas.filter((e: any) => e.responsavel_user_id === user.id).map((e: any) => e.id));
  }, [empresas, user]);

  const cobrancasAbertas = cobrancas.filter((c) => c.status === "aberta");
  const cobrancasPagas = cobrancas.filter((c) => c.status === "paga");
  const cobrancasMinhas = cobrancasAbertas.filter((c) => minhasEmpresasIds.has(c.empresa_id));

  const ativas = empresas.filter((e: any) => e.status_empresa === "Ativa");
  const ativasNaoSuspensas = ativas.filter((e: any) => !e.contrato_suspenso);

  const notasEnviadas = movs.filter((m: any) => !!m.data_envio_nota).length;
  const aguardandoNota = movs.filter((m: any) => !m.data_envio_nota).length;

  /* ─── Empresas FORA DO PRAZO (competência atual) ─── */
  const anexosPorMov = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of anexos as any[]) {
      const list = map.get(a.financeiro_movimentacao_id) ?? [];
      list.push(a);
      map.set(a.financeiro_movimentacao_id, list);
    }
    return map;
  }, [anexos]);

  const exclusoesSet = useMemo(
    () => new Set(exclusoes.map((e: any) => `${e.empresa_id}__${e.periodo}`)),
    [exclusoes],
  );

  const foraPrazoTudo = useMemo<ForaPrazoItem[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const result: ForaPrazoItem[] = [];

    for (const emp of ativasNaoSuspensas as any[]) {
      const periodo = emp.periodo_movimentacao as string | null;
      if (!periodo || !PERIODO_FIM[periodo]) continue;
      const limite = getDataLimitePeriodo(competenciaSel, periodo);
      if (!limite) continue;
      if (hoje.getTime() <= limite.getTime()) continue; // ainda dentro do prazo

      // mov correspondente nesta competência
      const mov = (movs as any[]).find(
        (m) => m.empresa_id === emp.id && m.mes_referencia === competenciaSel && m.periodo === periodo,
      );
      const anexosMov = mov ? anexosPorMov.get(mov.id) ?? [] : [];
      const status = mov
        ? calcularStatusFinanceiro(mov, !!mov.aguardando_nota_em, anexosMov)
        : "Pendente";

      if (status !== "Pendente") continue;
      if (exclusoesSet.has(`${emp.id}__${periodo}`)) continue;

      const diff = Math.floor((hoje.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));
      result.push({
        empresa_id: emp.id,
        empresa_nome: emp.nome,
        periodo,
        data_limite: limite,
        dias_atraso: diff,
        responsavel_user_id: emp.responsavel_user_id ?? null,
        mov_id: mov?.id ?? null,
      });
    }
    return result.sort((a, b) => b.dias_atraso - a.dias_atraso);
  }, [ativasNaoSuspensas, movs, anexosPorMov, exclusoesSet, competenciaSel]);


  const foraPrazoFiltrado = useMemo(() => {
    if (foraPrazoFiltro === "todos") return foraPrazoTudo;
    return foraPrazoTudo.filter((e) => e.periodo === foraPrazoFiltro);
  }, [foraPrazoTudo, foraPrazoFiltro]);

  const totalPorPeriodo = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const e of foraPrazoTudo) agg[e.periodo] = (agg[e.periodo] ?? 0) + 1;
    return agg;
  }, [foraPrazoTudo]);

  return (
    <div className="space-y-6">
      <AlertaRetroativosParaCobrar />
      <AlertasVencimentoFinanceiro />
      <FaturamentosEnviadoFinanceiro />


      {cobrancasMinhas.length > 0 && (
        <Card className="rounded-xl border-warning/40 bg-warning/10 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Você possui {cobrancasMinhas.length} cobrança{cobrancasMinhas.length > 1 ? "s" : ""} pendente
                {cobrancasMinhas.length > 1 ? "s" : ""} nas suas empresas
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {cobrancasMinhas[0].empresa_nome} — {cobrancasMinhas[0].motivo}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/financeiro")} className="shrink-0">
              Registrar cobrança
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Contratos ativos" value={ativasNaoSuspensas.length} icon={Building2} accent="text-primary" bg="bg-primary/10" />
        <KpiCard label="Notas enviadas" value={notasEnviadas} icon={CheckCircle2} accent="text-success" bg="bg-success/10" />
        <KpiCard label="Aguardando Emissão" value={aguardandoNota} icon={CalendarClock} accent="text-warning" bg="bg-warning/10" />
        <KpiCard label="Cobranças abertas" value={cobrancasAbertas.length} icon={AlertCircle} accent="text-destructive" bg="bg-destructive/10" />
        <KpiCard label="Empresas fora do prazo" value={foraPrazoFiltrado.length} icon={TimerOff} accent="text-destructive" bg="bg-destructive/10" />
      </div>

      {/* Cobranças + Fora do prazo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cobranças pendentes */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Cobranças pendentes
              <Badge variant="outline" className="ml-1">{cobrancasAbertas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cobrancasAbertas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma cobrança pendente 🎉</p>
            ) : (
              cobrancasAbertas.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.empresa_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.motivo} · {formatDateBR(c.data)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">Aberta</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Empresas fora do prazo */}
        <Card className="rounded-xl shadow-sm border-destructive/20">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TimerOff className="h-4 w-4 text-destructive" />
                Empresas fora do prazo
                <Badge variant="destructive" className="ml-1">{foraPrazoFiltrado.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={competenciaSel} onValueChange={setCompetenciaSel}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciasOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatMesReferencia(c)} {c === mesAtual ? "(atual)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={foraPrazoFiltro} onValueChange={setForaPrazoFiltro}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os períodos</SelectItem>
                    {PERIODOS_FIN.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p} {totalPorPeriodo[p] ? `(${totalPorPeriodo[p]})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setCobrancaOpen(true)}
                  disabled={foraPrazoFiltrado.length === 0}
                >
                  <Mail className="h-3.5 w-3.5 mr-1" /> Cobrança por e-mail
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Competência {formatMesReferencia(competenciaSel)}
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{foraPrazoFiltrado.length}</strong> no filtro atual
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
            {foraPrazoFiltrado.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma empresa fora do prazo para o período selecionado.
              </p>
            ) : (
              foraPrazoFiltrado.map((e) => (
                <div
                  key={`${e.empresa_id}-${e.periodo}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-foreground">{e.empresa_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Período {e.periodo} · Limite {formatDateBR(e.data_limite.toISOString().slice(0, 10))} · {formatMesReferencia(competenciaSel)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {e.dias_atraso} {e.dias_atraso === 1 ? "dia" : "dias"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => setAnaliseAlvo(e)}
                    title="Ver análise de tempos"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoverAlvo({ empresa_id: e.empresa_id, empresa_nome: e.empresa_nome, periodo: e.periodo })}
                    title="Remover desta competência"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>



      {/* Contratos recém implantados aguardando primeiro fechamento */}
      <ImplantacoesAguardandoFechamentoCard />

      {/* Previsão financeira */}
      <PrevisaoFinanceira />

      {/* Confirmar remoção */}
      <AlertDialog open={!!removerAlvo} onOpenChange={(o) => !o && setRemoverAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removerAlvo?.empresa_nome}</strong> ({removerAlvo?.periodo}) deixará de aparecer em "Empresas fora do prazo" para a competência {formatMesReferencia(competenciaSel)}. Essa exceção fica registrada apenas para este mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removerAlvo &&
                removerExclusaoMutation.mutate({ empresa_id: removerAlvo.empresa_id, periodo: removerAlvo.periodo })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Análise de tempos por empresa */}
      <AnaliseTemposDialog
        alvo={analiseAlvo}
        competencia={competenciaSel}
        onClose={() => setAnaliseAlvo(null)}
      />

      {/* Cobrança por e-mail */}
      <CobrancaEmailDialog
        open={cobrancaOpen}
        onOpenChange={setCobrancaOpen}
        itens={foraPrazoFiltrado}
        empresas={empresas as any[]}
        competencia={competenciaSel}
      />
    </div>
  );
}


function KpiCard({ label, value, icon: Icon, accent, bg }: { label: string; value: number; icon: any; accent: string; bg: string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
          <Icon className={cn("h-5 w-5", accent)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   Análise de Tempos — dialog por empresa
   Mostra: dia_emissao (deadline), quando o cadastro anexou,
   quando o financeiro enviou a nota, e as métricas de atraso.
   ───────────────────────────────────────────────────────────── */
function AnaliseTemposDialog({
  alvo,
  competencia,
  onClose,
}: {
  alvo: ForaPrazoItem | null;
  competencia: string;
  onClose: () => void;
}) {
  const open = !!alvo;

  const { data, isLoading } = useQuery({
    queryKey: ["fora-prazo-analise", alvo?.empresa_id, alvo?.periodo, competencia],
    enabled: open && !!alvo,
    queryFn: async () => {
      const { data: mov } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, dia_emissao, data_envio_nota, aguardando_nota_em, data_vencimento, enviado_por_user_id, faturamento_iniciado_em, faturamento_iniciado_por_nome")
        .eq("empresa_id", alvo!.empresa_id)
        .eq("mes_referencia", competencia)
        .eq("periodo", alvo!.periodo)
        .maybeSingle();

      let anexos: any[] = [];
      let uploaderNames = new Map<string, string>();
      if (mov?.id) {
        const { data: ax } = await supabase
          .from("anexos_financeiro")
          .select("id, nome_arquivo, mime_type, created_at, uploaded_by, origem")
          .eq("financeiro_movimentacao_id", mov.id)
          .order("created_at", { ascending: true });
        anexos = ax ?? [];
        const uids = Array.from(new Set(anexos.map((a) => a.uploaded_by).filter(Boolean))) as string[];
        if (uids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", uids);
          uploaderNames = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name || "—"]));
        }
      }
      return { mov, anexos, uploaderNames };
    },
  });

  const analise = useMemo(() => {
    if (!alvo || !data) return null;
    const { mov, anexos } = data;
    const diaEmissao = mov?.dia_emissao ?? null;
    const [y, m] = competencia.split("-").map(Number);
    // Deadline "de emissão" = dia_emissao do mês da competência (ou fim do período do cadastro)
    const deadlineCadastro = diaEmissao
      ? new Date(y, m - 1, diaEmissao, 23, 59, 59)
      : alvo.data_limite;
    const primeiroAnexo = anexos[0]?.created_at ? new Date(anexos[0].created_at) : null;
    const envioNota = mov?.data_envio_nota ? new Date(mov.data_envio_nota) : null;

    const diffDays = (a: Date, b: Date) =>
      Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

    return {
      diaEmissao,
      deadlineCadastro,
      primeiroAnexo,
      envioNota,
      atrasoCadastro: primeiroAnexo ? diffDays(primeiroAnexo, deadlineCadastro) : null,
      tempoFinanceiro: envioNota && primeiroAnexo ? diffDays(envioNota, primeiroAnexo) : null,
      aguardandoNotaEm: mov?.aguardando_nota_em ? new Date(mov.aguardando_nota_em) : null,
    };
  }, [alvo, data, competencia]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise de tempos
          </DialogTitle>
          <DialogDescription>
            {alvo?.empresa_nome} · Período {alvo?.periodo} · {formatMesReferencia(competencia)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando análise...</p>
        ) : !analise ? null : (
          <div className="space-y-4">
            {/* Métricas */}
            <div className="grid grid-cols-2 gap-3">
              <MetricBox
                label="Atraso do Cadastro"
                value={
                  analise.atrasoCadastro == null
                    ? "— sem anexo"
                    : `${analise.atrasoCadastro > 0 ? "+" : ""}${analise.atrasoCadastro} dia(s)`
                }
                hint={
                  analise.diaEmissao
                    ? `Prazo dia ${String(analise.diaEmissao).padStart(2, "0")} da competência`
                    : `Prazo: ${formatDateBR(analise.deadlineCadastro.toISOString().slice(0, 10))}`
                }
                bad={analise.atrasoCadastro != null && analise.atrasoCadastro > 0}
                good={analise.atrasoCadastro != null && analise.atrasoCadastro <= 0}
              />
              <MetricBox
                label="Tempo do Financeiro"
                value={
                  analise.tempoFinanceiro == null
                    ? analise.primeiroAnexo
                      ? "Nota ainda não enviada"
                      : "—"
                    : `${analise.tempoFinanceiro} dia(s)`
                }
                hint={
                  analise.envioNota
                    ? `Nota enviada em ${formatDateBR(analise.envioNota.toISOString().slice(0, 10))}`
                    : "Aguardando envio da nota"
                }
                bad={analise.tempoFinanceiro != null && analise.tempoFinanceiro > 2}
                good={analise.tempoFinanceiro != null && analise.tempoFinanceiro <= 2}
              />
            </div>

            <Separator />

            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linha do tempo</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">Prazo do Cadastro</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(analise.deadlineCadastro.toISOString().slice(0, 10))}
                    </p>
                  </div>
                </li>
                {data!.anexos.length === 0 ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Nenhum anexo registrado</p>
                      <p className="text-xs text-muted-foreground">Cadastro ainda não enviou o faturamento.</p>
                    </div>
                  </li>
                ) : (
                  data!.anexos.map((a: any) => (
                    <li key={a.id} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.nome_arquivo}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("pt-BR")} · por{" "}
                          {data!.uploaderNames.get(a.uploaded_by) ?? "—"}
                          {a.origem && a.origem !== "normal" ? ` · ${a.origem}` : ""}
                        </p>
                      </div>
                    </li>
                  ))
                )}
                {analise.aguardandoNotaEm && (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-warning shrink-0" />
                    <div>
                      <p className="font-medium">Enviado ao Financeiro</p>
                      <p className="text-xs text-muted-foreground">
                        {analise.aguardandoNotaEm.toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </li>
                )}
                {analise.envioNota ? (
                  <li className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-success shrink-0" />
                    <div>
                      <p className="font-medium">Nota enviada pelo Financeiro</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(analise.envioNota.toISOString().slice(0, 10))}
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
  label,
  value,
  hint,
  bad,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  bad?: boolean;
  good?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        bad ? "border-destructive/30 bg-destructive/5" : good ? "border-success/30 bg-success/5" : "bg-muted/30",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold", bad ? "text-destructive" : good ? "text-success" : "text-foreground")}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Cobrança por e-mail — agrupa por responsável do contrato
   e gera mensagens copiáveis.
   ───────────────────────────────────────────────────────────── */
function CobrancaEmailDialog({
  open,
  onOpenChange,
  itens,
  empresas,
  competencia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itens: ForaPrazoItem[];
  empresas: any[];
  competencia: string;
}) {
  const [copiadoIdx, setCopiadoIdx] = useState<string | null>(null);

  const userIds = useMemo(
    () => Array.from(new Set(itens.map((i) => i.responsavel_user_id).filter(Boolean))) as string[],
    [itens],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["fora-prazo-profiles", userIds],
    enabled: open && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, username").in("user_id", userIds);
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    for (const p of profiles as any[]) m.set(p.user_id, { nome: p.display_name || p.username || "—" });
    return m;
  }, [profiles]);

  const grupos = useMemo(() => {
    const map = new Map<string, { userId: string | null; nome: string; itens: ForaPrazoItem[] }>();
    for (const it of itens) {
      const key = it.responsavel_user_id ?? "__sem__";
      const nome = it.responsavel_user_id ? profileMap.get(it.responsavel_user_id)?.nome ?? "Responsável" : "Sem responsável definido";
      if (!map.has(key)) map.set(key, { userId: it.responsavel_user_id, nome, itens: [] });
      map.get(key)!.itens.push(it);
    }
    return Array.from(map.values()).sort((a, b) => b.itens.length - a.itens.length);
  }, [itens, profileMap]);

  const montarMensagem = (nome: string, lista: ForaPrazoItem[]) => {
    const linhas = lista
      .map(
        (i) =>
          `• ${i.empresa_nome} — Período ${i.periodo} — ${i.dias_atraso} dia(s) de atraso (limite ${formatDateBR(i.data_limite.toISOString().slice(0, 10))})`,
      )
      .join("\n");
    return `Olá, ${nome}.

Identifiquei que os contratos abaixo, sob sua responsabilidade, estão com o faturamento pendente e fora do prazo da competência ${formatMesReferencia(competencia)}:

${linhas}

Por gentileza, providencie o envio da documentação o mais breve possível para regularizarmos o faturamento. Qualquer dificuldade, me avise.

Obrigado!`;
  };

  const copiar = async (key: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoIdx(key);
      toast({ title: "Mensagem copiada", description: "Cole no e-mail ou mensageiro." });
      setTimeout(() => setCopiadoIdx((c) => (c === key ? null : c)), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Cobrança por e-mail
          </DialogTitle>
          <DialogDescription>
            Mensagens agrupadas por responsável — {itens.length} contrato(s) em atraso na competência {formatMesReferencia(competencia)}.
          </DialogDescription>
        </DialogHeader>

        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nada a cobrar 🎉</p>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => {
              const key = g.userId ?? "__sem__";
              const msg = montarMensagem(g.nome, g.itens);
              const copiado = copiadoIdx === key;
              return (
                <div key={key} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{g.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.itens.length} contrato(s) em atraso
                      </p>
                    </div>
                    <Button size="sm" onClick={() => copiar(key, msg)}>
                      {copiado ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar mensagem
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea value={msg} readOnly rows={Math.min(14, 6 + g.itens.length)} className="text-xs font-mono" />
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



