import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bucket: string;
  storagePath: string;
  nomeArquivo: string;
  mimeType?: string | null;
}

export function PreviewArquivoDialog({
  open,
  onOpenChange,
  bucket,
  storagePath,
  nomeArquivo,
  mimeType,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase();
  const isPdf = ext === "pdf" || (mimeType ?? "").includes("pdf");
  const isImage =
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ||
    (mimeType ?? "").startsWith("image/");

  useEffect(() => {
    if (!open) {
      setUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      return;
    }
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Baixa o arquivo e cria um blob URL local — evita bloqueios de
        // iframe cross-origin (ex.: Microsoft Edge bloqueia PDFs de domínios
        // diferentes em iframe por padrão).
        const { data, error: e } = await supabase.storage
          .from(bucket)
          .download(storagePath);
        if (e || !data) throw e ?? new Error("Falha ao baixar arquivo");
        const mime =
          mimeType ||
          (isPdf ? "application/pdf" : data.type || "application/octet-stream");
        const blob = data.type ? data : new Blob([data], { type: mime });
        createdBlobUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(createdBlobUrl);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Erro ao carregar arquivo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [open, bucket, storagePath, mimeType, isPdf]);

  async function handleDownload() {
    try {
      const { data, error: e } = await supabase.storage
        .from(bucket)
        .download(storagePath);
      if (e || !data) throw e ?? new Error("Falha ao baixar");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      toast.error("Erro ao baixar: " + (err?.message ?? "desconhecido"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate text-base pr-4" title={nomeArquivo}>
            {nomeArquivo}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(url, "_blank", "noopener")}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4 mr-1.5" /> Nova aba
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" /> Baixar
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p>Não foi possível carregar este arquivo.</p>
              <p className="text-xs">{error}</p>
            </div>
          )}
          {!loading && !error && url && (
            <>
              {isPdf ? (
                <iframe
                  src={`${url}#toolbar=1&view=FitH`}
                  title={nomeArquivo}
                  className="w-full h-full border-0"
                />
              ) : isImage ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={url}
                    alt={nomeArquivo}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground p-6 text-center">
                  <AlertCircle className="h-6 w-6" />
                  <p>
                    Não foi possível visualizar este arquivo no navegador.
                    <br />
                    Você pode baixá-lo para abrir localmente.
                  </p>
                  <Button variant="default" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1.5" /> Baixar arquivo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
