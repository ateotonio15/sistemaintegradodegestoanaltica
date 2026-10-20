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
import { CheckCircle2, XCircle, Send, FileEdit, Sparkles, DollarSign, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { buscarClassesPlano } from "@/lib/valoresOperadora";
import { Button } from "@/components/ui/button";
import { valoresModalidadeReajuste, type FaixaReajusteSalva } from "@/lib/reajuste-apresentacao";
import { labelFaixa } from "@/lib/reajuste-utils";
import { ReajusteFaixasHistorico } from "./ReajusteFaixasHistorico";

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
    refetchOnMount: "always",
  });

  // Classe do plano (ex.: Gold / Gold Plus) vinda da operadora, só para exibição.
  const { data: codigoContrato } = useQuery({
    queryKey: ["reajustes-historico-codigo", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await supabase.from("empresas").select("codigo_contrato").eq("id", empresaId).maybeSingle();
      return (data?.codigo_contrato as string | null) ?? null;
    },
    enabled: open && !!empresaId,
  });
  const anosReajuste = reajustes.map((r: any) => r.ano).join(",");
  const { data: classesPorAno = {} } = useQuery({
    queryKey: ["reajustes-historico-classes", codigoContrato, anosReajuste],
    queryFn: async () => {
      const out: Record<string, { enfermaria?: string; apartamento?: string }> = {};
      if (!codigoContrato) return out;
      try {
        for (const r of reajustes as any[]) {
          const c = await buscarClassesPlano(codigoContrato, Number(r.ano));
          if (c) out[String(r.ano)] = c;
        }
      } catch {
        /* exibição opcional: mantém Enfermaria/Apartamento */
      }
      return out;
    },
    enabled: open && !!codigoContrato && reajustes.length > 0,
    staleTime: 5 * 60_000,
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

  const { data: faixas = [], isLoading: carregandoFaixas, isError: erroFaixas } = useQuery({
    queryKey: ["reajustes-historico-faixas", empresaId, ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data, error } = await supabase.from("reajuste_faixas").select("*").in("reajuste_id", ids).order("idade_inicial");
      if (error) throw error;
      return (data ?? []) as FaixaReajusteSalva[];
    },
    enabled: open && !!empresaId && ids.length > 0,
    refetchOnMount: "always",
  });

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
    refetchOnMount: "always",
  });

  const fmtBRL = (c?: number | null) =>
    c == null ? "—" : `R$ ${((Number(c) || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                const faixasAno = faixas.filter((f) => f.reajuste_id === r.id);
                const enf = valoresModalidadeReajuste(r, "enfermaria", faixasAno);
                const apt = valoresModalidadeReajuste(r, "apartamento", faixasAno);
                const porFaixa = enf.porFaixa || apt.porFaixa;
                const produtos: Array<{ nome: string; antigo: number | null; reajustado: number | null; retro: number | null; final: number | null; pct: number }> = [];
                if (r.possui_enfermaria) {
                  produtos.push({
                    nome: classesPorAno[String(r.ano)]?.enfermaria ? `${classesPorAno[String(r.ano)]?.enfermaria} · Enfermaria` : "Enfermaria",
                    ...enf,
                  });
                }
                if (r.possui_apartamento) {
                  produtos.push({
                    nome: classesPorAno[String(r.ano)]?.apartamento ? `${classesPorAno[String(r.ano)]?.apartamento} · Apartamento` : "Apartamento",
                    ...apt,
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
                const totalFinal = porFaixa ? produtos[0].final : produtos.reduce((acc, p) => acc + (p.final ?? 0), 0);
                const totalRetro = porFaixa ? produtos[0].retro : produtos.reduce((acc, p) => acc + (p.retro ?? 0), 0);

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

                      {/* Produto e valores */}
                      {porFaixa && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {[enf, apt].filter((p) => p.primeira).map((p) => (
                            <Badge key={p.primeira?.modalidade} variant="outline">
                              {p.primeira?.modalidade === "enfermaria" ? "Enfermaria" : "Apartamento"} · 1ª Faixa {p.primeira ? labelFaixa(p.primeira.idade_inicial, p.primeira.idade_final) : ""}
                            </Badge>
                          ))}
                          {carregandoFaixas && <span className="text-xs text-muted-foreground">Carregando faixas...</span>}
                          {erroFaixas && <span className="text-xs text-destructive">Não foi possível carregar as faixas.</span>}
                        </div>
                      )}
                      {produtos.length === 1 ? (
                        (() => {
                          const p = produtos[0];
                          return (
                            <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2 border-y py-2.5 px-1">
                              <div className="text-sm font-semibold min-w-[90px]">{p.nome}</div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor base</div>
                                <div className="text-sm tabular-nums">{fmtBRL(p.antigo)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor reajustado</div>
                                <div className="text-sm tabular-nums">{fmtBRL(p.reajustado)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reajuste</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{p.pct.toFixed(2).replace(".", ",")}%</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Retroativo</div>
                                <div className={`text-sm tabular-nums ${(p.retro ?? 0) > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>{fmtBRL(p.retro)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor final</div>
                                <div className="text-base font-semibold text-primary tabular-nums">{fmtBRL(p.final)}</div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="rounded-md border overflow-x-auto mb-3">
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
                                  <td className="px-2 py-1.5 text-right text-muted-foreground">{p.pct.toFixed(2).replace(".", ",")}%</td>
                                  <td className={`px-2 py-1.5 text-right ${(p.retro ?? 0) > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>{fmtBRL(p.retro)}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-primary">{fmtBRL(p.final)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Detalhes técnicos (ocultos por padrão) */}
                      {faixasAno.length > 0 && <ReajusteFaixasHistorico faixas={faixasAno} />}
                      {(() => {
                        const idStr = String(r.id);
                        const aberto = detalhesAbertos.has(idStr);
                        return (
                          <div className="mb-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => toggleDetalhes(idStr)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
                              {aberto ? "Ocultar detalhes" : "Ver mais detalhes"}
                            </Button>
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

                      {r.motivo_rejeicao && (
                        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs mb-2">
                          <span className="font-medium text-red-700 dark:text-red-300">Motivo da rejeição:</span>{" "}
                          <span className="text-muted-foreground">{r.motivo_rejeicao}</span>
                        </div>
                      )}

                      {r.observacao && (
                        <div className="border-l-2 border-muted-foreground/30 pl-3 py-1 text-xs">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Observação da Diretoria</div>
                          <div className="text-muted-foreground">{r.observacao}</div>
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
