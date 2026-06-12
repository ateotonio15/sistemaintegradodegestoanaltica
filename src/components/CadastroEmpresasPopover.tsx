import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { UserRound, Building2 } from "lucide-react";

interface Row {
  user_id: string;
  display_name: string;
  empresa_count: number;
}

export function CadastroEmpresasPopover() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["comum-users-empresa-count"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const sorted = [...data].sort((a, b) => b.empresa_count - a.empresa_count);
  const total = sorted.reduce((s, r) => s + (r.empresa_count || 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Empresas por usuário do Cadastro"
        >
          <UserRound className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Empresas por Cadastro</p>
            <p className="text-xs text-muted-foreground">Total: {total}</p>
          </div>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {isLoading && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Carregando...</p>
          )}
          {!isLoading && sorted.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum usuário.</p>
          )}
          {sorted.map((r) => (
            <div
              key={r.user_id}
              className="flex items-center justify-between px-4 py-2 hover:bg-accent/50"
            >
              <span className="text-sm truncate">{r.display_name}</span>
              <span className="text-sm font-semibold tabular-nums ml-2">{r.empresa_count}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
