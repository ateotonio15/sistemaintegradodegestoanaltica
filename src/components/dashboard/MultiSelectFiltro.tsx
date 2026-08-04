import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFiltroProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  width?: string;
}

export function MultiSelectFiltro({
  label,
  options,
  selected,
  onChange,
  width = "w-[180px]",
}: MultiSelectFiltroProps) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const resumo =
    selected.length === 0
      ? `Todas as ${label.toLowerCase()}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selecionadas`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 justify-between text-xs font-normal", width)}>
          <span className="truncate">{resumo}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-0 pointer-events-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-medium">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
          >
            Limpar
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhuma opção</p>
          ) : (
            options.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/60"
              >
                <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
