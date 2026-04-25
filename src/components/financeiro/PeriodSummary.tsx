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
    <Card className="rounded-xl shadow-sm">
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
                  "rounded-lg border px-3 py-2.5 text-left transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-card-foreground border-border hover:bg-accent hover:border-accent",
                )}
              >
                <p className="text-[11px] font-medium opacity-80">{p}</p>
                <p className="text-lg font-bold leading-tight">{count}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
