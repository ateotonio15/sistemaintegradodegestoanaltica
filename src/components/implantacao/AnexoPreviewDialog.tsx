import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface AnexoPreview {
  storage_path: string;
  nome_arquivo: string;
  mime_type?: string | null;
}

interface Props {
  anexo: AnexoPreview | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AnexoPreviewDialog({ anexo, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nomeArquivo = anexo?.nome_arquivo || "Documento";
  const ext = (nomeArquivo.split(".").pop() || "").toLowerCase();
  const mimeType = anexo?.mime_type || "";
  const isPdf = ext === "pdf" || mimeType.includes("pdf");
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext) || mimeType.startsWith("image/");
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!open || !anexo) {
      setUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfDoc((prev) => {
        prev?.destroy();
        return null;
      });
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    let loadedPdf: PDFDocumentProxy | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      setPdfDoc((prev) => {
        prev?.destroy();
        return null;
      });
      try {
        const { data: arquivo, error: e } = await supabase.storage
          .from("anexos-implantacao")
          .download(anexo.storage_path);
        if (e || !arquivo) throw e ?? new Error("Falha ao baixar arquivo");
        const mime = mimeType || (isPdf ? "application/pdf" : arquivo.type || "application/octet-stream");
        const blob = arquivo.type ? arquivo : new Blob([arquivo], { type: mime });
        createdUrl = URL.createObjectURL(blob);
        if (isPdf) {
          const buffer = await blob.arrayBuffer();
          loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        }
        if (!cancelled) {
          setUrl(createdUrl);
          if (loadedPdf) setPdfDoc(loadedPdf);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Não foi possível carregar o arquivo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      loadedPdf?.destroy();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, anexo, isPdf, mimeType]);

  const handleOpenWindow = () => {
    if (!url) {
      toast.error("Arquivo ainda não está pronto para abrir.");
      return;
    }
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error("O navegador bloqueou a abertura da janela. Tente baixar o arquivo.");
      return;
    }
    window.setTimeout(() => {
      setUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="truncate text-base pr-4" title={nomeArquivo}>
            {nomeArquivo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-card overflow-hidden">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando documento...
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p>Não foi possível carregar este documento.</p>
              <p className="text-xs">{error}</p>
            </div>
          )}
          {!loading && !error && url && (
            <>
              {isPdf && pdfDoc ? (
                <PdfCanvasViewer pdfDoc={pdfDoc} />
              ) : isPdf ? null : isImage ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={url}
                    alt={nomeArquivo}
                    className="max-w-full max-h-full object-contain rounded-sm shadow-sm"
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground p-6 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/60" />
                  <p>
                    Visualização direta não disponível para este tipo de arquivo.
                    <br />
                    Clique em <strong>Abrir janela</strong> para visualizar ou baixar.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-3 flex items-center justify-between gap-3 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={handleOpenWindow} disabled={!url || loading} className="gap-2">
            <ExternalLink className="h-4 w-4" /> Abrir janela
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PdfCanvasViewer({ pdfDoc }: { pdfDoc: PDFDocumentProxy }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    setNumPages(pdfDoc.numPages);
  }, [pdfDoc]);

  useEffect(() => {
    if (!numPages) return;
    let cancelled = false;
    const tasks: { cancel: () => void }[] = [];
    const renderAll = async () => {
      await new Promise((r) => requestAnimationFrame(r));
      const container = containerRef.current;
      if (!container || cancelled) return;
      const availableWidth = Math.max(320, container.clientWidth - 48);
      const outputScale = window.devicePixelRatio || 1;
      for (let p = 1; p <= numPages; p++) {
        if (cancelled) return;
        const canvas = container.querySelector<HTMLCanvasElement>(`canvas[data-page="${p}"]`);
        if (!canvas) continue;
        try {
          const page = await pdfDoc.getPage(p);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.max(0.6, Math.min(2.2, availableWidth / base.width));
          const viewport = page.getViewport({ scale });
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          if (cancelled) return;
          const task = page.render({ canvas, canvasContext: ctx, viewport, background: "hsl(0 0% 100%)" });
          tasks.push(task);
          await task.promise;
        } catch {
          // página ignorada em caso de erro de renderização
        }
      }
    };
    renderAll();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [pdfDoc, numPages]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-card p-4">
      <div className="flex flex-col items-center gap-4 pb-6">
        {Array.from({ length: numPages }, (_, i) => (
          <canvas key={i + 1} data-page={i + 1} className="rounded-sm shadow-sm bg-card" />
        ))}
      </div>
    </div>
  );
}
