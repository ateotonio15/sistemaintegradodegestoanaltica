import { useEffect, useState } from "react";
import { Check, Download, Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarRelatorioPortal, gerarRelatoriosPortal, validarArquivoContrato, ErroCarregarArquivoPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";
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
  const [falhasArquivos, setFalhasArquivos] = useState<ErroCarregarArquivoPortal[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setArquivos([]); setFalhasArquivos([]); setUrlPdf(""); setErro(""); setGerando(true); setVisualizando(false); onArquivos([]); onBusy(true);
    const busca = somenteConsulta
      ? Promise.allSettled([gerarRelatorioPortal(contrato, "pdf", controller.signal), gerarRelatorioPortal(contrato, "xlsx", controller.signal)]).then(resultados => {
        controller.signal.throwIfAborted();
        setFalhasArquivos(resultados.flatMap(r => r.status === "rejected" && r.reason instanceof ErroCarregarArquivoPortal ? [r.reason] : []));
        return resultados.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
      })
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
  if (somenteConsulta) return <div className="space-y-3">
    {gerando ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Buscando relatório de vidas...</p>
      : <>{arquivos.map(arquivo => <div key={arquivo.job_id} className="space-y-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{arquivo.tipo === "pdf" ? "Relatório de Vidas" : "OPS - Mensalidades"}</p>
        <p role="status" className="flex items-center gap-2 text-sm text-primary"><Check className="h-4 w-4 shrink-0" />Relatório disponível</p>
        <p className="text-xs font-medium text-muted-foreground">{arquivo.tipo === "pdf" ? "PDF" : `Excel (${arquivo.nome_arquivo.toLowerCase().endsWith(".xls") ? ".xls" : ".xlsx"})`}</p>
        <p className="break-all text-sm">{arquivo.nome_arquivo}</p>
        {arquivo.atualizado_em && <p className="text-sm text-muted-foreground">Data de atualização: {formatDateBR(arquivo.atualizado_em)}</p>}
        {arquivo.tipo === "pdf" && visualizando && <PortalPdfPreview key={arquivo.job_id} blob={arquivo.blob} />}
        <div className="flex flex-wrap gap-3 pt-1">
          {arquivo.tipo === "pdf" && <Button type="button" className="h-11 w-full border border-primary/40 px-5 sm:w-auto" onClick={() => setVisualizando(true)}><Eye />Visualizar PDF</Button>}
          <Button type="button" variant={arquivo.tipo === "pdf" ? "outline" : "default"} className={arquivo.tipo === "pdf" ? "h-11 w-full border-primary/30 bg-primary/10 px-5 text-foreground hover:border-primary/60 hover:bg-primary/20 hover:text-foreground sm:w-auto" : "h-11 w-full border border-primary/40 px-5 sm:w-auto"} onClick={() => baixar(arquivo)}><Download />{arquivo.tipo === "pdf" ? "Baixar PDF" : "Baixar Excel"}</Button>
        </div>
      </div>)}
      {falhasArquivos.map(falha => <div key={falha.arquivo.job_id} className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">{falha.arquivo.tipo === "pdf" ? "Relatório de Vidas · PDF" : "OPS - Mensalidades · Excel"}</p>
        <p className="break-all text-sm">{falha.arquivo.nome_arquivo}</p>
        <p role="status" className="text-sm text-muted-foreground">Arquivo disponível, mas ocorreu erro ao carregar.</p>
        <Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw />Tentar novamente</Button>
      </div>)}
      {!arquivos.length && !falhasArquivos.length && <div className="space-y-3">
        <p role="status" className="text-sm text-muted-foreground">Relatório não disponível para este contrato.</p>
        <Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
      </div>}</>}
  </div>;
  return <div className="space-y-3">
    {gerando && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Gerando relatório do contrato #{contrato} ({nome})...</p>}
    {erro && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{erro}</p><Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>}
    {urlPdf && arquivos.filter(a => a.tipo === "pdf").map(a => <PortalPdfPreview key={a.job_id} blob={a.blob} />)}
    <div className="flex flex-wrap gap-2">{arquivos.map(a => <Button type="button" variant="outline" key={a.tipo} onClick={() => baixar(a)}><Download className="mr-2 h-4 w-4" />{a.tipo === "pdf" ? "Baixar PDF de vidas ativas" : "Baixar Excel de mensalidades"}</Button>)}</div>
  </div>;
}