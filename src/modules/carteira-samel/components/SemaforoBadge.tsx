import { cn } from "@/lib/utils";
import { corSemaforoClasses, Semaforo } from "../lib/risco";

export function SemaforoBadge({ semaforo, label, className }: { semaforo: Semaforo; label?: string; className?: string }) {
  const c = corSemaforoClasses(semaforo);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", c.bg, c.text, c.border, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label ?? semaforo}
    </span>
  );
}
