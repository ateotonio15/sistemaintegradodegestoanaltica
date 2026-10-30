import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpsertPassageiro } from "@/hooks/useUberPassageiros";
import { useUberFuncoes, useGarantirFuncao } from "@/hooks/useUberFuncoes";
import {
  UBER_MOTIVOS,
  UBER_TIPOS_PADRAO,
  validarPassageiro,
  normalizarPassageiroParaSalvar,
  type UberPassageiro,
  type PassageiroForm,
} from "@/lib/uber-passageiros";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  passageiro?: UberPassageiro | null;
}

const VAZIO: PassageiroForm = {
  nome: "",
  setor: "",
  endereco: "",
  whatsapp: "",
  funcao_id: null,
  ativo: true,
  tem_corrida_padrao: false,
  usar_endereco_origem: true,
  origem_padrao: null,
  tipo_padrao: null,
  motivo_padrao: null,
};

export function PassageiroDialog({ open, onOpenChange, passageiro }: Props) {
  const upsert = useUpsertPassageiro();
  const { data: funcoes = [] } = useUberFuncoes();
  const garantir = useGarantirFuncao();
  const [form, setForm] = useState<PassageiroForm>(VAZIO);
  const [novaFuncao, setNovaFuncao] = useState(false);
  const [textoFuncao, setTextoFuncao] = useState("");

  useEffect(() => {
    if (open) { setForm(passageiro ?? VAZIO); setNovaFuncao(false); setTextoFuncao(""); }
  }, [open, passageiro]);

  const confirmarFuncao = async () => {
    if (!novaFuncao || garantir.isPending) return;
    const nome = textoFuncao.trim();
    if (!nome) { setForm((p) => ({ ...p, funcao_id: null })); setNovaFuncao(false); return; }
    try {
      const id = await garantir.mutateAsync({ nome, existentes: funcoes });
      setForm((p) => ({ ...p, funcao_id: id }));
    } catch { /* toast já exibido */ }
    setNovaFuncao(false);
    setTextoFuncao("");
  };

  const set = (k: keyof PassageiroForm, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const erro = validarPassageiro(form);
    if (erro) {
      toast.error(erro);
      return;
    }
    const payload = normalizarPassageiroParaSalvar(form);
    await upsert.mutateAsync(passageiro?.id ? { ...payload, id: passageiro.id } : payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{passageiro ? "Editar passageiro" : "Novo passageiro"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div>
            <Label>Setor *</Label>
            <Input value={form.setor ?? ""} onChange={(e) => set("setor", e.target.value)} />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(92) 99999-9999" />
          </div>
          <div>
            <Label>Função</Label>
            {novaFuncao ? (
              <Input
                autoFocus
                value={textoFuncao}
                placeholder="Digite a nova função"
                onChange={(e) => setTextoFuncao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmarFuncao(); }
                  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setNovaFuncao(false); setTextoFuncao(""); }
                }}
                onBlur={confirmarFuncao}
                disabled={garantir.isPending}
              />
            ) : (
              <Select
                value={form.funcao_id ?? ""}
                onValueChange={(v) => {
                  if (v === "__nova") { setNovaFuncao(true); setTextoFuncao(""); return; }
                  set("funcao_id", v || null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcoes.filter((f) => f.ativo || f.id === form.funcao_id).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}{f.ativo ? "" : " (inativa)"}</SelectItem>
                  ))}
                  <SelectItem value="__nova">+ Nova função…</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço *</Label>
            <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo !== false} onCheckedChange={(v) => set("ativo", v)} />
            <Label>Ativo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!form.tem_corrida_padrao} onCheckedChange={(v) => set("tem_corrida_padrao", v)} />
            <Label>Este passageiro tem corrida padrão</Label>
          </div>

          {form.tem_corrida_padrao && (
            <div className="sm:col-span-2 rounded-lg border border-border p-3 space-y-3">
              <div className="text-sm font-medium text-foreground">Padrões de corrida</div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="usar-endereco-origem"
                  checked={form.usar_endereco_origem !== false}
                  onCheckedChange={(v) => set("usar_endereco_origem", v === true)}
                />
                <Label htmlFor="usar-endereco-origem" className="font-normal">
                  Usar o endereço cadastrado como origem
                </Label>
              </div>
              {form.usar_endereco_origem === false && (
                <div>
                  <Label>Origem padrão *</Label>
                  <Input value={form.origem_padrao ?? ""} onChange={(e) => set("origem_padrao", e.target.value)} />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo padrão *</Label>
                  <Select value={form.tipo_padrao ?? ""} onValueChange={(v) => set("tipo_padrao", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {UBER_TIPOS_PADRAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo padrão *</Label>
                  <Select value={form.motivo_padrao ?? ""} onValueChange={(v) => set("motivo_padrao", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {UBER_MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
