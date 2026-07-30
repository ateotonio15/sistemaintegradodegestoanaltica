import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { FileText, Paperclip } from "lucide-react";

interface Props {
  movimentacaoId: string;
  children: React.ReactNode;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AnexosHoverCard({ movimentacaoId, children }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["anexos-hover", movimentacaoId],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: anexos, error } = await supabase
        .from("anexos_movimentacao")
        .select("id, nome_arquivo, created_at, uploaded_by")
        .eq("movimentacao_id", movimentacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((anexos ?? []).map((a) => a.uploaded_by).filter(Boolean))) as string[];
      let nomes = new Map<string, string>();
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
    <HoverCard openDelay={200} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span className="cursor-default">{children}</span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-accent/30 px-3 py-2 text-xs font-semibold">
          <Paperclip className="h-3.5 w-3.5" /> Relatórios anexados
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-1 py-2">Carregando...</p>
          ) : !data?.length ? (
            <p className="text-xs text-muted-foreground px-1 py-2">Nenhum relatório anexado.</p>
          ) : (
            data.map((a) => (
              <div key={a.id} className="flex gap-2 rounded-md border p-2">
                <FileText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs font-medium">{a.nome_arquivo}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
                  <p className="text-[11px] text-muted-foreground">Por: {a.autor}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
