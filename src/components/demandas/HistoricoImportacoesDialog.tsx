import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteImportacao, useImportacoes } from "@/hooks/useDemandas";
import { formatDate } from "@/lib/demandas-utils";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export default function HistoricoImportacoesDialog({ open, onOpenChange }: Props) {
  const { data: lotes = [], isLoading } = useImportacoes();
  const del = useDeleteImportacao();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de importações</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
          ) : lotes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma importação registrada.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Arquivo</th>
                  <th className="text-left py-2">Importado por</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-right py-2">Registros</th>
                  <th className="text-right py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 hover:bg-accent/30">
                    <td className="py-2 truncate max-w-[220px]">{l.nome_arquivo}</td>
                    <td className="py-2 text-muted-foreground">{l.importado_por_nome || "—"}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(l.created_at.slice(0, 10))}</td>
                    <td className="py-2 text-right font-medium">{l.total_registros}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmId(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <AlertDialog open={!!confirmId} onOpenChange={(v) => !v && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lote de importação?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as demandas vinculadas a este lote serão removidas permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!confirmId) return;
                  try {
                    await del.mutateAsync(confirmId);
                    toast.success("Lote excluído");
                    setConfirmId(null);
                  } catch (e: any) {
                    toast.error(e?.message || "Erro ao excluir");
                  }
                }}
              >
                Excluir lote
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
