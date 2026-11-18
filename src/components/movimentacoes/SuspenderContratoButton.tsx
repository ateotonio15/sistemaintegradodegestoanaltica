import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SuspensaoDialog } from "@/components/empresas/SuspensaoDialog";

type Emp = { id: string; nome: string; codigo_contrato: string | null };

/** Escolhe um contrato ativo e abre a mesma janela de suspensão da aba Empresas. */
export function SuspenderContratoButton() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<Emp | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["empresas-para-suspender"], enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome, codigo_contrato")
        .eq("contrato_suspenso", false).neq("status_empresa", "Inativa").order("nome");
      if (error) throw error;
      return (data ?? []) as Emp[];
    },
  });
  return (
    <>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"><Ban className="h-3.5 w-3.5" />Suspender contrato</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar empresa ou contrato..." />
            <CommandList>
              <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
              {data.map((e) => (
                <CommandItem key={e.id} value={`${e.nome} ${e.codigo_contrato ?? ""}`} onSelect={() => { setSel(e); setAberto(false); }}>
                  <span className="truncate">{e.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">#{e.codigo_contrato ?? "—"}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {sel && (
        <SuspensaoDialog
          open={!!sel}
          onOpenChange={async (o) => {
            if (o) return;
            setSel(null);
            await supabase.rpc("processar_contratos_suspensos" as any);
            qc.invalidateQueries({ queryKey: ["suspensos-encaminhados"] });
            qc.invalidateQueries({ queryKey: ["empresas-para-suspender"] });
          }}
          empresa={{ id: sel.id, nome: sel.nome, contrato_suspenso: false, data_suspensao: null, motivo_suspensao: null, codigo_contrato: sel.codigo_contrato }}
        />
      )}
    </>
  );
}
