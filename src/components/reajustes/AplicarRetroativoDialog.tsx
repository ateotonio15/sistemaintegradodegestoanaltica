import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";
import { formatCentavosBRL } from "@/lib/reajuste-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reajuste: any | null;
  empresaNome?: string;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Aplicar Retroativo</DialogTitle>
          <DialogDescription>{empresaNome}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Retroativo</div>
              <div className="font-semibold">{formatCentavosBRL(reajuste.valor_retroativo_centavos)}</div>
              <div className="text-[10px] text-muted-foreground">{reajuste.meses_retroativos || 0} {(reajuste.meses_retroativos || 0) === 1 ? "mês" : "meses"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor final</div>
              <div className="font-bold text-primary">{formatCentavosBRL(reajuste.valor_final_centavos)}</div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Observação (opcional)</Label>
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
