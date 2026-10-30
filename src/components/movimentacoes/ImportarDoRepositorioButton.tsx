import { useEffect, useRef, useState } from "react";
import { Archive, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buscarArquivosRepositorio, carregarArquivoRepositorio, conferirContextoRepositorio } from "@/services/importarDoRepositorio";
import type { ArquivoEnvio } from "@/lib/repositorio-envios";
import type { ContextoImportacao } from "@/services/importarArquivosMovimentacao";
import { validarContratoPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";

interface Props {
  movimentacaoId: string | null; empresaId: string | null; mes?: string; periodo?: string | null;
  disabled: boolean; onBusy: (busy: boolean) => void;
  onImportar: (arquivo: ArquivoPortal, signal: AbortSignal) => Promise<"ignorado" | void>;
}
export function ImportarDoRepositorioButton({ movimentacaoId, empresaId, mes, periodo, disabled, onBusy, onImportar }: Props) {
  const [resumo, setResumo] = useState<{ contexto: ContextoImportacao; nome: string; arquivos: ArquivoEnvio[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setResumo(null); setMensagem(""); setBusy(false); setImportando(false); onBusy(false);
    return () => controller.current?.abort();
  }, [movimentacaoId, empresaId, mes, periodo]);
  const finalizar = () => { setBusy(false); onBusy(false); };
  const buscar = async () => {
    if (!movimentacaoId || !empresaId || busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); onBusy(true); setMensagem("");
    try {
      const { data: emp, error } = await supabase.from("empresas").select("codigo_contrato").eq("id", empresaId).abortSignal(abort.signal).single();
      if (error) throw error;
      const contexto = { movimentacaoId, empresaId, contrato: String(validarContratoPortal(emp.codigo_contrato)), mes: mes ?? "", periodo: periodo ?? null };
      const nome = await conferirContextoRepositorio(contexto, abort.signal);
      const arquivos = await buscarArquivosRepositorio(contexto, abort.signal);
      abort.signal.throwIfAborted();
      setResumo({ contexto, nome, arquivos });
    } catch (erro) {
      if (!abort.signal.aborted) { setMensagem(erro instanceof Error ? erro.message : "Não foi possível consultar o Repositório de Envios."); finalizar(); }
    }
  };
  const confirmar = async () => {
    const abort = controller.current;
    if (!resumo || !abort || importando) return;
    setImportando(true); setMensagem("");
    try {
      await conferirContextoRepositorio(resumo.contexto, abort.signal);
      const atuais = await buscarArquivosRepositorio(resumo.contexto, abort.signal);
      if (resumo.arquivos.some(a => !atuais.some(atual => atual.id === a.id))) {
        setResumo({ ...resumo, arquivos: atuais });
        throw new Error("Os arquivos atuais mudaram. Confira a lista e confirme novamente.");
      }
      // Carregar todos antes de anexar: cancelar a consulta nunca cria anexos.
      const arquivos = await Promise.all(resumo.arquivos.map(a => carregarArquivoRepositorio(a, resumo.contexto, abort.signal)));
      let anexados = 0; let ignorados = 0; let falhas = 0;
      for (const arquivo of arquivos) {
        abort.signal.throwIfAborted();
        try { if (await onImportar(arquivo, abort.signal) === "ignorado") ignorados++; else anexados++; }
        catch (erro) { if (abort.signal.aborted) throw erro; falhas++; }
      }
      abort.signal.throwIfAborted();
      setMensagem(`${anexados} arquivo(s) anexado(s).${ignorados ? ` ${ignorados} já estavam anexados e foram ignorados.` : ""}${falhas ? ` ${falhas} não puderam ser anexados. Tente novamente.` : ""}`);
      setResumo(null); finalizar();
    } catch (erro) { if (!abort.signal.aborted) setMensagem(erro instanceof Error ? erro.message : "Não foi possível importar os arquivos."); }
    finally { if (!abort.signal.aborted) setImportando(false); }
  };
  return <div className="min-w-0 space-y-1">
    <Button type="button" size="sm" disabled={disabled || busy || !movimentacaoId || !empresaId} onClick={buscar}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}Importar do Repositório
    </Button>
    {!resumo && mensagem && <p role="status" className="text-xs text-muted-foreground break-words">{mensagem}</p>}
    <Dialog open={!!resumo} onOpenChange={open => { if (!open && !importando) { controller.current?.abort(); setResumo(null); finalizar(); } }}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" onEscapeKeyDown={e => { if (importando) e.preventDefault(); }} onInteractOutside={e => { if (importando) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Arquivos encontrados no Repositório</DialogTitle><DialogDescription>{resumo?.nome}</DialogDescription></DialogHeader>
        {resumo && <>
          <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Contrato</dt><dd>{resumo.contexto.contrato}</dd></div><div><dt className="text-muted-foreground">Competência</dt><dd>{resumo.contexto.mes.split("-").reverse().join("/")}</dd></div><div><dt className="text-muted-foreground">Período</dt><dd>{resumo.contexto.periodo || "—"}</dd></div></dl>
          {resumo.arquivos.length ? <ul className="space-y-3">{resumo.arquivos.map(a => <li key={a.id} className="flex min-w-0 gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div className="min-w-0"><p className="font-medium">{a.tipo_relatorio} - {a.nome_arquivo.split(".").pop()?.toUpperCase()} <span className="font-normal text-muted-foreground">· v{a.versao}</span></p><p className="break-words text-xs text-muted-foreground">{a.nome_arquivo}</p></div></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum arquivo atual encontrado no Repositório para esta movimentação.</p>}
          {mensagem && <p role="alert" className="text-sm text-destructive">{mensagem}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={importando} onClick={() => { controller.current?.abort(); setResumo(null); finalizar(); }}>Cancelar</Button><Button type="button" disabled={importando || !resumo.arquivos.length} onClick={confirmar}>{importando && <Loader2 className="h-4 w-4 animate-spin" />}{importando ? "Importando..." : "Importar arquivos"}</Button></div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}