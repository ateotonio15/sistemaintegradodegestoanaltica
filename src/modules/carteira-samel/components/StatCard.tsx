import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, hint, className }: { icon?: LucideIcon; label: string; value: React.ReactNode; hint?: string; className?: string }) {
  return (
    <Card className={cn("p-4 flex items-start gap-3", className)}>
      {Icon ? (
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tracking-tight truncate">{value}</div>
        {hint ? <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div> : null}
      </div>
    </Card>
  );
}
