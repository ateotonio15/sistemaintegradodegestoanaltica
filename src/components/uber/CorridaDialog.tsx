import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpsertCorrida, type UberCorrida } from "@/hooks/useUberCorridas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  corrida?: UberCorrida | null;
}

const TIPOS = ["Ida", "Volta", "Ida e Volta"];
const MOTIVOS = [
  "Plantão de Atendimento",
  "Envio de Material",
  "Técnica Honda",
  "Coleta de Preventivo",
  "Coleta de PSA",
  "Ação de Saúde",
  "Palestra",
  "Coleta de sangue",
  "Taxa de destaque",
  "Implantação",
  "Portal de Treinamento",
  "Integração",
  "Gravação da Palestra",
];
const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Dinheiro"];

export function CorridaDialog({ open, onOpenChange, corrida }: Props) {
  const upsert = useUpsertCorrida();
  const [form, setForm] = useState<Partial<UberCorrida>>({});

  useEffect(() => {
    if (open) {
      setForm(corrida ?? { data: new Date().toISOString().slice(0, 10), cancelada: false, valor: 0, reembolso: 0 });
    }
  }, [open, corrida]);

  const set = (k: keyof UberCorrida, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.data || !form.colaborador) return;
    await upsert.mutateAsync(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{corrida ? "Editar corrida" : "Nova corrida"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.data ?? ""} onChange={(e) => set("data", e.target.value)} />
          </div>
          <div>
            <Label>Horário</Label>
            <Input type="time" value={form.horario ?? ""} onChange={(e) => set("horario", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Colaborador *</Label>
            <Input value={form.colaborador ?? ""} onChange={(e) => set("colaborador", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Origem</Label>
            <Input value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Destino</Label>
            <Input value={form.destino ?? ""} onChange={(e) => set("destino", e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={form.motivo ?? ""} onChange={(e) => set("motivo", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo ?? ""} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Empresa</Label>
            <Input value={form.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Input value={form.forma_pagamento ?? ""} onChange={(e) => set("forma_pagamento", e.target.value)} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel ?? ""} onChange={(e) => set("responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => set("valor", Number(e.target.value))} />
          </div>
          <div>
            <Label>Reembolso (R$)</Label>
            <Input type="number" step="0.01" value={form.reembolso ?? 0} onChange={(e) => set("reembolso", Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={!!form.cancelada} onCheckedChange={(v) => set("cancelada", v)} />
            <Label>Cancelada</Label>
          </div>
          <div className="sm:col-span-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending || !form.data || !form.colaborador}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
