import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { emptyToNull, type Demanda, type ImportacaoLote } from "@/lib/demandas-utils";

const QK_DEMANDAS = ["demandas"] as const;
const QK_IMPORTACOES = ["importacoes"] as const;

export function useDemandas() {
  const { user, loading, isExecutivoExterno } = useAuth();
  return useQuery({
    queryKey: [...QK_DEMANDAS, isExecutivoExterno ? `own:${user?.id ?? ""}` : "all"],
    enabled: !loading && !!user,
    queryFn: async () => {
      let query = supabase
        .from("demandas")
        .select("*")
        .order("data_reclamacao", { ascending: false })
        .order("created_at", { ascending: false });
      if (isExecutivoExterno && user?.id) {
        query = query.eq("created_by", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Demanda[];
    },
  });
}

export function useImportacoes() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: QK_IMPORTACOES,
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ImportacaoLote[];
    },
  });
}

export function useCreateDemanda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<Demanda>) => {
      const row = emptyToNull({
        ...payload,
        created_by: user?.id ?? null,
      });
      const { data, error } = await supabase
        .from("demandas")
        .insert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data as Demanda;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_DEMANDAS }),
  });
}

export function useUpdateDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Demanda> }) => {
      const row = emptyToNull(patch);
      const { data, error } = await supabase
        .from("demandas")
        .update(row as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Demanda;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_DEMANDAS }),
  });
}

export function useDeleteDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demandas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK_DEMANDAS }); qc.invalidateQueries({ queryKey: ["plantoes_atendimentos"] }); qc.invalidateQueries({ queryKey: ["plantoes"] }); },
  });
}

export function useDeleteImportacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // ON DELETE CASCADE remove as demandas vinculadas
      const { error } = await supabase.from("importacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_DEMANDAS });
      qc.invalidateQueries({ queryKey: QK_IMPORTACOES });
    },
  });
}

export function useImportDemandasLote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      nomeArquivo,
      registros,
      importadoPorNome,
    }: {
      nomeArquivo: string;
      registros: Partial<Demanda>[];
      importadoPorNome: string | null;
    }) => {
      const { data: lote, error: errLote } = await supabase
        .from("importacoes")
        .insert({
          nome_arquivo: nomeArquivo,
          total_registros: registros.length,
          importado_por: user?.id ?? null,
          importado_por_nome: importadoPorNome,
        })
        .select()
        .single();
      if (errLote) throw errLote;

      const rows = registros.map((r) =>
        emptyToNull({
          ...r,
          importacao_id: lote.id,
          created_by: user?.id ?? null,
        }),
      );

      // Insere em lotes de 200 para evitar payload grande e identificar erros
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error: errIns } = await supabase.from("demandas").insert(slice as any);
        if (errIns) {
          await supabase.from("importacoes").delete().eq("id", lote.id);
          throw new Error(
            `Falha no lote ${i + 1}-${i + slice.length}: ${errIns.message}${
              errIns.details ? " — " + errIns.details : ""
            }`,
          );
        }
      }
      return lote as ImportacaoLote;

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_DEMANDAS });
      qc.invalidateQueries({ queryKey: QK_IMPORTACOES });
    },
  });
}
