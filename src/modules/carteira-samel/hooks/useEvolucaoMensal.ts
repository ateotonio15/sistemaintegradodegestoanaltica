import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LancamentoMensal } from "../lib/evolucao-mensal";

const db = supabase as any;
const KEY = ["sinistralidade_mensal"];

export function useEvolucaoMensal() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db
        .from("sinistralidade_mensal")
        .select("*")
        .order("periodo", { ascending: false });
      if (error) throw error;
      return (data || []) as LancamentoMensal[];
    },
  });
}

export interface UpsertLancamento {
  id?: string;
  empresa_id: string;
  empresa_nome: string;
  periodo: string;
  premio_empresa: number;
  premio_continuidade: number;
  sinistro: number;
  observacao?: string | null;
}

export function useUpsertLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertLancamento | UpsertLancamento[]) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      const { error } = await db
        .from("sinistralidade_mensal")
        .upsert(rows, { onConflict: "empresa_id,periodo" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("sinistralidade_mensal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
