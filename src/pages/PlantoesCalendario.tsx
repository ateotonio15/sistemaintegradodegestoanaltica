import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlantoes, usePlantoesRealtime } from "@/hooks/usePlantoes";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

export default function PlantoesCalendario() {
  usePlantoesRealtime();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const { data: plantoes = [] } = usePlantoes({ from: fmt(monthStart), to: fmt(monthEnd) });

  const byDay = useMemo(() => {
    const m = new Map<string, typeof plantoes>();
    for (const p of plantoes) {
      const arr = m.get(p.data) ?? [];
      arr.push(p);
      m.set(p.data, arr);
    }
    return m;
  }, [plantoes]);

  const dias: (Date | null)[] = [];
  const firstWeekday = monthStart.getDay();
  for (let i = 0; i < firstWeekday; i++) dias.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) dias.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const [selected, setSelected] = useState<string | null>(null);
  const selectedList = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold capitalize">
            {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </div>
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div />
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
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`min-h-[70px] p-1 border rounded text-left text-xs hover:bg-muted/50 ${isSel ? "ring-2 ring-primary" : ""}`}
              >
                <div className="font-semibold">{d.getDate()}</div>
                {items.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] mt-1">{items.length} plantão{items.length > 1 ? "s" : ""}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      {selected && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="font-semibold">Plantões em {new Date(selected + "T00:00:00").toLocaleDateString("pt-BR")}</div>
          {selectedList.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum plantão neste dia.</div>
          ) : selectedList.map((p) => (
            <Link key={p.id} to={`/plantoes/${p.id}/atendimentos`} className="block border rounded p-2 hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.empresa?.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.turno} · {p.plantonista || "sem plantonista"}</div>
                </div>
                <Badge variant="outline">{p.atendimentos_count} atend.</Badge>
              </div>
            </Link>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
