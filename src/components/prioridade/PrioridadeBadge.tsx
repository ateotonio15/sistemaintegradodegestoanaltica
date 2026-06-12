import { Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "default" | "pulsing" | "compact" | "fire";
  label?: string;
  /**
   * Quando true, força modo "intenso": fundo vermelho sólido, ícone de chama,
   * animação pulsante e ring para destacar empresas em prioridade cujo
   * período de movimentação está prestes a iniciar (≤ 1 dia) ou já em curso.
   */
  intense?: boolean;
}

export function PrioridadeBadge({ className, variant = "default", label, intense = false }: Props) {
  const Icon = intense || variant === "fire" ? Flame : Star;
  const text = label ?? (variant === "compact" ? "PRIORIDADE" : "PRIORIDADE MÁXIMA");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wide border",
        variant === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        intense
          ? "border-red-500 bg-red-600 text-white shadow-[0_0_0_0_rgba(239,68,68,0.7)] ring-2 ring-red-500/40 animate-pulse-priority"
          : "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400",
        !intense && variant === "pulsing" && "animate-pulse-priority shadow-[0_0_0_0_rgba(239,68,68,0.7)]",
        className
      )}
    >
      <Icon className={cn(variant === "compact" ? "h-3 w-3" : "h-3.5 w-3.5", "fill-current")} />
      {text}
    </span>
  );
}
