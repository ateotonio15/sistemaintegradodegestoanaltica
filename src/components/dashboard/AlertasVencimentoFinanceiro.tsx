import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, ChevronRight, Clock, Paperclip } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";

/**
 * Card "Faturamentos Enviado" — Dashboard Financeiro.
 *
 * Espelha o card do Cadastro fechando o ciclo:
 *  Cadastro clica "Alertar vencimento" → empresa aparece aqui
 *  Financeiro preenche data_vencimento → empresa some daqui
 *
 * Cada linha exibe: Empresa · Contrato · Data envio · Usuário · Anexos · Status.
 * O alerta é finalizado automaticamente pelo trigger
 * `handle_finalizar_alerta_vencimento` quando a data de vencimento é registrada.
 */
export function AlertasVencimentoFinanceiro() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Alertas pendentes do tipo vencimento
  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-financeiro-pendentes", "vencimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_financeiro")
        .select("*")
        .eq("status", "Pendente")
        .eq("tipo", "vencimento")
        .order("data_envio", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Movimentações dos alertas (para descobrir mes/periodo e mapear ao financeiro)
  const movIds = useMemo(() => alertas.map((a: any) => a.movimentacao_id), [alertas]);
  const { data: movs = [] } = useQuery({
    queryKey: ["alertas-vencimento-movs", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("id", movIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Empresas (para pegar codigo_contrato)
  const empresaIds = useMemo(() => Array.from(new Set(alertas.map((a: any) => a.empresa_id))), [alertas]);
  const { data: empresas = [] } = useQuery({
    queryKey: ["alertas-vencimento-empresas", empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, codigo_contrato")
        .in("id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // financeiro_movimentacoes correspondentes (empresa+mes+periodo)
  const { data: finRows = [] } = useQuery({
    queryKey: ["alertas-vencimento-fin", empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Anexos do Cadastro por movimentacao_id
  const { data: anexosCad = new Map<string, number>() } = useQuery({
    queryKey: ["alertas-vencimento-anexos-cad", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("movimentacao_id")
        .in("movimentacao_id", movIds);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).movimentacao_id as string;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    },
  });

  // Anexos do Financeiro por financeiro_movimentacao_id
  const finIds = useMemo(() => finRows.map((f: any) => f.id), [finRows]);
  const { data: anexosFin = new Map<string, number>() } = useQuery({
    queryKey: ["alertas-vencimento-anexos-fin", finIds.sort().join(",")],
    enabled: finIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("financeiro_movimentacao_id")
        .in("financeiro_movimentacao_id", finIds);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).financeiro_movimentacao_id as string;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("alertas-vencimento-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_financeiro" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-financeiro-pendentes", "vencimento"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anexos_movimentacao" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-vencimento-anexos-cad"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anexos_financeiro" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-vencimento-anexos-fin"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financeiro_movimentacoes" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-vencimento-fin"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  if (!isLoading && alertas.length === 0) return null;

  // Lookup maps
  const movMap = new Map(movs.map((m: any) => [m.id, m]));
  const empMap = new Map(empresas.map((e: any) => [e.id, e]));
  const finKey = (empresaId: string, mes: string, periodo: string) => `${empresaId}|${mes}|${periodo}`;
  const finMap = new Map(finRows.map((f: any) => [finKey(f.empresa_id, f.mes_referencia, f.periodo), f]));

  return (
    <Card className="rounded-xl shadow-sm border-warning/40 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-warning" />
            </div>
            Faturamentos Enviado
            <Badge variant="outline" className="ml-1">{alertas.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate("/financeiro")} className="gap-1">
            Resolver no Financeiro <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">
          Itens enviados pelo Cadastro aguardando o preenchimento da <strong>data de vencimento</strong>.
          A empresa some daqui assim que o vencimento for registrado.
        </p>
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
          {alertas.map((a: any) => {
            const mov = movMap.get(a.movimentacao_id);
            const empresa = empMap.get(a.empresa_id);
            const fin = mov
              ? finMap.get(finKey(a.empresa_id, mov.mes_referencia, mov.periodo))
              : null;
            const qtdCad = anexosCad.get(a.movimentacao_id) ?? 0;
            const qtdFin = fin ? (anexosFin.get(fin.id) ?? 0) : 0;
            const totalAnexos = qtdCad + qtdFin;

            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">{a.empresa_nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="mr-2">
                      Contrato: <span className="font-medium text-foreground/80">{empresa?.codigo_contrato ?? "—"}</span>
                    </span>
                    · Enviado por <span className="font-medium text-foreground/80">{a.enviado_por_nome ?? "—"}</span>
                    {" · "}
                    {formatDateBR(a.data_envio)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="gap-1" title="Anexos: Cadastro + Financeiro">
                    <Paperclip className="h-3 w-3" />
                    {totalAnexos}
                  </Badge>
                  <Badge className="bg-warning text-warning-foreground gap-1">
                    <Clock className="h-3 w-3" /> Pendente
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
