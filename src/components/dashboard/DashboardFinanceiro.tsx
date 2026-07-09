import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date-utils";
import { FaturamentosEnviadoFinanceiro } from "./FaturamentosEnviadoFinanceiro";
import { AlertasVencimentoFinanceiro } from "./AlertasVencimentoFinanceiro";
import { PrevisaoFinanceira } from "./PrevisaoFinanceira";
import { AlertaRetroativosParaCobrar } from "@/components/reajustes/AlertaRetroativosParaCobrar";
import { ImplantacoesAguardandoFechamentoCard } from "./ImplantacoesAguardandoFechamentoCard";
import { AnalisesEnviosPanel } from "@/components/financeiro/AnalisesEnviosPanel";

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

export function DashboardFinanceiro() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    queryKey: ["fin-dash-movs-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, data_envio_nota");
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

  const minhasEmpresasIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(empresas.filter((e: any) => e.responsavel_user_id === user.id).map((e: any) => e.id));
  }, [empresas, user]);

  const cobrancasAbertas = cobrancas.filter((c) => c.status === "aberta");
  const cobrancasMinhas = cobrancasAbertas.filter((c) => minhasEmpresasIds.has(c.empresa_id));

  const ativas = empresas.filter((e: any) => e.status_empresa === "Ativa");
  const ativasNaoSuspensas = ativas.filter((e: any) => !e.contrato_suspenso);

  const notasEnviadas = movs.filter((m: any) => !!m.data_envio_nota).length;
  const aguardandoNota = movs.filter((m: any) => !m.data_envio_nota).length;

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Contratos ativos" value={ativasNaoSuspensas.length} icon={Building2} accent="text-primary" bg="bg-primary/10" />
        <KpiCard label="Notas enviadas" value={notasEnviadas} icon={CheckCircle2} accent="text-success" bg="bg-success/10" />
        <KpiCard label="Aguardando Emissão" value={aguardandoNota} icon={CalendarClock} accent="text-warning" bg="bg-warning/10" />
        <KpiCard label="Cobranças abertas" value={cobrancasAbertas.length} icon={AlertCircle} accent="text-destructive" bg="bg-destructive/10" />
      </div>

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

      {/* Análises de envios — substitui "Empresas fora do prazo" */}
      <AnalisesEnviosPanel />

      {/* Contratos recém implantados aguardando primeiro fechamento */}
      <ImplantacoesAguardandoFechamentoCard />

      {/* Previsão financeira */}
      <PrevisaoFinanceira />
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
