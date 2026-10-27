import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { UberPassageiro, PassageiroForm } from "@/lib/uber-passageiros";

const QK = ["uber_passageiros"] as const;

export function useUberPassageiros() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("uber-passageiros-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "uber_passageiros" }, () => {
        qc.invalidateQueries({ queryKey: QK });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: QK,
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uber_passageiros" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as UberPassageiro[];
    },
  });
}

export function useUpsertPassageiro() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: PassageiroForm & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("uber_passageiros" as any).update(rest as any).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("uber_passageiros" as any)
        .insert({ ...rest, created_by: user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Passageiro salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar passageiro"),
  });
}

export function useDeletePassageiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("uber_passageiros" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Passageiro excluído. As corridas já registradas não foram alteradas.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir passageiro"),
  });
}
