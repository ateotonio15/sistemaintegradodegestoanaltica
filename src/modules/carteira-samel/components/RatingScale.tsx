import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { useState } from "react";

export function RatingScale({
  value,
  onChange,
  max = 5,
  minLabel = "Insatisfatório",
  maxLabel = "Excelente",
  readOnly,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const filled = n <= active;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(n)}
              onMouseEnter={() => !readOnly && setHover(n)}
              onMouseLeave={() => !readOnly && setHover(null)}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              className={cn(
                "p-1 rounded-md transition-transform",
                !readOnly && "hover:scale-110",
                readOnly && "cursor-default"
              )}
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-colors",
                  filled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-transparent text-muted-foreground/40"
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
