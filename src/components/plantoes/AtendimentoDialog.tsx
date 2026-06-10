import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { usePlantaoMutations, type PlantaoAtendimento } from "@/hooks/usePlantoes";

export function AtendimentoDialog({
  open,
  onOpenChange,
  plantaoId,
  atendimento,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantaoId: string;
  atendimento?: PlantaoAtendimento | null;
}) {
  const { upsertAtendimento } = usePlantaoMutations();
  const [hora, setHora] = useState(atendimento?.hora ?? "");
  const [nome, setNome] = useState(atendimento?.nome_cliente ?? "");
  const [cpf, setCpf] = useState(atendimento?.cpf ?? "");
  const [assunto, setAssunto] = useState(atendimento?.assunto ?? "");
  const [resolvido, setResolvido] = useState(atendimento?.resolvido ?? false);
  const [observacao, setObservacao] = useState(atendimento?.observacao ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{atendimento ? "Editar atendimento" : "Novo atendimento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hora</Label>
              <Input type="time" value={hora ?? ""} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nome do cliente</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Assunto</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={resolvido} onCheckedChange={setResolvido} />
            <Label>Resolvido</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || upsertAtendimento.isPending}
            onClick={async () => {
              await upsertAtendimento.mutateAsync({
                id: atendimento?.id,
                plantao_id: plantaoId,
                hora: hora || null,
                nome_cliente: nome.trim(),
                cpf,
                assunto,
                resolvido,
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
