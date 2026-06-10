import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlantaoEmpresas, usePlantaoMutations } from "@/hooks/usePlantoes";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PlantaoLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: empresas = [] } = usePlantaoEmpresas();
  const { createLotePlantoes } = usePlantaoMutations();
  const [empresaId, setEmpresaId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [turno, setTurno] = useState("integral");
  const [plantonista, setPlantonista] = useState("");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lote de plantões</DialogTitle></DialogHeader>
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
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Dias da semana</Label>
            <div className="flex gap-3 mt-2 flex-wrap">
              {DIAS.map((d, i) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <Checkbox checked={dias.includes(i)} onCheckedChange={() => toggleDia(i)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["integral", "manhã", "tarde", "noite"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plantonista</Label>
              <Input value={plantonista} onChange={(e) => setPlantonista(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!empresaId || createLotePlantoes.isPending}
            onClick={async () => {
              await createLotePlantoes.mutateAsync({ empresa_id: empresaId, from, to, turno, plantonista, diasSemana: dias });
              onOpenChange(false);
            }}
          >
            Criar lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
