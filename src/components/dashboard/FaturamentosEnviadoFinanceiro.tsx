import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, Clock, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";

/**
 * Painel exibido APENAS no dashboard do perfil Financeiro.
 * Lista os alertas "Faturamentos Enviado" pendentes (status='Pendente').
 * Atualiza em tempo real e desaparece quando o financeiro registra o
 * envio da nota correspondente.
 */
export function FaturamentosEnviadoFinanceiro() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-financeiro-pendentes", "nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_financeiro")
        .select("*")
        .eq("status", "Pendente")
        .or("tipo.eq.nota,tipo.is.null")
        .order("data_envio", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("alertas-financeiro-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_financeiro" },
        () => queryClient.invalidateQueries({ queryKey: ["alertas-financeiro-pendentes"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  return (
    <Card className="rounded-xl shadow-sm border-warning/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-warning" />
            </div>
            Faturamentos Enviado
            <Badge variant="outline" className="ml-1">{alertas.length}</Badge>
          </CardTitle>
          {alertas.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => navigate("/financeiro")} className="gap-1">
              Ir ao Financeiro <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : alertas.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum faturamento aguardando 🎉
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {alertas.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">{a.empresa_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Enviado por {a.enviado_por_nome ?? "—"} · {formatDateBR(a.data_envio)}
                  </p>
                </div>
                <Badge className="bg-warning text-warning-foreground shrink-0 gap-1">
                  <Clock className="h-3 w-3" /> Pendente
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
