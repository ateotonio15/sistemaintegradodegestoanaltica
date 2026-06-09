import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, DollarSign, Info, User, CalendarCheck } from "lucide-react";
import { formatCentavosBRL } from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/movimentacao-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reajuste: any | null;
  empresaNome?: string;
}

function fmtDateTimeBR(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function ProdutoCard({
  titulo,
  valorAntigo,
  valorReajustado,
  valorRetroativo,
  valorFinal,
  percentual,
  ativo,
}: {
  titulo: string;
  valorAntigo?: number | null;
  valorReajustado?: number | null;
  valorRetroativo?: number | null;
  valorFinal?: number | null;
  percentual?: number | null;
  ativo: boolean;
}) {
  if (!ativo) return null;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">{titulo}</div>
        {percentual != null && (
          <Badge variant="secondary" className="text-[10px]">
            {Number(percentual).toFixed(2)}%
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Valor antigo</div>
          <div className="font-medium">{formatCentavosBRL(valorAntigo ?? 0)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Valor reajustado</div>
          <div className="font-medium">{formatCentavosBRL(valorReajustado ?? 0)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Retroativo</div>
          <div className="font-semibold text-amber-600 dark:text-amber-400">
            {formatCentavosBRL(valorRetroativo ?? 0)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Valor final</div>
          <div className="font-bold text-primary">{formatCentavosBRL(valorFinal ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}

export function AplicarRetroativoDialog({ open, onOpenChange, reajuste, empresaNome }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("aplicar_retroativo_reajuste" as any, { p_id: reajuste.id, p_obs: obs || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Retroativo aplicado", description: "Status atualizado para Retroativo Aplicado." });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-retroativo-count"] });
      qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      setObs("");
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  if (!reajuste) return null;

  const possuiEnfermaria = !!reajuste.possui_enfermaria;
  const possuiApartamento = !!reajuste.possui_apartamento;

  const mesesLabel = `${reajuste.meses_retroativos || 0} ${(reajuste.meses_retroativos || 0) === 1 ? "mês" : "meses"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Aplicar Retroativo</DialogTitle>
          <DialogDescription>{empresaNome}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Aviso: reajuste já aplicado no contrato pelo Cadastro */}
          <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-success">Reajuste já aplicado no contrato pelo Cadastro</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                O Cadastro confirmou a aplicação dos novos valores no contrato. O Financeiro deve cobrar
                o valor retroativo abaixo na próxima competência.
              </div>
            </div>
          </div>

          {/* Informações fornecidas pela Diretora (aprovação) */}
          <div className="rounded-lg border bg-muted/40 p-3 grid gap-1.5 text-xs">
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Info className="h-4 w-4 text-primary" /> Informações da aprovação (Diretora)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground">Ano do reajuste</div>
                <div className="font-medium">{reajuste.ano ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Mês do reajuste</div>
                <div className="font-medium">{reajuste.mes_reajuste ? String(reajuste.mes_reajuste).padStart(2, "0") : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Data de aplicação</div>
                <div className="font-medium">{formatDateBR(reajuste.data_aplicacao)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Competência cobrança</div>
                <div className="font-medium">{reajuste.competencia || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Aprovado por (Diretora)</div>
                <div className="font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {reajuste.aprovado_por_nome || "—"}
                  <span className="text-muted-foreground text-[11px]">· {fmtDateTimeBR(reajuste.aprovado_em)}</span>
                </div>
              </div>
              {reajuste.observacao && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Observação da Diretora</div>
                  <div className="font-medium whitespace-pre-wrap">{reajuste.observacao}</div>
                </div>
              )}
            </div>
          </div>

          {/* Valores dos dois produtos */}
          <div className="grid gap-2 sm:grid-cols-2">
            <ProdutoCard
              titulo="Enfermaria"
              ativo={possuiEnfermaria}
              percentual={reajuste.percentual_unico_enfermaria ? reajuste.percentual : null}
              valorAntigo={reajuste.valor_antigo_enfermaria_centavos}
              valorReajustado={reajuste.valor_reajustado_enfermaria_centavos}
              valorRetroativo={reajuste.valor_retroativo_enfermaria_centavos}
              valorFinal={reajuste.valor_final_enfermaria_centavos}
            />
            <ProdutoCard
              titulo="Apartamento"
              ativo={possuiApartamento}
              percentual={reajuste.percentual_unico_apartamento ? reajuste.percentual : null}
              valorAntigo={reajuste.valor_antigo_apartamento_centavos}
              valorReajustado={reajuste.valor_reajustado_apartamento_centavos}
              valorRetroativo={reajuste.valor_retroativo_apartamento_centavos}
              valorFinal={reajuste.valor_final_apartamento_centavos}
            />
          </div>

          {/* Totais consolidados */}
          <div className="rounded-lg border bg-primary/5 p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Retroativo total</div>
              <div className="font-bold text-amber-600 dark:text-amber-400 text-base">
                {formatCentavosBRL(reajuste.valor_retroativo_centavos)}
              </div>
              <div className="text-[10px] text-muted-foreground">{mesesLabel}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor final total</div>
              <div className="font-bold text-primary text-base">{formatCentavosBRL(reajuste.valor_final_centavos)}</div>
            </div>
          </div>

          {/* Histórico de aplicação no contrato (Cadastro) */}
          {reajuste.retroativo_aplicado_em || reajuste.confirmado_por_nome || reajuste.data_confirmacao ? (
            <div className="rounded-lg border bg-muted/30 p-3 grid gap-1.5 text-xs">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-primary" /> Aplicação no contrato (Cadastro)
              </div>
              {reajuste.confirmado_por_nome && (
                <div>
                  <span className="text-muted-foreground">Aplicado por: </span>
                  <span className="font-medium">{reajuste.confirmado_por_nome}</span>
                  <span className="text-muted-foreground"> · {fmtDateTimeBR(reajuste.data_confirmacao)}</span>
                </div>
              )}
              {reajuste.retroativo_aplicado_por_nome && (
                <div>
                  <span className="text-muted-foreground">Retroativo aplicado por: </span>
                  <span className="font-medium">{reajuste.retroativo_aplicado_por_nome}</span>
                  <span className="text-muted-foreground"> · {fmtDateTimeBR(reajuste.retroativo_aplicado_em)}</span>
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label>Observação do Financeiro (opcional)</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: cobrado na competência X" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => mut.mutate()} disabled={mut.isPending}>
            Confirmar Aplicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
