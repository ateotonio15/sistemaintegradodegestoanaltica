import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowLeft, Download, Plus, X } from "lucide-react";
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
  const canEdit = role === "admin" || role === "comum" || role === "executivo" || role === "coordenadora" || role === "administradoras";

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

  // Grade Seg–Sex do mês
  const dias: (Date | null)[] = useMemo(() => {
    const arr: (Date | null)[] = [];
    const firstWeekday = monthStart.getDay(); // 0=Dom
    // Ajuste para segunda como início
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    // Só mostramos seg–sex, então descartamos offsets fora do intervalo
    for (let i = 0; i < offset; i++) {
      if (i < 5) arr.push(null);
    }
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      const wd = date.getDay();
      if (wd >= 1 && wd <= 5) arr.push(date);
    }
    return arr;
  }, [cursor, monthStart, monthEnd]);

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

      <div className="flex items-center justify-center gap-3">
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
        <div className="font-semibold capitalize min-w-[180px] text-center">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </div>
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="grid grid-cols-5 gap-1 text-xs font-medium text-muted-foreground mb-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex"].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {dias.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = toISO(d);
            const items = byDay.get(key) ?? [];
            const isHoje = key === today;
            const fer = feriadoMap.get(key);
            const bg = fer?.tipo === "Municipal" ? "bg-orange-50" : fer ? "bg-rose-50" : "";
            const dot = fer?.tipo === "Municipal" ? "bg-orange-400" : fer ? "bg-rose-400" : "";
            return (
              <button
                key={i}
                onClick={() => {
                  if (fer || !canEdit) return;
                  setEditing(null);
                  setNovoData(key);
                  setNovoOpen(true);
                }}
                disabled={!!fer}
                className={cn(
                  "min-h-[110px] p-1.5 border rounded text-left text-xs transition",
                  bg,
                  fer ? "cursor-not-allowed opacity-70" : "hover:bg-muted/50",
                  isHoje ? "border-primary ring-1 ring-primary" : "",
                )}
                title={fer?.nome ?? ""}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${isHoje ? "text-primary" : ""}`}>{d.getDate()}</span>
                  {fer && <span className={`h-2 w-2 rounded-full ${dot}`} title={fer.nome} />}
                </div>
                {fer && <div className="text-[10px] text-muted-foreground truncate">{fer.nome}</div>}
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      role="button"
                      onClick={(e) => { e.stopPropagation(); if (canEdit) { setEditing(a); setNovoOpen(true); } }}
                      className={cn("rounded border px-1 py-0.5 text-[10px] leading-tight cursor-pointer", STATUS_CHIP[a.status])}
                    >
                      <div className="font-semibold truncate">{a.hora_inicio.slice(0, 5)} · {a.empresa_nome}</div>
                      <div className="truncate opacity-90">{a.executiva ?? "sem executiva"}</div>
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent></Card>

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
