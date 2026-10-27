import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface UberCorrida {
  id: string;
  data: string;
  horario: string | null;
  colaborador: string;
  passageiro_id: string | null;
  origem: string | null;
  destino: string | null;
  motivo: string | null;
  tipo: string | null;
  empresa: string | null;
  forma_pagamento: string | null;
  responsavel: string | null;
  criado_por: string | null;
  valor: number;
  tem_reembolso: boolean;
  valor_reembolso: number;
  reembolso: number;
  cancelada: boolean;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

const QK = ["uber_corridas"] as const;

export function useUberCorridas() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("uber-corridas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "uber_corridas" }, () => {
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
        .from("uber_corridas" as any)
        .select("*")
        .order("data", { ascending: false })
        .order("horario", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UberCorrida[];
    },
  });
}

export function useUpsertCorrida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<UberCorrida> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("uber_corridas" as any).update(rest).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("uber_corridas" as any).insert(rest as any).select("id").single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["uber-enderecos-usados"] });
      toast.success("Corrida salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useDeleteCorrida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("uber_corridas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Corrida excluída");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}

export function useImportCorridasLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<UberCorrida>[]) => {
      if (!rows.length) return 0;
      const chunkSize = 200;
      let total = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("uber_corridas" as any).insert(chunk as any);
        if (error) throw error;
        total += chunk.length;
      }
      return total;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["uber-enderecos-usados"] });
      toast.success(`${n} corrida(s) importada(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao importar"),
  });
}
