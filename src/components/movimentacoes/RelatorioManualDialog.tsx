import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { STATUS_RELATORIO, CONFIRMACOES_RELATORIO, RELATORIO_VAZIO, validarRegistroRelatorio, type RegistroRelatorio } from "@/lib/movimentacao-relatorio";

function hojeLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RelatorioManualDialog({ movimentacaoId, nome, contexto, registro, statusInicial, dataEnvioEmpresa, canEdit, onClose }: {
  movimentacaoId: string; nome: string; contexto: string; registro?: RegistroRelatorio; statusInicial?: string; dataEnvioEmpresa?: string | null; canEdit: boolean; onClose: () => void;
}) {
  const [form, setForm] = useState<RegistroRelatorio>(() => {
    const base = { ...(registro ?? RELATORIO_VAZIO), ...(statusInicial ? { status: statusInicial } : {}) };
    // Reutiliza a data já existente da coluna "Envio Empresa"; só sugere hoje quando não há nenhuma.
    if (statusInicial === "Enviado" && !base.data_envio) base.data_envio = dataEnvioEmpresa ?? hojeLocalISO();
    return base;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error("Sem permissão para registrar o relatório.");
      const erro = validarRegistroRelatorio(form);
      if (erro) throw new Error(erro);
      const { error } = await supabase.from("movimentacao_relatorios").upsert({
        movimentacao_id: movimentacaoId, status: form.status, destinatarios: form.destinatarios.trim(),
        data_envio: form.data_envio, confirmacao: form.confirmacao, observacoes: form.observacoes.trim(),
      }, { onConflict: "movimentacao_id" });
      if (error) throw error;
      // Integração com o fluxo da movimentação: relatório enviado preenche "Envio Empresa" apenas se estiver vazia.
      if (["Enviado", "Conferido pela empresa", "Divergência informada"].includes(form.status) && form.data_envio && !dataEnvioEmpresa) {
        const { error: erroMov } = await supabase.from("movimentacoes").update({ data_envio_empresa: form.data_envio }).eq("id", movimentacaoId).is("data_envio_empresa", null);
        if (erroMov) throw erroMov;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: "Registro manual salvo" }); onClose();
    },
    onError: (e: Error) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }),
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Relatório de vidas — registro manual</DialogTitle><DialogDescription>{nome} · {contexto}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="relatorio-status">Status do Relatório</Label>
          <Select disabled={!canEdit || save.isPending} value={form.status} onValueChange={status => setForm(f => ({ ...f, status, confirmacao: ["Conferido pela empresa", "Divergência informada"].includes(status) ? status : "Aguardando" }))}>
            <SelectTrigger id="relatorio-status"><SelectValue /></SelectTrigger><SelectContent>{STATUS_RELATORIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="relatorio-destinatarios">Destinatários</Label><Textarea id="relatorio-destinatarios" value={form.destinatarios} disabled={!canEdit || save.isPending} onChange={e => setForm(f => ({ ...f, destinatarios: e.target.value }))} /></div>
        <div className="space-y-2"><Label htmlFor="relatorio-data">Data de Envio</Label><Input id="relatorio-data" type="date" disabled={!canEdit || save.isPending} value={form.data_envio ?? ""} onChange={e => setForm(f => ({ ...f, data_envio: e.target.value || null }))} /></div>
        <div className="space-y-2"><Label htmlFor="relatorio-confirmacao">Confirmação da Empresa</Label>
          <Select disabled={!canEdit || save.isPending} value={form.confirmacao} onValueChange={confirmacao => setForm(f => ({ ...f, confirmacao, status: confirmacao !== "Aguardando" ? confirmacao : ["Conferido pela empresa", "Divergência informada"].includes(f.status) ? "Enviado" : f.status }))}>
            <SelectTrigger id="relatorio-confirmacao"><SelectValue /></SelectTrigger><SelectContent>{CONFIRMACOES_RELATORIO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="relatorio-observacoes">Observações do relatório</Label><Textarea id="relatorio-observacoes" disabled={!canEdit || save.isPending} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Fechar</Button>{canEdit && <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar registro manual"}</Button>}</DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}