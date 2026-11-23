import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bold, Copy, Eye, History, Italic, Link2, List, Mail, MoreHorizontal, Pencil, Plus, Power, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ANEXOS_MODELO, CENARIOS_MODELO, DADOS_DEMONSTRACAO, DESTINOS_MODELO, VARIAVEIS_MODELO, corpoParaHtml, rotuloCenario, substituirVariaveis, variaveisNaoReconhecidas } from "@/lib/email-modelos";

interface Modelo {
  id: string; nome: string; descricao: string | null; cenario: string; destino: string; assunto: string; corpo: string;
  anexos_esperados: string[]; cc_padrao: string | null; assinatura_tipo: string; assinatura_texto: string | null; status: string;
  versao: number; utilizado: boolean; criado_em: string; criado_por_nome: string | null; atualizado_em: string; atualizado_por_nome: string | null;
}
type Form = Pick<Modelo, "nome" | "descricao" | "cenario" | "destino" | "assunto" | "corpo" | "anexos_esperados" | "cc_padrao" | "assinatura_tipo" | "assinatura_texto" | "status">;
const VAZIO: Form = { nome: "", descricao: "", cenario: "dentro_periodo", destino: "Empresa", assunto: "", corpo: "", anexos_esperados: [], cc_padrao: "", assinatura_tipo: "padrao", assinatura_texto: "", status: "ativo" };
const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dataCurta = (s: string) => new Date(s).toLocaleDateString("pt-BR");

function StatusBadge({ status }: { status: string }) {
  return status === "ativo" ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>;
}

function Previa({ form }: { form: Form }) {
  const assunto = substituirVariaveis(form.assunto, DADOS_DEMONSTRACAO);
  const corpo = substituirVariaveis(form.corpo, DADOS_DEMONSTRACAO);
  return <div className="space-y-3 text-sm">
    <p><span className="text-muted-foreground">Para: </span>{form.destino === "Financeiro" ? "Financeiro" : form.destino === "Empresa + Financeiro" ? "Empresa Exemplo; Financeiro" : form.destino === "Outro" ? "Destinatário informado no envio" : "Empresa Exemplo"}</p>
    {form.cc_padrao?.trim() && <p><span className="text-muted-foreground">Cc: </span>{form.cc_padrao}</p>}
    <p><span className="text-muted-foreground">Assunto: </span><span className="font-medium">{assunto || "—"}</span></p>
    <div className="rounded-md border bg-card p-4 [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: corpoParaHtml(corpo) }} />
    <p className="text-xs text-muted-foreground">{form.assinatura_tipo === "padrao" ? "Assinatura: padrão do SIGA (imagem do remetente) é adicionada no envio." : `Assinatura: ${form.assinatura_texto || "—"}`}</p>
    {form.anexos_esperados.length > 0 && <p className="text-xs text-muted-foreground">Anexos esperados: {form.anexos_esperados.join(", ")}</p>}
    <p className="text-xs text-muted-foreground">Prévia com dados de demonstração.</p>
  </div>;
}

function Editor({ inicial, titulo, onClose, onSave, salvando }: { inicial: Form; titulo: string; onClose: () => void; onSave: (f: Form) => void; salvando: boolean }) {
  const [form, setForm] = useState<Form>(inicial);
  const [previa, setPrevia] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const assuntoRef = useRef<HTMLInputElement>(null);
  const [foco, setFoco] = useState<"assunto" | "corpo">("corpo");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const desconhecidas = variaveisNaoReconhecidas(form.assunto, form.corpo, form.assinatura_texto ?? "");
  const inserir = (antes: string, depois = "") => {
    const el = foco === "assunto" ? assuntoRef.current : corpoRef.current;
    const campo = foco;
    const atual = form[campo];
    const ini = el?.selectionStart ?? atual.length, fim = el?.selectionEnd ?? atual.length;
    const novo = atual.slice(0, ini) + antes + atual.slice(ini, fim) + depois + atual.slice(fim);
    set(campo, novo);
    requestAnimationFrame(() => { el?.focus(); const p = ini + antes.length + (fim - ini); el?.setSelectionRange(p, p); });
  };
  const obrigatorioFalta = !form.nome.trim() || !form.assunto.trim() || !form.corpo.trim();
  return <Dialog open onOpenChange={o => { if (!o && !salvando) onClose(); }}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
      <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>Os campos com * são obrigatórios. Clique em uma variável para inseri-la onde está o cursor.</DialogDescription></DialogHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="m-nome">Nome do modelo *</Label><Input id="m-nome" value={form.nome} onChange={e => set("nome", e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="m-desc">Descrição</Label><Input id="m-desc" value={form.descricao ?? ""} onChange={e => set("descricao", e.target.value)} /></div>
            <div className="space-y-1"><Label>Cenário *</Label><Select value={form.cenario} onValueChange={v => set("cenario", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CENARIOS_MODELO.map(c => <SelectItem key={c.valor} value={c.valor}>{c.rotulo}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Destino padrão *</Label><Select value={form.destino} onValueChange={v => set("destino", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DESTINOS_MODELO.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label htmlFor="m-assunto">Assunto *</Label><Input id="m-assunto" ref={assuntoRef} value={form.assunto} onFocus={() => setFoco("assunto")} placeholder="Validação de vidas | {{empresa}} | {{competencia}}" onChange={e => set("assunto", e.target.value)} /></div>
          <div className="space-y-1">
            <div className="flex items-center justify-between"><Label htmlFor="m-corpo">Corpo do e-mail *</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Negrito" onClick={() => { setFoco("corpo"); inserir("**", "**"); }}><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Itálico" onClick={() => { setFoco("corpo"); inserir("*", "*"); }}><Italic className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Lista" onClick={() => { setFoco("corpo"); inserir("\n- "); }}><List className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Link" onClick={() => { setFoco("corpo"); inserir("[texto do link](https://", ")"); }}><Link2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <Textarea id="m-corpo" ref={corpoRef} rows={12} className="font-mono text-sm" value={form.corpo} onFocus={() => setFoco("corpo")} onChange={e => set("corpo", e.target.value)} />
            <p className="text-xs text-muted-foreground">**negrito**, *itálico*, "- " para listas e [texto](https://link).</p>
          </div>
          {desconhecidas.length > 0 && <div className="flex gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" /><div>{desconhecidas.map(v => <p key={v}>Variável não reconhecida: {v}</p>)}</div></div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Anexos esperados</Label>{ANEXOS_MODELO.map(a => <label key={a} className="flex items-center gap-2 text-sm"><Checkbox checked={form.anexos_esperados.includes(a)} onCheckedChange={c => set("anexos_esperados", c ? [...form.anexos_esperados, a] : form.anexos_esperados.filter(x => x !== a))} />{a}</label>)}<p className="text-xs text-muted-foreground">Somente informativo nesta etapa.</p></div>
            <div className="space-y-1"><Label htmlFor="m-cc">CC padrão</Label><Textarea id="m-cc" rows={3} value={form.cc_padrao ?? ""} placeholder="E-mails separados por vírgula (opcional)" onChange={e => set("cc_padrao", e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Assinatura do e-mail</Label>
            <RadioGroup value={form.assinatura_tipo} onValueChange={v => set("assinatura_tipo", v)} className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="padrao" />Usar assinatura padrão do SIGA</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="personalizada" />Assinatura personalizada do modelo</label>
            </RadioGroup>
            {form.assinatura_tipo === "personalizada" && <Textarea rows={3} value={form.assinatura_texto ?? ""} onChange={e => set("assinatura_texto", e.target.value)} />}
          </div>
          <div className="space-y-1"><Label>Status</Label><Select value={form.status} onValueChange={v => set("status", v)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent></Select></div>
        </div>
        <aside className="space-y-2 rounded-md border bg-muted/30 p-3 lg:sticky lg:top-0 lg:max-h-[70vh] lg:overflow-y-auto">
          <h3 className="text-sm font-semibold">Variáveis disponíveis</h3>
          {VARIAVEIS_MODELO.map(v => <button key={v.chave} type="button" onClick={() => inserir(`{{${v.chave}}}`)} className="block w-full rounded px-2 py-1 text-left hover:bg-primary/10">
            <code className="text-xs text-primary">{`{{${v.chave}}}`}</code><span className="block text-xs text-muted-foreground">{v.descricao}</span>
          </button>)}
        </aside>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={() => setPrevia(true)}><Eye className="mr-2 h-4 w-4" />Visualizar modelo</Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button type="button" disabled={salvando || obrigatorioFalta} onClick={() => onSave(form)}>{salvando ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
      <Dialog open={previa} onOpenChange={setPrevia}><DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Visualizar modelo</DialogTitle><DialogDescription>{form.nome || "Sem nome"}</DialogDescription></DialogHeader><Previa form={form} /></DialogContent></Dialog>
    </DialogContent>
  </Dialog>;
}

function HistoricoDialog({ modelo, onClose }: { modelo: Modelo; onClose: () => void }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const q = useQuery({ queryKey: ["email-modelo-versoes", modelo.id], queryFn: async () => {
    const { data, error } = await supabase.from("email_modelo_versoes").select("*").eq("modelo_id", modelo.id).order("versao", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Histórico — {modelo.nome}</DialogTitle><DialogDescription>Criado em {dataHora(modelo.criado_em)}{modelo.criado_por_nome ? ` por ${modelo.criado_por_nome}` : ""}</DialogDescription></DialogHeader>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : <ol className="space-y-2 border-l border-border pl-4">
      {q.data?.map(v => <li key={v.id} className="text-sm">
        <button type="button" className="text-left" onClick={() => setAberta(aberta === v.versao ? null : v.versao)}>
          <span className="font-semibold">Versão {v.versao}</span> · {dataCurta(v.alterado_em)} · {v.versao === 1 ? "Criado" : "Alterado"} por {v.alterado_por_nome || "Sistema"}
        </button>
        {aberta === v.versao && <div className="mt-2 rounded-md border p-3"><Previa form={{ ...VAZIO, ...(v.dados as any) }} /></div>}
      </li>)}
    </ol>}
  </DialogContent></Dialog>;
}

export default function ModelosEmail() {
  const { isAdmin, isComum, isAdministradoras } = useAuth();
  const pode = isAdmin || isComum || isAdministradoras;
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ id?: string; form: Form; titulo: string } | null>(null);
  const [historico, setHistorico] = useState<Modelo | null>(null);
  const [verStatus, setVerStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const lista = useQuery({ queryKey: ["email-modelos"], queryFn: async () => {
    const { data, error } = await supabase.from("email_modelos").select("*").order("cenario").order("nome");
    if (error) throw error; return (data ?? []) as Modelo[];
  } });
  const filtrada = useMemo(() => (lista.data ?? []).filter(m => verStatus === "todos" || m.status === verStatus), [lista.data, verStatus]);
  const salvar = useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: Form }) => {
      const dados = { ...form, nome: form.nome.trim(), assunto: form.assunto.trim(), descricao: form.descricao?.trim() || null, cc_padrao: form.cc_padrao?.trim() || null, assinatura_texto: form.assinatura_tipo === "personalizada" ? form.assinatura_texto?.trim() || null : null };
      const { error } = id ? await supabase.from("email_modelos").update(dados).eq("id", id) : await supabase.from("email_modelos").insert(dados);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-modelos"] }); qc.invalidateQueries({ queryKey: ["email-modelo-versoes"] }); setEditor(null); toast.success("Modelo salvo"); },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });
  const alternar = useMutation({
    mutationFn: async (m: Modelo) => { const { error } = await supabase.from("email_modelos").update({ status: m.status === "ativo" ? "inativo" : "ativo" }).eq("id", m.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-modelos"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const excluir = useMutation({
    mutationFn: async (m: Modelo) => { const { error, count } = await supabase.from("email_modelos").delete({ count: "exact" }).eq("id", m.id); if (error) throw error; if (!count) throw new Error("Modelo já utilizado: inative em vez de excluir."); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-modelos"] }); toast.success("Modelo excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const paraForm = (m: Modelo): Form => ({ nome: m.nome, descricao: m.descricao, cenario: m.cenario, destino: m.destino, assunto: m.assunto, corpo: m.corpo, anexos_esperados: m.anexos_esperados ?? [], cc_padrao: m.cc_padrao, assinatura_tipo: m.assinatura_tipo, assinatura_texto: m.assinatura_texto, status: m.status });

  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/configuracoes" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Mail className="h-6 w-6 text-primary" />Modelos de E-mail</h1>
          <p className="text-sm text-muted-foreground">Textos usados nos e-mails das Movimentações, com versões e histórico.</p></div>
      </div>
      {pode && <Button onClick={() => setEditor({ form: VAZIO, titulo: "Novo modelo" })}><Plus className="mr-2 h-4 w-4" />Novo modelo</Button>}
    </div>
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div><CardTitle className="text-base">Modelos cadastrados</CardTitle><CardDescription>Modelos inativos ficam no histórico e não aparecem para novos envios.</CardDescription></div>
        <Select value={verStatus} onValueChange={v => setVerStatus(v as typeof verStatus)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem></SelectContent></Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Nome do modelo</TableHead><TableHead>Cenário</TableHead><TableHead>Destino</TableHead><TableHead>Assunto</TableHead><TableHead>Status</TableHead><TableHead>Última alteração</TableHead><TableHead>Alterado por</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {lista.isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!lista.isLoading && !filtrada.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum modelo.</TableCell></TableRow>}
            {filtrada.map(m => <TableRow key={m.id}>
              <TableCell><p className="font-medium">{m.nome}</p><p className="text-xs text-muted-foreground">Versão {m.versao}</p></TableCell>
              <TableCell>{rotuloCenario(m.cenario)}</TableCell>
              <TableCell>{m.destino}</TableCell>
              <TableCell className="max-w-[260px] truncate" title={m.assunto}>{m.assunto}</TableCell>
              <TableCell><StatusBadge status={m.status} /></TableCell>
              <TableCell className="whitespace-nowrap">{dataHora(m.atualizado_em)}</TableCell>
              <TableCell>{m.atualizado_por_nome || "—"}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {pode && <DropdownMenuItem onClick={() => setEditor({ id: m.id, form: paraForm(m), titulo: `Editar — ${m.nome}` })}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                    {pode && <DropdownMenuItem onClick={() => setEditor({ form: { ...paraForm(m), nome: `${m.nome} (cópia)` }, titulo: "Duplicar modelo" })}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => setHistorico(m)}><History className="mr-2 h-4 w-4" />Ver histórico</DropdownMenuItem>
                    {pode && <DropdownMenuItem onClick={() => alternar.mutate(m)}><Power className="mr-2 h-4 w-4" />{m.status === "ativo" ? "Inativar modelo" : "Ativar modelo"}</DropdownMenuItem>}
                    {pode && !m.utilizado && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Excluir o modelo "${m.nome}"? Ele nunca foi usado em envios.`)) excluir.mutate(m); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    {editor && <Editor key={editor.id ?? editor.titulo} inicial={editor.form} titulo={editor.titulo} salvando={salvar.isPending} onClose={() => setEditor(null)} onSave={form => {
      const avisos = variaveisNaoReconhecidas(form.assunto, form.corpo, form.assinatura_texto ?? "");
      if (avisos.length && !window.confirm(`Variável não reconhecida: ${avisos.join(", ")}\nSalvar mesmo assim?`)) return;
      salvar.mutate({ id: editor.id, form });
    }} />}
    {historico && <HistoricoDialog modelo={historico} onClose={() => setHistorico(null)} />}
  </div>;
}
