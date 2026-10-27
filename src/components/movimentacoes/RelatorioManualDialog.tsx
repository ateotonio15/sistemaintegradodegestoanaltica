import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const anexosQ = useQuery({
    queryKey: ["relatorio-anexos-email", movimentacaoId],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await supabase.from("anexos_movimentacao").select("id, nome_arquivo").eq("movimentacao_id", movimentacaoId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter(a => /\.(pdf|xlsx|xlsm|xls)$/i.test(a.nome_arquivo));
    },
  });
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const enviarEmail = useMutation({
    mutationFn: async () => {
      const emails = form.destinatarios.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      if (!emails.length) throw new Error("Informe ao menos um destinatário.");
      const invalido = emails.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (invalido) throw new Error(`E-mail inválido: ${invalido}`);
      if (!selecionados.length) throw new Error("Selecione ao menos um arquivo para anexar.");
      const { data, error } = await supabase.functions.invoke("enviar-relatorio-email", { body: { movimentacao_id: movimentacaoId, destinatarios: emails, anexo_ids: selecionados } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const msg = ctx ? (await ctx.json().catch(() => null))?.error : null;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast({ title: "E-mail enviado", description: "O relatório foi enviado e registrado como \"Enviado\"." }); onClose();
    },
    onError: (e: Error) => toast({ title: "Não foi possível enviar o e-mail", description: e.message, variant: "destructive" }),
  });
  const ocupado = save.isPending || enviarEmail.isPending;
  return <Dialog open onOpenChange={open => { if (!open && !ocupado) onClose(); }}>
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
        {canEdit && <div className="space-y-2 rounded-md border p-3">
          <Label>Arquivos para anexar no e-mail</Label>
          {anexosQ.isLoading ? <p className="text-sm text-muted-foreground">Carregando arquivos...</p>
            : !anexosQ.data?.length ? <p className="text-sm text-muted-foreground">Nenhum PDF ou Excel anexado nesta movimentação.</p>
            : anexosQ.data.map(a => <label key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selecionados.includes(a.id)} disabled={ocupado} onCheckedChange={v => setSelecionados(s => v ? [...s, a.id] : s.filter(x => x !== a.id))} />
                <span className="break-all">{a.nome_arquivo}</span>
              </label>)}
          <Button type="button" className="w-full" disabled={ocupado || !selecionados.length} onClick={() => enviarEmail.mutate()}>
            <Send className="mr-2 h-4 w-4" />{enviarEmail.isPending ? "Enviando e-mail..." : "Enviar por e-mail"}
          </Button>
        </div>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>Fechar</Button>{canEdit && <Button type="submit" variant="outline" disabled={ocupado}>{save.isPending ? "Salvando..." : "Salvar registro manual"}</Button>}</DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}