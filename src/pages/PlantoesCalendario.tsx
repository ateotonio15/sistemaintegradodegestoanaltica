import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowLeft, Download, Plus, X, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useFeriados } from "@/hooks/useFeriados";
import { EmpresaAutocomplete } from "@/components/plantoes/EmpresaAutocomplete";
import { AgendamentoPlantaoDialog } from "@/components/plantoes/AgendamentoPlantaoDialog";
import {
  useAgendamentosPlantao,
  useAgendamentosRealtime,
  useExecutivas,
  type AgendamentoPlantao,
  type AgendamentoStatus,
} from "@/hooks/useAgendamentosPlantao";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StatusFiltro = "todos" | AgendamentoStatus;

const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  a_confirmar: "A confirmar",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CHIP: Record<AgendamentoStatus, string> = {
  a_confirmar: "bg-yellow-100 text-yellow-900 border-yellow-200",
  confirmado: "bg-green-100 text-green-900 border-green-200",
  concluido: "bg-emerald-700 text-white border-emerald-800",
  cancelado: "bg-muted text-muted-foreground",
};

export default function PlantoesCalendario() {
  useAgendamentosRealtime();
  const { role } = useAuth();
  const canEdit = !!role && ["admin", "comum", "executivo", "coordenadora"].includes(role as string);

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const today = toISO(new Date());

  const { data: feriadosAno = [] } = useFeriados(cursor.getFullYear());
  const feriadoMap = useMemo(() => new Map(feriadosAno.map((f) => [f.data, f])), [feriadosAno]);

  const { data: agendamentos = [] } = useAgendamentosPlantao({ from: toISO(monthStart), to: toISO(monthEnd) });
  const { data: executivas = [] } = useExecutivas();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [execFiltro, setExecFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoData, setNovoData] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgendamentoPlantao | null>(null);

  const filtrados = useMemo(() => agendamentos.filter((a) => {
    if (empresaId && a.empresa_id !== empresaId) return false;
    if (execFiltro !== "todas" && (a.executiva ?? "") !== execFiltro) return false;
    if (statusFiltro !== "todos" && a.status !== statusFiltro) return false;
    return true;
  }), [agendamentos, empresaId, execFiltro, statusFiltro]);

  // Grade completa Dom–Sáb (com dias dos meses vizinhos)
  const dias = useMemo(() => {
    const arr: { date: Date; fora: boolean }[] = [];
    const inicio = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - monthStart.getDay());
    const total = Math.ceil((monthStart.getDay() + monthEnd.getDate()) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const date = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      arr.push({ date, fora: date.getMonth() !== monthStart.getMonth() });
    }
    return arr;
  }, [cursor]);

  const [selecionado, setSelecionado] = useState<string | null>(today);
  const doDia = useMemo(
    () => filtrados.filter((a) => a.data === selecionado).sort((x, y) => x.hora_inicio.localeCompare(y.hora_inicio)),
    [filtrados, selecionado],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, AgendamentoPlantao[]>();
    for (const a of filtrados) {
      if (a.status === "cancelado") continue; // não exibir na grade
      const arr = m.get(a.data) ?? [];
      arr.push(a);
      m.set(a.data, arr);
    }
    return m;
  }, [filtrados]);

  const limparFiltros = () => {
    setEmpresaId(null);
    setExecFiltro("todas");
    setStatusFiltro("todos");
  };

  const exportExcel = () => {
    const rows = filtrados.map((a) => ({
      Data: new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR"),
      Empresa: a.empresa_nome,
      "Horário início": a.hora_inicio.slice(0, 5),
      "Horário fim": a.hora_fim.slice(0, 5),
      Executiva: a.executiva ?? "",
      Status: STATUS_LABELS[a.status],
      "Motivo cancelamento": a.motivo_cancelamento ?? "",
      Observação: a.observacao ?? "",
      "Criado por": a.criado_por ?? "",
      "Última edição": `${a.editado_por ?? ""} ${a.updated_at ? format(new Date(a.updated_at), "dd/MM/yyyy HH:mm") : ""}`.trim(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calendário");
    const mes = format(cursor, "yyyy-MM");
    XLSX.writeFile(wb, `calendario-plantoes-${mes}.xlsx`);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário de Plantões</h1>
          <p className="text-sm text-muted-foreground">Você pode criar, editar e excluir eventos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          {canEdit && (
            <Button onClick={() => { setNovoData(null); setEditing(null); setNovoOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo evento
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[240px] flex-1">
            <Label className="text-xs">Empresa</Label>
            <EmpresaAutocomplete value={empresaId} onChange={(id) => setEmpresaId(id)} allowClear placeholder="Todas" />
          </div>
          <div className="space-y-1 min-w-[200px] flex-1">
            <Label className="text-xs">Executiva(o)</Label>
            <Select value={execFiltro} onValueChange={setExecFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {executivas.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px] flex-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(STATUS_LABELS) as AgendamentoStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Feriado Nacional/Estadual</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Feriado Municipal - Manaus</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
      <Card className="rounded-2xl"><CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" className="rounded-full" onClick={() => { setCursor(startOfMonth(new Date())); setSelecionado(today); }}>Hoje</Button>
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {dias.map(({ date: d, fora }, i) => {
            const key = toISO(d);
            const items = fora ? [] : (byDay.get(key) ?? []);
            const isHoje = key === today;
            const isSel = key === selecionado;
            const fer = feriadoMap.get(key);
            const fim = d.getDay() === 0 || d.getDay() === 6;
            const bg = fer?.tipo === "Municipal" ? "bg-orange-50 dark:bg-orange-950/30" : fer ? "bg-rose-50 dark:bg-rose-950/30" : fim ? "bg-muted/40" : "bg-card";
            const dot = fer?.tipo === "Municipal" ? "bg-orange-400" : fer ? "bg-rose-400" : "";
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (fora) { setCursor(startOfMonth(d)); }
                  setSelecionado(key);
                }}
                className={cn(
                  "min-h-[92px] p-1.5 border rounded-xl text-left text-xs transition flex flex-col",
                  bg,
                  fora ? "opacity-40" : "hover:border-primary/50 hover:shadow-sm",
                  isSel ? "border-primary border-2 shadow-md" : "",
                )}
                title={fer?.nome ?? ""}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "h-6 w-6 inline-flex items-center justify-center rounded-full font-semibold",
                    isHoje ? "bg-primary text-primary-foreground" : "",
                  )}>{d.getDate()}</span>
                  {fer && <span className={`h-2 w-2 rounded-full ${dot}`} title={fer.nome} />}
                </div>
                {fer && !fora && <div className="text-[10px] text-muted-foreground truncate">{fer.nome}</div>}
                <div className="mt-1 space-y-0.5 w-full">
                  {items.slice(0, 2).map((a) => (
                    <div key={a.id} className={cn("rounded-md border px-1 py-0.5 text-[10px] leading-tight truncate", STATUS_CHIP[a.status])}>
                      {a.hora_inicio.slice(0, 5)} · {a.empresa_nome}
                    </div>
                  ))}
                  {items.length > 2 && <div className="text-[10px] text-muted-foreground">+{items.length - 2} mais</div>}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      <Card className="rounded-2xl lg:sticky lg:top-4"><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {selecionado ? format(new Date(selecionado + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
          </h2>
          {selecionado && canEdit && !feriadoMap.get(selecionado) && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setNovoData(selecionado); setNovoOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          )}
        </div>
        {selecionado && feriadoMap.get(selecionado) && (
          <div className="rounded-lg border bg-muted/50 p-2 text-xs">Feriado: {feriadoMap.get(selecionado)!.nome}</div>
        )}
        {!selecionado ? (
          <p className="text-sm text-muted-foreground">Clique em um dia do calendário para ver a programação.</p>
        ) : doDia.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma programação agendada neste dia.</p>
        ) : (
          <div className="space-y-2">
            {doDia.map((a) => (
              <div key={a.id} className={cn("rounded-xl border p-3 space-y-1", STATUS_CHIP[a.status])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm leading-tight">{a.empresa_nome}</div>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setEditing(a); setNovoOpen(true); }} aria-label="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="text-xs">{a.hora_inicio.slice(0, 5)} – {a.hora_fim.slice(0, 5)}</div>
                <div className="text-xs">Executiva: {a.executiva ?? "sem executiva"}</div>
                <div className="text-xs">Status: {STATUS_LABELS[a.status]}</div>
                {a.status === "cancelado" && a.motivo_cancelamento && <div className="text-xs">Motivo: {a.motivo_cancelamento}</div>}
                {a.observacao && <div className="text-xs opacity-90">{a.observacao}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
      </div>

      {novoOpen && (
        <AgendamentoPlantaoDialog
          open={novoOpen}
          onOpenChange={(v) => { setNovoOpen(v); if (!v) { setNovoData(null); setEditing(null); } }}
          editing={editing}
          defaultDate={novoData}
        />
      )}
    </div>
  );
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}
