import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { RelatoriosPortal } from "./RelatoriosPortal";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { STATUS_RELATORIO, CONFIRMACOES_RELATORIO, RELATORIO_VAZIO, ajustarRegistroManual, validarRegistroRelatorio, type RegistroRelatorio } from "@/lib/movimentacao-relatorio";
import type { ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { enviarRelatoriosPortal, buscarGrupoRelatorio } from "@/services/enviarRelatoriosPortal";
import { HistoricoEnvioRelatorio } from "./HistoricoEnvioRelatorio";
import { CenarioEnvioPainel, type EscolhaCenario } from "./CenarioEnvioPainel";
import { CENARIOS_ENVIO, sugerirCenario, validarEscolhaCenario } from "../../../supabase/functions/_shared/cenario-envio";
import { dataCorteMovimentacao } from "../../../supabase/functions/_shared/data-corte";

function hojeLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RelatorioManualDialog({ movimentacaoId, empresaId = null, nome, contrato, contexto, competencia, mesReferencia = null, periodo, registro, statusInicial, dataEnvioEmpresa, canEdit, onClose, modoFechamento = false }: {
  modoFechamento?: boolean; movimentacaoId: string; empresaId?: string | null; nome: string; contrato: string | null; contexto: string; competencia: string; mesReferencia?: string | null; periodo: string | null; registro?: RegistroRelatorio; statusInicial?: string; dataEnvioEmpresa?: string | null; canEdit: boolean; onClose: () => void;
}) {
  const somenteConsulta = !statusInicial;
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
      // Salvar só os e-mails não pode marcar o relatório como enviado.
      const registro = ajustarRegistroManual(form);
      const erro = validarRegistroRelatorio(registro);
      if (erro) throw new Error(erro);
      const { error } = await supabase.from("movimentacao_relatorios").upsert({
        movimentacao_id: movimentacaoId, status: registro.status, destinatarios: registro.destinatarios.trim(),
        cc: registro.cc.trim(),
        data_envio: registro.data_envio, confirmacao: registro.confirmacao, observacoes: registro.observacoes.trim(),
      }, { onConflict: "movimentacao_id" });
      if (error) throw error;
      // Integração com o fluxo da movimentação: relatório enviado preenche "Envio Empresa" apenas se estiver vazia.
      if (["Enviado", "Conferido pela empresa", "Divergência informada"].includes(registro.status) && registro.data_envio && !dataEnvioEmpresa) {
        const { error: erroMov } = await supabase.from("movimentacoes").update({ data_envio_empresa: registro.data_envio }).eq("id", movimentacaoId).is("data_envio_empresa", null);
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
  const [arquivosOcupados, setArquivosOcupados] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoPortal[]>([]);
  const [progresso, setProgresso] = useState("");
  const grupo = useQuery({ queryKey: ["relatorio-grupo", empresaId, contrato], queryFn: () => buscarGrupoRelatorio(empresaId, contrato), enabled: !!empresaId && !somenteConsulta });
  const ehMembro = grupo.data?.papel === "membro";
  const corte = dataCorteMovimentacao(periodo, mesReferencia);
  const cenarioSugerido = sugerirCenario(hojeLocalISO(), corte);
  const [escolha, setEscolha] = useState<EscolhaCenario>({ cenario: modoFechamento ? "financeiro" : cenarioSugerido, justificativa: "", motivoAlteracao: "" });
  // Ao escolher "Envio direto ao Financeiro", preenche "Destinatários" com os e-mails do Financeiro já cadastrados.
  const emailsFin = useQuery({ queryKey: ["config-emails-financeiro"], enabled: escolha.cenario === "financeiro", queryFn: async () => {
    const { data } = await supabase.from("config_emails_financeiro").select("para, cc").eq("id", 1).maybeSingle();
    return [...new Set([...(data?.para ?? []), ...(data?.cc ?? [])])];
  } });
  useEffect(() => {
    if (escolha.cenario !== "financeiro" || !emailsFin.data?.length) return;
    const lista = emailsFin.data;
    setForm(f => {
      const atuais = f.destinatarios.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      const faltam = lista.filter(e => !atuais.includes(e));
      return faltam.length ? { ...f, destinatarios: [...atuais, ...faltam].join(", ") } : f;
    });
  }, [escolha.cenario, emailsFin.data]);
  const enviarEmail = useMutation({
    mutationFn: async () => {
      const emails = form.destinatarios.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      if (!emails.length) throw new Error("Informe ao menos um destinatário.");
      const invalido = emails.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (invalido) throw new Error(`E-mail inválido: ${invalido}`);
      const emailsCopia = form.cc.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      const invalidoCopia = emailsCopia.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (invalidoCopia) throw new Error(`E-mail inválido em "Com cópia": ${invalidoCopia}`);
      const bloqueio = validarEscolhaCenario({ sugerido: cenarioSugerido, escolhido: escolha.cenario, justificativa: escolha.justificativa, motivoAlteracao: escolha.motivoAlteracao });
      if (bloqueio) throw new Error(bloqueio);
      if (escolha.bloqueio) throw new Error(escolha.bloqueio);
      return enviarRelatoriosPortal({ assuntoEditado: escolha.assuntoEditado, corpoEditado: escolha.corpoEditado, movimentacaoId, empresaId, onProgresso: setProgresso, contrato, destinatarios: emails, cc: emailsCopia, arquivos, cenario: escolha.cenario, modeloId: escolha.modeloId, justificativa: escolha.justificativa, motivoAlteracao: escolha.motivoAlteracao });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast({ title: "E-mail enviado", description: modoFechamento ? "E-mail enviado ao Financeiro e fechamento efetuado." : "O relatório foi enviado e registrado como \"Enviado\"." }); onClose();
    },
    onSettled: () => setProgresso(""),
    onError: (e: Error) => toast({ title: "Não foi possível enviar o e-mail", description: e.message, variant: "destructive" }),
  });
  // Fechamento sem e-mail: quando a empresa já deu o ok, permite concluir o fechamento
  // (preenche "Data Envio Financeiro" com a data de hoje) sem disparar o e-mail ao Financeiro.
  const concluirSemEmail = useMutation({
    mutationFn: async () => {
      const hoje = hojeLocalISO();
      const { error } = await supabase.from("movimentacoes").update({ data_envio_financeiro: hoje }).eq("id", movimentacaoId).is("data_envio_financeiro", null);
      if (error) throw error;
      // Grupo Financeiro: o fechamento do principal vale para os demais contratos do grupo.
      const db = supabase as any;
      const { data: mov } = await db.from("movimentacoes").select("id, empresa_id, mes_referencia, periodo").eq("id", movimentacaoId).maybeSingle();
      const { data: vinc } = mov ? await db.from("grupos_financeiros_contratos").select("grupo_id").eq("empresa_id", mov.empresa_id).eq("ativo", true).maybeSingle() : { data: null };
      if (mov && vinc) {
        const { data: grupo } = await db.from("grupos_financeiros").select("contrato_principal_empresa_id").eq("id", vinc.grupo_id).maybeSingle();
        if (!grupo?.contrato_principal_empresa_id || grupo.contrato_principal_empresa_id === mov.empresa_id) {
          const { data: membros } = await db.from("grupos_financeiros_contratos").select("empresa_id").eq("grupo_id", vinc.grupo_id).eq("ativo", true);
          const outras = ((membros ?? []) as any[]).map((m) => m.empresa_id).filter((id: string) => id !== mov.empresa_id);
          if (outras.length) {
            let q = db.from("movimentacoes").select("id, empresa_id").in("empresa_id", outras).eq("mes_referencia", mov.mes_referencia);
            q = mov.periodo ? q.eq("periodo", mov.periodo) : q.is("periodo", null);
            const { data: irmas } = await q;
            if (irmas?.length) {
              const { error: e2 } = await db.from("movimentacoes").update({ data_envio_financeiro: hoje }).in("id", irmas.map((i: any) => i.id)).is("data_envio_financeiro", null);
              if (e2) throw e2;
            }
          }
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: "Fechamento efetuado sem envio de e-mail" }); onClose();
    },
    onError: (e: Error) => toast({ title: "Não foi possível concluir o fechamento", description: e.message, variant: "destructive" }),
  });
  const ocupado = save.isPending || enviarEmail.isPending || concluirSemEmail.isPending || arquivosOcupados;
  if (somenteConsulta) return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Visualizar relatório</DialogTitle><DialogDescription>{contexto}</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><dt className="text-xs font-medium uppercase text-muted-foreground">Empresa</dt><dd className="break-words font-semibold">{nome}</dd></div>
        <div className="space-y-1"><dt className="text-xs font-medium uppercase text-muted-foreground">Contrato</dt><dd>{contrato ?? "Não informado"}</dd></div>
        <div className="space-y-1"><dt className="text-xs font-medium uppercase text-muted-foreground">Competência</dt><dd>{competencia}</dd></div>
        <div className="space-y-1"><dt className="text-xs font-medium uppercase text-muted-foreground">Período</dt><dd>{periodo ?? "—"}</dd></div>
      </dl>
      <HistoricoEnvioRelatorio movimentacaoId={movimentacaoId} dataEnvioEmpresa={dataEnvioEmpresa || registro?.data_envio} />
      <div className="border-t border-border pt-4"><RelatoriosPortal contrato={contrato} nome={nome} onArquivos={setArquivos} onBusy={setArquivosOcupados} somenteConsulta /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending && !enviarEmail.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{statusInicial ? "Enviar relatório" : "Visualizar relatório"}</DialogTitle><DialogDescription>{contexto}</DialogDescription></DialogHeader>
      <p className="break-words font-semibold">Empresa: {nome} | Contrato: #{contrato ?? "Não informado"}</p>
      {grupo.data?.papel === "principal" && grupo.data.contratos.length > 0 && <p className="rounded-md border p-3 text-sm">Contrato principal do grupo "{grupo.data.nomeGrupo}". O e-mail também leva o PDF e o Excel dos contratos: {grupo.data.contratos.map(c => `#${c}`).join(", ")}.</p>}
      {ehMembro && <p className="rounded-md border border-warning p-3 text-sm">Este contrato faz parte do grupo "{grupo.data?.nomeGrupo}". O relatório dele vai no e-mail do contrato principal.</p>}
      <RelatoriosPortal contrato={contrato} nome={nome} onArquivos={setArquivos} onBusy={setArquivosOcupados} />
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="relatorio-status">Status do Relatório</Label>
          <Select disabled={!canEdit || save.isPending} value={form.status} onValueChange={status => setForm(f => ({ ...f, status, confirmacao: ["Conferido pela empresa", "Divergência informada"].includes(status) ? status : "Aguardando" }))}>
            <SelectTrigger id="relatorio-status"><SelectValue /></SelectTrigger><SelectContent>{STATUS_RELATORIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="relatorio-destinatarios">Destinatários</Label><Textarea id="relatorio-destinatarios" value={form.destinatarios} disabled={!canEdit || save.isPending} onChange={e => setForm(f => ({ ...f, destinatarios: e.target.value }))} />
          {escolha.cenario === "financeiro" && <p className="text-xs text-muted-foreground">E-mails do Financeiro preenchidos automaticamente{emailsFin.data?.length ? `: ${emailsFin.data.join(", ")}` : " (nenhum cadastrado ainda)"}. Você pode ajustar antes de enviar.</p>}
        </div>
        <div className="space-y-2"><Label htmlFor="relatorio-copia">Com cópia (Cc)</Label><Textarea id="relatorio-copia" value={form.cc} disabled={!canEdit || save.isPending} placeholder="E-mails que recebem uma cópia visível (opcional)" onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} /></div>
        <div className="space-y-2"><Label htmlFor="relatorio-data">Data de Envio</Label><Input id="relatorio-data" type="date" disabled={!canEdit || save.isPending} value={form.data_envio ?? ""} onChange={e => setForm(f => ({ ...f, data_envio: e.target.value || null }))} /></div>
        <div className="space-y-2"><Label htmlFor="relatorio-confirmacao">Confirmação da Empresa</Label>
          <Select disabled={!canEdit || save.isPending} value={form.confirmacao} onValueChange={confirmacao => setForm(f => ({ ...f, confirmacao, status: confirmacao !== "Aguardando" ? confirmacao : ["Conferido pela empresa", "Divergência informada"].includes(f.status) ? "Enviado" : f.status }))}>
            <SelectTrigger id="relatorio-confirmacao"><SelectValue /></SelectTrigger><SelectContent>{CONFIRMACOES_RELATORIO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="relatorio-observacoes">Observações do relatório</Label><Textarea id="relatorio-observacoes" disabled={!canEdit || save.isPending} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
        <div className="space-y-2 rounded-md border p-3">
          {canEdit && !ehMembro && <CenarioEnvioPainel movimentacaoId={movimentacaoId} sugerido={cenarioSugerido} valor={escolha} onChange={setEscolha} anexos={[...arquivos.map(a => a.nome_arquivo), ...(grupo.data?.contratos ?? []).flatMap(c => [`Contrato #${c} (PDF)`, `Contrato #${c} (Excel)`])]} corte={corte} destinatarios={form.destinatarios} cc={form.cc} disabled={ocupado} modoFechamento={modoFechamento} />}
          {progresso && <p role="status" className="text-sm">{progresso}</p>}
          {canEdit && !ehMembro && <Button type="button" className="w-full" disabled={ocupado || grupo.isLoading || arquivos.length !== 2 || !!escolha.bloqueio} onClick={() => { if (window.confirm(`${escolha.cenario === "financeiro" ? "Este envio será realizado sem confirmação da empresa. Deseja continuar?\n\n" : ""}Enviar os relatórios?\nCenário: ${CENARIOS_ENVIO[escolha.cenario].rotulo} (destino: ${CENARIOS_ENVIO[escolha.cenario].destino})\nEmpresa: ${nome} | Contrato: #${contrato}\nDestinatários: ${form.destinatarios}${form.cc.trim() ? `\nCom cópia (Cc): ${form.cc}` : ""}${grupo.data?.contratos.length ? `\nContratos do grupo junto: ${grupo.data.contratos.map(c => `#${c}`).join(", ")}` : ""}`)) enviarEmail.mutate(); }}>
            <Send className="mr-2 h-4 w-4" />{enviarEmail.isPending ? "Enviando e-mail..." : "Enviar por e-mail"}
          </Button>}
          {canEdit && modoFechamento && <Button type="button" variant="outline" className="w-full" disabled={ocupado} onClick={() => { if (window.confirm(`Concluir o fechamento SEM enviar e-mail ao Financeiro?\n\nUse esta opção quando a empresa já deu o ok.\nEmpresa: ${nome} | Contrato: #${contrato}`)) concluirSemEmail.mutate(); }}>
            {concluirSemEmail.isPending ? "Concluindo..." : "Concluir sem enviar e-mail (empresa deu o ok)"}
          </Button>}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={save.isPending || enviarEmail.isPending}>Fechar</Button>{canEdit && <Button type="submit" variant="outline" disabled={ocupado}>{save.isPending ? "Salvando..." : "Salvar registro manual"}</Button>}</DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}