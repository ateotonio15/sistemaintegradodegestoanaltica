import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const ENDERECO_SAMEL = "Samel - Av. Joaquim Nabuco, 1550 - Centro";

export function EnderecoCombobox({
  value,
  onChange,
  opcoes,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal text-left", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || "Selecione ou digite o endereço"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar novo endereço..." value={busca} onValueChange={setBusca} />
          <CommandList>
            {(() => {
              const q = busca.trim().toLowerCase();
              const filtradas = q ? opcoes.filter((o) => o.toLowerCase().includes(q)) : opcoes;
              const podeCriar = !!busca.trim() && !opcoes.some((o) => o.toLowerCase() === q);
              return (
                <>
                  {!podeCriar && filtradas.length === 0 && <CommandEmpty>Nenhum endereço encontrado.</CommandEmpty>}
                  {podeCriar && (
                    <CommandGroup heading="Novo endereço">
                      <CommandItem
                        value={`__novo__${busca}`}
                        onSelect={() => { onChange(busca.trim()); setOpen(false); setBusca(""); }}
                      >
                        <Plus className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">Usar "{busca.trim()}"</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {filtradas.length > 0 && (
                    <CommandGroup heading="Endereços cadastrados">
                      {filtradas.map((o) => (
                        <CommandItem
                          key={o}
                          value={o}
                          onSelect={() => { onChange(o); setOpen(false); setBusca(""); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 shrink-0", value === o ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{o}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              );
            })()}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Lista de endereços sugeridos:
 * 1. Samel (sempre primeiro);
 * 2. Endereços das empresas cadastradas;
 * 3. Endereços já usados em corridas Uber, palestras e ações preventivas.
 */
export function useEnderecosSugeridos() {
  const { data: empresas = [] } = useQuery({
    queryKey: ["enderecos-sugeridos", "empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("endereco");
      if (error) throw error;
      return (data ?? []) as { endereco: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: historicos = [] } = useQuery({
    queryKey: ["enderecos-sugeridos", "historicos"],
    queryFn: async () => {
      const sb = supabase as any;
      const [uber, palestras, preventivas] = await Promise.all([
        sb.from("uber_corridas").select("origem, destino").order("created_at", { ascending: false }).limit(1000),
        sb.from("palestras_saude").select("endereco").order("created_at", { ascending: false }).limit(1000),
        sb.from("acoes_preventivas").select("endereco").order("created_at", { ascending: false }).limit(1000),
      ]);
      const out: string[] = [];
      (uber.data ?? []).forEach((c: any) => { if (c.origem) out.push(c.origem); if (c.destino) out.push(c.destino); });
      (palestras.data ?? []).forEach((p: any) => { if (p.endereco) out.push(p.endereco); });
      (preventivas.data ?? []).forEach((a: any) => { if (a.endereco) out.push(a.endereco); });
      return out;
    },
    staleTime: 60 * 1000,
  });

  return useMemo(() => {
    const set = new Set<string>();
    set.add(ENDERECO_SAMEL);
    empresas.forEach((e) => { if (e.endereco && e.endereco.trim()) set.add(e.endereco.trim()); });
    historicos.forEach((v) => { if (v && v.trim()) set.add(v.trim()); });
    const arr = Array.from(set);
    return [ENDERECO_SAMEL, ...arr.filter((a) => a !== ENDERECO_SAMEL).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [empresas, historicos]);
}
