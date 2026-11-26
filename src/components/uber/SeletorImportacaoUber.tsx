import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SeletorImportacaoUber({ label, value, opcoes, onChange, obrigatorio = false, disabled = false }: {
  label: string; value: string; opcoes: { value: string; label: string }[]; onChange: (s: string) => void; obrigatorio?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label={label} disabled={disabled}
      className={cn("w-full min-w-40 justify-between font-normal", obrigatorio && !value && "border-destructive", !value && "text-muted-foreground")}>
      <span className="truncate">{opcoes.find(o => o.value === value)?.label || value || label}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" />
    </Button></PopoverTrigger>
    <PopoverContent className="w-72 p-0" align="start"><Command>
      <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} /><CommandList><CommandEmpty>Nenhum resultado.</CommandEmpty>
      <CommandGroup><CommandItem value="__limpar" onSelect={() => { onChange(""); setOpen(false); }}>Limpar seleção</CommandItem>
        {opcoes.map(o => <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => { onChange(o.value); setOpen(false); }}>{o.label}</CommandItem>)}
      </CommandGroup></CommandList></Command></PopoverContent>
  </Popover>;
}