import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const data = formatDateBR(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${data} ${hh}:${mm}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome: string;
  mesReferencia: string;
  periodo: string;
}

const STORAGE_BUCKET = "anexos-movimentacoes";

type AnexoRow = {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
  uploader_nome?: string | null;
};

export function AnexosViewerDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  mesReferencia,
  periodo,
}: Props) {
  const { data: anexos = [], isLoading } = useQuery<AnexoRow[]>({
    queryKey: ["anexos-viewer", empresaId, mesReferencia, periodo],
    enabled: open && !!empresaId,
    queryFn: async () => {
      // Busca movimentações do processo (empresa + mes + periodo)
      const { data: movs } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movIds = (movs ?? []).map((m) => m.id);
      if (movIds.length === 0) return [];

      const { data: anx, error } = await supabase
        .from("anexos_movimentacao")
        .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
        .in("movimentacao_id", movIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((anx ?? []).map((a) => a.uploaded_by).filter(Boolean) as string[]),
      );
      let nomeMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        nomeMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      }
      return (anx ?? []).map((a) => ({
        ...a,
        uploader_nome: a.uploaded_by ? nomeMap.get(a.uploaded_by) ?? null : null,
      })) as AnexoRow[];
    },
  });

  const handleDownload = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60);
    if (error) {
      toast.error("Erro ao gerar link: " + error.message);
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-info" />
            Anexos do processo
          </DialogTitle>
          <DialogDescription>
            {empresaNome} · {mesReferencia} · {periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : anexos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum anexo encontrado para este processo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {anexos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium" title={a.nome_arquivo}>
                      {a.nome_arquivo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTimeBR(a.created_at)}
                      {a.uploader_nome ? ` · ${a.uploader_nome}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
