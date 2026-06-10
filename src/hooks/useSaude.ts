import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type SaudeCategoria = "palestra" | "preventiva";

export interface SaudeAgendamento {
  id: string;
  empresa_id: string;
  enfermeira_user_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_palestra: string;
  categoria: SaudeCategoria;
  endereco_empresa: string | null;
  observacao: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome: string; codigo_contrato: string | null };
}

export interface SaudeAcao {
  id: string;
  empresa_id: string;
  enfermeira_user_id: string;
  data: string;
  colaborador_nome: string;
  cpf: string | null;
  idade: number | null;
  sexo: string | null;
  peso: number | null;
  altura: number | null;
  imc: number | null;
  pressao_arterial: string | null;
  glicemia: number | null;
  frequencia_cardiaca: number | null;
  saturacao: number | null;
  temperatura: number | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome: string; codigo_contrato: string | null };
}

const QK = {
  agendamentos: (categoria: SaudeCategoria) => ["saude_agendamentos", categoria] as const,
  acoes: ["saude_acoes"] as const,
};

const sb = supabase as any;

export function useSaudeAgendamentos(categoria: SaudeCategoria, filters?: { from?: string; to?: string; empresaId?: string }) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...QK.agendamentos(categoria), filters?.from ?? "", filters?.to ?? "", filters?.empresaId ?? "all"],
    enabled: !loading && !!user,
    queryFn: async () => {
      let q = sb
        .from("saude_agendamentos")
        .select("*, empresa:empresas(id,nome,codigo_contrato)")
        .eq("categoria", categoria)
        .order("data", { ascending: false });
      if (filters?.from) q = q.gte("data", filters.from);
      if (filters?.to) q = q.lte("data", filters.to);
      if (filters?.empresaId) q = q.eq("empresa_id", filters.empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SaudeAgendamento[];
    },
  });
}

export function useSaudeAcoes(filters?: { from?: string; to?: string; empresaId?: string }) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...QK.acoes, filters?.from ?? "", filters?.to ?? "", filters?.empresaId ?? "all"],
    enabled: !loading && !!user,
    queryFn: async () => {
      let q = sb
        .from("saude_acoes")
        .select("*, empresa:empresas(id,nome,codigo_contrato)")
        .order("data", { ascending: false });
      if (filters?.from) q = q.gte("data", filters.from);
      if (filters?.to) q = q.lte("data", filters.to);
      if (filters?.empresaId) q = q.eq("empresa_id", filters.empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SaudeAcao[];
    },
  });
}

export function useSaudeRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("saude-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "saude_agendamentos" }, () =>
        qc.invalidateQueries({ queryKey: ["saude_agendamentos"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "saude_acoes" }, () =>
        qc.invalidateQueries({ queryKey: QK.acoes })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export function useSaudeMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsertAgendamento = useMutation({
    mutationFn: async (a: Partial<SaudeAgendamento> & { empresa_id: string; data: string; hora_inicio: string; hora_fim: string; tipo_palestra: string; categoria: SaudeCategoria }) => {
      const payload = {
        empresa_id: a.empresa_id,
        enfermeira_user_id: a.enfermeira_user_id ?? user?.id,
        data: a.data,
        hora_inicio: a.hora_inicio,
        hora_fim: a.hora_fim,
        tipo_palestra: a.tipo_palestra,
        categoria: a.categoria,
        endereco_empresa: a.endereco_empresa ?? null,
        observacao: a.observacao ?? null,
        status: a.status ?? "agendado",
      };
      if (a.id) {
        const { error } = await sb.from("saude_agendamentos").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("saude_agendamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude_agendamentos"] });
      toast.success("Agendamento salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const deleteAgendamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("saude_agendamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude_agendamentos"] });
      toast.success("Agendamento removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const upsertAcao = useMutation({
    mutationFn: async (a: Partial<SaudeAcao> & { empresa_id: string; data: string; colaborador_nome: string }) => {
      const imc =
        a.imc ?? (a.peso && a.altura && Number(a.altura) > 0
          ? Number((Number(a.peso) / (Number(a.altura) * Number(a.altura))).toFixed(2))
          : null);
      const payload = {
        empresa_id: a.empresa_id,
        enfermeira_user_id: a.enfermeira_user_id ?? user?.id,
        data: a.data,
        colaborador_nome: a.colaborador_nome,
        cpf: a.cpf ?? null,
        idade: a.idade ?? null,
        sexo: a.sexo ?? null,
        peso: a.peso ?? null,
        altura: a.altura ?? null,
        imc,
        pressao_arterial: a.pressao_arterial ?? null,
        glicemia: a.glicemia ?? null,
        frequencia_cardiaca: a.frequencia_cardiaca ?? null,
        saturacao: a.saturacao ?? null,
        temperatura: a.temperatura ?? null,
        observacao: a.observacao ?? null,
      };
      if (a.id) {
        const { error } = await sb.from("saude_acoes").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("saude_acoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.acoes });
      toast.success("Ficha salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const deleteAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("saude_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.acoes });
      toast.success("Ficha removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return { upsertAgendamento, deleteAgendamento, upsertAcao, deleteAcao };
}
