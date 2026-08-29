import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GrupoFinanceiro {
  id: string;
  nome_grupo: string;
  vencimento_compartilhado: boolean;
  dia_vencimento: number | null;
  forma_pagamento_compartilhada: boolean;
  forma_pagamento: "DDA" | "Depósito" | null;
  observacao: string | null;
  status: "Ativo" | "Inativo";
  contrato_principal_empresa_id?: string | null;
}


export interface GrupoContrato {
  id: string;
  grupo_id: string;
  empresa_id: string;
  codigo_contrato: string | null;
  nome_empresa: string | null;
  cnpj: string | null;
  ativo: boolean;
}

/** Retorna o grupo financeiro ativo de uma empresa (se houver) e os contratos vinculados. */
export function useGrupoFinanceiro(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["grupo-financeiro", "empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: vinc } = await supabase
        .from("grupos_financeiros_contratos" as any)
        .select("grupo_id")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .maybeSingle();
      const grupoId = (vinc as any)?.grupo_id as string | undefined;
      if (!grupoId) return { grupo: null as GrupoFinanceiro | null, contratos: [] as GrupoContrato[] };

      const [{ data: grupo }, { data: contratos }] = await Promise.all([
        supabase.from("grupos_financeiros" as any).select("*").eq("id", grupoId).maybeSingle(),
        supabase
          .from("grupos_financeiros_contratos" as any)
          .select("*")
          .eq("grupo_id", grupoId)
          .eq("ativo", true)
          .order("nome_empresa"),
      ]);
      return {
        grupo: (grupo as any) as GrupoFinanceiro | null,
        contratos: ((contratos as any) ?? []) as GrupoContrato[],
      };
    },
    staleTime: 30_000,
  });
}

/** Retorna todos os grupos ativos (para filtros e seletores). */
export function useGruposFinanceirosAtivos() {
  return useQuery({
    queryKey: ["grupos-financeiros", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos_financeiros" as any)
        .select("*")
        .eq("status", "Ativo")
        .order("nome_grupo");
      if (error) throw error;
      return ((data as any) ?? []) as GrupoFinanceiro[];
    },
    staleTime: 60_000,
  });
}

/** Mapa empresa_id -> grupo (id + nome) — usado para badges/filtros na aba Financeiro. */
export function useEmpresaGrupoMap() {
  return useQuery({
    queryKey: ["grupo-financeiro", "empresa-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos_financeiros_contratos" as any)
        .select(
          "empresa_id, grupo_id, grupos_financeiros(nome_grupo, status, contrato_principal_empresa_id)",
        )
        .eq("ativo", true);
      if (error) throw error;
      const map = new Map<
        string,
        { grupo_id: string; nome_grupo: string; principal_empresa_id: string | null }
      >();
      for (const r of (data as any[]) ?? []) {
        const g = r?.grupos_financeiros;
        if (!g || g.status !== "Ativo") continue;
        map.set(r.empresa_id, {
          grupo_id: r.grupo_id,
          nome_grupo: g.nome_grupo,
          principal_empresa_id: g.contrato_principal_empresa_id ?? null,
        });
      }
      return map;
    },
    staleTime: 30_000,
  });
}

