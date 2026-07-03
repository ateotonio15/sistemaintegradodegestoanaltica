import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, CalendarIcon, Sparkles, X, Ban, Pencil, Building2, MapPin, Clock, User, MessageSquare, CalendarDays, StickyNote } from "lucide-react";
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

const STATUS_LABEL_MAP: Record<PalestraStatus, string> = {
  a_confirmar: "A confirmar", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};

const STATUS_STYLE: Record<PalestraStatus, { badge: string; dot: string; ring: string }> = {
  a_confirmar: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/40", dot: "bg-amber-500", ring: "ring-amber-500/30" },
  confirmado:  { badge: "bg-sky-500/15 text-sky-400 border-sky-500/40",        dot: "bg-sky-500",   ring: "ring-sky-500/30" },
  concluido:   { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40", dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
  cancelado:   { badge: "bg-rose-500/15 text-rose-400 border-rose-500/40",     dot: "bg-rose-500",  ring: "ring-rose-500/30" },
};

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
  onBloquearAgenda?: (d: Date | null) => void;
}

export function PalestraDialog({
  open, onOpenChange, editing, preselect, canEdit, isReadOnly, userNome, bloqueiosFn, onBloquearAgenda,
}: Props) {
  const isEdit = !!editing;
  const { data: empresas = [] } = useEmpresasAtivas();
  const { data: executivas = [] } = useExecutivas();
  const { createMany, updateOne, deleteOne } = usePalestraMutations();

  const [empresa, setEmpresa] = useState("");
  const [endereco, setEndereco] = useState("");
  const [datas, setDatas] = useState<Date[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [tema, setTema] = useState("");
  const [executiva, setExecutiva] = useState("");
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState<PalestraStatus>("a_confirmar");
  const [motivo, setMotivo] = useState("");
  const [datasPopOpen, setDatasPopOpen] = useState(false);
  const [viewMode, setViewMode] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresa(editing.empresa);
      setEndereco(editing.endereco ?? "");
      const [y, m, d] = editing.data.split("-").map(Number);
      setDatas([new Date(y, m - 1, d)]);
      setHorarioInicio(editing.horario_inicio?.slice(0, 5) ?? "");
      setHorarioFim(editing.horario_fim?.slice(0, 5) ?? "");
      setTema(editing.tema ?? "");
      setExecutiva(editing.executiva ?? "");
      setObservacao(editing.observacao ?? "");
      setStatus(editing.status);
      setMotivo(editing.motivo_cancelamento ?? "");
      setViewMode(true);
    } else {
      setEmpresa("");
      setEndereco("");
      setDatas(preselect ?? []);
      setHorarioInicio("");
      setHorarioFim("");
      setTema("");
      setExecutiva(userNome ?? "");
      setObservacao("");
      setStatus("a_confirmar");
      setMotivo("");
      setViewMode(false);
    }
  }, [open, editing, preselect, userNome]);

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

  const empresaSel = useMemo(() => empresas.find((e) => e.nome === empresa), [empresas, empresa]);
  useEffect(() => {
    if (!isEdit && empresaSel && !endereco) setEndereco(empresaSel.endereco ?? "");
  }, [empresaSel, isEdit, endereco]);

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
    if (!empresa) { toast.error("Selecione a empresa"); return; }
    if (!endereco.trim()) { toast.error("Informe o endereço"); return; }
    if (datas.length === 0) { toast.error("Selecione ao menos uma data"); return; }
    if (!horarioInicio) { toast.error("Informe o horário de início"); return; }
    if (!horarioFim) { toast.error("Informe o horário de fim"); return; }
    if (horarioFim <= horarioInicio) { toast.error("Horário de fim deve ser maior que o de início"); return; }
    if (!executiva) { toast.error("Selecione a executiva responsável"); return; }
    if (status === "cancelado" && !motivo.trim()) {
      toast.error("Informe o motivo do cancelamento"); return;
    }

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
      empresa,
      endereco,
      horario_inicio: horarioInicio || null,
      horario_fim: horarioFim || null,
      tema: tema || null,
      observacao: observacao || null,
      status,
      motivo_cancelamento: status === "cancelado" ? motivo : null,
      executiva,
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

  const isView = isEdit && viewMode;
  const st = STATUS_STYLE[status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (viewMode ? "Detalhes da palestra" : "Editar palestra") : "Nova palestra"}
            {isEdit && (
              <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${st.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {STATUS_LABEL_MAP[status]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isView ? (
          <div className="grid gap-3 py-2">
            <div className={`rounded-xl border bg-card/60 p-4 ring-1 ${st.ring}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 h-11 w-11 rounded-lg flex items-center justify-center ${st.badge} border`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Empresa</div>
                  <div className="text-base font-semibold truncate">{empresa || "—"}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{endereco || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <CalendarDays className="h-3.5 w-3.5" /> Data
                </div>
                <div className="mt-1 text-sm font-semibold">{datas[0] ? format(datas[0], "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}</div>
                <div className="text-xs text-muted-foreground capitalize">{datas[0] ? format(datas[0], "EEEE", { locale: ptBR }) : ""}</div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <Clock className="h-3.5 w-3.5" /> Horário
                </div>
                <div className="mt-1 text-sm font-semibold font-mono tabular-nums">
                  {(horarioInicio || "--:--")} – {(horarioFim || "--:--")}
                </div>
              </div>
            </div>

            {tema && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> Tema
                </div>
                <div className="mt-1 text-sm">{tema}</div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                <User className="h-3.5 w-3.5" /> Executiva responsável
              </div>
              <div className="mt-1 text-sm font-medium">{executiva || "—"}</div>
            </div>

            {status === "cancelado" && motivo && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-400 font-medium">
                  <MessageSquare className="h-3.5 w-3.5" /> Motivo do cancelamento
                </div>
                <div className="mt-1 text-sm">{motivo}</div>
              </div>
            )}

            {observacao && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <StickyNote className="h-3.5 w-3.5" /> Observação
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap">{observacao}</div>
              </div>
            )}

            {editing && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                Criado por {editing.criado_por ?? "—"}
                {editing.editado_por && (
                  <> • Última edição: {editing.editado_por} em {format(new Date(editing.updated_at), "dd/MM/yyyy HH:mm")}</>
                )}
              </div>
            )}
          </div>
        ) : (
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Empresa *</Label>
            <Select value={empresa} onValueChange={setEmpresa} disabled={dis}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
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
                  <Calendar mode="single" selected={datas[0]} onSelect={(d) => d && handleSelectDatas([d])} locale={ptBR} initialFocus className="pointer-events-auto" />
                ) : (
                  <Calendar mode="multiple" selected={datas} onSelect={(ds) => handleSelectDatas(ds as Date[] | undefined)} locale={ptBR} initialFocus className="pointer-events-auto" />
                )}
              </PopoverContent>
            </Popover>
            {datas.length > 1 && !isEdit && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1 items-center">
                <span>{datas.length} data(s) selecionada(s):</span>
                {datas.map((d) => (
                  <Badge key={d.toISOString()} variant="secondary" className="gap-1">
                    {format(d, "dd/MM", { locale: ptBR })}
                    {!dis && (
                      <button type="button" onClick={() => removerData(d)} aria-label={`Remover ${format(d, "dd/MM")}`} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Horário início *</Label>
              <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} disabled={dis} />
            </div>
            <div className="grid gap-2">
              <Label>Horário fim *</Label>
              <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} disabled={dis} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tema-palestra">Tema</Label>
            <Input
              id="tema-palestra"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              disabled={dis}
              placeholder={sugGestantes || "Tema da palestra"}
            />
            <div className="rounded-lg border bg-muted/40 p-2 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Sugestões para {MESES_PT[mesSugestao]}
              </div>
              <button
                type="button"
                disabled={dis}
                onClick={() => aplicarSugestao(sugGestantes)}
                className="w-full text-left text-xs rounded border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-60"
              >
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">Encontro com Gestantes:</span>{" "}
                <span className="text-foreground">{sugGestantes}</span>
              </button>
              <button
                type="button"
                disabled={dis}
                onClick={() => aplicarSugestao(sugCampanha.tema)}
                className="w-full text-left text-xs rounded border-l-4 px-2 py-1.5 hover:bg-accent/40 disabled:opacity-60"
                style={{ borderLeftColor: sugCampanha.hex, background: `${sugCampanha.hex}14` }}
              >
                <span className="font-semibold" style={{ color: sugCampanha.hex }}>Campanha do mês ({sugCampanha.cor}):</span>{" "}
                <span className="text-foreground">{sugCampanha.tema}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Executiva responsável *</Label>
            <Select value={executiva} onValueChange={setExecutiva} disabled={dis}>
              <SelectTrigger><SelectValue placeholder="Selecione a executiva" /></SelectTrigger>
              <SelectContent>
                {executivas.map((e) => (
                  <SelectItem key={e.user_id} value={e.display_name}>{e.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={dis} rows={2} />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={dis} rows={3} />
          </div>

          {isEdit && editing && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Criado por {editing.criado_por ?? "—"}
              {editing.editado_por && (
                <> • Última edição: {editing.editado_por} em {format(new Date(editing.updated_at), "dd/MM/yyyy HH:mm")}</>
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
            {!isEdit && canEdit && !isReadOnly && onBloquearAgenda && (
              <Button
                variant="outline"
                onClick={() => onBloquearAgenda(datas[0] ?? null)}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Ban className="h-4 w-4 mr-1" /> Bloquear agenda
              </Button>
            )}
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
