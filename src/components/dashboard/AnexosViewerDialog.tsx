import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, Paperclip, Play, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
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
  /** ID da financeiro_movimentacoes para suporte ao botão "Iniciar faturamento". */
  movimentacaoId?: string | null;
  faturamentoIniciadoEm?: string | null;
  faturamentoIniciadoPorNome?: string | null;
}

const BUCKET_FINANCEIRO = "anexos-financeiro";
const BUCKET_OPERACIONAL = "anexos-movimentacoes";


type AnexoRow = {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
  uploader_nome?: string | null;
  bucket: string;
  origem_label: "Financeiro" | "Cadastro";
};

export function AnexosViewerDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  mesReferencia,
  periodo,
  movimentacaoId = null,
  faturamentoIniciadoEm = null,
  faturamentoIniciadoPorNome = null,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [iniciando, setIniciando] = useState(false);

  const handleIniciarFaturamento = async () => {
    if (!movimentacaoId || !user) return;
    setIniciando(true);
    try {
      // Busca o nome do usuário atual
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      const nome = prof?.display_name || prof?.username || user.email || "Usuário";

      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update({
          faturamento_iniciado_por: user.id,
          faturamento_iniciado_por_nome: nome,
          faturamento_iniciado_em: new Date().toISOString(),
        })
        .eq("id", movimentacaoId);
      if (error) throw error;

      toast.success("Faturamento iniciado");
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
    } catch (e: any) {
      toast.error("Erro ao iniciar faturamento: " + e.message);
    } finally {
      setIniciando(false);
    }
  };


  const { data: anexos = [], isLoading } = useQuery<AnexoRow[]>({
    queryKey: ["anexos-viewer-merged", empresaId, mesReferencia, periodo],
    enabled: open && !!empresaId,
    queryFn: async () => {
      // 1) Movimentações financeiras do processo
      const { data: movsFin } = await supabase
        .from("financeiro_movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movFinIds = (movsFin ?? []).map((m) => m.id);

      // 2) Movimentações operacionais (cadastro) do processo
      const { data: movsOp } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movOpIds = (movsOp ?? []).map((m) => m.id);

      const [anxFinRes, anxOpRes] = await Promise.all([
        movFinIds.length
          ? supabase
              .from("anexos_financeiro")
              .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
              .in("financeiro_movimentacao_id", movFinIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        movOpIds.length
          ? supabase
              .from("anexos_movimentacao")
              .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
              .in("movimentacao_id", movOpIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (anxFinRes.error) throw anxFinRes.error;
      if (anxOpRes.error) throw anxOpRes.error;

      const fin: AnexoRow[] = (anxFinRes.data ?? []).map((a: any) => ({
        ...a,
        bucket: BUCKET_FINANCEIRO,
        origem_label: "Financeiro" as const,
      }));
      const op: AnexoRow[] = (anxOpRes.data ?? []).map((a: any) => ({
        ...a,
        bucket: BUCKET_OPERACIONAL,
        origem_label: "Cadastro" as const,
      }));

      const merged = [...fin, ...op].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const userIds = Array.from(
        new Set(merged.map((a) => a.uploaded_by).filter(Boolean) as string[]),
      );
      let nomeMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        nomeMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      }
      return merged.map((a) => ({
        ...a,
        uploader_nome: a.uploaded_by ? nomeMap.get(a.uploaded_by) ?? null : null,
      }));
    },
  });

  const handleDownload = async (bucket: string, path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) throw error ?? new Error("Falha ao baixar arquivo");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      // Fallback: tenta abrir signed URL em nova aba
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60, { download: nome });
      if (signErr || !signed?.signedUrl) {
        toast.error("Erro ao baixar: " + (e?.message || signErr?.message || "desconhecido"));
        return;
      }
      window.open(signed.signedUrl, "_blank", "noopener");
    }
  };

  const [preview, setPreview] = useState<AnexoRow | null>(null);

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
                  key={`${a.bucket}-${a.id}`}
                  className="flex items-center gap-3 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium" title={a.nome_arquivo}>
                      {a.nome_arquivo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(a.created_at)}
                      {a.uploader_nome ? ` · ${a.uploader_nome}` : ""}
                      {` · ${a.origem_label}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPreview(a)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDownload(a.bucket, a.storage_path, a.nome_arquivo)}
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
      {preview && (
        <PreviewArquivoDialog
          open={!!preview}
          onOpenChange={(v) => !v && setPreview(null)}
          bucket={preview.bucket}
          storagePath={preview.storage_path}
          nomeArquivo={preview.nome_arquivo}
        />
      )}
    </Dialog>
  );
}
