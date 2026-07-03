import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmpresasAtivas } from "@/hooks/useAgendamentosPlantao";

interface Props {
  value: string | null;
  onChange: (id: string | null, nome: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
}

export function EmpresaAutocomplete({ value, onChange, placeholder = "Selecione a empresa", allowClear = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: empresas = [], isLoading } = useEmpresasAtivas();
  const sel = empresas.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", className)}>
          <span className="truncate">{sel?.nome ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>{isLoading ? "Carregando..." : "Nenhuma empresa"}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem onSelect={() => { onChange(null, null); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  Todas
                </CommandItem>
              )}
              {empresas.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.nome}
                  onSelect={() => { onChange(e.id, e.nome); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === e.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{e.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
