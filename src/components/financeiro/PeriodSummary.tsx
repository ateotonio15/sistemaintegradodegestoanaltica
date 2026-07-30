import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PERIODOS_FIN } from "@/lib/financeiro-utils";

interface PeriodSummaryProps {
  countByPeriodo: Record<string, number>;
  selected: string | null;
  onSelect: (periodo: string | null) => void;
}

export function PeriodSummary({ countByPeriodo, selected, onSelect }: PeriodSummaryProps) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Resumo por período</h3>
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
            return (
              <button
                key={p}
                onClick={() => onSelect(isActive ? null : p)}
                className={cn(
                  "group relative rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : "bg-card text-card-foreground border-border/60 hover:bg-accent/60 hover:border-primary/40 hover:shadow-sm",
                )}
              >
                <p className={cn("text-[11px] font-medium", isActive ? "opacity-90" : "opacity-70")}>{p}</p>
                <p className="text-lg font-bold leading-tight tabular-nums">{count}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
