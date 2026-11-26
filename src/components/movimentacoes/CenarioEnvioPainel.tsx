import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { VARIAVEIS_MODELO } from "@/lib/email-modelos";
import { CENARIOS_ENVIO, LISTA_CENARIOS, type CenarioEnvio } from "../../../supabase/functions/_shared/cenario-envio";
import { montarVariaveis, renderizarModelo, corpoParaHtml, temVariavel } from "../../../supabase/functions/_shared/email-modelo-render";

export interface EscolhaCenario { cenario: CenarioEnvio; justificativa: string; motivoAlteracao: string; assuntoEditado?: string; corpoEditado?: string; modeloId?: string; bloqueio?: string | null }

const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const descricao = (k: string) => VARIAVEIS_MODELO.find(v => v.chave === k)?.descricao ?? k;

export function CenarioEnvioPainel({ movimentacaoId, sugerido, valor, onChange, anexos, corte, destinatarios, cc, disabled, modoFechamento = false }: {
  modoFechamento?: boolean; movimentacaoId: string; sugerido: CenarioEnvio; valor: EscolhaCenario; onChange: (v: EscolhaCenario) => void; anexos: string[]; codigo?: string; nome?: string; corte: string | null; destinatarios: string; cc: string; disabled?: boolean;
}) {
  const { user } = useAuth() as any;
  const [ver, setVer] = useState(false);
  const [editar, setEditar] = useState(false);
  const info = CENARIOS_ENVIO[valor.cenario];
  const alterado = valor.cenario !== sugerido;
  const modelos = useQuery({ queryKey: ["email-modelos-ativos"], queryFn: async () => {
    const { data, error } = await supabase.from("email_modelos").select("id, nome, versao, cenario, assunto, corpo, destino, anexos_esperados, atualizado_em").eq("status", "ativo").order("atualizado_em", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const emailsFin = useQuery({ queryKey: ["config-emails-financeiro"], enabled: valor.cenario === "financeiro", queryFn: async () => {
    const { data } = await supabase.from("config_emails_financeiro").select("para, cc").eq("id", 1).maybeSingle();
    return [...new Set([...(data?.para ?? []), ...(data?.cc ?? [])])];
  } });
  const fonte = useQuery({ queryKey: ["email-fonte-mov", movimentacaoId], queryFn: async () => {
    const { data, error } = await supabase.from("movimentacoes").select("mes_referencia, periodo, responsavel_movimentacao, empresas(nome, codigo_contrato, razao_social, vidas, responsavel_contrato, contrato_suspenso)").eq("id", movimentacaoId).maybeSingle();
    if (error) throw error; return data as any;
  } });
  const perfil = useQuery({ queryKey: ["perfil-nome", user?.id], enabled: !!user?.id, queryFn: async () => (await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()).data?.display_name ?? "" });
  const modelo = (valor.modeloId ? modelos.data?.find(m => m.id === valor.modeloId) : null) ?? modelos.data?.find(m => m.cenario === valor.cenario) ?? null;
  const emp = fonte.data?.empresas ?? {};
  const r = useMemo(() => {
    if (!modelo || !fonte.data) return null;
    const dados = montarVariaveis({ empresa: emp.nome, razaoSocial: emp.razao_social, contrato: emp.codigo_contrato, mesReferencia: fonte.data.mes_referencia, periodo: fonte.data.periodo, corte,
      responsavelContrato: emp.responsavel_contrato, responsavelMovimentacao: fonte.data.responsavel_movimentacao, vidas: emp.vidas, hojeISO: hojeISO(), usuario: perfil.data, justificativa: valor.cenario === "financeiro" ? valor.justificativa : "" });
    return renderizarModelo(modelo, dados);
  }, [modelo, fonte.data, perfil.data, valor.cenario, valor.justificativa, corte]);
  const assunto = valor.assuntoEditado ?? r?.assunto ?? "";
  const corpo = valor.corpoEditado ?? r?.corpo ?? "";
  const editado = valor.assuntoEditado !== undefined || valor.corpoEditado !== undefined;
  const faltando = editado ? [] : (r?.faltando ?? []).filter(k => !(k === "justificativa_envio" && valor.cenario === "financeiro"));
  const esperados = (modelo?.anexos_esperados ?? []) as string[];
  const temPdf = anexos.some(a => /\.pdf$/i.test(a));
  const anexoFaltando = esperados.filter(a => a === "Relatório de Vidas" && !temPdf);
  const bloqueio = fonte.isLoading || modelos.isLoading ? "Carregando o modelo de e-mail..."
    : emp.contrato_suspenso && valor.cenario !== "financeiro" ? "Contrato suspenso — envio para empresa não aplicável."
    : !modelo ? "Nenhum modelo de e-mail ativo foi encontrado para este cenário."
    : faltando.length ? `Existem informações obrigatórias não preenchidas: ${faltando.map(descricao).join(", ")}.`
    : anexoFaltando.length ? `Anexo obrigatório não encontrado: ${anexoFaltando.join(", ")}.`
    : !destinatarios.trim() ? "Destinatário não encontrado."
    : temVariavel(assunto) || temVariavel(corpo) ? "O e-mail ainda contém códigos de variável." : null;
  useEffect(() => { if (bloqueio !== (valor.bloqueio ?? null)) onChange({ ...valor, bloqueio }); }, [bloqueio]); // eslint-disable-line react-hooks/exhaustive-deps
  const trocarCenario = (c: CenarioEnvio) => onChange({ ...valor, cenario: c, modeloId: undefined, assuntoEditado: undefined, corpoEditado: undefined });

  return <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Cenário de envio</h3>
      <Badge variant="outline">Cenário sugerido: {CENARIOS_ENVIO[sugerido].rotulo}</Badge>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Cenário</dt><dd className="font-medium">{info.rotulo}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Modelo</dt><dd>{modelo ? `${modelo.nome} (v${modelo.versao})` : "—"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Destino</dt><dd>{modelo?.destino ?? info.destino}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Anexos</dt><dd>{anexos.length} arquivo{anexos.length === 1 ? "" : "s"}</dd></div>
    </dl>
    {bloqueio && !bloqueio.startsWith("Carregando") && <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="space-y-1"><p>{bloqueio}</p>
        {!modelo && <Button asChild size="sm" variant="outline"><Link to="/configuracoes/modelos-email">Ir para Modelos de E-mail</Link></Button>}</div></div>}
    {!modoFechamento && <div className="space-y-1"><Label htmlFor="cenario-envio">Alterar cenário</Label>
      <Select disabled={disabled} value={valor.cenario} onValueChange={c => trocarCenario(c as CenarioEnvio)}>
        <SelectTrigger id="cenario-envio"><SelectValue /></SelectTrigger>
        <SelectContent>{LISTA_CENARIOS.map(c => <SelectItem key={c} value={c}>{CENARIOS_ENVIO[c].rotulo}{c === sugerido ? " (sugerido)" : ""}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
    {(modelos.data?.length ?? 0) > 0 && <div className="space-y-1"><Label htmlFor="modelo-envio">Modelo de e-mail</Label>
      <Select disabled={disabled} value={modelo?.id ?? ""} onValueChange={id => onChange({ ...valor, modeloId: id, assuntoEditado: undefined, corpoEditado: undefined })}>
        <SelectTrigger id="modelo-envio"><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
        <SelectContent>{modelos.data!.map(m => <SelectItem key={m.id} value={m.id}>{m.nome} (v{m.versao}) — {CENARIOS_ENVIO[m.cenario as CenarioEnvio]?.rotulo ?? m.cenario}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
    {valor.cenario === "financeiro" && <div className="space-y-1"><Label htmlFor="cenario-justificativa">Justificativa do envio direto ao Financeiro *</Label>
      <Textarea id="cenario-justificativa" disabled={disabled} value={valor.justificativa} placeholder="Ex.: Empresa não retornou a validação dentro do prazo." onChange={e => onChange({ ...valor, justificativa: e.target.value })} />
      <p className="text-xs text-muted-foreground">Este envio será realizado sem confirmação da empresa. Será enviado para os e-mails acima e também para o Financeiro: {emailsFin.data?.length ? <strong>{emailsFin.data.join(", ")}</strong> : <span>nenhum e-mail do Financeiro cadastrado ainda (use uma vez "Enviar fechamento ao Financeiro" nas Administradoras)</span>}.</p></div>}
    {alterado && !modoFechamento && valor.cenario !== "financeiro" && <div className="space-y-1"><Label htmlFor="cenario-motivo">Motivo da alteração *</Label>
      <Textarea id="cenario-motivo" disabled={disabled} value={valor.motivoAlteracao} onChange={e => onChange({ ...valor, motivoAlteracao: e.target.value })} /></div>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!r} onClick={() => setVer(true)}><Eye className="mr-2 h-4 w-4" />Visualizar e-mail</Button>
      <Button type="button" variant="outline" size="sm" disabled={!r || disabled} onClick={() => setEditar(true)}><Pencil className="mr-2 h-4 w-4" />Editar envio</Button>
      {editado && <Badge variant="secondary">Texto ajustado só para este envio</Badge>}
    </div>
    <Dialog open={ver} onOpenChange={setVer}><DialogContent className="sm:max-w-[720px]">
      <DialogHeader><DialogTitle>Prévia do E-mail</DialogTitle><DialogDescription>{info.rotulo} — {modelo?.nome}</DialogDescription></DialogHeader>
      <div className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">Empresa: </span>{emp.nome} · Contrato {emp.codigo_contrato} · {fonte.data?.mes_referencia} · Período {fonte.data?.periodo ?? "—"}</p>
        <p><span className="text-muted-foreground">Para: </span>{destinatarios || <span className="text-destructive">Destinatário não encontrado</span>}</p>
        {cc.trim() && <p><span className="text-muted-foreground">CC: </span>{cc}</p>}
        <p><span className="text-muted-foreground">Assunto: </span><span className="font-medium">{assunto}</span></p>
      </div>
      <div className="max-h-[45vh] overflow-y-auto rounded-md border p-3 text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: corpoParaHtml(corpo) }} />
      <p className="text-sm"><span className="text-muted-foreground">Anexos ({anexos.length}): </span>{anexos.join(", ") || "nenhum"}</p>
      <DialogFooter><Button variant="outline" onClick={() => setVer(false)}>Fechar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={editar} onOpenChange={setEditar}><DialogContent className="sm:max-w-[720px]">
      <DialogHeader><DialogTitle>Editar envio</DialogTitle><DialogDescription>As alterações valem só para este e-mail. O modelo salvo não muda. Destinatários e cópia são ajustados nos campos da janela.</DialogDescription></DialogHeader>
      <div className="space-y-1"><Label htmlFor="ed-assunto">Assunto</Label><Input id="ed-assunto" value={assunto} onChange={e => onChange({ ...valor, assuntoEditado: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="ed-corpo">Corpo</Label><Textarea id="ed-corpo" rows={12} value={corpo} onChange={e => onChange({ ...valor, corpoEditado: e.target.value })} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { onChange({ ...valor, assuntoEditado: undefined, corpoEditado: undefined }); }}>Voltar ao texto do modelo</Button>
        <Button onClick={() => setEditar(false)}>Concluir</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
