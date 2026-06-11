import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePrioridadeHistorico } from "@/hooks/usePrioridadeMaxima";
import { formatDateBR } from "@/lib/date-utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaId: string | null;
  empresaNome?: string;
}

export function PrioridadeHistoricoDialog({ open, onOpenChange, empresaId, empresaNome }: Props) {
  const { data } = usePrioridadeHistorico(empresaId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Prioridade Máxima{empresaNome ? ` — ${empresaNome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          {(data ?? []).map((r) => (
            <div key={r.id} className={`rounded-lg border p-3 ${r.ativo ? "border-red-500/60 bg-red-500/5" : "bg-muted/30"}`}>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Criado em {formatDateBR(r.criado_em)} por {r.criado_por_nome ?? "—"}</span>
                <span className={r.ativo ? "text-red-600 font-semibold" : ""}>{r.ativo ? "Ativa" : "Concluída"}</span>
              </div>
              <div className="text-sm mt-1"><strong>Motivo:</strong> {r.motivo}</div>
              {r.observacoes && <div className="text-sm text-muted-foreground"><strong>Obs:</strong> {r.observacoes}</div>}
              {r.removido_em && (
                <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                  Removida em {formatDateBR(r.removido_em)} por {r.removido_por_nome ?? "—"}
                  {r.motivo_remocao && <> — {r.motivo_remocao}</>}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
