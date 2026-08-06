import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  empty?: boolean;
  emptyLabel?: string;
  className?: string;
  /** altura da área do gráfico */
  height?: number;
}

export function ChartCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  empty,
  emptyLabel = "Sem dados no período",
  className,
  height = 260,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm backdrop-blur transition-colors hover:border-primary/30",
        className,
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center p-3">
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            <p className="text-[11px] text-muted-foreground/70">Ajuste os filtros para ver os dados</p>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
