import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sb = supabase as any;

export type PalestraStatus = "a_confirmar" | "confirmado" | "concluido" | "cancelado";
export type BloqueioPeriodo = "dia_todo" | "manha" | "tarde";

export interface Palestra {
  id: string;
  empresa_id: string;
  endereco: string;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  tema: string | null;
  observacao: string | null;
  status: PalestraStatus;
  motivo_cancelamento: string | null;
  executiva_user_id: string | null;
  executiva_nome: string | null;
  created_by: string | null;
  created_by_nome: string | null;
  updated_by: string | null;
  updated_by_nome: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome: string; endereco: string | null };
}

export interface Bloqueio {
  id: string;
  data: string;
  periodo: BloqueioPeriodo;
  motivo: string;
  created_by_nome: string | null;
  created_at: string;
  updated_at: string;
}

export function usePalestrasRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("palestras-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "palestras_saude" }, () => {
        qc.invalidateQueries({ queryKey: ["palestras"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "palestras_bloqueios" }, () => {
        qc.invalidateQueries({ queryKey: ["palestras_bloqueios"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export function usePalestras(fromISO: string, toISO: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["palestras", fromISO, toISO],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("palestras_saude")
        .select("*, empresa:empresas(id,nome,endereco)")
        .gte("data", fromISO)
        .lte("data", toISO)
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Palestra[];
    },
  });
}

export function useBloqueios(fromISO: string, toISO: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["palestras_bloqueios", fromISO, toISO],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("palestras_bloqueios")
        .select("*")
        .gte("data", fromISO)
        .lte("data", toISO)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bloqueio[];
    },
  });
}

export function usePalestraMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const createMany = useMutation({
    mutationFn: async (payload: {
      datas: string[];
      base: Omit<Partial<Palestra>, "data"> & { empresa_id: string; endereco: string };
      userNome: string | null;
    }) => {
      const rows = payload.datas.map((d) => ({
        empresa_id: payload.base.empresa_id,
        endereco: payload.base.endereco,
        data: d,
        horario_inicio: payload.base.horario_inicio ?? null,
        horario_fim: payload.base.horario_fim ?? null,
        tema: payload.base.tema ?? null,
        observacao: payload.base.observacao ?? null,
        status: payload.base.status ?? "a_confirmar",
        motivo_cancelamento: payload.base.motivo_cancelamento ?? null,
        executiva_user_id: payload.base.executiva_user_id ?? null,
        executiva_nome: payload.base.executiva_nome ?? null,
        created_by: user?.id ?? null,
        created_by_nome: payload.userNome,
        updated_by: user?.id ?? null,
        updated_by_nome: payload.userNome,
      }));
      const { data, error } = await sb.from("palestras_saude").insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any[]) => {
      qc.invalidateQueries({ queryKey: ["palestras"] });
      toast.success(`${data?.length ?? 0} palestra(s) criada(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar palestra"),
  });

  const updateOne = useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<Palestra>; userNome: string | null }) => {
      const patch: any = { ...payload.patch };
      delete patch.empresa;
      delete patch.created_at;
      delete patch.updated_at;
      patch.updated_by = user?.id ?? null;
      patch.updated_by_nome = payload.userNome;
      const { data, error } = await sb
        .from("palestras_saude")
        .update(patch)
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["palestras"] });
      toast.success("Palestra atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("palestras_saude").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["palestras"] });
      toast.success("Palestra excluída");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { createMany, updateOne, deleteOne };
}

export function useBloqueioMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsert = useMutation({
    mutationFn: async (payload: { id?: string; data: string; periodo: BloqueioPeriodo; motivo: string; userNome: string | null }) => {
      if (payload.id) {
        const { error } = await sb.from("palestras_bloqueios")
          .update({ data: payload.data, periodo: payload.periodo, motivo: payload.motivo })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("palestras_bloqueios").insert({
          data: payload.data, periodo: payload.periodo, motivo: payload.motivo,
          created_by: user?.id ?? null, created_by_nome: payload.userNome,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["palestras_bloqueios"] });
      toast.success("Bloqueio salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar bloqueio"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("palestras_bloqueios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["palestras_bloqueios"] });
      toast.success("Bloqueio removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return { upsert, remove };
}
