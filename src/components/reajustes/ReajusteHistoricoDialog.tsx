import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corStatusReajusteFluxo, labelStatusReajusteFluxo } from "@/lib/reajuste-utils";
import { CheckCircle2, XCircle, Send, FileEdit, Sparkles, DollarSign, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome?: string;
}

const eventoMeta: Record<string, { label: string; icon: any; color: string }> = {
  solicitado: { label: "Solicitação criada", icon: Sparkles, color: "text-orange-600" },
  editado: { label: "Valores atualizados", icon: FileEdit, color: "text-yellow-600" },
  confirmado: { label: "Confirmado pelo Cadastro", icon: Send, color: "text-blue-600" },
  aprovado: { label: "Aprovado pela Diretoria", icon: CheckCircle2, color: "text-green-600" },
  rejeitado: { label: "Rejeitado pela Diretoria", icon: XCircle, color: "text-red-600" },
  liberado_financeiro: { label: "Liberado para o Financeiro", icon: Send, color: "text-blue-600" },
  reajustado: { label: "Reajuste concluído", icon: CheckCircle2, color: "text-green-600" },
  retroativo_aplicado: { label: "Retroativo aplicado", icon: DollarSign, color: "text-purple-600" },
};

export function ReajusteHistoricoDialog({ open, onOpenChange, empresaId, empresaNome }: Props) {
  const { data: reajustes = [] } = useQuery({
    queryKey: ["reajustes-historico-empresa", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("reajustes_anuais")
        .select("id, ano, percentual, status_reajuste, motivo_rejeicao")
        .eq("empresa_id", empresaId)
        .order("ano", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: open && !!empresaId,
  });

  const ids = reajustes.map((r: any) => r.id);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["reajustes-historico-eventos", empresaId, ids.join(",")],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase as any)
        .from("reajustes_historico")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: open && !!empresaId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Reajustes</DialogTitle>
          <DialogDescription>{empresaNome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {reajustes.map((r: any) => {
            const evs = eventos.filter((e) => e.reajuste_id === r.id);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">Ano {r.ano}</span>
                    <Badge variant="outline">{Number(r.percentual || 0).toFixed(2).replace(".",",")}%</Badge>
                  </div>
                  <Badge variant="outline" className={corStatusReajusteFluxo(r.status_reajuste)}>
                    {labelStatusReajusteFluxo(r.status_reajuste)}
                  </Badge>
                </div>

                {r.motivo_rejeicao && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs mb-3">
                    <span className="font-medium text-red-700 dark:text-red-300">Motivo da rejeição:</span>{" "}
                    <span className="text-muted-foreground">{r.motivo_rejeicao}</span>
                  </div>
                )}

                <div className="relative pl-6 border-l border-border space-y-3">
                  {evs.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Sem eventos registrados.</div>
                  ) : (
                    evs.map((ev: any) => {
                      const meta = eventoMeta[ev.evento] || { label: ev.evento, icon: Clock, color: "text-muted-foreground" };
                      const Icon = meta.icon;
                      return (
                        <div key={ev.id} className="relative">
                          <div className={`absolute -left-[27px] top-1 h-4 w-4 rounded-full bg-background border-2 border-current flex items-center justify-center ${meta.color}`}>
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                          <div className="text-sm font-medium">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {ev.usuario_nome || "—"} · {new Date(ev.created_at).toLocaleString("pt-BR")}
                          </div>
                          {ev.observacao && (
                            <div className="text-xs text-muted-foreground mt-1 italic">"{ev.observacao}"</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {!isLoading && reajustes.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Nenhum reajuste registrado.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
