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
  { key: "aguardandoNota", label: "Aguardando nota", icon: Clock, accent: "text-warning", bg: "bg-warning/10" },
  { key: "pendentes", label: "Pendentes", icon: AlertCircle, accent: "text-muted-foreground", bg: "bg-muted" },
  { key: "foraDoPrazo", label: "Fora do prazo", icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10" },
] as const;

export function KpiCards(props: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const value = props[item.key];
        return (
          <Card key={item.key} className="rounded-xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <Icon className={cn("h-5 w-5", item.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
