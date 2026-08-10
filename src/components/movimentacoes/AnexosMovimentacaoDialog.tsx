import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, Eye, Download, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";

const BUCKET = "anexos-movimentacoes";

interface Props {
  movimentacaoId: string | null;
  empresaNome?: string | null;
  mesReferencia?: string | null;
  periodo?: string | null;
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

function tipoArquivo(nome: string) {
  const n = (nome || "").toLowerCase();
  if (/\.(xlsx|xlsm|xls|csv)$/.test(n)) return "Excel do faturamento";
  if (/boleto/.test(n)) return "Boleto";
  if (n.endsWith(".pdf")) return "PDF da NFS-e";
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "Comprovante";
  return "Outros";
}

export function AnexosMovimentacaoDialog({
  movimentacaoId,
  empresaNome,
  mesReferencia,
  periodo,
  open,
  onOpenChange,
}: Props) {
  const [preview, setPreview] = useState<{ storage_path: string; nome_arquivo: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["anexos-mov-dialog", movimentacaoId],
    enabled: open && !!movimentacaoId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const [{ data: anexos, error: anexosErr }, { data: mov, error: movErr }] = await Promise.all([
        supabase
          .from("anexos_movimentacao")
          .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
          .eq("movimentacao_id", movimentacaoId as string)
          .order("created_at", { ascending: false }),
        supabase.from("movimentacoes").select("observacoes").eq("id", movimentacaoId as string).single(),
      ]);
      if (anexosErr) throw anexosErr;
      if (movErr && movErr.code !== "PGRST116") throw movErr;

      const ids = Array.from(
        new Set((anexos ?? []).map((a) => a.uploaded_by).filter(Boolean)),
      ) as string[];
      const nomes = new Map<string, string>();
      if (ids.length) {
        const { data: users } = await supabase.rpc("get_user_display_names", { _ids: ids });
        (users ?? []).forEach((u: any) => nomes.set(u.user_id, u.display_name));
      }
      return {
        anexos: (anexos ?? []).map((a) => ({
          ...a,
          autor: a.uploaded_by ? nomes.get(a.uploaded_by) ?? "Usuário" : null,
        })),
        observacoes: (mov?.observacoes ?? "").trim(),
      };
    },
  });

  const handleDownload = async (storagePath: string, nome: string) => {
    const { data: file, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !file) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
      if (signed?.signedUrl) {
        window.open(signed.signedUrl, "_blank", "noopener");
        return;
      }
      toast.error("Erro ao baixar arquivo");
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
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
            {[empresaNome, mesReferencia, periodo].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto space-y-5">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquareText className="h-4 w-4 text-info" />
                  Observações
                </h4>
                {data?.observacoes ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data.observacoes
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((linha, i) => {
                        const match = linha.match(/^\[(\d{2}\/\d{2}\/\d{4}(?:, \d{2}:\d{2})?) — ([^\]]+)\]\s*(.*)$/s);
                        const dataHora = match?.[1] ?? null;
                        const autor = match?.[2] ?? null;
                        const texto = match?.[3] ?? linha;
                        return (
                          <div
                            key={i}
                            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                          >
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                              {texto}
                            </p>
                            {(dataHora || autor) && (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                  {(autor || "U").charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate max-w-[180px]">{autor}</span>
                                {dataHora && (
                                  <>
                                    <span className="text-border">•</span>
                                    <span>{dataHora}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Paperclip className="h-4 w-4 text-info" />
                  Anexos
                </h4>
                {!data?.anexos.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/30">
                    Nenhum anexo encontrado para este processo.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.anexos.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" title={a.nome_arquivo}>
                            {a.nome_arquivo}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {tipoArquivo(a.nome_arquivo)}
                            {` · ${formatDateTime(a.created_at)}`}
                            {a.autor ? ` · Anexado por ${a.autor}` : ""}
                            {" · Cadastro"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Visualizar"
                          onClick={() => setPreview({ storage_path: a.storage_path, nome_arquivo: a.nome_arquivo })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Download"
                          onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {preview && (
        <PreviewArquivoDialog
          open={!!preview}
          onOpenChange={(v) => !v && setPreview(null)}
          bucket={BUCKET}
          storagePath={preview.storage_path}
          nomeArquivo={preview.nome_arquivo}
        />
      )}
    </Dialog>
  );
}
