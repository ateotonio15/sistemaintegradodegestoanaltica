import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface UberFuncao {
  id: string;
  nome: string;
  ativo: boolean;
}

const QK = ["uber_funcoes"] as const;

export function useUberFuncoes() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: QK,
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("uber_funcoes" as any).select("id,nome,ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as UberFuncao[];
    },
  });
}

export function useSalvarFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { id?: string; nome?: string; ativo?: boolean }) => {
      const { id, ...rest } = f;
      if (rest.nome !== undefined) {
        rest.nome = rest.nome.trim();
        if (!rest.nome) throw new Error("Informe o nome da função.");
      }
      const q = id
        ? supabase.from("uber_funcoes" as any).update({ ...rest, updated_at: new Date().toISOString() } as any).eq("id", id)
        : supabase.from("uber_funcoes" as any).insert(rest as any);
      const { error } = await q;
      if (error) {
        if ((error as any).code === "23505") throw new Error("Já existe uma função com esse nome.");
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar função"),
  });
}
