import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "destructive" | "muted";
}

const TONE: Record<string, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
  muted: "text-muted-foreground bg-muted",
};

export function KpiCard({ label, value, hint, icon, tone = "primary" }: KpiCardProps) {
  return (
    <Card className="relative flex items-center gap-3 overflow-hidden rounded-2xl border-border/60 bg-card/80 p-3.5 shadow-sm">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight tracking-tight">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
