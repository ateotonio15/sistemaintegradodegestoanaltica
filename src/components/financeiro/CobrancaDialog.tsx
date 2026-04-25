import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FinanceiroMovimentacao } from "@/lib/financeiro-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao: FinanceiroMovimentacao | null;
  empresaNome?: string;
}

export function CobrancaDialog({ open, onOpenChange, movimentacao, empresaNome }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) {
      setMotivo("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!movimentacao) return;
      const { error: insErr } = await supabase.from("cobrancas").insert({
        financeiro_movimentacao_id: movimentacao.id,
        motivo: motivo.trim(),
        data,
        observacao: observacao.trim() || null,
        status: "aberta",
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      const { error: upErr } = await supabase
        .from("financeiro_movimentacoes")
        .update({ cobranca_registrada: true })
        .eq("id", movimentacao.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["cobrancas-abertas"] });
      toast.success("Cobrança registrada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobrança</DialogTitle>
          {empresaNome && <DialogDescription>{empresaNome}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Atraso na emissão da nota"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data_cobranca">Data *</Label>
            <Input
              id="data_cobranca"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs_cobranca">Observação</Label>
            <Textarea
              id="obs_cobranca"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Detalhes adicionais (opcional)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!motivo.trim() || !data || createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
