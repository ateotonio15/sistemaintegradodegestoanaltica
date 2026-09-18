import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EmpresaAutocomplete } from "@/components/plantoes/EmpresaAutocomplete";
import {
  useAgendamentoMutations,
  useExecutivas,
  type AgendamentoPlantao,
  type AgendamentoStatus,
} from "@/hooks/useAgendamentosPlantao";
import { useFeriados, type Feriado } from "@/hooks/useFeriados";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: AgendamentoPlantao | null;
  defaultDate?: string | null; // YYYY-MM-DD
}

const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  a_confirmar: "A confirmar",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function AgendamentoPlantaoDialog({ open, onOpenChange, editing, defaultDate }: Props) {
  const isEdit = !!editing;
  const { user } = useAuth();
  const { createMany, update, remove } = useAgendamentoMutations();
  const { data: executivas = [] } = useExecutivas();
  const anoAtual = new Date().getFullYear();
  const { data: feriadosAno = [] } = useFeriados(anoAtual);
  const { data: feriadosProx = [] } = useFeriados(anoAtual + 1);
  const feriadoMap = useMemo(() => {
    const m = new Map<string, Feriado>();
    [...feriadosAno, ...feriadosProx].forEach((f) => m.set(f.data, f));
    return m;
  }, [feriadosAno, feriadosProx]);

  const [meuNome, setMeuNome] = useState<string | null>(null);
  const [meuUsername, setMeuUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setMeuNome(data?.display_name || null);
      setMeuUsername(null);
    });
  }, [user]);

  const canChangeExecutiva = meuUsername === "mayara.meireles";

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [datas, setDatas] = useState<Date[]>([]);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("17:00");
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState<AgendamentoStatus>("a_confirmar");
  const [executiva, setExecutiva] = useState<string>("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setEmpresaNome(editing.empresa_nome);
      setDatas([fromISO(editing.data)]);
      setHoraInicio(editing.hora_inicio.slice(0, 5));
      setHoraFim(editing.hora_fim.slice(0, 5));
      setObservacao(editing.observacao ?? "");
      setStatus(editing.status);
      setExecutiva(editing.executiva ?? "");
      setMotivo(editing.motivo_cancelamento ?? "");
    } else {
      setEmpresaId(null);
      setEmpresaNome(null);
      setDatas(defaultDate ? [fromISO(defaultDate)] : []);
      setHoraInicio("08:00");
      setHoraFim("17:00");
      setObservacao("");
      setStatus("a_confirmar");
      setExecutiva(meuNome ?? "");
      setMotivo("");
    }
  }, [open, editing, defaultDate, meuNome]);

  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isFeriado = (d: Date) => feriadoMap.has(toISO(d));

  const handleSalvar = async () => {
    if (!empresaId || !empresaNome) return toast.error("Selecione uma empresa");
    if (datas.length === 0) return toast.error("Selecione ao menos uma data");
    // Plantões que viram o dia (ex.: 16:45 às 01:45) são permitidos: o término vale para o dia seguinte.
    if (horaFim === horaInicio) return toast.error("Horário de término não pode ser igual ao de início");
    for (const d of datas) {
      if (isWeekend(d)) return toast.error("Agendamento apenas em dias úteis");
      const fer = feriadoMap.get(toISO(d));
      if (fer) return toast.error(`Data ${d.toLocaleDateString("pt-BR")} é feriado (${fer.nome})`);
    }
    if (status === "cancelado" && !motivo.trim()) return toast.error("Informe o motivo do cancelamento");

    const base = {
      empresa_id: empresaId,
      empresa_nome: empresaNome,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      executiva: executiva || null,
      status,
      observacao: observacao || null,
      motivo_cancelamento: status === "cancelado" ? motivo : null,
    };

    if (isEdit && editing) {
      await update.mutateAsync({ id: editing.id, patch: { ...base, data: toISO(datas[0]) } });
    } else {
      await createMany.mutateAsync({ base, datas: datas.map(toISO) });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Empresa</Label>
            <EmpresaAutocomplete value={empresaId} onChange={(id, nome) => { setEmpresaId(id); setEmpresaNome(nome); }} />
          </div>

          <div className="space-y-1">
            <Label>Data{isEdit ? "" : "s"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", datas.length === 0 && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {datas.length === 0 ? "Selecionar" : datas.length === 1 ? format(datas[0], "PPP", { locale: ptBR }) : `${datas.length} datas`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {isEdit ? (
                  <Calendar
                    mode="single"
                    selected={datas[0]}
                    onSelect={(d) => d && setDatas([d])}
                    weekStartsOn={1}
                    locale={ptBR}
                    disabled={(d) => isWeekend(d) || isFeriado(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                ) : (
                  <Calendar
                    mode="multiple"
                    selected={datas}
                    onSelect={(ds) => setDatas(ds ?? [])}
                    weekStartsOn={1}
                    locale={ptBR}
                    disabled={(d) => isWeekend(d) || isFeriado(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                )}
              </PopoverContent>
            </Popover>
            {!isEdit && datas.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {datas.map((d) => (
                  <Badge key={toISO(d)} variant="secondary" className="cursor-pointer" onClick={() => setDatas(datas.filter((x) => toISO(x) !== toISO(d)))}>
                    {format(d, "dd/MM", { locale: ptBR })} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Horário início</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Horário fim</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              {!!horaInicio && !!horaFim && horaFim < horaInicio && (
                <p className="text-[11px] text-muted-foreground">Termina no dia seguinte</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AgendamentoStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as AgendamentoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Executiva responsável</Label>
              <Select value={executiva} onValueChange={setExecutiva} disabled={!canChangeExecutiva}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {executivas.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                  {executiva && !executivas.includes(executiva) && (
                    <SelectItem value={executiva}>{executiva}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "cancelado" && (
            <div className="space-y-1">
              <Label>Motivo do cancelamento *</Label>
              <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {isEdit && editing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => { await remove.mutateAsync(editing.id); onOpenChange(false); }}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={createMany.isPending || update.isPending}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
