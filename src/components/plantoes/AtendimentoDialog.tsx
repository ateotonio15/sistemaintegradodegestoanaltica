import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlantaoMutations, type PlantaoAtendimento } from "@/hooks/usePlantoes";

const TIPOS = ["Consulta", "Exame", "Autorização", "Agendamento", "Reembolso", "Outro"];
const CANAIS = ["Presencial", "WhatsApp", "Telefone", "E-mail"];

function parseAssunto(assunto: string | null | undefined): { tipo: string; canal: string } {
  if (!assunto) return { tipo: "Consulta", canal: "Presencial" };
  const parts = assunto.split("·").map((s) => s.trim());
  const tipo = TIPOS.find((t) => t.toLowerCase() === (parts[0] ?? "").toLowerCase()) ?? parts[0] ?? "Consulta";
  const canal = CANAIS.find((c) => c.toLowerCase() === (parts[1] ?? "").toLowerCase()) ?? "Presencial";
  return { tipo, canal };
}

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
  const initial = parseAssunto(atendimento?.assunto);
  const [nome, setNome] = useState(atendimento?.nome_cliente ?? "");
  const [cpf, setCpf] = useState(atendimento?.cpf ?? "");
  const [tipo, setTipo] = useState(initial.tipo);
  const [canal, setCanal] = useState(initial.canal);
  const [resolvido, setResolvido] = useState(atendimento?.resolvido ?? false);
  const [observacao, setObservacao] = useState(atendimento?.observacao ?? "");

  const now = new Date();
  const horaAtual = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{atendimento ? "Editar demanda" : "Adicionar demanda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Beneficiário" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          <Input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>{CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={resolvido ? "resolvido" : "pendente"} onValueChange={(v) => setResolvido(v === "resolvido")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={1000}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || upsertAtendimento.isPending}
            onClick={async () => {
              await upsertAtendimento.mutateAsync({
                id: atendimento?.id,
                plantao_id: plantaoId,
                hora: atendimento?.hora ?? horaAtual,
                nome_cliente: nome.trim(),
                cpf: cpf.trim(),
                assunto: `${tipo} · ${canal}`,
                resolvido,
                observacao: observacao.trim(),
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
