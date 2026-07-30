import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Paperclip } from "lucide-react";

interface Props {
  movimentacaoId: string | null;
  empresaNome?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnexosMovimentacaoDialog({ movimentacaoId, empresaNome, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["anexos-mov-dialog", movimentacaoId],
    enabled: open && !!movimentacaoId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: anexos, error } = await supabase
        .from("anexos_movimentacao")
        .select("id, nome_arquivo, created_at, uploaded_by")
        .eq("movimentacao_id", movimentacaoId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = Array.from(
        new Set((anexos ?? []).map((a) => a.uploaded_by).filter(Boolean)),
      ) as string[];
      const nomes = new Map<string, string>();
      if (ids.length) {
        const { data: users } = await supabase.rpc("get_user_display_names", { _ids: ids });
        (users ?? []).forEach((u: any) => nomes.set(u.user_id, u.display_name));
      }
      return (anexos ?? []).map((a) => ({
        ...a,
        autor: a.uploaded_by ? nomes.get(a.uploaded_by) ?? "Usuário" : "—",
      }));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-primary" /> Relatórios anexados
          </DialogTitle>
          {empresaNome && <p className="text-xs text-muted-foreground">{empresaNome}</p>}
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Carregando...</p>
          ) : !data?.length ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum relatório anexado.</p>
          ) : (
            data.map((a) => (
              <div key={a.id} className="flex gap-2 rounded-md border p-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{a.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
                  <p className="text-xs text-muted-foreground">Por: {a.autor}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
