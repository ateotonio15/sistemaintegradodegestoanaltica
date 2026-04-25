import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/date-utils";
import { Ban, RotateCcw, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: {
    id: string;
    nome: string;
    contrato_suspenso: boolean;
    data_suspensao: string | null;
    motivo_suspensao: string | null;
  } | null;
}

export function SuspensaoDialog({ open, onOpenChange, empresa }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setMotivo("");
      setObservacao("");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const { data: historico = [] } = useQuery({
    queryKey: ["empresa-suspensoes", empresa?.id],
    queryFn: async () => {
      if (!empresa) return [];
      const { data, error } = await supabase
        .from("empresa_suspensoes")
        .select("*")
        .eq("empresa_id", empresa.id)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresa && open,
  });

  const suspender = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const { error: e1 } = await supabase.from("empresa_suspensoes").insert({
        empresa_id: empresa.id,
        data_inicio: data,
        motivo: motivo.trim(),
        observacao: observacao.trim() || null,
        suspenso_por: user?.id ?? null,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("empresas")
        .update({
          contrato_suspenso: true,
          data_suspensao: data,
          motivo_suspensao: motivo.trim(),
        })
        .eq("id", empresa.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-suspensoes"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-suspensas"] });
      toast.success("Contrato suspenso");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const reativar = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const aberta = historico.find((h: any) => !h.data_fim);
      if (aberta) {
        const { error: e1 } = await supabase
          .from("empresa_suspensoes")
          .update({
            data_fim: data,
            reativado_por: user?.id ?? null,
          })
          .eq("id", aberta.id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from("empresas")
        .update({
          contrato_suspenso: false,
          data_suspensao: null,
          motivo_suspensao: null,
        })
        .eq("id", empresa.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-suspensoes"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-suspensas"] });
      toast.success("Contrato reativado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (!empresa) return null;
  const isSuspenso = empresa.contrato_suspenso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspenso ? (
              <>
                <RotateCcw className="h-5 w-5 text-primary" />
                Reativar contrato
              </>
            ) : (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                Suspender contrato
              </>
            )}
          </DialogTitle>
          <DialogDescription>{empresa.nome}</DialogDescription>
        </DialogHeader>

        {isSuspenso && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Contrato atualmente suspenso</p>
              <p className="text-muted-foreground mt-0.5">
                Desde {formatDateBR(empresa.data_suspensao)} — {empresa.motivo_suspensao || "—"}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!isSuspenso && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="motivo_susp">Motivo *</Label>
                <Input
                  id="motivo_susp"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: Inadimplência"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs_susp">Observação</Label>
                <Textarea
                  id="obs_susp"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Detalhes adicionais (opcional)"
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="data_susp">
              {isSuspenso ? "Data da reativação *" : "Data da suspensão *"}
            </Label>
            <Input
              id="data_susp"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>

        {historico.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico de Suspensões
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {historico.map((h: any) => (
                <div
                  key={h.id}
                  className="rounded-lg border p-3 bg-card"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant={h.data_fim ? "secondary" : "destructive"} className="rounded-md">
                      {h.data_fim ? "Encerrada" : "Em vigor"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateBR(h.data_inicio)}
                      {h.data_fim ? ` → ${formatDateBR(h.data_fim)}` : " → ..."}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{h.motivo}</p>
                  {h.observacao && (
                    <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {isSuspenso ? (
            <Button
              onClick={() => reativar.mutate()}
              disabled={!data || reativar.isPending}
            >
              {reativar.isPending ? "Reativando..." : "Reativar contrato"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => suspender.mutate()}
              disabled={!motivo.trim() || !data || suspender.isPending}
            >
              {suspender.isPending ? "Suspendendo..." : "Suspender contrato"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
