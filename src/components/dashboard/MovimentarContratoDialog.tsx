import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Send } from "lucide-react";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaNome: string;
  empresaCodigo?: string | null;
  mesReferencia: string;
  periodo: string;
  /** Caso já exista uma movimentação aguardando envio, passamos o id direto. */
  movimentacaoIdExistente?: string | null;
  onSuccess?: () => void;
}

/**
 * Dialog "Movimentar contrato" — usado pelo card Faturamentos Enviado
 * (Dashboard Cadastro). Recebe a empresa + ciclo vigente, garante que
 * exista o registro em `movimentacoes`, permite anexar documentos
 * (obrigatório ≥ 1) e ao confirmar marca `data_envio_financeiro = hoje`.
 *
 * O trigger handle_envio_financeiro cuida do resto:
 *   - cria/atualiza financeiro_movimentacoes
 *   - espelha anexos para anexos_financeiro
 *   - cria alerta Pendente para o Financeiro
 */
export function MovimentarContratoDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  empresaCodigo,
  mesReferencia,
  periodo,
  movimentacaoIdExistente,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [movId, setMovId] = useState<string | null>(movimentacaoIdExistente ?? null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [anexosCount, setAnexosCount] = useState(0);

  // Garante a existência da movimentação assim que o dialog abre
  useEffect(() => {
    if (!open) return;
    if (movimentacaoIdExistente) {
      setMovId(movimentacaoIdExistente);
      return;
    }
    let cancelled = false;
    (async () => {
      setPreparing(true);
      try {
        // Tenta buscar uma já existente para este (empresa, mes, periodo)
        const { data: existing, error: selErr } = await supabase
          .from("movimentacoes")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("mes_referencia", mesReferencia)
          .eq("periodo", periodo)
          .maybeSingle();
        if (selErr) throw selErr;

        if (existing?.id) {
          if (!cancelled) setMovId(existing.id);
          return;
        }

        const { data: created, error: insErr } = await supabase
          .from("movimentacoes")
          .insert({
            empresa_id: empresaId,
            mes_referencia: mesReferencia,
            periodo,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (!cancelled) setMovId(created.id);
      } catch (err: any) {
        toast.error("Erro ao preparar movimentação: " + err.message);
        if (!cancelled) onOpenChange(false);
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, empresaId, mesReferencia, periodo, movimentacaoIdExistente, onOpenChange]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setAnexosCount(0);
      if (!movimentacaoIdExistente) setMovId(null);
    }
  }, [open, movimentacaoIdExistente]);

  const handleConfirmar = async () => {
    if (!movId) return;
    if (anexosCount === 0) {
      toast.error("Anexe ao menos 1 documento para enviar ao financeiro.");
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { error } = await supabase
        .from("movimentacoes")
        .update({ data_envio_financeiro: iso })
        .eq("id", movId);
      if (error) throw error;

      toast.success("Contrato movimentado e enviado ao financeiro.");
      queryClient.invalidateQueries({ queryKey: ["faturamentos-enviados-comum"] });
      queryClient.invalidateQueries({ queryKey: ["faturamentos-finmap"] });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Movimentar contrato</DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-medium text-foreground">{empresaNome}</span>
            {empresaCodigo && <span className="text-muted-foreground"> · {empresaCodigo}</span>}
            <span className="text-muted-foreground"> · {mesReferencia} · {periodo}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-foreground">Este contrato precisa ser movimentado.</p>
        </div>

        <AnexosMovimentacao
          movimentacaoId={movId}
          empresaId={empresaId}
          required
          onCountChange={setAnexosCount}
        />

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={submitting || preparing || !movId || anexosCount === 0}
            className="bg-warning text-warning-foreground hover:bg-warning/90 gap-1"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Enviando..." : "Confirmar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
