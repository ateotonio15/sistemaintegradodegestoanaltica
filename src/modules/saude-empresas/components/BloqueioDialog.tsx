import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Bloqueio, BloqueioPeriodo, useBloqueioMutations } from "../hooks/usePalestras";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Bloqueio | null;
  preselectDate?: Date | null;
  canEdit: boolean;
  userNome: string | null;
}

export function BloqueioDialog({ open, onOpenChange, editing, preselectDate, canEdit, userNome }: Props) {
  const isEdit = !!editing;
  const { upsert, remove } = useBloqueioMutations();

  const [data, setData] = useState<Date | null>(null);
  const [periodo, setPeriodo] = useState<BloqueioPeriodo>("dia_todo");
  const [motivo, setMotivo] = useState("");
  const [popOpen, setPopOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const [y, m, d] = editing.data.split("-").map(Number);
      setData(new Date(y, m - 1, d));
      setPeriodo(editing.periodo);
      setMotivo(editing.motivo);
    } else {
      setData(preselectDate ?? null);
      setPeriodo("dia_todo");
      setMotivo("");
    }
  }, [open, editing, preselectDate]);

  const handleSubmit = async () => {
    if (!data) { toast.error("Selecione a data"); return; }
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    await upsert.mutateAsync({ id: editing?.id, data: isoDate(data), periodo, motivo, userNome });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await remove.mutateAsync(editing.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloqueio" : "Novo bloqueio de agenda"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Data *</Label>
            <Popover open={popOpen} onOpenChange={setPopOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={!canEdit} className="justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar mode="single" selected={data ?? undefined} onSelect={(d) => { if (d) setData(d); setPopOpen(false); }} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label>Período *</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as BloqueioPeriodo)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dia_todo">Dia todo</SelectItem>
                <SelectItem value="manha">Manhã (antes das 12h)</SelectItem>
                <SelectItem value="tarde">Tarde (a partir das 12h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Motivo *</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={!canEdit} placeholder="Ex.: Reunião interna, congresso, etc." />
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {isEdit && canEdit && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {canEdit && <Button onClick={handleSubmit} disabled={upsert.isPending}>Salvar</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
