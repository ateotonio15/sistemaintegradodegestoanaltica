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
  { key: "totalEmpresas", label: "Total contratos", icon: Building2, accent: "text-primary", bg: "bg-primary/10" },
  { key: "totalPagadores", label: "Total pagadores", icon: Users, accent: "text-info", bg: "bg-info/10" },
  { key: "notasEnviadas", label: "Notas enviadas", icon: FileCheck, accent: "text-success", bg: "bg-success/10" },
  { key: "aguardandoNota", label: "Aguardando Emissão", icon: Clock, accent: "text-warning", bg: "bg-warning/10" },
  { key: "pendentes", label: "Pendentes", icon: AlertCircle, accent: "text-muted-foreground", bg: "bg-muted" },
  { key: "foraDoPrazo", label: "Fora do prazo", icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10" },
] as const;

export function KpiCards(props: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
      {items.map((item) => {
        const Icon = item.icon;
        const value = props[item.key];
        return (
          <Card
            key={item.key}
            className="group rounded-2xl border-border/60 shadow-sm card-hover overflow-hidden relative"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-105",
                item.bg
              )}>
                <Icon className={cn("h-5 w-5", item.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate font-medium">{item.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
