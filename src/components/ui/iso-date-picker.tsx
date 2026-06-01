import * as React from "react";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR, todayLocalISO } from "@/lib/date-utils";

interface IsoDatePickerProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  id?: string;
  ariaInvalid?: boolean;
}

/**
 * Padrão visual de seleção de data do projeto (Popover + Calendar shadcn),
 * trabalhando com strings ISO local (YYYY-MM-DD) para evitar problemas de timezone.
 */
export function IsoDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "— Selecione —",
  className,
  buttonClassName,
  id,
  ariaInvalid,
}: IsoDatePickerProps) {
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid || undefined}
          className={cn(
            "w-full justify-start font-normal rounded-lg",
            !value && "text-muted-foreground",
            buttonClassName,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDateBR(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", className)} align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) {
              onChange(null);
              return;
            }
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${d}`);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Limpar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(todayLocalISO())}
            disabled={disabled}
          >
            Hoje
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
