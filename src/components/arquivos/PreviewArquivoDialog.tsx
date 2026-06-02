import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ExcelJS from "exceljs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type SheetData = { name: string; rows: string[][] };

function cellToString(value: any): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (typeof value === "object") {
    if ("text" in value) return cellToString((value as any).text);
    if ("result" in value) return cellToString((value as any).result);
    if ("richText" in value && Array.isArray((value as any).richText)) {
      return (value as any).richText.map((r: any) => r.text ?? "").join("");
    }
    if ("hyperlink" in value) return cellToString((value as any).text ?? (value as any).hyperlink);
    if ("formula" in value) return cellToString((value as any).result);
  }
  return String(value);
}

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
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.8);
  const [renderingPage, setRenderingPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      setPdfDoc((prev) => {
        prev?.destroy();
        return null;
      });
      setPageNumber(1);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    let loadedPdf: PDFDocumentProxy | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      setPdfDoc((prev) => {
        prev?.destroy();
        return null;
      });
      setPageNumber(1);
      try {
        const { data, error: e } = await supabase.storage
          .from(bucket)
          .download(storagePath);
        if (e || !data) throw e ?? new Error("Falha ao baixar arquivo");
        const mime =
          mimeType ||
          (isPdf ? "application/pdf" : data.type || "application/octet-stream");
        const blob = data.type ? data : new Blob([data], { type: mime });
        createdBlobUrl = URL.createObjectURL(blob);
        if (isPdf) {
          const buffer = await blob.arrayBuffer();
          loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        }
        if (!cancelled) {
          setUrl(createdBlobUrl);
          if (loadedPdf) setPdfDoc(loadedPdf);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Erro ao carregar arquivo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      loadedPdf?.destroy();
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [open, bucket, storagePath, mimeType, isPdf]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      setRenderingPage(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível");

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          setError(err?.message ?? "Erro ao renderizar PDF");
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, scale]);

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
            {pdfDoc && (
              <div className="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1 || renderingPage}
                  title="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-16 text-center text-xs text-muted-foreground">
                  {pageNumber}/{pdfDoc.numPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPageNumber((p) => Math.min(pdfDoc.numPages, p + 1))}
                  disabled={pageNumber >= pdfDoc.numPages || renderingPage}
                  title="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
                  disabled={scale <= 0.6 || renderingPage}
                  title="Diminuir zoom"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setScale((s) => Math.min(2.4, Number((s + 0.2).toFixed(1))))}
                  disabled={scale >= 2.4 || renderingPage}
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                <div className="relative h-full overflow-auto p-4">
                  {renderingPage && (
                    <div className="absolute inset-x-0 top-3 z-10 flex justify-center pointer-events-none">
                      <span className="inline-flex items-center rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Renderizando...
                      </span>
                    </div>
                  )}
                  <div className="flex min-h-full justify-center">
                    <canvas ref={canvasRef} className="h-fit max-w-none rounded-sm bg-background shadow-sm" />
                  </div>
                </div>
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
