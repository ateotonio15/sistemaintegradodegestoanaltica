import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { gerarRelatoriosPortal } from "@/services/portalEmpresaRelatorios";
import { enviarRelatoriosPortal } from "@/services/enviarRelatoriosPortal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function RelatorioLoteDialog({ items, resumo, contexto, onClose }: {
  items: { id: string; empresaId: string | null; nome: string; contrato: string | null; periodo: string; destinatarios: string; cc: string }[];
  resumo: { selecionadas: number; prontas: number; semDestinatario: number; comErro: number };
  contexto: string;
  onClose: () => void;
}) {
  const [lote] = useState(() => items.map(i => Object.freeze({ ...i })));
  const [progresso, setProgresso] = useState("");
  const [resultados, setResultados] = useState<{ id: string; mensagem: string; erro: boolean }[]>([]);
  const { toast } = useToast();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!lote.length) throw new Error("Confira os relatórios do lote.");
      let enviados = 0;
      for (const item of lote) {
        setProgresso(`Gerando e enviando: Empresa: ${item.nome} | Contrato: #${item.contrato}`);
        try {
          const { data: registro, error } = await supabase.from("movimentacao_relatorios").select("status, confirmacao, destinatarios, cc").eq("movimentacao_id", item.id).maybeSingle();
          if (error || registro?.status !== "Pronto para envio" || registro.confirmacao !== "Aguardando" || registro.destinatarios !== item.destinatarios || (registro.cc ?? "") !== item.cc) throw new Error("Registro alterado. Prepare os relatórios novamente.");
          const controller = new AbortController();
          const arquivos = await gerarRelatoriosPortal(item.contrato, controller.signal);
          await enviarRelatoriosPortal({ movimentacaoId: item.id, empresaId: item.empresaId, onProgresso: msg => setProgresso(`Empresa: ${item.nome} | Contrato: #${item.contrato} — ${msg}`), contrato: item.contrato, destinatarios: item.destinatarios.split(/[,;\s]+/).filter(Boolean), cc: item.cc.split(/[,;\s]+/).filter(Boolean), arquivos, lote: true });
          enviados++;
          setResultados(r => [...r, { id: item.id, mensagem: "E-mail enviado", erro: false }]);
        } catch (e) {
          setResultados(r => [...r, { id: item.id, mensagem: e instanceof Error ? e.message : "Falha no envio", erro: true }]);
        }
      }
      setProgresso("");
      return enviados;
    },
    onSuccess: async total => {
      await client.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      await client.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast({ title: `${total} e-mail(s) enviado(s)`, description: total !== lote.length ? "Confira os erros apresentados no lote." : undefined });
    },
    onError: (e: Error) => toast({ title: "Não foi possível registrar o envio", description: e.message, variant: "destructive" }),
  });
  return <Dialog open onOpenChange={o => { if (!o && !save.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Enviar Relatórios</DialogTitle><DialogDescription>Confirme o envio dos relatórios de vidas aptos</DialogDescription></DialogHeader>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Período</dt><dd className="font-medium">{contexto}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Empresas selecionadas</dt><dd className="font-medium">{resumo.selecionadas}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Prontas</dt><dd className="font-medium text-success">{resumo.prontas}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sem destinatário</dt><dd className="font-medium text-warning">{resumo.semDestinatario}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Com erro</dt><dd className="font-medium text-destructive">{resumo.comErro}</dd></div>
      </dl>
      <p className="text-sm font-medium">{items.length} relatórios serão enviados. Empresas sem destinatário ou com erro não bloqueiam as demais.</p>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border">{lote.map(i => <li key={i.id} className="py-2 text-sm"><div className="font-semibold break-words">Empresa: {i.nome} | Contrato: #{i.contrato ?? "Não informado"}</div><div>{i.periodo}</div><div className="text-muted-foreground break-words">{i.destinatarios}</div>{resultados.filter(r => r.id === i.id).map(r => <p key={r.id} className={r.erro ? "text-destructive" : "text-success"}>{r.mensagem}</p>)}</li>)}</ul>
      {progresso && <p role="status" className="text-sm break-words">{progresso}</p>}
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>{resultados.length ? "Fechar" : "Cancelar"}</Button><Button type="submit" disabled={save.isPending || !lote.length || resultados.length > 0}>{save.isPending ? "Enviando..." : "Confirmar envio"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
