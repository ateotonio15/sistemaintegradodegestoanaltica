import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LancamentoMensal, META_PADRAO } from "../lib/evolucao-mensal";

const db = supabase as any;
const KEY = ["sinistralidade_mensal"];
const CFG_KEY = ["cs_carteira_config"];

export interface CarteiraConfig {
  empresa_id: string;
  meta_sinistralidade: number;
  usa_in_company: boolean;
}

/** Configuração (meta + in company) por empresa da carteira. */
export function useCarteiraConfig() {
  return useQuery({
    queryKey: CFG_KEY,
    queryFn: async () => {
      const { data, error } = await db.from("cs_carteira_config").select("*");
      if (error) throw error;
      const map: Record<string, CarteiraConfig> = {};
      (data || []).forEach((c: any) => {
        map[c.empresa_id] = {
          empresa_id: c.empresa_id,
          meta_sinistralidade: Number(c.meta_sinistralidade) || META_PADRAO,
          usa_in_company: !!c.usa_in_company,
        };
      });
      return map;
    },
  });
}

export function useUpsertCarteiraConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: CarteiraConfig) => {
      const { error } = await db
        .from("cs_carteira_config")
        .upsert(
          {
            empresa_id: cfg.empresa_id,
            meta_sinistralidade: cfg.meta_sinistralidade,
            usa_in_company: cfg.usa_in_company,
          },
          { onConflict: "empresa_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CFG_KEY });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

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

export interface GuiaLancamento {
  id: string;
  descricao?: string;
  valor: number;
  ajuste?: boolean;
}

export interface UpsertLancamento {
  id?: string;
  empresa_id: string;
  empresa_nome: string;
  periodo: string;
  premio_empresa: number;
  premio_continuidade: number;
  sinistro: number;
  meta_sinistralidade?: number;
  hm_in_company?: number;
  fisioterapia_in_company?: number;
  administrativo_in_company?: number;
  observacao?: string | null;
  guias?: GuiaLancamento[];
}


export function useUpsertLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertLancamento | UpsertLancamento[]) => {
      const rows = (Array.isArray(payload) ? payload : [payload]).map((r) => {
        const { id, ...rest } = r;
        return id ? { id, ...rest } : rest;
      });
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
