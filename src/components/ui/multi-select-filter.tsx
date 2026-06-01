import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allLabel?: string;
  className?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção",
  allLabel = "Todos",
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const isAll = selected.length === 0;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10 px-3 hover:bg-accent/40",
            isAll && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isAll ? (
              <span className="truncate">{allLabel}</span>
            ) : selected.length <= 2 ? (
              <div className="flex gap-1 flex-wrap">
                {selected.map((value) => {
                  const opt = options.find((o) => o.value === value);
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="rounded-md px-1.5 py-0 text-xs font-normal"
                    >
                      {opt?.label ?? value}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <Badge
                variant="secondary"
                className="rounded-md px-1.5 py-0 text-xs font-normal"
              >
                {selected.length} selecionados
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isAll && (
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") clear();
                }}
                className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpar filtros"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="justify-center text-center text-xs text-muted-foreground cursor-pointer"
                  >
                    Limpar seleção
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
