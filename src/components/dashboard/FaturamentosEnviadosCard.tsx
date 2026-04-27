import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, Clock, CheckCircle2, Send, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";

/**
 * Card "Faturamentos Enviado" exibido no Dashboard do usuário comum.
 * Compartilha a MESMA identidade visual do alerta usado no Dashboard
 * Financeiro (FaturamentosEnviadoFinanceiro), garantindo consistência:
 *   - Borda warning, ícone BellRing em pílula
 *   - Badge contador no header
 *   - Botão de ação no canto superior direito
 *
 * A ação no perfil comum é "Enviar Faturamento", que leva o usuário
 * para a aba de Movimentações onde ele preenche `data_envio_financeiro`
 * e anexa os documentos obrigatórios — fluxo que dispara o alerta para
 * o Financeiro via o trigger handle_envio_financeiro.
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Movimentações com data_envio_financeiro
  const { data: movs = [] } = useQuery({
    queryKey: ["faturamentos-enviados-comum", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo, data_envio_financeiro, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato)")
        .not("data_envio_financeiro", "is", null)
        .order("data_envio_financeiro", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mapa data_envio_nota por (empresa|mes|periodo) → identifica se já foi finalizada pelo financeiro
  const { data: finMap = new Map<string, string>() } = useQuery({
    queryKey: ["faturamentos-finmap", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, mes_referencia, periodo, data_envio_nota");
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of data ?? []) {
        if (!r.data_envio_nota) continue;
        m.set(`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`, r.data_envio_nota as string);
      }
      return m;
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("faturamentos-enviados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-enviados-comum"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-finmap"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const itens = movs.map((m: any) => {
    const finalizada = finMap.has(`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`);
    return {
      id: m.id,
      empresa: m.empresas?.nome ?? "—",
      codigo: m.empresas?.codigo_contrato ?? "",
      data: m.data_envio_financeiro as string,
      mes: m.mes_referencia as string,
      periodo: m.periodo as string,
      status: finalizada ? "Finalizado" : "Pendente",
    };
  });

  const pendentes = itens.filter((i) => i.status === "Pendente").length;

  return (
    <Card className="rounded-xl shadow-sm border-warning/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-warning" />
            </div>
            Faturamentos Enviado
            <Badge variant="outline" className="ml-1">{itens.length}</Badge>
            {pendentes > 0 && (
              <Badge className="bg-warning text-warning-foreground text-xs">
                {pendentes} pendente{pendentes > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => navigate("/movimentacoes")}
            className="gap-1 shrink-0 bg-warning text-warning-foreground hover:bg-warning/90"
          >
            <Send className="h-4 w-4" />
            Faturamentos Enviado
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum faturamento enviado ainda.
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {itens.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">{it.empresa}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.codigo && <span className="mr-2">{it.codigo}</span>}
                    {it.mes} · {it.periodo} · enviado em {formatDateBR(it.data)}
                  </p>
                </div>
                {it.status === "Pendente" ? (
                  <Badge className="bg-warning text-warning-foreground shrink-0 gap-1">
                    <Clock className="h-3 w-3" /> Pendente
                  </Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground shrink-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Finalizado
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
