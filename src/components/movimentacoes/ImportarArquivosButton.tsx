import { useEffect, useRef, useState } from "react";
import { CloudDownload, Loader2, ClipboardCheck, Check, AlertTriangle, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { importarArquivosMovimentacao } from "@/services/importarArquivosMovimentacao";
import type { ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  movimentacaoId: string | null;
  empresaId: string | null;
  mes?: string;
  periodo?: string | null;
  disabled: boolean;
  onImportar: (arquivo: ArquivoPortal, signal: AbortSignal) => Promise<"ignorado" | void>;
  onBusy: (busy: boolean) => void;
  onConcluir?: () => void;
  compacto?: boolean;
}

export function ImportarArquivosButton({ movimentacaoId, empresaId, mes, periodo, disabled, onImportar, onBusy, onConcluir, compacto = false }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [resumo, setResumo] = useState<null | { nome: string; contrato: string; mes: string; periodo: string | null; resultado: Awaited<ReturnType<typeof importarArquivosMovimentacao>> }>(null);
  const [registrando, setRegistrando] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");
  useEffect(() => {
    setMensagem("");
    setResumo(null);
    setErroHistorico("");
    setBusy(false);
    onBusy(false);
    return () => { controller.current?.abort(); };
  }, [movimentacaoId, empresaId, mes, periodo]);

  const importar = async (preparar = false) => {
    if (!movimentacaoId || !empresaId || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    onBusy(true);
    setMensagem(preparar ? "Consultando o Repositório de Envios..." : "Buscando arquivos do contrato...");
    setResumo(null);
    try {
      const { data: mov, error } = await supabase.from("movimentacoes")
        .select("empresa_id, mes_referencia, periodo").eq("id", movimentacaoId).single();
      if (error) throw error;
      if (mov.empresa_id !== empresaId || (mes !== undefined && mov.mes_referencia !== mes) || (periodo !== undefined && mov.periodo !== periodo)) {
        throw new Error("Salve as alterações da empresa, competência e período antes de importar.");
      }
      const { data: empresa, error: empError } = await supabase.from("empresas")
        .select("codigo_contrato, nome").eq("id", mov.empresa_id).single();
      if (empError) throw empError;
      abort.signal.throwIfAborted();
      const resultado = await importarArquivosMovimentacao({
        movimentacaoId, empresaId, contrato: String(empresa.codigo_contrato ?? ""),
        mes: mov.mes_referencia, periodo: mov.periodo,
      }, abort.signal, arquivo => onImportar(arquivo, abort.signal), quantidade => {
        setMensagem(`Arquivos encontrados: ${quantidade}${quantidade ? " — Anexando..." : ""}`);
      }, preparar);
      if (preparar) await queryClient.invalidateQueries({ queryKey: ["envios-empresa-arquivos"] });
      if (preparar && !abort.signal.aborted) setResumo({ nome: empresa.nome, contrato: String(empresa.codigo_contrato), mes: mov.mes_referencia, periodo: mov.periodo, resultado });
      if (!abort.signal.aborted) setMensagem(resultado.encontrados === 0
        ? "Nenhum arquivo disponível para este contrato. Tente novamente."
        : `Arquivos encontrados: ${resultado.encontrados} — ${resultado.anexados} anexado(s).${resultado.ignorados ? ` ${resultado.ignorados === 1 ? "1 arquivo já estava anexado e foi ignorado." : `${resultado.ignorados} arquivos já estavam anexados e foram ignorados.`}` : ""}${resultado.falhas ? " Alguns arquivos não puderam ser obtidos ou anexados. Tente novamente." : ""}`);
    } catch (erro) {
      if (!abort.signal.aborted) setMensagem(erro instanceof Error ? erro.message : "Não foi possível importar os arquivos. Tente novamente.");
    } finally {
      if (controller.current === abort && !abort.signal.aborted) { setBusy(false); onBusy(false); }
    }
  };

  const continuar = async () => {
    if (!resumo || !movimentacaoId) return;
    const pendencias = resumo.resultado.documentos.filter(item => !item.disponivel).map(item => item.tipo === "pdf" ? "Relatório de Vidas - PDF" : "OPS Mensalidades - Excel");
    setRegistrando(true);
    setErroHistorico("");
    try {
      if (pendencias.length) {
        const { error } = await supabase.from("movimentacao_fechamento_historico").insert({ movimentacao_id: movimentacaoId, evento: "continuacao_pendente", pendencias });
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["historico-fechamento", movimentacaoId] });
      }
      setResumo(null);
      onConcluir?.();
    } catch { setErroHistorico("Não foi possível registrar as pendências no histórico. Tente novamente."); }
    finally { setRegistrando(false); }
  };

  return <div className="min-w-0 space-y-1">
    <div className="flex flex-wrap gap-2">
    {!compacto && <Button type="button" variant="outline" size="sm" disabled={disabled || busy || !movimentacaoId || !empresaId} onClick={() => importar()}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
      Importar arquivos
    </Button>}
    {onConcluir && <Button type="button" variant="outline" size="sm" disabled={disabled || busy || !movimentacaoId || !empresaId} onClick={() => importar(true)}><ClipboardCheck className="h-3.5 w-3.5" />Preparar fechamento</Button>}
    {compacto && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Outras ações de anexos" aria-label="Outras ações de anexos" disabled={disabled || busy || !movimentacaoId || !empresaId}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => importar()}><CloudDownload className="mr-2 h-4 w-4" />Importar arquivos</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
    </div>
    {mensagem && <p role="status" className="text-xs text-muted-foreground break-words">{mensagem}</p>}
    <Dialog open={!!resumo} onOpenChange={open => { if (!open && !registrando) setResumo(null); }}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Preparação do fechamento</DialogTitle><DialogDescription>{resumo?.nome}</DialogDescription></DialogHeader>
        {resumo && <>
          <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Contrato</dt><dd>{resumo.contrato}</dd></div><div><dt className="text-muted-foreground">Período</dt><dd>{resumo.periodo || "—"}</dd></div><div><dt className="text-muted-foreground">Competência da movimentação</dt><dd>{resumo.mes.split("-").reverse().join("/")}</dd></div></dl>
          <div className="space-y-2 text-sm"><p className="font-medium">Arquivos encontrados</p>{resumo.resultado.documentos.map(item => <p key={item.tipo} className="flex items-center gap-2">{item.disponivel ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}{item.tipo === "pdf" ? "Relatório de Vidas - PDF" : "OPS Mensalidades - Excel"}{!item.disponivel && " — não encontrado ou não anexado"}</p>)}</div>
          <p className="text-sm">Arquivos anexados automaticamente: {resumo.resultado.anexados}</p>
          {resumo.resultado.ignorados > 0 && <p className="text-sm text-muted-foreground">Já anexados e ignorados: {resumo.resultado.ignorados}</p>}
          <p className="text-sm">Pendências: {resumo.resultado.documentos.every(item => item.disponivel) ? "Nenhuma" : "Alguns arquivos não foram encontrados."}</p>
          {erroHistorico && <p role="alert" className="text-sm text-destructive">{erroHistorico}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {resumo.resultado.documentos.some(item => !item.disponivel) && <Button type="button" variant="outline" disabled={registrando} onClick={() => importar(true)}>Tentar novamente</Button>}
            <Button type="button" disabled={registrando} onClick={continuar}>{registrando ? "Registrando..." : resumo.resultado.documentos.every(item => item.disponivel) ? "Concluir" : "Continuar mesmo assim"}</Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}