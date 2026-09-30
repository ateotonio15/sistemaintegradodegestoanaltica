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
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Resumo Geral por Período</h3>
          {selected && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSelect(null)}>
              Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PERIODOS_FIN.map((p) => {
            const isActive = selected === p;
            const count = countByPeriodo[p] || 0;
            return (
              <button
                key={p}
                onClick={() => onSelect(isActive ? null : p)}
                className={cn(
                  "rounded-xl border p-4 text-center transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                    : "border-border/60 bg-card text-card-foreground hover:bg-accent",
                )}
              >
                <p className="text-sm font-semibold">{p}</p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">{count} total</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
