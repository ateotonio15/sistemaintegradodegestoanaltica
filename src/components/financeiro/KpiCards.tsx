import { Card, CardContent } from "@/components/ui/card";
import { Building2, FileCheck, Clock, AlertCircle, RefreshCw, BadgeCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  totalEmpresas: number;
  notasEnviadas: number;
  aguardandoNota: number;
  pendentes: number;
  emFaturamento: number;
  faturado: number;
  totalPagadores: number;
}

const items = [
  { key: "totalEmpresas", label: "Total contratos", icon: Building2, accent: "text-primary", bg: "bg-primary/10" },
  { key: "totalPagadores", label: "Total pagadores", icon: Users, accent: "text-info", bg: "bg-info/10" },
  { key: "notasEnviadas", label: "Notas enviadas", icon: FileCheck, accent: "text-success", bg: "bg-success/10" },
  { key: "aguardandoNota", label: "Aguardando Emissão", icon: Clock, accent: "text-warning", bg: "bg-warning/10" },
  { key: "pendentes", label: "Pendentes", icon: AlertCircle, accent: "text-muted-foreground", bg: "bg-muted" },
  { key: "emFaturamento", label: "Em faturamento", icon: RefreshCw, accent: "text-info", bg: "bg-info/10" },
  { key: "faturado", label: "Faturado", icon: BadgeCheck, accent: "text-success", bg: "bg-success/10" },
] as const;

export function KpiCards(props: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 min-[1750px]:grid-cols-7">
      {items.map((item) => {
        const Icon = item.icon;
        const value = props[item.key];
        return (
          <Card
            key={item.key}
            className="rounded-xl border-border/60 shadow-sm"
          >
            <CardContent className="p-3.5 flex items-center gap-2.5">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-border/60",
                item.bg
              )}>
                <Icon className={cn("h-5 w-5", item.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium leading-tight break-words">{item.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
