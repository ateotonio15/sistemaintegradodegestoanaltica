import { cn } from "@/lib/utils";
import { Bike, MapPin } from "lucide-react";

interface Props {
  diasRestantes: number; // 0 = hoje, 1 = amanhã, etc.
  className?: string;
  showLabel?: boolean;
}

/**
 * Animação discreta: moto percorre uma linha de progresso em direção ao destino.
 * Quanto menor o número de dias, mais próxima a moto fica do 📍.
 */
export function HondaMotoProgress({ diasRestantes, className, showLabel = false }: Props) {
  // Mapeia D-7+ → 0% ... D-0 → 100%
  const clamped = Math.max(0, Math.min(7, diasRestantes));
  const progress = ((7 - clamped) / 7) * 100;

  const urgent = diasRestantes <= 1;

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="relative flex-1 h-6 min-w-[120px]">
        {/* Trilha */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/70" />
        {/* Marco final */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        {/* Moto */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out motion-reduce:transition-none",
            urgent ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" : "text-foreground/80",
          )}
          style={{ left: `${progress}%` }}
          aria-hidden
        >
          <Bike className={cn("h-5 w-5", urgent && "animate-pulse")} />
        </div>
      </div>
      {showLabel && (
        <span className={cn("text-xs tabular-nums", urgent ? "text-primary font-medium" : "text-muted-foreground")}>
          {diasRestantes < 0
            ? `${Math.abs(diasRestantes)}d atrasado`
            : diasRestantes === 0
            ? "Hoje"
            : diasRestantes === 1
            ? "Amanhã"
            : `${diasRestantes}d`}
        </span>
      )}
    </div>
  );
}
