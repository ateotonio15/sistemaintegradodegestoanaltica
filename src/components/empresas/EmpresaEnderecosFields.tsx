import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnderecoEmpresa, EnderecosEmpresa, novoEndereco, TIPOS_ENDERECO_SECUNDARIO, alterarEndereco, removerEnderecoSecundario } from "@/lib/empresa-enderecos";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const CAMPOS = [["cep", "CEP"], ["logradouro", "Logradouro"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["referencia", "Referência"]] as const;
function Campos({ endereco, prefix, onChange }: { endereco: EnderecoEmpresa; prefix: string; onChange: (e: EnderecoEmpresa) => void }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {CAMPOS.map(([key, label]) => <div key={key} className="space-y-1">
      <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
      <Input id={`${prefix}-${key}`} value={endereco[key]} onChange={e => onChange({ ...endereco, [key]: key === "uf" ? e.target.value.toUpperCase() : e.target.value })} maxLength={key === "uf" ? 2 : undefined} />
    </div>)}
    <div className="space-y-1 sm:col-span-2"><Label htmlFor={`${prefix}-observacao`}>Observação</Label><Textarea id={`${prefix}-observacao`} value={endereco.observacao} onChange={e => onChange({ ...endereco, observacao: e.target.value })} rows={2} /></div>
  </div>;
}
export function ResumoEndereco({ endereco }: { endereco: EnderecoEmpresa }) {
  const linhas = endereco.logradouro
    ? [[endereco.logradouro, endereco.numero ? `nº ${endereco.numero}` : "", endereco.complemento].filter(Boolean).join(", "), endereco.bairro, [endereco.cidade, endereco.uf].filter(Boolean).join(" - "), endereco.cep ? `CEP ${endereco.cep}` : ""]
    : [endereco.endereco_livre, endereco.bairro, [endereco.cidade, endereco.uf].filter(Boolean).join(" - "), endereco.cep ? `CEP ${endereco.cep}` : ""];
  return <div className="text-sm text-muted-foreground break-words space-y-0.5">{linhas.filter(Boolean).map((linha, i) => <p key={i}>{linha}</p>)}{!linhas.some(Boolean) && <p>Endereço não informado.</p>}</div>;
}
type Editor = { alvo: "principal" | "novo" | number; draft: EnderecoEmpresa };
export function EmpresaEnderecosFields({ value, onChange, readOnly = false }: { value: EnderecosEmpresa; onChange: (value: EnderecosEmpresa) => void; readOnly?: boolean }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [excluir, setExcluir] = useState<number | null>(null);
  const [expandido, setExpandido] = useState(true);
  const [erro, setErro] = useState("");
  const abrir = (alvo: Editor["alvo"], draft: EnderecoEmpresa) => { setEditor({ alvo, draft: { ...draft } }); setErro(""); };
  const aplicar = () => {
    if (!editor || readOnly) return;
    if (editor.draft.tipo === "Outro" && !editor.draft.descricao_tipo.trim()) { setErro("Informe a descrição do tipo Outro."); return; }
    try { onChange(alterarEndereco(value, editor.alvo, editor.draft)); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível alterar o endereço."); return; }
    setEditor(null); setExpandido(true); setErro("");
  };
  const formulario = editor && <div className="border-t border-border pt-3 space-y-3" onKeyDown={e => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); aplicar(); } }}>
    <h4 className="text-sm font-semibold">{editor.alvo === "principal" ? "Editar endereço principal" : editor.alvo === "novo" ? "Adicionar endereço secundário" : "Editar endereço secundário"}</h4>
    {editor.alvo === "principal" ? <div className="space-y-1"><Label htmlFor="endereco-principal">Endereço Principal</Label><Input id="endereco-principal" value={editor.draft.endereco_livre} onChange={e => setEditor({ ...editor, draft: { ...editor.draft, endereco_livre: e.target.value } })} /></div>
      : <div className="space-y-1"><Label htmlFor="endereco-tipo">Tipo do endereço</Label><Select value={editor.draft.tipo} onValueChange={tipo => setEditor({ ...editor, draft: { ...editor.draft, tipo } })}><SelectTrigger id="endereco-tipo"><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ENDERECO_SECUNDARIO.map(tipo => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}</SelectContent></Select></div>}
    {editor.draft.tipo === "Outro" && <div className="space-y-1"><Label htmlFor="endereco-descricao">Descrição do tipo</Label><Input id="endereco-descricao" value={editor.draft.descricao_tipo} onChange={e => setEditor({ ...editor, draft: { ...editor.draft, descricao_tipo: e.target.value } })} /></div>}
    <Campos prefix="endereco-editor" endereco={editor.draft} onChange={draft => setEditor({ ...editor, draft })} />
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="flex justify-end gap-2 flex-wrap"><Button type="button" size="sm" variant="outline" onClick={() => { setEditor(null); setErro(""); }}>Cancelar</Button><Button type="button" size="sm" onClick={aplicar}>{editor.alvo === "novo" ? "Adicionar endereço" : "Salvar endereço"}</Button></div>
  </div>;
  return <section aria-label="Endereços da Empresa" className="space-y-4 min-w-0">
    <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Endereços da Empresa</h3>
    <div className="space-y-3 border-b border-border pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><h4 className="text-xs font-semibold uppercase">Endereço Principal</h4><Badge variant="secondary" className="bg-primary/10 text-primary">Principal</Badge></div>
      <ResumoEndereco endereco={value.principal} />
      {!readOnly && (editor?.alvo === "principal" ? formulario : <Button type="button" variant="ghost" size="sm" aria-label="Editar endereço principal" onClick={() => abrir("principal", value.principal)}><Pencil className="h-3.5 w-3.5 mr-2" />Editar</Button>)}
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-medium">Endereços Secundários{value.secundarios.length > 0 && <span className="text-muted-foreground ml-2">({value.secundarios.length})</span>}</h4>
        {value.secundarios.length > 0 && <Button type="button" size="sm" variant="ghost" aria-expanded={expandido} onClick={() => setExpandido(!expandido)}>{expandido ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}{expandido ? "Recolher" : "Expandir"}</Button>}
      </div>
      {!value.secundarios.length && <p className="text-sm text-muted-foreground">Nenhum endereço secundário cadastrado.</p>}
      {expandido && <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {value.secundarios.map((endereco, index) => <article key={index} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <h5 className="text-xs font-semibold uppercase break-words">{endereco.tipo === "Outro" ? endereco.descricao_tipo : endereco.tipo}{endereco.bairro ? ` — ${endereco.bairro}` : ""}</h5>
          <ResumoEndereco endereco={endereco} />
          {!readOnly && <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" aria-label={`Editar endereço secundário ${index + 1}`} onClick={() => abrir(index, endereco)}><Pencil className="h-3.5 w-3.5 mr-2" />Editar</Button><Button type="button" variant="ghost" size="sm" aria-label={`Excluir endereço secundário ${index + 1}`} onClick={() => setExcluir(index)}><Trash2 className="h-3.5 w-3.5 mr-2 text-destructive" />Excluir</Button></div>}
        </article>)}
      </div>}
      {!readOnly && (editor && editor.alvo !== "principal" ? formulario : <Button type="button" size="sm" variant="outline" onClick={() => abrir("novo", novoEndereco("Filial"))}><Plus className="h-4 w-4 mr-2" />Adicionar endereço secundário</Button>)}
    </div>
    <AlertDialog open={excluir !== null && !readOnly} onOpenChange={open => { if (!open) setExcluir(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este endereço secundário?</AlertDialogTitle><AlertDialogDescription>O endereço principal será preservado. A remoção será aplicada ao salvar a empresa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (excluir === null || readOnly) return; onChange(removerEnderecoSecundario(value, excluir)); setEditor(null); setExcluir(null); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}

export function EmpresaEnderecosConsulta({ value }: { value: EnderecosEmpresa }) {
  const [aberto, setAberto] = useState(false);
  return <div className="min-w-0"><dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Endereço</dt><dd className="mt-1"><ResumoEndereco endereco={value.principal} />{value.secundarios.length > 0 && <><Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0 text-primary" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>+ {value.secundarios.length} {value.secundarios.length === 1 ? "endereço adicional" : "endereços adicionais"}<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button><DialogConsulta open={aberto} onOpenChange={setAberto} value={value} /></>}</dd></div>;
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
function DialogConsulta({ open, onOpenChange, value }: { open: boolean; onOpenChange: (open: boolean) => void; value: EnderecosEmpresa }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Endereços da Empresa</DialogTitle><DialogDescription>Endereço principal e endereços secundários cadastrados.</DialogDescription></DialogHeader><EmpresaEnderecosFields value={value} onChange={() => {}} readOnly /></DialogContent></Dialog>;
}
