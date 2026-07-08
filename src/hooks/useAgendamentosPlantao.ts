import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AgendamentoStatus = "a_confirmar" | "confirmado" | "concluido" | "cancelado";

export interface AgendamentoPlantao {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM[:SS]
  hora_fim: string;
  executiva: string | null;
  status: AgendamentoStatus;
  observacao: string | null;
  motivo_cancelamento: string | null;
  criado_por: string | null;
  editado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendamentoInput {
  empresa_id: string;
  empresa_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  executiva: string | null;
  status: AgendamentoStatus;
  observacao?: string | null;
  motivo_cancelamento?: string | null;
}

const KEY = ["agendamentos_plantao"] as const;

export function useAgendamentosPlantao(range?: { from: string; to: string }) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...KEY, range?.from ?? "all", range?.to ?? "all"],
    enabled: !loading && !!user,
    queryFn: async () => {
      let q = supabase.from("agendamentos_plantao").select("*").order("data").order("hora_inicio");
      if (range) q = q.gte("data", range.from).lte("data", range.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AgendamentoPlantao[];
    },
  });
}

export function useAgendamentosRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("agendamentos_plantao")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos_plantao" }, () => {
        qc.invalidateQueries({ queryKey: KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export function useAgendamentoMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const authorName = async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    return data?.display_name || user.email || null;
  };

  const createMany = useMutation({
    mutationFn: async ({ base, datas }: { base: Omit<AgendamentoInput, "data">; datas: string[] }) => {
      const author = await authorName();
      const rows = datas.map((d) => ({ ...base, data: d, criado_por: author, editado_por: author }));
      const { error } = await supabase.from("agendamentos_plantao").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Agendamento(s) criado(s)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AgendamentoInput> }) => {
      const author = await authorName();
      const { error } = await supabase
        .from("agendamentos_plantao")
        .update({ ...patch, editado_por: author })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Agendamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agendamentos_plantao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Agendamento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { createMany, update, remove };
}

// Empresas para autocomplete
export function useEmpresasAtivas() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["empresas_ativas_plantao"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome")
        .is("data_rescisao", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Executivas: perfis com role interno (comum/executivo/coordenadora)
export function useExecutivas() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["executivas_plantao"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data: roles, error: e1 } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "comum", "executivo", "coordenadora"]);
      if (e1) throw e1;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      if (e2) throw e2;
      const nomes = new Set<string>();
      (profs ?? []).forEach((p) => {
        const nome = p.display_name;
        if (nome) nomes.add(nome);
      });
      return Array.from(nomes).sort();
    },
    staleTime: 1000 * 60 * 5,
  });
}
