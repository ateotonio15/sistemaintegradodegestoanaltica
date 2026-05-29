import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DayGridPickerProps {
  value: number | null | undefined;
  onChange: (day: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Day selector (1-31) rendered as a calendar-like 7-column grid inside a popover.
 * Used for monthly billing day fields (emissão, vencimento).
 */
export function DayGridPicker({
  value,
  onChange,
  placeholder = "Selecione o dia",
  allowClear = true,
  invalid,
  disabled,
  className,
}: DayGridPickerProps) {
  const [open, setOpen] = useState(false);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handlePick = (d: number) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
            className,
          )}
        >
          {value ? String(value).padStart(2, "0") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => handlePick(d)}
                className={cn(
                  "h-9 w-9 rounded-md text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  selected
                    ? "border border-primary text-primary font-semibold bg-primary/5"
                    : "text-foreground",
                )}
              >
                {String(d).padStart(2, "0")}
              </button>
            );
          })}
        </div>
        {allowClear && (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
