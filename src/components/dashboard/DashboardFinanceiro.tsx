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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date-utils";
import { FaturamentosEnviadoFinanceiro } from "./FaturamentosEnviadoFinanceiro";
import { AlertasVencimentoFinanceiro } from "./AlertasVencimentoFinanceiro";
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
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
  const [foraPrazoFiltro, setForaPrazoFiltro] = useState<string>("todos");
  const [removerAlvo, setRemoverAlvo] = useState<{ empresa_id: string; empresa_nome: string; periodo: string } | null>(
    null,
  );

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
        .select("financeiro_movimentacao_id, mime_type, nome_arquivo");
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
    queryKey: ["fora-prazo-exclusoes", mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fora_prazo_exclusoes")
        .select("empresa_id, periodo, mes_referencia")
        .eq("mes_referencia", mesAtual);
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
        mes_referencia: mesAtual,
        removido_por: user?.id,
        removido_por_nome: profile?.display_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fora-prazo-exclusoes", mesAtual] });
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

  const foraPrazoTudo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const result: Array<{
      empresa_id: string;
      empresa_nome: string;
      periodo: string;
      data_limite: Date;
      dias_atraso: number;
    }> = [];

    for (const emp of ativasNaoSuspensas as any[]) {
      const periodo = emp.periodo_movimentacao as string | null;
      if (!periodo || !PERIODO_FIM[periodo]) continue;
      const limite = getDataLimitePeriodo(mesAtual, periodo);
      if (!limite) continue;
      if (hoje.getTime() <= limite.getTime()) continue; // ainda dentro do prazo

      // mov correspondente nesta competência
      const mov = (movs as any[]).find(
        (m) => m.empresa_id === emp.id && m.mes_referencia === mesAtual && m.periodo === periodo,
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
      });
    }
    return result.sort((a, b) => b.dias_atraso - a.dias_atraso);
  }, [ativasNaoSuspensas, movs, anexosPorMov, exclusoesSet, mesAtual]);

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
        <KpiCard label="Aguardando nota" value={aguardandoNota} icon={CalendarClock} accent="text-warning" bg="bg-warning/10" />
        <KpiCard label="Cobranças abertas" value={cobrancasAbertas.length} icon={AlertCircle} accent="text-destructive" bg="bg-destructive/10" />
        <KpiCard label="Pagamentos recebidos" value={cobrancasPagas.length} icon={Wallet} accent="text-success" bg="bg-success/10" />
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
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Competência {formatMesReferencia(mesAtual)}
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
                      Período {e.periodo} · Limite {formatDateBR(e.data_limite.toISOString().slice(0, 10))} · {formatMesReferencia(mesAtual)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {e.dias_atraso} {e.dias_atraso === 1 ? "dia" : "dias"}
                  </Badge>
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

      {/* Previsão financeira */}
      <PrevisaoFinanceira />

      {/* Confirmar remoção */}
      <AlertDialog open={!!removerAlvo} onOpenChange={(o) => !o && setRemoverAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removerAlvo?.empresa_nome}</strong> ({removerAlvo?.periodo}) deixará de aparecer em "Empresas fora do prazo" para a competência {formatMesReferencia(mesAtual)}. Essa exceção fica registrada apenas para este mês.
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


