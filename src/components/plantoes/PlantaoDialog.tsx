import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { usePlantaoEmpresas, usePlantaoMutations, type Plantao } from "@/hooks/usePlantoes";
import { ptBR } from "date-fns/locale";

const TURNOS = ["integral", "manhã", "tarde", "noite"];
const STATUS_OPTIONS = ["A confirmar", "Confirmado", "Concluído", "Cancelado"];

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatChip(iso: string): string {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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
  const isEdit = !!plantao;

  const [empresaId, setEmpresaId] = useState(plantao?.empresa_id ?? defaultEmpresaId ?? "");
  const initialDates: string[] = plantao?.data
    ? [plantao.data]
    : defaultData
      ? [defaultData]
      : [];
  const [datas, setDatas] = useState<string[]>(initialDates);
  const [horaInicio, setHoraInicio] = useState((plantao?.hora_inicio ?? "09:00").slice(0, 5));
  const [horaFim, setHoraFim] = useState((plantao?.hora_fim ?? "10:00").slice(0, 5));
  const [status, setStatus] = useState(plantao?.status ?? "A confirmar");
  const [plantonista, setPlantonista] = useState(plantao?.plantonista ?? "");
  const [observacao, setObservacao] = useState(plantao?.observacao ?? "");
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(initialDates[0] ? isoToDate(initialDates[0]) : new Date());

  const selectedDates = datas.map(isoToDate);

  const toggleDates = (dates: Date[] | undefined) => {
    const next = (dates ?? []).map(dateToIso).sort();
    setDatas(isEdit ? next.slice(-1) : next);
  };

  const removeChip = (iso: string) => setDatas(datas.filter((d) => d !== iso));

  const canSave =
    !!empresaId &&
    datas.length > 0 &&
    !!horaInicio &&
    !!horaFim &&
    horaFim > horaInicio &&
    !upsertPlantao.isPending;

  const handleSave = async () => {
    for (const data of datas) {
      await upsertPlantao.mutateAsync({
        id: isEdit ? plantao?.id : undefined,
        empresa_id: empresaId,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        status,
        plantonista,
        observacao,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plantão" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
              <SelectContent>
                {empresas.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Datas *</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50"
                >
                  <CalendarIcon className="h-4 w-4 mr-2 text-emerald-700" />
                  {datas.length === 0
                    ? <span className="text-muted-foreground">Selecionar datas</span>
                    : isEdit
                      ? formatChip(datas[0])
                      : `${datas.length} ${datas.length === 1 ? "data selecionada" : "datas selecionadas"}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode={isEdit ? "single" : "multiple"}
                  locale={ptBR}
                  month={calMonth}
                  onMonthChange={setCalMonth}
                  selected={isEdit ? selectedDates[0] : selectedDates as any}
                  onSelect={(v: any) => {
                    if (isEdit) {
                      if (v) setDatas([dateToIso(v as Date)]);
                    } else {
                      toggleDates(v as Date[] | undefined);
                    }
                  }}
                  initialFocus
                />
                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-muted-foreground pl-1">
                    {datas.length} {datas.length === 1 ? "data selecionada" : "datas selecionadas"}
                  </span>
                  <Button size="sm" onClick={() => setCalOpen(false)}>Confirmar seleção</Button>
                </div>
              </PopoverContent>
            </Popover>
            {datas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {datas.map((iso) => (
                  <Badge key={iso} variant="secondary" className="gap-1 pr-1">
                    {formatChip(iso)}
                    <button
                      type="button"
                      onClick={() => removeChip(iso)}
                      className="rounded hover:bg-muted p-0.5"
                      aria-label={`Remover ${formatChip(iso)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
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
          <Button disabled={!canSave} onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
