import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Mic, ShieldPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgendamentoDialog } from "@/components/saude/AgendamentoDialog";
import { useSaudeAgendamentos, useSaudeMutations, useSaudeRealtime, type SaudeAgendamento, type SaudeCategoria } from "@/hooks/useSaude";
import { useAuth } from "@/hooks/useAuth";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmt(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const statusColor: Record<string, string> = {
  agendado: "bg-blue-500/15 text-blue-600",
  confirmado: "bg-purple-500/15 text-purple-600",
  realizado: "bg-green-500/15 text-green-600",
  cancelado: "bg-red-500/15 text-red-600",
};

export default function SaudeCalendario({ categoria }: { categoria: SaudeCategoria }) {
  useSaudeRealtime();
  const { isAdmin, isEnfermeira } = useAuth();
  const canEdit = isAdmin || isEnfermeira;
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const { data: agendamentos = [] } = useSaudeAgendamentos(categoria, { from: fmt(monthStart), to: fmt(monthEnd) });
  const { deleteAgendamento } = useSaudeMutations();
  const [selected, setSelected] = useState<string | null>(null);
  const [dlg, setDlg] = useState(false);
  const [edit, setEdit] = useState<SaudeAgendamento | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, SaudeAgendamento[]>();
    for (const a of agendamentos) {
      const arr = m.get(a.data) ?? [];
      arr.push(a);
      m.set(a.data, arr);
    }
    return m;
  }, [agendamentos]);

  const dias: (Date | null)[] = [];
  const firstWeekday = monthStart.getDay();
  for (let i = 0; i < firstWeekday; i++) dias.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) dias.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const selectedList = selected ? byDay.get(selected) ?? [] : [];
  const Icon = categoria === "palestra" ? Mic : ShieldPlus;
  const titulo = categoria === "palestra" ? "Calendário de Palestras" : "Calendário de Ações Preventivas";
  const subtitulo = categoria === "palestra"
    ? "Agenda de palestras nas empresas"
    : "Programação de ações preventivas";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{subtitulo}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { setEdit(null); setDlg(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold capitalize min-w-[180px] text-center">
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dias.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = fmt(d);
            const items = byDay.get(key) ?? [];
            const isSel = selected === key;
            const isToday = key === fmt(new Date());
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`min-h-[80px] p-1.5 border rounded text-left text-xs hover:bg-muted/50 transition-colors ${isSel ? "ring-2 ring-primary" : ""} ${isToday ? "border-primary/50" : ""}`}
              >
                <div className={`font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 2).map((it) => (
                    <div key={it.id} className="truncate text-[10px] bg-primary/10 text-primary px-1 rounded">
                      {it.hora_inicio.slice(0, 5)} {it.empresa?.nome ?? ""}
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{items.length - 2}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      {selected && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="font-semibold">
            {new Date(selected + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
          {selectedList.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</div>
          ) : selectedList.map((a) => (
            <div key={a.id} className="border rounded p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.empresa?.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {a.hora_inicio.slice(0, 5)} – {a.hora_fim.slice(0, 5)} · {a.tipo_palestra}
                </div>
                {a.endereco_empresa && (
                  <div className="text-xs text-muted-foreground truncate">{a.endereco_empresa}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColor[a.status] ?? ""}>{a.status}</Badge>
                {canEdit && (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(a); setDlg(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm("Remover este agendamento?")) deleteAgendamento.mutate(a.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}

      <AgendamentoDialog open={dlg} onOpenChange={setDlg} agendamento={edit} categoria={categoria} />
    </div>
  );
}
