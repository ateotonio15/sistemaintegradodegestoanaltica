import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pendenciaEmAberto, type ContratoProcessoPendencia } from "@/lib/contrato-processo";
import type { ValidacaoCruzadaRow, ValidacaoItem } from "@/lib/validacao-cruzada";

/** Itens já registrados da validação cruzada de um processo. */
export function useValidacaoCruzada(processoId?: string | null) {
  return useQuery({
    queryKey: ["contrato-validacao-cruzada", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_validacoes_cruzadas" as any)
        .select("*")
        .eq("processo_id", processoId)
        .order("criticidade", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ValidacaoCruzadaRow[];
    },
  });
}

/**
 * Executa a validação cruzada: grava as comparações, cria as pendências das
 * divergências no setor adequado e registra no histórico do processo.
 */
export function useExecutarValidacaoCruzada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { processoId: string; itens: ValidacaoItem[] }) => {
      const { data, error } = await supabase.rpc("executar_validacao_cruzada" as any, {
        p_processo_id: input.processoId,
        p_itens: input.itens as any,
      });
      if (error) throw error;
      return data as unknown as { divergencias: number; criticas: number; pendencias_criadas: number };
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["contrato-validacao-cruzada", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-pendencias", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-historico", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-impl"] });
    },
  });
}

/**
 * Divergências críticas ainda não analisadas impedem a conclusão do contrato.
 * Uma divergência crítica deixa de bloquear quando a pendência gerada é
 * resolvida ou cancelada.
 */
export function useBloqueioValidacaoCruzada(processoId?: string | null) {
  const { data: itens = [] } = useValidacaoCruzada(processoId);
  const { data: pendencias = [] } = useQuery({
    queryKey: ["contrato-processo-pendencias", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_processo_pendencias" as any)
        .select("*")
        .eq("processo_id", processoId);
      if (error) throw error;
      return (data ?? []) as unknown as ContratoProcessoPendencia[];
    },
  });

  const abertas = new Set(pendencias.filter((p) => pendenciaEmAberto(p.status)).map((p) => p.id));
  const criticas = itens.filter(
    (i) => i.resultado === "divergente" && i.criticidade === "Crítica" && (!i.pendencia_id || abertas.has(i.pendencia_id)),
  );
  return { bloqueado: criticas.length > 0, criticas };
}
