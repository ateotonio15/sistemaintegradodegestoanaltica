import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";

/**
 * Painel exibido APENAS no dashboard do perfil Financeiro.
 * Lista os alertas de **vencimento** abertos pelo Cadastro.
 * Some automaticamente quando o Financeiro preenche `data_vencimento`
 * na movimentação financeira correspondente (trigger no banco).
 */
export function AlertasVencimentoFinanceiro() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  useEffect(() => {
    const ch = supabase
      .channel("alertas-vencimento-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_financeiro" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-financeiro-pendentes", "vencimento"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  if (!isLoading && alertas.length === 0) return null;

  return (
    <Card className="rounded-xl shadow-sm border-warning/40 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-warning" />
            </div>
            Alertas de Vencimento
            <Badge variant="outline" className="ml-1">{alertas.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate("/financeiro")} className="gap-1">
            Resolver no Financeiro <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">
          O Cadastro solicitou o preenchimento do <strong>vencimento</strong>. O alerta some automaticamente quando você registrar a data.
        </p>
        <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-foreground">{a.empresa_nome}</p>
                <p className="text-xs text-muted-foreground">
                  Solicitado por {a.enviado_por_nome ?? "—"} · {formatDateBR(a.data_envio)}
                </p>
              </div>
              <Badge className="bg-warning text-warning-foreground shrink-0 gap-1">
                <CalendarClock className="h-3 w-3" /> Vencimento
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
