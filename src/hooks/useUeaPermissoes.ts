import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface UeaPermissao {
  user_id: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
}

const KEY_MINHA = ["uea-permissao-atual"];
const KEY_TODAS = ["uea-permissoes"];

/**
 * Permissão individual do usuário logado para o módulo Dependentes UEA.
 * Administradores mantêm o acesso total já previsto no sistema.
 */
export function useMinhaPermissaoUea() {
  const { user, isAdmin, loading } = useAuth();
  const query = useQuery({
    queryKey: [...KEY_MINHA, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UeaPermissao | null> => {
      const { data, error } = await supabase
        .from("uea_permissoes")
        .select("user_id, pode_visualizar, pode_editar")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UeaPermissao | null) ?? null;
    },
  });

  const p = query.data;
  const canEditarUea = isAdmin || !!p?.pode_editar;
  const canVerUea = canEditarUea || !!p?.pode_visualizar;

  return {
    canVerUea,
    canEditarUea,
    isLoading: loading || (!!user?.id && query.isLoading),
  };
}

/** Permissões de todos os usuários (tela de Usuários, somente admin). */
export function useUeaPermissoes(enabled = true) {
  return useQuery({
    queryKey: KEY_TODAS,
    enabled,
    queryFn: async (): Promise<Record<string, UeaPermissao>> => {
      const { data, error } = await supabase
        .from("uea_permissoes")
        .select("user_id, pode_visualizar, pode_editar");
      if (error) throw error;
      const map: Record<string, UeaPermissao> = {};
      ((data ?? []) as UeaPermissao[]).forEach((p) => (map[p.user_id] = p));
      return map;
    },
  });
}

export function useSalvarPermissaoUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      userId,
      pode_visualizar,
      pode_editar,
    }: {
      userId: string;
      pode_visualizar: boolean;
      pode_editar: boolean;
    }) => {
      const { error } = await supabase
        .from("uea_permissoes")
        .upsert(
          { user_id: userId, pode_visualizar: pode_visualizar || pode_editar, pode_editar },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_TODAS });
      qc.invalidateQueries({ queryKey: KEY_MINHA });
    },
    onError: (e: any) =>
      toast({
        title: "Erro ao salvar permissões de Dependentes UEA",
        description: e.message,
        variant: "destructive",
      }),
  });
}
