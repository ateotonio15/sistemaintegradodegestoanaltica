import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PlantaoEmpresa {
  id: string;
  nome: string;
  ativo: boolean;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plantao {
  id: string;
  empresa_id: string;
  data: string;
  turno: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: string;
  plantonista: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  empresa?: PlantaoEmpresa;
  atendimentos_count?: number;
}

export interface PlantaoAtendimento {
  id: string;
  plantao_id: string;
  hora: string | null;
  nome_cliente: string;
  cpf: string | null;
  assunto: string | null;
  resolvido: boolean;
  demanda_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

const QK = {
  empresas: ["plantoes_empresas"] as const,
  plantoes: ["plantoes"] as const,
  atendimentos: (plantaoId?: string) => ["plantoes_atendimentos", plantaoId ?? "all"] as const,
};

export function usePlantaoEmpresas() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: QK.empresas,
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantoes_empresas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as PlantaoEmpresa[];
    },
  });
}

export function usePlantoes(filters?: { empresaId?: string; from?: string; to?: string }) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...QK.plantoes, filters?.empresaId ?? "all", filters?.from ?? "", filters?.to ?? ""],
    enabled: !loading && !!user,
    queryFn: async () => {
      let q = supabase
        .from("plantoes")
        .select("*, empresa:plantoes_empresas(*), plantoes_atendimentos(count)")
        .order("data", { ascending: false });
      if (filters?.empresaId) q = q.eq("empresa_id", filters.empresaId);
      if (filters?.from) q = q.gte("data", filters.from);
      if (filters?.to) q = q.lte("data", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        atendimentos_count: p.plantoes_atendimentos?.[0]?.count ?? 0,
      })) as Plantao[];
    },
  });
}

export function useAtendimentos(plantaoId?: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: QK.atendimentos(plantaoId),
    enabled: !loading && !!user && !!plantaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantoes_atendimentos")
        .select("*")
        .eq("plantao_id", plantaoId!)
        .order("hora", { ascending: true });
      if (error) throw error;
      return data as PlantaoAtendimento[];
    },
  });
}

export function usePlantoesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("plantoes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "plantoes" }, () =>
        qc.invalidateQueries({ queryKey: QK.plantoes })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "plantoes_atendimentos" }, () => {
        qc.invalidateQueries({ queryKey: ["plantoes_atendimentos"] });
        qc.invalidateQueries({ queryKey: QK.plantoes });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plantoes_empresas" }, () =>
        qc.invalidateQueries({ queryKey: QK.empresas })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

export function usePlantaoMutations() {
  const qc = useQueryClient();

  const upsertEmpresa = useMutation({
    mutationFn: async (e: Partial<PlantaoEmpresa> & { nome: string }) => {
      if (e.id) {
        const { error } = await supabase.from("plantoes_empresas").update({
          nome: e.nome,
          ativo: e.ativo ?? true,
          observacao: e.observacao ?? null,
        }).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plantoes_empresas").insert({
          nome: e.nome,
          ativo: e.ativo ?? true,
          observacao: e.observacao ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.empresas });
      toast.success("Empresa salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar empresa"),
  });

  const deleteEmpresa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plantoes_empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.empresas });
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success("Empresa removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const upsertPlantao = useMutation({
    mutationFn: async (p: Partial<Plantao> & { empresa_id: string; data: string }) => {
      const payload = {
        empresa_id: p.empresa_id,
        data: p.data,
        turno: p.turno ?? "integral",
        hora_inicio: p.hora_inicio ?? null,
        hora_fim: p.hora_fim ?? null,
        status: p.status ?? "A confirmar",
        plantonista: p.plantonista ?? null,
        observacao: p.observacao ?? null,
      };
      if (p.id) {
        const { error } = await supabase.from("plantoes").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plantoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success("Plantão salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar plantão"),
  });

  const createLotePlantoes = useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      from: string;
      to: string;
      turno: string;
      plantonista?: string | null;
      diasSemana?: number[]; // 0-6
    }) => {
      const start = new Date(input.from + "T00:00:00");
      const end = new Date(input.to + "T00:00:00");
      const rows: any[] = [];
      const cur = new Date(start);
      while (cur <= end) {
        if (!input.diasSemana?.length || input.diasSemana.includes(cur.getDay())) {
          rows.push({
            empresa_id: input.empresa_id,
            data: cur.toISOString().slice(0, 10),
            turno: input.turno,
            plantonista: input.plantonista ?? null,
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (!rows.length) throw new Error("Nenhum plantão a criar no intervalo");
      const { error } = await supabase.from("plantoes").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success(`${n} plantões criados`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar lote"),
  });

  const deletePlantao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plantoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success("Plantão removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const upsertAtendimento = useMutation({
    mutationFn: async (a: Partial<PlantaoAtendimento> & { plantao_id: string; nome_cliente: string }) => {
      const payload = {
        plantao_id: a.plantao_id,
        hora: a.hora || null,
        nome_cliente: a.nome_cliente,
        cpf: a.cpf ?? null,
        assunto: a.assunto ?? null,
        resolvido: a.resolvido ?? false,
        observacao: a.observacao ?? null,
        demanda_id: a.demanda_id ?? null,
      };
      if (a.id) {
        const { error } = await supabase.from("plantoes_atendimentos").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plantoes_atendimentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK.atendimentos(vars.plantao_id) });
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success("Atendimento salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar atendimento"),
  });

  const deleteAtendimento = useMutation({
    mutationFn: async (a: { id: string; plantao_id: string }) => {
      const { error } = await supabase.from("plantoes_atendimentos").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK.atendimentos(vars.plantao_id) });
      qc.invalidateQueries({ queryKey: QK.plantoes });
      toast.success("Atendimento removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return {
    upsertEmpresa,
    deleteEmpresa,
    upsertPlantao,
    createLotePlantoes,
    deletePlantao,
    upsertAtendimento,
    deleteAtendimento,
  };
}
