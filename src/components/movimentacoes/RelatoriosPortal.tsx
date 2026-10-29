import { useEffect, useState } from "react";
import { Download, Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarRelatoriosPortal, validarArquivoContrato, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { PortalPdfPreview } from "./PortalPdfPreview";

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
    gerarRelatoriosPortal(contrato, controller.signal).then(result => {
      controller.signal.throwIfAborted();
      result.forEach(a => validarArquivoContrato(contrato, a, a.nome_arquivo));
      const pdf = result.find(a => a.tipo === "pdf");
      if (pdf) url = URL.createObjectURL(pdf.blob);
      setUrlPdf(url); setArquivos(result); onArquivos(result);
    }).catch(e => {
      if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Não foi possível gerar os relatórios.");
    }).finally(() => { if (!controller.signal.aborted) { setGerando(false); onBusy(false); } });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [contrato, nome, tentativa, onArquivos, onBusy]);
  function baixar(a: ArquivoPortal) {
    validarArquivoContrato(contrato, a, a.nome_arquivo);
    const url = URL.createObjectURL(a.blob);
    const link = document.createElement("a"); link.href = url; link.download = a.nome_arquivo; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const pdf = arquivos.find(a => a.tipo === "pdf");
  return <div className="space-y-3">
    {somenteConsulta && <div className="space-y-1"><p className="text-xs font-medium uppercase text-muted-foreground">Relatório de vidas</p><p className="break-all text-sm">{pdf?.nome_arquivo ?? (gerando ? "Carregando..." : "Indisponível")}</p></div>}
    {gerando && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Gerando relatório do contrato #{contrato} ({nome})...</p>}
    {erro && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{erro}</p><Button type="button" variant="outline" onClick={() => setTentativa(t => t + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>}
    {urlPdf && (!somenteConsulta || visualizando) && arquivos.filter(a => a.tipo === "pdf").map(a => <PortalPdfPreview key={a.job_id} blob={a.blob} />)}
    {somenteConsulta ? <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={!pdf || gerando} onClick={() => setVisualizando(true)}><Eye className="mr-2 h-4 w-4" />Visualizar relatório</Button>
      <Button type="button" variant="outline" disabled={!pdf || gerando} onClick={() => { if (pdf) baixar(pdf); }}><Download className="mr-2 h-4 w-4" />Baixar relatório</Button>
    </div> : <div className="flex flex-wrap gap-2">{arquivos.map(a => <Button type="button" variant="outline" key={a.tipo} onClick={() => baixar(a)}><Download className="mr-2 h-4 w-4" />{a.tipo === "pdf" ? "Baixar PDF de vidas ativas" : "Baixar Excel de mensalidades"}</Button>)}</div>}
  </div>;
}