import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, CalendarIcon, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Palestra, PalestraStatus, usePalestraMutations,
} from "../hooks/usePalestras";
import { useEmpresasAtivas, useExecutivas } from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { GESTANTES_2026, CAMPANHAS, MESES_PT } from "../lib/palestras-calendario";

const STATUS_OPTIONS: { v: PalestraStatus; label: string }[] = [
  { v: "a_confirmar", label: "A confirmar" },
  { v: "confirmado", label: "Confirmado" },
  { v: "concluido", label: "Concluído" },
  { v: "cancelado", label: "Cancelado" },
];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Palestra | null;
  preselect?: Date[];
  canEdit: boolean;
  isReadOnly: boolean;
  userNome: string | null;
  bloqueiosFn: (d: Date) => { periodo: "dia_todo" | "manha" | "tarde"; motivo: string } | null;
}

export function PalestraDialog({
  open, onOpenChange, editing, preselect, canEdit, isReadOnly, userNome, bloqueiosFn,
}: Props) {
  const isEdit = !!editing;
  const { user } = useAuth();
  const { data: empresas = [] } = useEmpresasAtivas();
  const { data: executivas = [] } = useExecutivas();
  const { createMany, updateOne, deleteOne } = usePalestraMutations();

  const [empresaId, setEmpresaId] = useState("");
  const [endereco, setEndereco] = useState("");
  const [datas, setDatas] = useState<Date[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [tema, setTema] = useState("");
  const [executivaUserId, setExecutivaUserId] = useState("");
  const [executivaNome, setExecutivaNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState<PalestraStatus>("a_confirmar");
  const [motivo, setMotivo] = useState("");
  const [datasPopOpen, setDatasPopOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setEndereco(editing.endereco ?? "");
      const [y, m, d] = editing.data.split("-").map(Number);
      setDatas([new Date(y, m - 1, d)]);
      setHorarioInicio(editing.horario_inicio?.slice(0, 5) ?? "");
      setHorarioFim(editing.horario_fim?.slice(0, 5) ?? "");
      setTema(editing.tema ?? "");
      setExecutivaUserId(editing.executiva_user_id ?? "");
      setExecutivaNome(editing.executiva_nome ?? "");
      setObservacao(editing.observacao ?? "");
      setStatus(editing.status);
      setMotivo(editing.motivo_cancelamento ?? "");
    } else {
      setEmpresaId("");
      setEndereco("");
      setDatas(preselect ?? []);
      setHorarioInicio("");
      setHorarioFim("");
      setTema("");
      setExecutivaUserId(user?.id ?? "");
      setExecutivaNome(userNome ?? "");
      setObservacao("");
      setStatus("a_confirmar");
      setMotivo("");
    }
  }, [open, editing, preselect, user?.id, userNome]);

  // Mês para sugestões (primeiro dado ou mês corrente)
  const mesSugestao = useMemo(() => (datas[0] ?? new Date()).getMonth(), [datas]);
  const sugGestantes = GESTANTES_2026[mesSugestao] ?? "";
  const sugCampanha = CAMPANHAS[mesSugestao];

  const aplicarSugestao = (texto: string) => {
    if (tema.trim() && tema !== texto) {
      if (!window.confirm("Substituir o tema atual pela sugestão?")) return;
    }
    setTema(texto);
  };

  const removerData = (d: Date) => {
    setDatas((prev) => prev.filter((x) => x.getTime() !== d.getTime()));
  };

  const empresa = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  useEffect(() => {
    if (!isEdit && empresa && !endereco) setEndereco(empresa.endereco ?? "");
  }, [empresa, isEdit, endereco]);

  // Sugestão de tema pelo mês selecionado
  const temaSugerido = useMemo(() => {
    const d = datas[0];
    if (!d) return "";
    return GESTANTES_2026[d.getMonth()] ?? "";
  }, [datas]);

  const handleSelectDatas = (ds: Date[] | undefined) => {
    const list = ds ?? [];
    const filtered = list.filter((d) => {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) {
        toast.warning("Só é possível agendar de segunda a sexta.");
        return false;
      }
      const fer = feriadoEm(d);
      if (fer) { toast.info(`${format(d, "dd/MM")} é feriado (${fer.nome}).`); return false; }
      const bl = bloqueiosFn(d);
      if (bl && bl.periodo === "dia_todo") {
        toast.warning(`${format(d, "dd/MM")} está bloqueado: ${bl.motivo}`);
        return false;
      }
      return true;
    });
    setDatas(filtered);
  };

  const handleSubmit = async () => {
    if (!empresaId) { toast.error("Selecione a empresa"); return; }
    if (!endereco.trim()) { toast.error("Informe o endereço"); return; }
    if (datas.length === 0) { toast.error("Selecione ao menos uma data"); return; }
    if (status === "cancelado" && !motivo.trim()) {
      toast.error("Informe o motivo do cancelamento"); return;
    }

    // Valida bloqueio por período em cada data (manha < 12, tarde >= 12)
    if (horarioInicio) {
      const h = parseInt(horarioInicio.slice(0, 2), 10);
      for (const d of datas) {
        const bl = bloqueiosFn(d);
        if (!bl) continue;
        if (bl.periodo === "manha" && h < 12) {
          toast.error(`${format(d, "dd/MM")} — manhã bloqueada: ${bl.motivo}`); return;
        }
        if (bl.periodo === "tarde" && h >= 12) {
          toast.error(`${format(d, "dd/MM")} — tarde bloqueada: ${bl.motivo}`); return;
        }
      }
    }

    const base = {
      empresa_id: empresaId,
      endereco,
      horario_inicio: horarioInicio || null,
      horario_fim: horarioFim || null,
      tema: tema || null,
      observacao: observacao || null,
      status,
      motivo_cancelamento: status === "cancelado" ? motivo : null,
      executiva_user_id: executivaUserId || null,
      executiva_nome: executivaNome || null,
    };

    if (isEdit && editing) {
      await updateOne.mutateAsync({
        id: editing.id,
        patch: { ...base, data: isoDate(datas[0]) },
        userNome,
      });
    } else {
      await createMany.mutateAsync({
        datas: datas.map(isoDate),
        base,
        userNome,
      });
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteOne.mutateAsync(editing.id);
    onOpenChange(false);
  };

  const dis = isReadOnly || !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar palestra" : "Nova palestra"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} disabled={dis}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Endereço *</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} disabled={dis} placeholder="Local da palestra" />
          </div>

          <div className="grid gap-2">
            <Label>{isEdit ? "Data" : "Datas (selecione uma ou mais)"} *</Label>
            <Popover open={datasPopOpen} onOpenChange={setDatasPopOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" disabled={dis} className="justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {datas.length === 0 ? "Selecionar" :
                    datas.length === 1 ? format(datas[0], "dd/MM/yyyy", { locale: ptBR }) :
                    `${datas.length} datas`}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                {isEdit ? (
                  <Calendar mode="single" selected={datas[0]} onSelect={(d) => d && handleSelectDatas([d])} locale={ptBR} initialFocus />
                ) : (
                  <Calendar mode="multiple" selected={datas} onSelect={(ds) => handleSelectDatas(ds as Date[] | undefined)} locale={ptBR} initialFocus />
                )}
              </PopoverContent>
            </Popover>
            {datas.length > 1 && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1">
                {datas.map((d) => (
                  <Badge key={d.toISOString()} variant="secondary">{format(d, "dd/MM", { locale: ptBR })}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Horário início</Label>
              <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} disabled={dis} />
            </div>
            <div className="grid gap-2">
              <Label>Horário fim</Label>
              <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} disabled={dis} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Tema</Label>
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              disabled={dis}
              placeholder={temaSugerido ? `Sugestão do mês: ${temaSugerido}` : "Tema livre"}
            />
          </div>

          <div className="grid gap-2">
            <Label>Executiva responsável</Label>
            <Select
              value={executivaUserId}
              onValueChange={(v) => {
                setExecutivaUserId(v);
                const ex = executivas.find((e) => e.user_id === v);
                setExecutivaNome(ex?.display_name ?? "");
              }}
              disabled={dis}
            >
              <SelectTrigger><SelectValue placeholder="Selecione a executiva" /></SelectTrigger>
              <SelectContent>
                {executivas.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={dis} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PalestraStatus)} disabled={dis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === "cancelado" && (
              <div className="grid gap-2">
                <Label>Motivo do cancelamento *</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={dis} />
              </div>
            )}
          </div>

          {isEdit && editing && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Criado por {editing.created_by_nome ?? "—"}
              {editing.updated_by_nome && (
                <> • Última edição: {editing.updated_by_nome} em {format(new Date(editing.updated_at), "dd/MM/yyyy HH:mm")}</>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {isEdit && canEdit && !isReadOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir palestra?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {!dis && (
              <Button onClick={handleSubmit} disabled={createMany.isPending || updateOne.isPending}>
                {isEdit ? "Salvar" : `Criar ${datas.length > 1 ? `(${datas.length})` : ""}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
