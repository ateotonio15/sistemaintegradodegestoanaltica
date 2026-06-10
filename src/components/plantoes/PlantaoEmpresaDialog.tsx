import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { usePlantaoMutations, type PlantaoEmpresa } from "@/hooks/usePlantoes";

export function PlantaoEmpresaDialog({
  open,
  onOpenChange,
  empresa,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa?: PlantaoEmpresa | null;
}) {
  const { upsertEmpresa } = usePlantaoMutations();
  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [ativo, setAtivo] = useState(empresa?.ativo ?? true);
  const [observacao, setObservacao] = useState(empresa?.observacao ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{empresa ? "Editar empresa" : "Nova empresa de plantão"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label>Ativa</Label>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || upsertEmpresa.isPending}
            onClick={async () => {
              await upsertEmpresa.mutateAsync({ id: empresa?.id, nome: nome.trim(), ativo, observacao });
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
