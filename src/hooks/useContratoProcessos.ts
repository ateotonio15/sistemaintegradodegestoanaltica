import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ContratoProcesso,
  ContratoProcessoMovimentacao,
  ContratoProcessoPendencia,
  ProcessoResultado,
  ProcessoSetor,
  ProcessoStatusGeral,
} from "@/lib/contrato-processo";

/** Lista os processos de contrato (estrutura integrada de análise). */
export function useContratoProcessos(enabled = true) {
  return useQuery({
    queryKey: ["contrato-processos"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_processos" as any)
        .select("*")
        .order("ultima_movimentacao_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContratoProcesso[];
    },
  });
}

/** Processo vinculado a uma implantação específica (se existir). */
export function useContratoProcessoPorImplantacao(implantacaoId?: string | null) {
  return useQuery({
    queryKey: ["contrato-processo-impl", implantacaoId],
    enabled: !!implantacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_processos" as any)
        .select("*")
        .eq("implantacao_id", implantacaoId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ContratoProcesso | null) ?? null;
    },
  });
}

export function useContratoProcessoHistorico(processoId?: string | null) {
  return useQuery({
    queryKey: ["contrato-processo-historico", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_processo_movimentacoes" as any)
        .select("*")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContratoProcessoMovimentacao[];
    },
  });
}

export function useContratoProcessoPendencias(processoId?: string | null) {
  return useQuery({
    queryKey: ["contrato-processo-pendencias", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_processo_pendencias" as any)
        .select("*")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContratoProcessoPendencia[];
    },
  });
}

/** Cria (ou reaproveita) o processo único de um contrato. */
export function useCriarContratoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      implantacaoId?: string | null;
      empresaId?: string | null;
      nomeEmpresa?: string | null;
      cnpj?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("criar_contrato_processo" as any, {
        p_implantacao_id: input.implantacaoId ?? null,
        p_empresa_id: input.empresaId ?? null,
        p_nome_empresa: input.nomeEmpresa ?? null,
        p_cnpj: input.cnpj ?? null,
      });
      if (error) throw error;
      return data as unknown as ContratoProcesso;
    },
    onSuccess: (proc) => {
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-impl", proc?.implantacao_id] });
    },
  });
}

/** Registra uma movimentação (setor, status, resultado, responsável). */
export function useRegistrarMovimentacaoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      processoId: string;
      acao: string;
      setorDestino?: ProcessoSetor | null;
      statusNovo?: ProcessoStatusGeral | null;
      statusDetalhado?: ProcessoStatus | null;
      proximaAcao?: string | null;
      resultadoNovo?: ProcessoResultado | null;
      responsavelId?: string | null;
      responsavelNome?: string | null;
      observacao?: string | null;
      detalhes?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.rpc("registrar_movimentacao_processo" as any, {
        p_processo_id: input.processoId,
        p_acao: input.acao,
        p_setor_destino: input.setorDestino ?? null,
        p_status_novo: input.statusNovo ?? null,
        p_resultado_novo: input.resultadoNovo ?? null,
        p_responsavel_id: input.responsavelId ?? null,
        p_responsavel_nome: input.responsavelNome ?? null,
        p_observacao: input.observacao ?? null,
        p_detalhes: input.detalhes ?? {},
        p_status_detalhado: input.statusDetalhado ?? null,
        p_proxima_acao: input.proximaAcao ?? null,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-historico", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-impl"] });
    },
  });
}

/** Encaminha o processo de um setor para outro, registrando o histórico. */
export function useEncaminharContratoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      processoId: string;
      setorDestino: ProcessoSetor;
      status?: ProcessoStatus | null;
      responsavelId?: string | null;
      responsavelNome?: string | null;
      proximaAcao?: string | null;
      observacao?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("encaminhar_contrato_processo" as any, {
        p_processo_id: input.processoId,
        p_setor_destino: input.setorDestino,
        p_status: input.status ?? null,
        p_responsavel_id: input.responsavelId ?? null,
        p_responsavel_nome: input.responsavelNome ?? null,
        p_proxima_acao: input.proximaAcao ?? null,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-historico", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processo-impl"] });
    },
  });
}

/** Cria uma pendência no processo (contador é atualizado pelo banco). */
export function useCriarPendenciaProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      processoId: string;
      setor: ProcessoSetor;
      descricao: string;
      responsavelId?: string | null;
      responsavelNome?: string | null;
      prazo?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("contrato_processo_pendencias" as any).insert({
        processo_id: input.processoId,
        setor: input.setor,
        descricao: input.descricao,
        responsavel_id: input.responsavelId ?? null,
        responsavel_nome: input.responsavelNome ?? null,
        prazo: input.prazo ?? null,
        created_by: auth.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["contrato-processo-pendencias", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
    },
  });
}

/** Marca uma pendência como resolvida. */
export function useResolverPendenciaProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; processoId: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("contrato_processo_pendencias" as any)
        .update({
          resolvida: true,
          resolvida_em: new Date().toISOString(),
          resolvida_por: auth.user?.id ?? null,
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["contrato-processo-pendencias", vars.processoId] });
      qc.invalidateQueries({ queryKey: ["contrato-processos"] });
    },
  });
}
