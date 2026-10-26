import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RelatorioLoteDialog({ items, resumo, contexto, onClose }: {
  items: { id: string; nome: string; periodo: string; destinatarios: string }[];
  resumo: { selecionadas: number; prontas: number; semDestinatario: number; comErro: number };
  contexto: string;
  onClose: () => void;
}) {
  const [dataEnvio, setDataEnvio] = useState(hojeISO());
  const { toast } = useToast();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!items.length || !dataEnvio) throw new Error("Informe a data de envio e confira os relatórios do lote.");
      const { data, error } = await supabase.from("movimentacao_relatorios")
        .update({ status: "Enviado", data_envio: dataEnvio })
        .in("movimentacao_id", items.map(i => i.id)).eq("status", "Pronto para envio")
        .eq("confirmacao", "Aguardando").neq("destinatarios", "").select("movimentacao_id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: async total => {
      await client.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      toast({ title: `${total} envio(s) registrado(s)`, description: total !== items.length ? "Alguns relatórios mudaram ou não puderam ser atualizados. Confira a tabela." : undefined });
      onClose();
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
      <ul className="max-h-64 overflow-y-auto divide-y divide-border">{items.map(i => <li key={i.id} className="py-2 text-sm"><div className="font-medium break-words">{i.nome} · {i.periodo}</div><div className="text-muted-foreground break-words">{i.destinatarios}</div></li>)}</ul>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="lote-data-envio">Data de Envio</Label><Input required id="lote-data-envio" type="date" value={dataEnvio} onChange={e => setDataEnvio(e.target.value)} disabled={save.isPending} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending || !items.length || !dataEnvio}>{save.isPending ? "Enviando..." : "Confirmar envio"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
