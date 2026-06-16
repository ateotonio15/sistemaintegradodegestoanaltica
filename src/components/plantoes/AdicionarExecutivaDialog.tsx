import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlantoes, usePlantaoMutations } from "@/hooks/usePlantoes";

const TIPOS = ["Presencial", "WhatsApp"] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  data: string;
}

export function AdicionarExecutivaDialog({ open, onOpenChange, empresaId, data }: Props) {
  const { data: todos = [] } = usePlantoes();
  const { upsertPlantao } = usePlantaoMutations();

  const opcoes = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((p) => p.plantonista && set.add(p.plantonista));
    return Array.from(set).sort();
  }, [todos]);

  const [executiva, setExecutiva] = useState("");
  const [custom, setCustom] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Presencial");

  const reset = () => {
    setExecutiva("");
    setCustom(false);
    setTipo("Presencial");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar executiva ao plantão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Executiva</Label>
            {custom ? (
              <Input
                autoFocus
                placeholder="Nome da executiva"
                value={executiva}
                onChange={(e) => setExecutiva(e.target.value)}
              />
            ) : (
              <Select
                value={executiva}
                onValueChange={(v) => {
                  if (v === "__novo__") {
                    setCustom(true);
                    setExecutiva("");
                  } else {
                    setExecutiva(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a executiva" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                  <SelectItem value="__novo__">+ Nova executiva…</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as (typeof TIPOS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!executiva.trim() || upsertPlantao.isPending}
            onClick={async () => {
              await upsertPlantao.mutateAsync({
                empresa_id: empresaId,
                data,
                turno: "integral",
                plantonista: executiva.trim(),
                observacao: `Tipo: ${tipo}`,
              });
              reset();
              onOpenChange(false);
            }}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
