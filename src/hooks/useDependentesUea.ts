import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  calcularTitular,
  type DependenteUea,
  type TitularCalculado,
  type TitularUea,
} from "@/lib/dependentes-uea";

const KEY = ["uea-titulares"];

export function useTitularesUea() {
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

  const titulares: TitularCalculado[] = useMemo(
    () => (query.data ?? []).map((t) => calcularTitular(t)),
    [query.data],
  );

  return { ...query, titulares };
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
