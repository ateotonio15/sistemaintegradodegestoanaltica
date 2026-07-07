import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { cn } from "@/lib/utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// -----------------------------------------------------------------------------
// Cache em memória: evita re-baixar o mesmo arquivo ao alternar entre prévias.
// -----------------------------------------------------------------------------
const blobCache = new Map<string, Promise<Blob>>();
const signedUrlCache = new Map<string, Promise<string>>();
const parsedExcelCache = new Map<string, SheetData[]>();

function getBlob(bucket: string, storagePath: string): Promise<Blob> {
  const key = `${bucket}:${storagePath}`;
  let p = blobCache.get(key);
  if (!p) {
    p = supabase.storage
      .from(bucket)
      .download(storagePath)
      .then((r) => {
        if (r.error || !r.data) throw r.error ?? new Error("Falha ao baixar arquivo");
        return r.data;
      })
      .catch((e) => {
        blobCache.delete(key);
        throw e;
      });
    blobCache.set(key, p);
  }
  return p;
}

function getSignedUrl(bucket: string, storagePath: string): Promise<string> {
  const key = `${bucket}:${storagePath}`;
  let p = signedUrlCache.get(key);
  if (!p) {
    p = supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600)
      .then((r) => {
        if (r.error || !r.data?.signedUrl) throw r.error ?? new Error("Falha ao gerar URL");
        return r.data.signedUrl;
      })
      .catch((e) => {
        signedUrlCache.delete(key);
        throw e;
      });
    signedUrlCache.set(key, p);
    // URLs assinadas expiram em ~1h; limpar cache antes disso
    setTimeout(() => signedUrlCache.delete(key), 55 * 60 * 1000);
  }
  return p;
}

// -----------------------------------------------------------------------------
// Tipagem da prévia de Excel — agora com metadados de estilo por célula
// -----------------------------------------------------------------------------
type ExcelCell = {
  text: string;
  isNumber: boolean;
  bold: boolean;
  indent: number;
};
type SheetData = { name: string; rows: ExcelCell[][] };

function isNumericLike(v: any): boolean {
  if (typeof v === "number" && isFinite(v)) return true;
  if (v && typeof v === "object") {
    if ("result" in v && typeof (v as any).result === "number") return true;
  }
  return false;
}

function toNumber(v: any): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (v && typeof v === "object" && typeof (v as any).result === "number") return (v as any).result;
  return null;
}

function formatNumberBR(n: number): string {
  const isInt = Number.isInteger(n);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

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

function parseCell(rawValue: any, cell: any, rowOutline: number): ExcelCell {
  const numeric = toNumber(rawValue);
  const isNumber = numeric !== null;
  const bold = !!cell?.font?.bold;
  const indent = Math.max(rowOutline, cell?.alignment?.indent ?? 0);
  return {
    text: isNumber ? formatNumberBR(numeric!) : cellToString(rawValue),
    isNumber,
    bold,
    indent,
  };
}

interface Props {
  bucket: string;
  storagePath: string;
  nomeArquivo: string;
  mimeType?: string | null;
}

export function ArquivoPreviewInline({ bucket, storagePath, nomeArquivo, mimeType }: Props) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [renderingPage, setRenderingPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [manualZoom, setManualZoom] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase();
  const isPdf = ext === "pdf" || (mimeType ?? "").includes("pdf");
  const isImage =
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ||
    (mimeType ?? "").startsWith("image/");
  const isExcel = ["xlsx", "xlsm", "xls"].includes(ext);

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    let loadedPdf: PDFDocumentProxy | null = null;
    const cacheKey = `${bucket}:${storagePath}`;

    (async () => {
      setLoading(true);
      setError(null);
      setPdfDoc((prev) => { prev?.destroy(); return null; });
      setPageNumber(1);
      setManualZoom(false);
      // Só limpa sheets se for outro arquivo Excel
      if (!isExcel || !parsedExcelCache.has(cacheKey)) setSheets(null);
      setActiveSheet(0);
      setImageUrl(null);

      try {
        if (isPdf) {
          // PDF: usa URL assinada com range requests → primeira página aparece rápido
          const url = await getSignedUrl(bucket, storagePath);
          if (cancelled) return;
          loadedPdf = await pdfjsLib.getDocument({
            url,
            disableRange: false,
            disableStream: false,
          }).promise;
          if (cancelled) { loadedPdf.destroy(); return; }
          setPdfDoc(loadedPdf);
        } else if (isExcel) {
          const cached = parsedExcelCache.get(cacheKey);
          if (cached) {
            setSheets(cached);
          } else {
            const blob = await getBlob(bucket, storagePath);
            if (cancelled) return;
            const buffer = await blob.arrayBuffer();
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buffer);
            const parsed: SheetData[] = [];
            wb.eachSheet((ws) => {
              const rows: ExcelCell[][] = [];
              const maxCol = ws.actualColumnCount || ws.columnCount || 0;
              ws.eachRow({ includeEmpty: false }, (row) => {
                if (rows.length >= 500) return;
                const r: ExcelCell[] = [];
                const outline = row.outlineLevel ?? 0;
                for (let c = 1; c <= maxCol; c++) {
                  const cell = row.getCell(c);
                  r.push(parseCell(cell.value, cell, outline));
                }
                rows.push(r);
              });
              parsed.push({ name: ws.name, rows });
            });
            parsedExcelCache.set(cacheKey, parsed);
            if (cancelled) return;
            setSheets(parsed);
          }
          // Se houver aba "RESUMO", abre por padrão
          setActiveSheet((prev) => {
            const list = parsedExcelCache.get(cacheKey) ?? [];
            const idx = list.findIndex((s) => /resumo/i.test(s.name));
            return idx >= 0 ? idx : 0;
          });
        } else if (isImage) {
          const blob = await getBlob(bucket, storagePath);
          if (cancelled) return;
          createdBlobUrl = URL.createObjectURL(blob);
          setImageUrl(createdBlobUrl);
        }
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
  }, [bucket, storagePath, isPdf, isExcel, isImage]);

  useEffect(() => {
    if (!pdfDoc || !pdfContainerRef.current || manualZoom) return;
    let cancelled = false;
    const fitToContainer = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !pdfContainerRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, pdfContainerRef.current.clientWidth - 24);
        const fittedScale = Math.max(0.6, Math.min(3.0, availableWidth / viewport.width));
        setScale(Number(fittedScale.toFixed(2)));
      } catch {}
    };
    fitToContainer();
    const observer = new ResizeObserver(fitToContainer);
    observer.observe(pdfContainerRef.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [pdfDoc, pageNumber, manualZoom]);

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
        context.fillStyle = "hsl(0 0% 100%)";
        context.fillRect(0, 0, viewport.width, viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport, background: "hsl(0 0% 100%)" });
        await renderTask.promise;
      } catch (err: any) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          setError(err?.message ?? "Erro ao renderizar PDF");
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => () => { pdfDoc?.destroy(); }, [pdfDoc]);

  // ESC sai do modo tela cheia
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  const currentSheet = sheets?.[activeSheet];

  return (
    <div className={cn(
      "flex flex-col min-h-0",
      fullscreen
        ? "fixed inset-0 z-[100] bg-background h-screen"
        : "h-full",
    )}>
      {/* Botão flutuante de tela cheia — sempre visível */}
      <Button
        variant={fullscreen ? "default" : "secondary"}
        size="icon"
        onClick={() =>
          setFullscreen((v) => {
            const next = !v;
            if (next) { setManualZoom(true); setScale(2.0); }
            else { setManualZoom(false); }
            return next;
          })
        }
        className="absolute top-2 right-2 z-20 h-8 w-8 shadow-md"
        title={fullscreen ? "Sair da tela cheia (ESC)" : "Tela cheia"}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>

      {pdfDoc && (
        <div className="flex items-center justify-center gap-1 px-3 py-2 border-b bg-muted/30 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1 || renderingPage}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-16 text-center text-xs text-muted-foreground">
            {pageNumber} / {pdfDoc.numPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setPageNumber((p) => Math.min(pdfDoc.numPages, p + 1))}
            disabled={pageNumber >= pdfDoc.numPages || renderingPage}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setManualZoom(true); setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1)))); }}
            disabled={scale <= 0.6 || renderingPage}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setManualZoom(true); setScale((s) => Math.min(2.4, Number((s + 0.2).toFixed(1)))); }}
            disabled={scale >= 2.4 || renderingPage}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-background overflow-hidden">
        {loading && !pdfDoc && !currentSheet && !imageUrl && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando prévia...
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p>Não foi possível carregar este arquivo.</p>
            <p className="text-xs">{error}</p>
          </div>
        )}
        {!error && (
          <>
            {isPdf && pdfDoc && (
              <div ref={pdfContainerRef} className="relative h-full overflow-auto bg-muted/20 p-4">
                {renderingPage && (
                  <div className="absolute inset-x-0 top-3 z-10 flex justify-center pointer-events-none">
                    <span className="inline-flex items-center rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Renderizando...
                    </span>
                  </div>
                )}
                <div className="flex min-h-full justify-center pb-6">
                  <canvas ref={canvasRef} className="h-fit max-w-none rounded-sm shadow-md bg-white" />
                </div>
              </div>
            )}
            {isImage && imageUrl && (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-muted/20">
                <img src={imageUrl} alt={nomeArquivo} className="max-w-full max-h-full object-contain rounded shadow-md" />
              </div>
            )}
            {isExcel && sheets && currentSheet && (
              <div className="h-full flex flex-col min-h-0">
                {sheets.length > 1 && (
                  <div className="flex gap-1 px-3 py-2 border-b bg-muted/30 overflow-x-auto shrink-0">
                    {sheets.map((s, i) => (
                      <Button key={i} variant={i === activeSheet ? "default" : "outline"} size="sm"
                        className="h-7 text-xs shrink-0" onClick={() => setActiveSheet(i)}>
                        {s.name}
                      </Button>
                    ))}
                  </div>
                )}
                <ExcelSheetView sheet={currentSheet} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Renderização inteligente da planilha (destaque para RESUMO / tabelas de pivot)
// -----------------------------------------------------------------------------
function ExcelSheetView({ sheet }: { sheet: SheetData }) {
  const rows = sheet.rows;
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        Planilha vazia.
      </div>
    );
  }

  // Determina largura máxima em colunas
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

  // Detecta colunas numéricas (>50% das linhas com número naquela coluna)
  const numericCols = new Set<number>();
  for (let c = 0; c < maxCols; c++) {
    let numCount = 0, total = 0;
    for (let r = 1; r < rows.length; r++) {
      const cell = rows[r][c];
      if (!cell || cell.text === "") continue;
      total++;
      if (cell.isNumber) numCount++;
    }
    if (total > 0 && numCount / total >= 0.5) numericCols.add(c);
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-background">
      <table className="text-xs border-collapse w-full">
        <tbody>
          {rows.map((row, ri) => {
            const first = row[0]?.text?.trim() ?? "";
            const isTotalRow =
              /^total/i.test(first) ||
              row.some((c) => c.bold && c.isNumber);
            const isHeader = ri === 0;
            return (
              <tr
                key={ri}
                className={cn(
                  "transition-colors",
                  isHeader && "bg-primary/10 sticky top-0 z-10",
                  isTotalRow && !isHeader && "bg-primary/5 border-t-2 border-primary/40",
                  !isHeader && !isTotalRow && ri % 2 === 0 && "bg-muted/20",
                  !isHeader && "hover:bg-primary/[0.03]",
                )}
              >
                <td className="border-b border-r border-border/50 px-2 py-1.5 text-muted-foreground text-[10px] sticky left-0 bg-inherit w-10 text-center">
                  {ri + 1}
                </td>
                {Array.from({ length: maxCols }).map((_, ci) => {
                  const cell = row[ci] ?? { text: "", isNumber: false, bold: false, indent: 0 };
                  const numericCol = numericCols.has(ci);
                  const bold = cell.bold || isHeader || isTotalRow;
                  const align = cell.isNumber || numericCol ? "text-right tabular-nums" : "text-left";
                  const indentPx = ci === 0 && cell.indent > 0 ? cell.indent * 14 : 0;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-border/40 px-3 py-1.5 whitespace-nowrap max-w-[420px] overflow-hidden text-ellipsis",
                        align,
                        bold && "font-semibold text-foreground",
                        !bold && "text-foreground/90",
                        isHeader && "uppercase tracking-wide text-[10.5px] text-primary",
                      )}
                      style={indentPx ? { paddingLeft: `${12 + indentPx}px` } : undefined}
                      title={cell.text}
                    >
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
