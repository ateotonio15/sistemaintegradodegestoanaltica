import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban, CalendarDays, CalendarIcon, Clock3, MessageSquareText, Pencil, Trash2 } from "lucide-react";
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
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditMode(false);
    if (editing) {
      const [y, m, d] = editing.data.split("-").map(Number);
      setData(new Date(y, m - 1, d));
      setPeriodo(editing.periodo);
      setHoraInicio((editing.hora_inicio ?? "08:00").slice(0, 5));
      setHoraFim((editing.hora_fim ?? "09:00").slice(0, 5));
      setMotivo(editing.motivo);
    } else {
      setData(preselectDate ?? null);
      setPeriodo("dia_todo");
      setHoraInicio("08:00");
      setHoraFim("09:00");
      setMotivo("");
    }
  }, [open, editing, preselectDate]);

  const handleSubmit = async () => {
    if (!data) { toast.error("Selecione a data"); return; }
    if (periodo === "horario") {
      if (!horaInicio || !horaFim) { toast.error("Informe o horário de início e fim"); return; }
      if (horaFim <= horaInicio) { toast.error("O horário final deve ser maior que o inicial"); return; }
    }
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    await upsert.mutateAsync({
      id: editing?.id,
      data: isoDate(data),
      periodo,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      motivo,
      userNome,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await remove.mutateAsync(editing.id);
    onOpenChange(false);
  };

  const periodoLabel = (p: BloqueioPeriodo) =>
    p === "dia_todo" ? "Dia todo" : p === "manha" ? "Manhã (antes das 12h)" : p === "tarde" ? "Tarde (a partir das 12h)" : "Horário específico";

  const showView = isEdit && !editMode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? (editMode ? "Editar bloqueio" : "Detalhes do bloqueio") : "Novo bloqueio de agenda"}</DialogTitle>
        </DialogHeader>
        {showView ? (
          <div className="grid gap-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <Ban className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Agenda bloqueada neste dia</span>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="grid">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Data</span>
                  <span className="text-sm font-medium">{data ? format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="grid">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Período</span>
                  <span className="text-sm font-medium">{periodoLabel(periodo)}{periodo === "horario" ? ` · ${horaInicio} às ${horaFim}` : ""}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="grid">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Motivo</span>
                  <span className="text-sm font-medium">{motivo || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                <SelectItem value="horario">Horário específico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodo === "horario" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Início *</Label>
                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="grid gap-2">
                <Label>Fim *</Label>
                <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Motivo *</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={!canEdit} placeholder="Ex.: Reunião interna, congresso, etc." />
          </div>
        </div>
        )}
        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {isEdit && canEdit && editMode && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {showView && canEdit ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => (isEdit && canEdit ? setEditMode(false) : onOpenChange(false))}>
                  {isEdit && canEdit ? "Voltar" : "Fechar"}
                </Button>
                {canEdit && <Button onClick={handleSubmit} disabled={upsert.isPending}>Salvar</Button>}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
