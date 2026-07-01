import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sb = supabase as any;

export type AcaoPreventivaTipo = "sinais_vitais" | "preventivo" | "psa";
export type AcaoPreventivaStatus = "a_confirmar" | "confirmado" | "concluido" | "cancelado";

export interface AcaoPreventiva {
  id: string;
  empresa_id: string;
  endereco: string | null;
  tipo: AcaoPreventivaTipo;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  responsavel: string | null;
  executiva_user_id: string | null;
  executiva_nome: string | null;
  observacao: string | null;
  status: AcaoPreventivaStatus;
  motivo_cancelamento: string | null;
  created_by: string | null;
  created_by_nome: string | null;
  updated_by: string | null;
  updated_by_nome: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome: string; endereco: string | null };
}

export function useAcoesPreventivasRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("acoes-preventivas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "acoes_preventivas" }, () => {
        qc.invalidateQueries({ queryKey: ["acoes_preventivas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export function useAcoesPreventivas(tipo?: AcaoPreventivaTipo, fromISO?: string, toISO?: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["acoes_preventivas", tipo ?? "", fromISO ?? "", toISO ?? ""],
    enabled: !loading && !!user && !!tipo,
    queryFn: async () => {
      let q = sb
        .from("acoes_preventivas")
        .select("*, empresa:empresas(id,nome,endereco)")
        .eq("tipo", tipo)
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true });
      if (fromISO) q = q.gte("data", fromISO);
      if (toISO) q = q.lte("data", toISO);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AcaoPreventiva[];
    },
  });
}

export function useExecutivas() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["executivas_list"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("user_roles")
        .select("user_id, profiles!inner(user_id, display_name, username)")
        .eq("role", "executivo");
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({
          user_id: r.user_id,
          display_name: r.profiles?.display_name ?? "—",
          username: r.profiles?.username ?? "",
        }))
        .sort((a: any, b: any) => a.display_name.localeCompare(b.display_name));
    },
  });
}

export function useEmpresasAtivas() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["empresas_ativas_simples"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("empresas")
        .select("id, nome, endereco")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; endereco: string | null }[];
    },
  });
}

export function useAcaoPreventivaMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const createMany = useMutation({
    mutationFn: async (payload: {
      datas: string[];
      base: Omit<Partial<AcaoPreventiva>, "data"> & { empresa_id: string; tipo: AcaoPreventivaTipo };
      userNome: string | null;
    }) => {
      const rows = payload.datas.map((d) => ({
        empresa_id: payload.base.empresa_id,
        endereco: payload.base.endereco ?? null,
        tipo: payload.base.tipo,
        data: d,
        horario_inicio: payload.base.horario_inicio ?? null,
        horario_fim: payload.base.horario_fim ?? null,
        responsavel: payload.base.responsavel ?? null,
        executiva_user_id: payload.base.executiva_user_id ?? null,
        executiva_nome: payload.base.executiva_nome ?? null,
        observacao: payload.base.observacao ?? null,
        status: payload.base.status ?? "a_confirmar",
        motivo_cancelamento: payload.base.motivo_cancelamento ?? null,
        created_by: user?.id ?? null,
        created_by_nome: payload.userNome,
        updated_by: user?.id ?? null,
        updated_by_nome: payload.userNome,
      }));
      const { data, error } = await sb.from("acoes_preventivas").insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any[]) => {
      qc.invalidateQueries({ queryKey: ["acoes_preventivas"] });
      toast.success(`${data?.length ?? 0} evento(s) criado(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar evento"),
  });

  const updateOne = useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<AcaoPreventiva>; userNome: string | null }) => {
      const patch: any = { ...payload.patch };
      delete patch.empresa;
      delete patch.created_at;
      delete patch.updated_at;
      patch.updated_by = user?.id ?? null;
      patch.updated_by_nome = payload.userNome;
      const { data, error } = await sb
        .from("acoes_preventivas")
        .update(patch)
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes_preventivas"] });
      toast.success("Evento atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("acoes_preventivas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes_preventivas"] });
      toast.success("Evento excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { createMany, updateOne, deleteOne };
}
