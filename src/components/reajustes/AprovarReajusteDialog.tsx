import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Send, BedDouble, Hotel, AlertTriangle, Users } from "lucide-react";
import { formatCentavosBRL, nomeMes, labelFaixa } from "@/lib/reajuste-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reajuste: any | null;
  empresaNome?: string;
}

export function AprovarReajusteDialog({ open, onOpenChange, reajuste, empresaNome }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [modoRejeicao, setModoRejeicao] = useState(false);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
    qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
    qc.invalidateQueries({ queryKey: ["reajustes-aprovar-count"] });
    qc.invalidateQueries({ queryKey: ["reajustes-retroativo-count"] });
  };

  const aprovar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("aprovar_reajuste" as any, { p_id: reajuste.id, p_obs: obs || null });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Reajuste aprovado" }); invalidar(); onOpenChange(false); setObs(""); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const rejeitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rejeitar_reajuste" as any, { p_id: reajuste.id, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Reajuste rejeitado", description: "Cadastro foi notificado para correção." }); invalidar(); onOpenChange(false); setMotivo(""); setModoRejeicao(false); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("liberar_reajuste_financeiro" as any, { p_id: reajuste.id });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Liberado", description: "Financeiro foi notificado do retroativo." }); invalidar(); onOpenChange(false); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  if (!reajuste) return null;

  const enfAtual = reajuste.valor_antigo_enfermaria_centavos || 0;
  const enfFinal = reajuste.valor_final_enfermaria_centavos || 0;
  const aptAtual = reajuste.valor_antigo_apartamento_centavos || 0;
  const aptFinal = reajuste.valor_final_apartamento_centavos || 0;
  const totalRetro = reajuste.valor_retroativo_centavos || 0;
  const totalFinal = reajuste.valor_final_centavos || 0;
  const podeLiberar = reajuste.status_reajuste === "aprovado";
  const podeDecidir = reajuste.status_reajuste === "aguardando_aprovacao";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setModoRejeicao(false); setMotivo(""); setObs(""); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Análise do Reajuste</DialogTitle>
          <DialogDescription>
            {empresaNome} · Mês oficial {nomeMes(reajuste.mes_reajuste)} · Percentual {Number(reajuste.percentual || 0).toFixed(2).replace(".",",")}%
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid md:grid-cols-2 gap-3">
            {enfAtual > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><BedDouble className="h-4 w-4 text-emerald-600" /> Enfermaria</div>
                <Row label="Atual" v={formatCentavosBRL(enfAtual)} />
                <Row label="Reajustado" v={formatCentavosBRL(reajuste.valor_reajustado_enfermaria_centavos)} />
                <Row label="Retroativo" v={formatCentavosBRL(reajuste.valor_retroativo_enfermaria_centavos)} />
                <Row label="Final" v={formatCentavosBRL(enfFinal)} bold />
              </div>
            )}
            {aptAtual > 0 && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-sm"><Hotel className="h-4 w-4 text-blue-600" /> Apartamento</div>
                <Row label="Atual" v={formatCentavosBRL(aptAtual)} />
                <Row label="Reajustado" v={formatCentavosBRL(reajuste.valor_reajustado_apartamento_centavos)} />
                <Row label="Retroativo" v={formatCentavosBRL(reajuste.valor_retroativo_apartamento_centavos)} />
                <Row label="Final" v={formatCentavosBRL(aptFinal)} bold />
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Meses retroativos</div><div className="font-semibold">{reajuste.meses_retroativos || 0}</div></div>
            <div><div className="text-xs text-muted-foreground">Retroativo total</div><div className="font-semibold">{formatCentavosBRL(totalRetro)}</div></div>
            <div><div className="text-xs text-muted-foreground">Valor final</div><div className="font-bold text-primary">{formatCentavosBRL(totalFinal)}</div></div>
          </div>

          {reajuste.motivo_rejeicao && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
              <div className="font-medium text-red-700 dark:text-red-300">Rejeição anterior</div>
              <div className="text-muted-foreground mt-1">{reajuste.motivo_rejeicao}</div>
            </div>
          )}

          {podeLiberar && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
              <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-500/30 mb-2">Aprovado</Badge>
              <div>Pronto para liberar ao Financeiro aplicar o retroativo.</div>
            </div>
          )}

          {modoRejeicao && podeDecidir && (
            <div className="grid gap-2">
              <Label>Motivo da rejeição <span className="text-destructive">*</span></Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Descreva os ajustes necessários" />
            </div>
          )}

          {podeDecidir && !modoRejeicao && (
            <div className="grid gap-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {podeDecidir && !modoRejeicao && (
            <>
              <Button variant="destructive" onClick={() => setModoRejeicao(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Rejeitar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => aprovar.mutate()} disabled={aprovar.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
              </Button>
            </>
          )}
          {podeDecidir && modoRejeicao && (
            <>
              <Button variant="outline" onClick={() => setModoRejeicao(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => rejeitar.mutate()} disabled={!motivo.trim() || rejeitar.isPending}>
                Confirmar Rejeição
              </Button>
            </>
          )}
          {podeLiberar && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => liberar.mutate()} disabled={liberar.isPending}>
              <Send className="h-4 w-4 mr-1" /> Liberar para Financeiro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, v, bold }: { label: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold text-primary" : "font-medium"}>{v}</span>
    </div>
  );
}
