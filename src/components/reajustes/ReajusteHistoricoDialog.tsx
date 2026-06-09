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
        .select("*")
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

  const fmtBRL = (c?: number | null) =>
    `R$ ${((Number(c) || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
  const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
  const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Reajustes</DialogTitle>
          <DialogDescription>{empresaNome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {reajustes.map((r: any) => {
            const evs = eventos.filter((e) => e.reajuste_id === r.id);
            const produtos: Array<{ nome: string; antigo: number; reajustado: number; retro: number; final: number; pct: number }> = [];
            if (r.possui_enfermaria) {
              produtos.push({
                nome: "Enfermaria",
                antigo: r.valor_antigo_enfermaria_centavos || 0,
                reajustado: r.valor_reajustado_enfermaria_centavos || 0,
                retro: r.valor_retroativo_enfermaria_centavos || 0,
                final: r.valor_final_enfermaria_centavos || 0,
                pct: Number(r.percentual || 0),
              });
            }
            if (r.possui_apartamento) {
              produtos.push({
                nome: "Apartamento",
                antigo: r.valor_antigo_apartamento_centavos || 0,
                reajustado: r.valor_reajustado_apartamento_centavos || 0,
                retro: r.valor_retroativo_apartamento_centavos || 0,
                final: r.valor_final_apartamento_centavos || 0,
                pct: Number(r.percentual || 0),
              });
            }
            if (produtos.length === 0) {
              produtos.push({
                nome: "Valor",
                antigo: r.valor_antigo_centavos || 0,
                reajustado: r.valor_reajustado_centavos || 0,
                retro: r.valor_retroativo_centavos || 0,
                final: r.valor_final_centavos || 0,
                pct: Number(r.percentual || 0),
              });
            }

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

                {/* Dados do reajuste */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Data liberação</div>
                    <div className="font-medium">{fmtDate(r.data_liberacao)}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Competência reajuste</div>
                    <div className="font-medium">{r.mes_reajuste ? `${meses[r.mes_reajuste]}/${r.ano}` : `—/${r.ano}`}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Data de aplicação</div>
                    <div className="font-medium">{fmtDate(r.data_aplicacao)}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Competência cobrança</div>
                    <div className="font-medium">{r.competencia || "—"}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Meses retroativos</div>
                    <div className="font-medium">{r.meses_retroativos ?? 0}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Índice / Tipo</div>
                    <div className="font-medium">Negociação</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Aplicado no contrato em</div>
                    <div className="font-medium">{fmtDateTime(r.retroativo_aplicado_em)}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-muted-foreground">Aplicado por</div>
                    <div className="font-medium">{r.retroativo_aplicado_por_nome || r.confirmado_por_nome || "—"}</div>
                  </div>
                </div>

                {/* Tabela de valores por produto */}
                <div className="rounded-md border overflow-x-auto mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 font-medium">Produto</th>
                        <th className="px-2 py-1.5 font-medium text-right">Valor base</th>
                        <th className="px-2 py-1.5 font-medium text-right">Valor reajustado</th>
                        <th className="px-2 py-1.5 font-medium text-right">% Reajuste</th>
                        <th className="px-2 py-1.5 font-medium text-right">Retroativo</th>
                        <th className="px-2 py-1.5 font-medium text-right">Valor final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1.5 font-medium">{p.nome}</td>
                          <td className="px-2 py-1.5 text-right">{fmtBRL(p.antigo)}</td>
                          <td className="px-2 py-1.5 text-right">{fmtBRL(p.reajustado)}</td>
                          <td className="px-2 py-1.5 text-right">{p.pct.toFixed(2).replace(".", ",")}%</td>
                          <td className="px-2 py-1.5 text-right text-amber-600 dark:text-amber-400">{fmtBRL(p.retro)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-primary">{fmtBRL(p.final)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {r.observacao && (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs mb-3">
                    <span className="font-medium">Observação da Diretora:</span>{" "}
                    <span className="text-muted-foreground">{r.observacao}</span>
                  </div>
                )}

                {r.motivo_rejeicao && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs mb-3">
                    <span className="font-medium text-red-700 dark:text-red-300">Motivo da rejeição:</span>{" "}
                    <span className="text-muted-foreground">{r.motivo_rejeicao}</span>
                  </div>
                )}

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
