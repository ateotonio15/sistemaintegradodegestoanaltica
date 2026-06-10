import { cn } from "@/lib/utils";

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
  return (
    <div>
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(n)}
              className={cn(
                "h-10 w-10 rounded-lg border text-sm font-semibold transition-all",
                selected
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-background hover:bg-accent border-border",
                readOnly && "opacity-70 cursor-default"
              )}
            >
              {n}
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
