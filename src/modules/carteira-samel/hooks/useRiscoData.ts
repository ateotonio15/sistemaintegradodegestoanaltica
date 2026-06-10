import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classificarSinistralidade, classificarRenovacao, scoreCompleto, Semaforo } from "../lib/risco";

const db = supabase as any;

export function useHistoricoSinistralidade(empresa?: string) {
  return useQuery({
    queryKey: ["cs_sinistralidade_historico", empresa],
    queryFn: async () => {
      let q = db.from("cs_sinistralidade_historico").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
      if (empresa) q = q.eq("empresa", empresa);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUltimaSinistralidade(empresa: string) {
  return useQuery({
    queryKey: ["cs_sinistralidade_ultima", empresa],
    queryFn: async () => {
      const { data } = await db
        .from("cs_sinistralidade_historico")
        .select("*")
        .eq("empresa", empresa)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any | null;
    },
    enabled: !!empresa,
  });
}

export function useSinistralidadeMediaEmpresa(empresa: string) {
  return useQuery({
    queryKey: ["cs_sinistralidade_media", empresa],
    queryFn: async () => {
      const { data } = await db
        .from("cs_sinistralidade_historico")
        .select("sinistralidade,ano,mes")
        .eq("empresa", empresa)
        .order("ano", { ascending: false })
        .limit(12);
      const arr = (data || []).map((r: any) => Number(r.sinistralidade)).filter((n: number) => !isNaN(n));
      if (!arr.length) return null;
      return arr.reduce((s: number, n: number) => s + n, 0) / arr.length;
    },
    enabled: !!empresa,
  });
}

export function useAvaliacaoEmpresa(empresaId: string) {
  return useQuery({
    queryKey: ["cs_avaliacao", empresaId],
    queryFn: async () => {
      const { data } = await db
        .from("cs_avaliacao_risco")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("data_avaliacao", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any | null;
    },
    enabled: !!empresaId,
  });
}

export function useUpsertSinistralidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; empresa: string; contrato?: string; mes: string; ano: number; sinistralidade: number; percentual_reajuste?: number; indexador?: string; observacao?: string; created_by?: string }) => {
      if (payload.id) {
        const { error } = await db.from("cs_sinistralidade_historico").update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("cs_sinistralidade_historico").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_historico"] });
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_ultima"] });
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_media"] });
    },
  });
}

export function useDeleteSinistralidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("cs_sinistralidade_historico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_historico"] });
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_ultima"] });
      qc.invalidateQueries({ queryKey: ["cs_sinistralidade_media"] });
    },
  });
}

export function useAvaliacoesExecutiva(empresa: string) {
  return useQuery({
    queryKey: ["cs_avaliacoes_executiva", empresa],
    queryFn: async () => {
      const { data } = await db
        .from("cs_avaliacoes_executiva")
        .select("*")
        .eq("empresa", empresa)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!empresa,
  });
}

export function useSalvarAvaliacaoExecutiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; empresa: string; contrato?: string; relacionamento?: string; satisfacao?: string; observacao?: string; created_by?: string }) => {
      if (payload.id) {
        const { error } = await db.from("cs_avaliacoes_executiva").update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("cs_avaliacoes_executiva").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cs_avaliacoes_executiva"] }),
  });
}

export function useDeleteAvaliacaoExecutiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("cs_avaliacoes_executiva").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cs_avaliacoes_executiva"] }),
  });
}

export function recalcularAvaliacaoSemaforos(args: {
  sinistralidadeMedia: number | null;
  vigenciaISO: string;
  reclamacoes?: Semaforo;
  relacionamento?: Semaforo;
  satisfacao?: Semaforo;
}): { sin: Semaforo; ren: Semaforo; total: number; classificacao: string } {
  const sin = classificarSinistralidade(args.sinistralidadeMedia ?? undefined);
  const ren = classificarRenovacao(args.vigenciaISO);
  const res = scoreCompleto({
    sinistralidade: sin,
    reclamacoes: args.reclamacoes || "Verde",
    relacionamento: args.relacionamento || "Verde",
    satisfacao: args.satisfacao || "Verde",
    renovacao: ren,
  });
  return { sin, ren, total: res.total, classificacao: res.classificacao };
}
