import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlantaoMutations, type PlantaoAtendimento } from "@/hooks/usePlantoes";

const TIPOS = ["Consulta", "Exame", "Reclamação", "Dúvida", "Outro"];
const CANAIS = ["Presencial", "WhatsApp"];
const STATUS = ["Pendente", "Em andamento", "Resolvido", "Cancelado"] as const;
type Status = (typeof STATUS)[number];

export function parseAssunto(assunto: string | null | undefined, resolvidoFallback = false): { tipo: string; canal: string; status: Status } {
  const fallbackStatus: Status = resolvidoFallback ? "Resolvido" : "Pendente";
  if (!assunto) return { tipo: "Consulta", canal: "Presencial", status: fallbackStatus };
  const parts = assunto.split("·").map((s) => s.trim());
  const tipo = TIPOS.find((t) => t.toLowerCase() === (parts[0] ?? "").toLowerCase()) ?? parts[0] ?? "Consulta";
  const canal = CANAIS.find((c) => c.toLowerCase() === (parts[1] ?? "").toLowerCase()) ?? "Presencial";
  const status = (STATUS.find((s) => s.toLowerCase() === (parts[2] ?? "").toLowerCase()) ?? fallbackStatus) as Status;
  return { tipo, canal, status };
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
  const initial = parseAssunto(atendimento?.assunto, atendimento?.resolvido);
  const [nome, setNome] = useState(atendimento?.nome_cliente ?? "");
  const [cpf, setCpf] = useState(atendimento?.cpf ?? "");
  const [tipo, setTipo] = useState(initial.tipo);
  const [canal, setCanal] = useState(initial.canal);
  const [status, setStatus] = useState<Status>(initial.status);
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
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                assunto: `${tipo} · ${canal} · ${status}`,
                resolvido: status === "Resolvido",
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
