import { useEffect, useRef, useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { importarArquivosMovimentacao } from "@/services/importarArquivosMovimentacao";
import type { ArquivoPortal } from "@/services/portalEmpresaRelatorios";

interface Props {
  movimentacaoId: string | null;
  empresaId: string | null;
  mes?: string;
  periodo?: string | null;
  disabled: boolean;
  onImportar: (arquivo: ArquivoPortal, signal: AbortSignal) => Promise<void>;
  onBusy: (busy: boolean) => void;
}

export function ImportarArquivosButton({ movimentacaoId, empresaId, mes, periodo, disabled, onImportar, onBusy }: Props) {
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setMensagem("");
    setBusy(false);
    onBusy(false);
    return () => { controller.current?.abort(); };
  }, [movimentacaoId, empresaId, mes, periodo]);

  const importar = async () => {
    if (!movimentacaoId || !empresaId || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    onBusy(true);
    setMensagem("Buscando arquivos do contrato...");
    try {
      const { data: mov, error } = await supabase.from("movimentacoes")
        .select("empresa_id, mes_referencia, periodo").eq("id", movimentacaoId).single();
      if (error) throw error;
      if (mov.empresa_id !== empresaId || (mes !== undefined && mov.mes_referencia !== mes) || (periodo !== undefined && mov.periodo !== periodo)) {
        throw new Error("Salve as alterações da empresa, competência e período antes de importar.");
      }
      const { data: empresa, error: empError } = await supabase.from("empresas")
        .select("codigo_contrato").eq("id", mov.empresa_id).single();
      if (empError) throw empError;
      abort.signal.throwIfAborted();
      const resultado = await importarArquivosMovimentacao({
        movimentacaoId, empresaId, contrato: String(empresa.codigo_contrato ?? ""),
        mes: mov.mes_referencia, periodo: mov.periodo,
      }, abort.signal, arquivo => onImportar(arquivo, abort.signal), quantidade => {
        setMensagem(`Arquivos encontrados: ${quantidade}${quantidade ? " — Anexando..." : ""}`);
      });
      if (!abort.signal.aborted) setMensagem(resultado.encontrados === 0
        ? "Nenhum arquivo disponível para este contrato. Tente novamente."
        : `Arquivos encontrados: ${resultado.encontrados} — ${resultado.anexados} processado(s).${resultado.falhas ? " Alguns arquivos não puderam ser obtidos ou anexados. Tente novamente." : ""}`);
    } catch (erro) {
      if (!abort.signal.aborted) setMensagem(erro instanceof Error ? erro.message : "Não foi possível importar os arquivos. Tente novamente.");
    } finally {
      if (controller.current === abort && !abort.signal.aborted) { setBusy(false); onBusy(false); }
    }
  };

  return <div className="min-w-0 space-y-1">
    <Button type="button" variant="outline" size="sm" disabled={disabled || busy || !movimentacaoId || !empresaId} onClick={importar}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
      Importar arquivos
    </Button>
    {mensagem && <p role="status" className="text-xs text-muted-foreground break-words">{mensagem}</p>}
  </div>;
}