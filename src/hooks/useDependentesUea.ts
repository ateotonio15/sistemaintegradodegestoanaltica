import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  analisarReativacao,
  calcularTitular,
  faixaLabel,
  MOTIVO_FALTA_MARGEM,
  type DependenteCalculado,
  type DependenteUea,
  type FaixaUea,
  type TitularCalculado,
  type TitularUea,
} from "@/lib/dependentes-uea";

const KEY = ["uea-titulares"];
const KEY_FAIXAS = ["uea-faixas"];

/* ------------------------------ Faixas etárias ----------------------------- */

export function useFaixasUea() {
  return useQuery({
    queryKey: KEY_FAIXAS,
    queryFn: async (): Promise<FaixaUea[]> => {
      const { data, error } = await supabase
        .from("uea_faixas")
        .select("*")
        .order("idade_inicial", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((f) => ({
        ...f,
        valor_mensal: Number(f.valor_mensal ?? 0),
      })) as FaixaUea[];
    },
  });
}

export interface FaixaInput {
  id?: string;
  idade_inicial: number;
  idade_final: number | null;
  valor_mensal: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacao: string | null;
}

export function useSalvarFaixaUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: FaixaInput) => {
      const payload = {
        idade_inicial: input.idade_inicial,
        idade_final: input.idade_final,
        valor_mensal: input.valor_mensal,
        vigencia_inicio: input.vigencia_inicio,
        vigencia_fim: input.vigencia_fim || null,
        observacao: input.observacao || null,
      };
      if (input.id) {
        const { error } = await supabase.from("uea_faixas").update(payload).eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("uea_faixas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_FAIXAS });
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Faixa salva" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar faixa", description: e.message, variant: "destructive" }),
  });
}

export function useExcluirFaixaUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("uea_faixas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_FAIXAS });
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Faixa excluída" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir faixa", description: e.message, variant: "destructive" }),
  });
}

/* --------------------------------- Titulares -------------------------------- */

export function useTitularesUea() {
  const faixasQuery = useFaixasUea();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<TitularUea[]> => {
      const { data, error } = await supabase
        .from("uea_titulares")
        .select("*, uea_dependentes(*)")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((t) => ({
        ...t,
        valor_margem: Number(t.valor_margem ?? 0),
        dependentes: ((t.uea_dependentes ?? []) as any[]).map((d) => ({
          ...d,
          valor_mensal: Number(d.valor_mensal ?? 0),
        })) as DependenteUea[],
      })) as TitularUea[];
    },
  });

  const faixas = faixasQuery.data ?? [];

  const titulares: TitularCalculado[] = useMemo(
    () => (query.data ?? []).map((t) => calcularTitular(t, faixas)),
    [query.data, faixas],
  );

  return {
    ...query,
    isLoading: query.isLoading || faixasQuery.isLoading,
    titulares,
    faixas,
  };
}

export interface TitularInput {
  id?: string;
  nome_completo: string;
  cpf: string;
  matricula: string | null;
  contrato: string | null;
  valor_margem: number;
  observacao: string | null;
}

export function useSalvarTitularUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: TitularInput) => {
      const payload = {
        nome_completo: input.nome_completo.trim(),
        cpf: input.cpf,
        matricula: input.matricula || null,
        contrato: input.contrato || null,
        valor_margem: input.valor_margem,
        observacao: input.observacao || null,
      };
      if (input.id) {
        const { error } = await supabase.from("uea_titulares").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("uea_titulares")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Titular salvo" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar titular", description: e.message, variant: "destructive" }),
  });
}

/** Atualiza somente a margem disponível do titular (campo editável na visão de detalhe). */
export function useAtualizarMargemUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, valor_margem }: { id: string; valor_margem: number }) => {
      const { error } = await supabase.from("uea_titulares").update({ valor_margem }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Margem atualizada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao atualizar margem", description: e.message, variant: "destructive" }),
  });
}

export function useExcluirTitularUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("uea_titulares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Titular excluído" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });
}

/* -------------------------------- Dependentes ------------------------------- */

export interface DependenteInput {
  id?: string;
  titular_id: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: string | null;
  faixa_etaria: string | null;
  valor_mensal: number;
  status: "ativo" | "desligado";
  motivo_desligamento: string | null;
  data_desligamento: string | null;
  observacao: string | null;
}

export function useSalvarDependenteUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: DependenteInput) => {
      const payload = {
        titular_id: input.titular_id,
        nome_completo: input.nome_completo.trim(),
        cpf: input.cpf || null,
        data_nascimento: input.data_nascimento || null,
        parentesco: input.parentesco || null,
        faixa_etaria: input.faixa_etaria || null,
        valor_mensal: input.valor_mensal,
        status: input.status,
        motivo_desligamento: input.status === "desligado" ? input.motivo_desligamento || null : null,
        data_desligamento: input.status === "desligado" ? input.data_desligamento || null : null,
        observacao: input.observacao || null,
      };
      if (input.id) {
        const { error } = await supabase.from("uea_dependentes").update(payload).eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("uea_dependentes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Dependente salvo" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar dependente", description: e.message, variant: "destructive" }),
  });
}

export function useExcluirDependenteUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("uea_dependentes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Dependente excluído" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });
}

/* ------------------------- Faixa aplicável / histórico ---------------------- */

export interface HistoricoDependente {
  id: string;
  dependente_id: string;
  faixa_anterior: string | null;
  faixa_nova: string | null;
  valor_anterior: number | null;
  valor_novo: number | null;
  motivo: string | null;
  created_at: string;
  tipo?: string | null;
  valor_mensal_momento?: number | null;
  margem_titular_momento?: number | null;
  margem_restante_momento?: number | null;
  created_by?: string | null;
}

export function useHistoricoDependentesUea(titularId: string | null) {
  return useQuery({
    queryKey: ["uea-historico", titularId],
    enabled: !!titularId,
    queryFn: async (): Promise<HistoricoDependente[]> => {
      const { data: deps, error: e1 } = await supabase
        .from("uea_dependentes")
        .select("id")
        .eq("titular_id", titularId as string);
      if (e1) throw e1;
      const ids = (deps ?? []).map((d: any) => d.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("uea_dependente_historico")
        .select("*")
        .in("dependente_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const nomesMap = new Map<string, string>();
      const userIds = Array.from(new Set(rows.map((h) => h.created_by).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: nomes } = await supabase.rpc("get_user_display_names", { _ids: userIds });
        (nomes ?? []).forEach((n: any) => nomesMap.set(n.user_id, n.display_name));
      }
      const nomeDep = new Map<string, string>(
        ((deps ?? []) as any[]).map((d) => [d.id, d.nome_completo as string]),
      );
      return rows.map((h) => ({
        ...h,
        valor_anterior: h.valor_anterior === null ? null : Number(h.valor_anterior),
        valor_novo: h.valor_novo === null ? null : Number(h.valor_novo),
        valor_mensal_momento:
          h.valor_mensal_momento === null || h.valor_mensal_momento === undefined
            ? null
            : Number(h.valor_mensal_momento),
        margem_titular_momento:
          h.margem_titular_momento === null || h.margem_titular_momento === undefined
            ? null
            : Number(h.margem_titular_momento),
        margem_restante_momento:
          h.margem_restante_momento === null || h.margem_restante_momento === undefined
            ? null
            : Number(h.margem_restante_momento),
        responsavel: h.created_by ? nomesMap.get(h.created_by) ?? "—" : "—",
        dependente_nome: nomeDep.get(h.dependente_id) ?? "—",
      })) as HistoricoDependente[];
    },
  });
}

/**
 * Aplica a faixa/valor configurado a um dependente e registra a alteração no histórico.
 * Usado quando o dependente muda de faixa etária (automático) ou por ação manual.
 */
export function useAplicarFaixaDependenteUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      dependente,
      faixa,
      motivo,
    }: {
      dependente: DependenteUea;
      faixa: FaixaUea;
      motivo: string;
    }) => {
      const novoValor = Number(faixa.valor_mensal);
      const novaFaixa = faixaLabel(faixa);
      const { error } = await supabase
        .from("uea_dependentes")
        .update({ faixa_etaria: novaFaixa, valor_mensal: novoValor })
        .eq("id", dependente.id);
      if (error) throw error;
      const { error: e2 } = await supabase.from("uea_dependente_historico").insert({
        dependente_id: dependente.id,
        faixa_anterior: dependente.faixa_etaria,
        faixa_nova: novaFaixa,
        valor_anterior: dependente.valor_mensal,
        valor_novo: novoValor,
        motivo,
      });
      if (e2) throw e2;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["uea-historico", vars.dependente.titular_id] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao aplicar faixa", description: e.message, variant: "destructive" }),
  });
}

/* ---------------------- Desligamento / reativação por margem ---------------------- */

interface EventoMargemArgs {
  dependente: DependenteCalculado;
  titular: TitularCalculado;
  motivo?: string;
}

/** Desliga um dependente por falta de margem (somente após confirmação humana). */
export function useDesligarPorMargemUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ dependente, titular, motivo }: EventoMargemArgs) => {
      const hoje = new Date();
      const dataISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
        hoje.getDate(),
      ).padStart(2, "0")}`;
      const valorMomento = Number(dependente.valor_mensal || 0);
      const { error } = await supabase
        .from("uea_dependentes")
        .update({
          status: "desligado",
          motivo_desligamento: motivo || MOTIVO_FALTA_MARGEM,
          data_desligamento: dataISO,
        })
        .eq("id", dependente.id);
      if (error) throw error;
      const { error: e2 } = await supabase.from("uea_dependente_historico").insert({
        dependente_id: dependente.id,
        tipo: "desligamento_margem",
        faixa_anterior: dependente.faixa_etaria,
        faixa_nova: dependente.faixa_etaria,
        valor_anterior: valorMomento,
        valor_novo: 0,
        valor_mensal_momento: valorMomento,
        margem_titular_momento: titular.valor_margem,
        margem_restante_momento: titular.margem_restante,
        motivo: motivo || MOTIVO_FALTA_MARGEM,
      });
      if (e2) throw e2;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["uea-historico", vars.titular.id] });
      toast({ title: "Dependente desligado por falta de margem" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao desligar dependente", description: e.message, variant: "destructive" }),
  });
}

/** Reativa um dependente desligado (valida margem disponível antes). */
export function useReativarDependenteUea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ dependente, titular }: EventoMargemArgs) => {
      const analise = analisarReativacao(titular, dependente);
      if (!analise.ok) throw new Error("Não há margem suficiente para reativar este dependente.");
      const valorMomento = Number(dependente.valor_aplicavel || dependente.valor_mensal || 0);
      const { error } = await supabase
        .from("uea_dependentes")
        .update({
          status: "ativo",
          motivo_desligamento: null,
          data_desligamento: null,
          valor_mensal: valorMomento,
        })
        .eq("id", dependente.id);
      if (error) throw error;
      const { error: e2 } = await supabase.from("uea_dependente_historico").insert({
        dependente_id: dependente.id,
        tipo: "reativacao",
        faixa_anterior: dependente.faixa_etaria,
        faixa_nova: dependente.faixa_atual ? faixaLabel(dependente.faixa_atual) : dependente.faixa_etaria,
        valor_anterior: Number(dependente.valor_mensal || 0),
        valor_novo: valorMomento,
        valor_mensal_momento: valorMomento,
        margem_titular_momento: titular.valor_margem,
        margem_restante_momento: titular.margem_restante,
        motivo: "Reativação com margem disponível",
      });
      if (e2) throw e2;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["uea-historico", vars.titular.id] });
      toast({ title: "Dependente reativado" });
    },
    onError: (e: any) =>
      toast({ title: "Não foi possível reativar", description: e.message, variant: "destructive" }),
  });
}
