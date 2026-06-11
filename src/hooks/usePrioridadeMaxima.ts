import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PrioridadeRegistro {
  id: string;
  empresa_id: string;
  motivo: string;
  observacoes: string | null;
  criado_por_user_id: string;
  criado_por_nome: string | null;
  criado_em: string;
  removido_por_user_id: string | null;
  removido_por_nome: string | null;
  removido_em: string | null;
  motivo_remocao: string | null;
  ativo: boolean;
}

export function usePrioridadesAtivas() {
  return useQuery({
    queryKey: ["prioridade-maxima", "ativas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresa_prioridade_maxima")
        .select("*")
        .is("removido_em", null);
      if (error) throw error;
      return (data ?? []) as PrioridadeRegistro[];
    },
  });
}

export function usePrioridadeHistorico(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["prioridade-maxima", "historico", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresa_prioridade_maxima")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrioridadeRegistro[];
    },
  });
}

export function usePrioridadeMaxima() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, isDiretora, isComum } = useAuth();
  const canManage = isAdmin || isDiretora || isComum;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prioridade-maxima"] });
    qc.invalidateQueries({ queryKey: ["empresas"] });
  };

  const marcar = useMutation({
    mutationFn: async (input: { empresa_id: string; motivo: string; observacoes?: string }) => {
      const { data, error } = await (supabase as any).rpc("marcar_prioridade_maxima", {
        p_empresa_id: input.empresa_id,
        p_motivo: input.motivo,
        p_observacoes: input.observacoes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Prioridade Máxima definida", description: "A empresa foi marcada com prioridade." });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (input: { empresa_id: string; motivo_remocao?: string }) => {
      const { error } = await (supabase as any).rpc("remover_prioridade_maxima", {
        p_empresa_id: input.empresa_id,
        p_motivo_remocao: input.motivo_remocao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Prioridade removida" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { canManage, marcar, remover };
}
