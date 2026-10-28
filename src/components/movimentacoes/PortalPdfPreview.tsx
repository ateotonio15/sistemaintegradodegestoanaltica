import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function PortalPdfPreview({ blob }: { blob: Blob }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let ativo = true;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    setDoc(null); setPagina(1); setErro(""); setOcupado(true);
    blob.arrayBuffer().then(async data => {
      if (!ativo) return;
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      if (ativo) setDoc(pdf);
    }).catch(() => { if (ativo) { setErro("Não foi possível exibir o PDF. O download continua disponível."); setOcupado(false); } });
    return () => { ativo = false; void task?.destroy(); };
  }, [blob]);
  useEffect(() => {
    if (!doc) return;
    let ativo = true;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setOcupado(true);
    doc.getPage(pagina).then(async page => {
      const canvas = canvasRef.current;
      if (!ativo || !canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const viewport = page.getViewport({ scale: 1.4 });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      render = page.render({ canvas, canvasContext: context, viewport });
      await render.promise;
    }).catch(e => { if (ativo && e?.name !== "RenderingCancelledException") setErro("Não foi possível exibir esta página."); })
      .finally(() => { if (ativo) setOcupado(false); });
    return () => { ativo = false; render?.cancel(); };
  }, [doc, pagina]);
  return <div className="space-y-2">
    <div className="flex items-center justify-center gap-3">
      <Button type="button" variant="outline" size="icon" title="Página anterior" aria-label="Página anterior" disabled={!doc || pagina <= 1 || ocupado} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm">Página {pagina} de {doc?.numPages ?? "—"}</span>
      <Button type="button" variant="outline" size="icon" title="Próxima página" aria-label="Próxima página" disabled={!doc || pagina >= doc.numPages || ocupado} onClick={() => setPagina(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
    {ocupado && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Carregando PDF...</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="h-[420px] overflow-auto border border-border bg-muted"><canvas aria-label={`Página ${pagina} do relatório de vidas`} ref={canvasRef} className="mx-auto h-auto max-w-full" /></div>
  </div>;
}