import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnderecoEmpresa, EnderecosEmpresa, novoEndereco, TIPOS_ENDERECO_SECUNDARIO } from "@/lib/empresa-enderecos";

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
export function EmpresaEnderecosFields({ value, onChange }: { value: EnderecosEmpresa; onChange: (value: EnderecosEmpresa) => void }) {
  const [detalhes, setDetalhes] = useState(false);
  const update = (index: number, endereco: EnderecoEmpresa) => onChange({ ...value, secundarios: value.secundarios.map((e, i) => i === index ? endereco : e) });
  return <section className="space-y-4 min-w-0">
    <div className="space-y-2">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><Label htmlFor="endereco-principal">Endereço Principal</Label><span className="text-xs text-muted-foreground ml-auto">Principal</span></div>
      <Input id="endereco-principal" value={value.principal.endereco_livre} onChange={e => onChange({ ...value, principal: { ...value.principal, endereco_livre: e.target.value } })} placeholder="Endereço da empresa" />
      <Button type="button" variant="ghost" size="sm" onClick={() => setDetalhes(!detalhes)} aria-expanded={detalhes}>{detalhes ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}Detalhes do endereço principal</Button>
      {detalhes && <Campos prefix="principal" endereco={value.principal} onChange={principal => onChange({ ...value, principal })} />}
    </div>
    <div className="border-t border-border pt-3 space-y-4">
      <h3 className="text-sm font-medium">Endereços Secundários</h3>
      {value.secundarios.map((endereco, index) => <div key={index} className="space-y-3 border-b border-border pb-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1"><Label htmlFor={`secundario-${index}-tipo`}>Tipo</Label><Select value={endereco.tipo} onValueChange={tipo => update(index, { ...endereco, tipo })}><SelectTrigger id={`secundario-${index}-tipo`}><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ENDERECO_SECUNDARIO.map(tipo => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}</SelectContent></Select></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remover endereço secundário ${index + 1}`} title="Remover endereço secundário" onClick={() => { if (window.confirm("Remover este endereço secundário? A remoção será aplicada ao salvar.")) onChange({ ...value, secundarios: value.secundarios.filter((_, i) => i !== index) }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
        {endereco.tipo === "Outro" && <div className="space-y-1"><Label htmlFor={`secundario-${index}-descricao`}>Descrição do tipo</Label><Input id={`secundario-${index}-descricao`} required value={endereco.descricao_tipo} onChange={e => update(index, { ...endereco, descricao_tipo: e.target.value })} /></div>}
        <Campos prefix={`secundario-${index}`} endereco={endereco} onChange={e => update(index, e)} />
      </div>)}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, secundarios: [...value.secundarios, novoEndereco("Filial")] })}><Plus className="h-4 w-4 mr-2" />Adicionar endereço secundário</Button>
    </div>
  </section>;
}