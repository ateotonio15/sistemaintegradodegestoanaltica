import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PERIODOS_FIN } from "@/lib/financeiro-utils";
import { CalendarRange } from "lucide-react";

interface PeriodSummaryProps {
  countByPeriodo: Record<string, number>;
  selected: string | null;
  onSelect: (periodo: string | null) => void;
}

export function PeriodSummary({ countByPeriodo, selected, onSelect }: PeriodSummaryProps) {
  const total = PERIODOS_FIN.reduce((acc, p) => acc + (countByPeriodo[p] || 0), 0);
  const max = Math.max(1, ...PERIODOS_FIN.map((p) => countByPeriodo[p] || 0));

  return (
    <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur-sm shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-border/50">
              <CalendarRange className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-none">Resumo por período</h3>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                {total} contrato(s) distribuídos por faixa de movimentação
              </p>
            </div>
          </div>
          {selected && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSelect(null)}>
              Limpar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {PERIODOS_FIN.map((p) => {
            const isActive = selected === p;
            const count = countByPeriodo[p] || 0;
            const pct = Math.round((count / max) * 100);
            return (
              <button
                key={p}
                onClick={() => onSelect(isActive ? null : p)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : "bg-background/40 text-card-foreground border-border/60 hover:bg-accent/50 hover:border-primary/40 hover:shadow-sm",
                )}
              >
                <p className={cn("text-[10px] font-semibold uppercase tracking-wide", isActive ? "opacity-90" : "text-muted-foreground")}>
                  {p}
                </p>
                <p className="text-xl font-bold leading-tight tabular-nums mt-0.5">{count}</p>
                <div className={cn("mt-2 h-1 w-full rounded-full overflow-hidden", isActive ? "bg-primary-foreground/25" : "bg-muted/70")}>
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", isActive ? "bg-primary-foreground/80" : "bg-primary/70")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
