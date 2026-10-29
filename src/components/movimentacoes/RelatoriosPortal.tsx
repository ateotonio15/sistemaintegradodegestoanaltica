import { useEffect, useState } from "react";
import { Check, Download, Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarRelatorioPortal, gerarRelatoriosPortal, validarArquivoContrato, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { PortalPdfPreview } from "./PortalPdfPreview";
import { formatDateBR } from "@/lib/date-utils";

export function RelatoriosPortal({ contrato, nome, onArquivos, onBusy, somenteConsulta = false }: {
  contrato: string | null; nome: string; onArquivos: (arquivos: ArquivoPortal[]) => void; onBusy: (busy: boolean) => void; somenteConsulta?: boolean;
}) {
  const [arquivos, setArquivos] = useState<ArquivoPortal[]>([]);
  const [urlPdf, setUrlPdf] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [visualizando, setVisualizando] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setArquivos([]); setUrlPdf(""); setErro(""); setGerando(true); setVisualizando(false); onArquivos([]); onBusy(true);
    const busca = somenteConsulta
      ? gerarRelatorioPortal(contrato, "pdf", controller.signal).then(pdf => [pdf])
      : gerarRelatoriosPortal(contrato, controller.signal);
    busca.then(result => {
      controller.signal.throwIfAborted();
      result.forEach(a => validarArquivoContrato(contrato, a, a.nome_arquivo));
      const pdf = result.find(a => a.tipo === "pdf");
      if (pdf) url = URL.createObjectURL(pdf.blob);
      setUrlPdf(url); setArquivos(result); onArquivos(result);
    }).catch(e => {
      if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Não foi possível gerar os relatórios.");
    }).finally(() => { if (!controller.signal.aborted) { setGerando(false); onBusy(false); } });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [contrato, nome, tentativa, onArquivos, onBusy, somenteConsulta]);
  function baixar(a: ArquivoPortal) {
    validarArquivoContrato(contrato, a, a.nome_arquivo);
    const url = URL.createObjectURL(a.blob);
    const link = document.createElement("a"); link.href = url; link.download = a.nome_arquivo; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const pdf = arquivos.find(a => a.tipo === "pdf");
  const excel = arquivos.find(a => a.tipo === "xlsx");
  if (somenteConsulta) return <div className="space-y-3">
    <p className="text-xs font-medium uppercase text-muted-foreground">Relatório de vidas</p>
    {gerando ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Buscando relatório de vidas...</p>
      : pdf ? <>
        <p role="status" className="flex items-center gap-2 text-sm text-primary"><Check className="h-4 w-4 shrink-0" />Relatório disponível</p>
        <p className="text-xs font-medium text-muted-foreground">PDF</p>
        <p className="break-all text-sm">{pdf.nome_arquivo}</p>
        {pdf.atualizado_em && <p className="text-sm text-muted-foreground">Data de atualização: {formatDateBR(pdf.atualizado_em)}</p>}
        {visualizando && <PortalPdfPreview key={pdf.job_id} blob={pdf.blob} />}
        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="button" className="h-11 w-full border border-primary/40 px-5 sm:w-auto" onClick={() => setVisualizando(true)}><Eye />Visualizar PDF</Button>
          <Button type="button" variant="outline" className="h-11 w-full border-primary/30 bg-primary/10 px-5 text-foreground hover:border-primary/60 hover:bg-primary/20 hover:text-foreground sm:w-auto" onClick={() => baixar(pdf)}><Download />Baixar PDF</Button>
        </div>
      </> : <div className="space-y-3">
        <p role="status" className="text-sm text-muted-foreground">Relatório não disponível para este contrato.</p>
        <Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
      </div>}
    {excel && <div className="space-y-3 border-t border-border pt-4">
      <div className="space-y-1"><p className="text-xs font-medium uppercase text-muted-foreground">OPS - Mensalidades</p><p className="text-xs font-medium text-muted-foreground">Excel (.xlsx)</p><p className="break-all text-sm">{excel.nome_arquivo}</p></div>
      <Button type="button" className="h-11 w-full border border-primary/40 px-5 sm:w-auto" onClick={() => baixar(excel)}><Download />Baixar Excel</Button>
    </div>}
  </div>;
  return <div className="space-y-3">
    {gerando && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Gerando relatório do contrato #{contrato} ({nome})...</p>}
    {erro && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{erro}</p><Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>}
    {urlPdf && arquivos.filter(a => a.tipo === "pdf").map(a => <PortalPdfPreview key={a.job_id} blob={a.blob} />)}
    <div className="flex flex-wrap gap-2">{arquivos.map(a => <Button type="button" variant="outline" key={a.tipo} onClick={() => baixar(a)}><Download className="mr-2 h-4 w-4" />{a.tipo === "pdf" ? "Baixar PDF de vidas ativas" : "Baixar Excel de mensalidades"}</Button>)}</div>
  </div>;
}