import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
import { usePrioridadeMaxima } from "@/hooks/usePrioridadeMaxima";

const MOTIVOS_PRIORIDADE = [
  "🔥 Fechamento Crítico",
  "🚨 Prioridade Máxima",
  "⚠️ Movimentação Urgente",
  "⏰ Prazo Crítico",
  "📢 Atenção Imediata",
  "🔴 Contrato Estratégico",
  "⭐ Cliente Prioritário",
  "🏆 Atendimento Preferencial",
  "🚀 Prioridade Executiva",
  "💼 Operação Prioritária",
  "Atraso crítico",
];
const MOTIVOS_REMOCAO = [
  "Fechamento concluído",
  "Situação normalizada",
  "Não é mais prioridade",
  "Solicitação da diretoria",
  "Cancelado por engano",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaId: string | null;
  empresaNome?: string;
  mode: "marcar" | "remover";
}

export function PrioridadeDialog({ open, onOpenChange, empresaId, empresaNome, mode }: Props) {
  const { marcar, remover } = usePrioridadeMaxima();
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const reset = () => { setMotivo(""); setObservacoes(""); };

  const handleConfirm = async () => {
    if (!empresaId) return;
    if (mode === "marcar") {
      if (!motivo.trim()) return;
      await marcar.mutateAsync({ empresa_id: empresaId, motivo, observacoes });
    } else {
      await remover.mutateAsync({ empresa_id: empresaId, motivo_remocao: motivo });
    }
    reset();
    onOpenChange(false);
  };

  const busy = marcar.isPending || remover.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Star className="h-5 w-5 fill-current" />
            {mode === "marcar" ? "Definir como Prioridade Máxima" : "Remover Prioridade Máxima"}
          </DialogTitle>
          <DialogDescription>
            {empresaNome ? `Empresa: ${empresaNome}` : "Confirme a ação para a empresa selecionada."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="motivo-prioridade">
              {mode === "marcar" ? "Motivo da prioridade *" : "Motivo da remoção"}
            </Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="motivo-prioridade">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {(mode === "marcar" ? MOTIVOS_PRIORIDADE : MOTIVOS_REMOCAO).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "marcar" && (
            <div>
              <Label htmlFor="obs-prioridade">Observações (opcional)</Label>
              <Textarea
                id="obs-prioridade"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || (mode === "marcar" && !motivo.trim())}
            className={mode === "marcar" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            variant={mode === "remover" ? "destructive" : "default"}
          >
            {busy ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
