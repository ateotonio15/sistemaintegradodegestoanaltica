import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlantaoEmpresas, usePlantaoMutations, type Plantao } from "@/hooks/usePlantoes";

const TURNOS = ["integral", "manhã", "tarde", "noite"];

export function PlantaoDialog({
  open,
  onOpenChange,
  plantao,
  defaultEmpresaId,
  defaultData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantao?: Plantao | null;
  defaultEmpresaId?: string;
  defaultData?: string;
}) {
  const { data: empresas = [] } = usePlantaoEmpresas();
  const { upsertPlantao } = usePlantaoMutations();
  const [empresaId, setEmpresaId] = useState(plantao?.empresa_id ?? defaultEmpresaId ?? "");
  const [data, setData] = useState(plantao?.data ?? defaultData ?? new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState(plantao?.turno ?? "integral");
  const [plantonista, setPlantonista] = useState(plantao?.plantonista ?? "");
  const [observacao, setObservacao] = useState(plantao?.observacao ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plantao ? "Editar plantão" : "Novo plantão"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {empresas.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Plantonista</Label>
            <Input value={plantonista} onChange={(e) => setPlantonista(e.target.value)} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!empresaId || !data || upsertPlantao.isPending}
            onClick={async () => {
              await upsertPlantao.mutateAsync({
                id: plantao?.id,
                empresa_id: empresaId,
                data,
                turno,
                plantonista,
                observacao,
              });
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
