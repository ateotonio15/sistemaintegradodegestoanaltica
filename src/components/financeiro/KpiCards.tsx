import { Card, CardContent } from "@/components/ui/card";
import { Building2, FileCheck, Clock, AlertCircle, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  totalEmpresas: number;
  notasEnviadas: number;
  aguardandoNota: number;
  pendentes: number;
  foraDoPrazo: number;
  totalPagadores: number;
}

const items = [
  {
    key: "totalEmpresas",
    label: "Total contratos",
    icon: Building2,
    accent: "text-primary",
    bg: "bg-primary/10",
    bar: "bg-primary",
    glow: "from-primary/40",
    share: false,
  },
  {
    key: "totalPagadores",
    label: "Total pagadores",
    icon: Users,
    accent: "text-info",
    bg: "bg-info/10",
    bar: "bg-info",
    glow: "from-info/40",
    share: false,
  },
  {
    key: "notasEnviadas",
    label: "Notas enviadas",
    icon: FileCheck,
    accent: "text-success",
    bg: "bg-success/10",
    bar: "bg-success",
    glow: "from-success/40",
    share: true,
  },
  {
    key: "aguardandoNota",
    label: "Aguardando emissão",
    icon: Clock,
    accent: "text-warning",
    bg: "bg-warning/10",
    bar: "bg-warning",
    glow: "from-warning/40",
    share: true,
  },
  {
    key: "pendentes",
    label: "Pendentes",
    icon: AlertCircle,
    accent: "text-muted-foreground",
    bg: "bg-muted",
    bar: "bg-muted-foreground",
    glow: "from-muted-foreground/30",
    share: true,
  },
  {
    key: "foraDoPrazo",
    label: "Fora do prazo",
    icon: AlertTriangle,
    accent: "text-destructive",
    bg: "bg-destructive/10",
    bar: "bg-destructive",
    glow: "from-destructive/40",
    share: true,
  },
] as const;

export function KpiCards(props: KpiCardsProps) {
  const total = props.totalEmpresas || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
      {items.map((item) => {
        const Icon = item.icon;
        const value = props[item.key];
        const pct = item.share && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : null;

        return (
          <Card
            key={item.key}
            className="group relative overflow-hidden rounded-2xl border-border/60 bg-card/70 backdrop-blur-sm shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-border"
          >
            {/* faixa de acento superior */}
            <div className={cn("absolute inset-x-0 top-0 h-[3px] opacity-70 group-hover:opacity-100 transition-opacity", item.bar)} />
            {/* brilho difuso */}
            <div
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                item.glow,
              )}
            />

            <CardContent className="relative p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold leading-tight">
                  {item.label}
                </p>
                <div
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ring-1 ring-border/50 transition-transform duration-300 group-hover:scale-110",
                    item.bg,
                  )}
                >
                  <Icon className={cn("h-4 w-4", item.accent)} />
                </div>
              </div>

              <p className="mt-2 text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">
                {value}
              </p>

              <div className="mt-3 h-1 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", item.bar)}
                  style={{ width: pct === null ? "100%" : `${pct}%`, opacity: pct === null ? 0.35 : 0.9 }}
                />
              </div>
              <p className="mt-1.5 h-3 text-[10px] text-muted-foreground tabular-nums">
                {pct === null ? "" : `${pct}% do total`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
