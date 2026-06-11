import { Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "default" | "pulsing" | "compact" | "fire";
  label?: string;
}

export function PrioridadeBadge({ className, variant = "default", label }: Props) {
  const Icon = variant === "fire" ? Flame : Star;
  const text = label ?? (variant === "compact" ? "PRIORIDADE" : "PRIORIDADE MÁXIMA");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold uppercase tracking-wide",
        variant === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        variant === "pulsing" && "animate-pulse-priority shadow-[0_0_0_0_rgba(239,68,68,0.7)]",
        className
      )}
    >
      <Icon className={cn(variant === "compact" ? "h-3 w-3" : "h-3.5 w-3.5", "fill-current")} />
      {text}
    </span>
  );
}
