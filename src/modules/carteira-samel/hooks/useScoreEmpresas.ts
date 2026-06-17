import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const KEY = ["carteira-samel", "score-empresas-incluidas"];

export function useScoreEmpresas() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cs_score_empresas" as any)
        .select("empresa_id, incluida_em");
      if (error) throw error;
      return (data ?? []) as unknown as { empresa_id: string; incluida_em: string }[];
    },
  });

  const addMany = useMutation({
    mutationFn: async (empresaIds: string[]) => {
      if (!empresaIds.length) return;
      const rows = empresaIds.map((empresa_id) => ({
        empresa_id,
        incluida_por: user?.id ?? null,
      }));
      const { error } = await supabase
        .from("cs_score_empresas" as any)
        .upsert(rows, { onConflict: "empresa_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Empresa(s) adicionada(s) ao Score de Risco");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao adicionar"),
  });

  const remove = useMutation({
    mutationFn: async (empresaId: string) => {
      const { error } = await supabase
        .from("cs_score_empresas" as any)
        .delete()
        .eq("empresa_id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Empresa removida do Score de Risco");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const ids = (list.data ?? []).map((r) => r.empresa_id);
  return { ids, idsSet: new Set(ids), loading: list.isLoading, addMany, remove };
}
