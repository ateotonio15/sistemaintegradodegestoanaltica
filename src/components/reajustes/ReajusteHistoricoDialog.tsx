import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corStatusReajusteFluxo, labelStatusReajusteFluxo } from "@/lib/reajuste-utils";
import { CheckCircle2, XCircle, Send, FileEdit, Sparkles, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";

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

  // Reajuste mais recente aberto por padrão; anos anteriores fechados.
  const [anoAberto, setAnoAberto] = useState<string | null>(null);
  useEffect(() => {
    if (open && reajustes.length > 0) {
      setAnoAberto((atual) => {
        if (atual && reajustes.some((r: any) => String(r.id) === atual)) return atual;
        return String(reajustes[0].id);
      });
    }
    if (!open) setAnoAberto(null);
  }, [open, reajustes]);

  // Detalhes técnicos abertos por reajuste (ocultos por padrão).
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<string>>(new Set());
  const toggleDetalhes = (id: string) =>
    setDetalhesAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
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

        <div className="py-2">
          {reajustes.length > 0 && (
            <Accordion type="single" collapsible value={anoAberto ?? undefined} onValueChange={(v) => setAnoAberto(v || null)}>
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
                const totalFinal = produtos.reduce((acc, p) => acc + p.final, 0);
                const totalRetro = produtos.reduce((acc, p) => acc + p.retro, 0);

                return (
                  <AccordionItem key={r.id} value={String(r.id)} className="border-b-0 mb-2 rounded-xl border bg-card overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                        <span className="font-semibold text-base">Ano {r.ano}</span>
                        <Badge variant="secondary" className="font-semibold tabular-nums">
                          {Number(r.percentual || 0).toFixed(2).replace(".", ",")}%
                        </Badge>
                        <Badge variant="outline" className={corStatusReajusteFluxo(r.status_reajuste)}>
                          {labelStatusReajusteFluxo(r.status_reajuste)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1">
                      {/* Resumo do Reajuste */}
                      <div className="mb-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Resumo do Reajuste</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 items-end">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">% Reajuste</div>
                            <div className="text-lg font-semibold tabular-nums">{Number(r.percentual || 0).toFixed(2).replace(".", ",")}%</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor final</div>
                            <div className="text-lg font-semibold text-primary tabular-nums">{fmtBRL(totalFinal)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Retroativo</div>
                            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{fmtBRL(totalRetro)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
                            <Badge variant="outline" className={corStatusReajusteFluxo(r.status_reajuste)}>
                              {labelStatusReajusteFluxo(r.status_reajuste)}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Competência do reajuste</div>
                            <div className="text-sm font-medium">{r.mes_reajuste ? `${meses[r.mes_reajuste]}/${r.ano}` : `—/${r.ano}`}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Competência da cobrança</div>
                            <div className="text-sm font-medium">{r.competencia || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Índice / Tipo</div>
                            <div className="text-sm font-medium">Negociação</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Meses retroativos</div>
                            <div className="text-sm font-medium tabular-nums">{r.meses_retroativos ?? 0}</div>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes técnicos (ocultos por padrão) */}
                      {(() => {
                        const idStr = String(r.id);
                        const aberto = detalhesAbertos.has(idStr);
                        return (
                          <div className="mb-4">
                            <button
                              type="button"
                              onClick={() => toggleDetalhes(idStr)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
                              {aberto ? "Ocultar detalhes" : "Ver mais detalhes"}
                            </button>
                            {aberto && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs mt-2 rounded-md border bg-muted/20 p-3">
                                <div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Data de liberação</div>
                                  <div className="font-medium">{fmtDate(r.data_liberacao) || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aplicado no contrato (Cadastro)</div>
                                  <div className="font-medium">{fmtDate(r.retroativo_aplicado_em || r.data_confirmacao) || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aplicado no contrato em</div>
                                  <div className="font-medium">{fmtDateTime(r.retroativo_aplicado_em) || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aplicado por</div>
                                  <div className="font-medium">{r.retroativo_aplicado_por_nome || r.confirmado_por_nome || "—"}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {!isLoading && reajustes.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Nenhum reajuste registrado.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
