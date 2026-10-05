import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sb = supabase as any;

export type AcaoSaudeTipo = "triagem" | "palestra" | "preventiva" | "bioimpedancia" | "outro";
export type AcaoSaudeStatus = "agendada" | "em_andamento" | "concluida" | "cancelada";

export interface AcaoSaude {
  id: string;
  empresa_id: string;
  enfermeira_user_id: string | null;
  enfermeira_nome: string | null;
  data_acao: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo: AcaoSaudeTipo;
  status: AcaoSaudeStatus;
  titulo: string | null;
  local: string | null;
  observacoes: string | null;
  total_atendidos: number;
  tem_pa: boolean;
  tem_glicemia: boolean;
  tem_bioimpedancia: boolean;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome: string; codigo_contrato: string | null; cnpj: string | null };
}

export interface Triagem {
  id: string;
  acao_id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  idade: number | null;
  sexo: string | null;
  email: string | null;
  telefone: string | null;
  setor: string | null;
  cargo: string | null;
  peso_kg: number | null;
  altura_cm: number | null;
  imc: number | null;
  circ_abdominal_cm: number | null;
  circ_quadril_cm: number | null;
  rcq: number | null;
  gordura_pct: number | null;
  gordura_corporal_kg: number | null;
  gordura_subcutanea_pct: number | null;
  gordura_visceral: number | null;
  massa_muscular_kg: number | null;
  massa_ossea_kg: number | null;
  agua_corporal_pct: number | null;
  tmb_kcal: number | null;
  idade_metabolica: number | null;
  score_corporal: number | null;
  pas_mmhg: number | null;
  pad_mmhg: number | null;
  classificacao_pa: string | null;
  freq_cardiaca: number | null;
  sat_o2: number | null;
  temperatura_c: number | null;
  glicemia_mg_dl: number | null;
  jejum: boolean;
  classificacao_glicemia: string | null;
  tem_has: boolean;
  tem_dm: boolean;
  tem_bio: boolean;
  usa_medicacao: boolean;
  medicamentos: string | null;
  risco_geral: "alto" | "medio" | "baixo" | null;
  recomendacao: string | null;
  enviado_email_em: string | null;
  created_at: string;
  updated_at: string;
}

export function useSaudeRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("saude-empresas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "acoes_saude" }, () => {
        qc.invalidateQueries({ queryKey: ["acoes_saude"] });
        qc.invalidateQueries({ queryKey: ["empresas_saude_agg"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "triagens" }, () => {
        qc.invalidateQueries({ queryKey: ["triagens"] });
        qc.invalidateQueries({ queryKey: ["acoes_saude"] });
        qc.invalidateQueries({ queryKey: ["empresas_saude_agg"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

/** Lista empresas (ativas) com agregados de saúde no período. */
export function useEmpresasComAcoes(filters: { from?: string; to?: string; enfermeiraId?: string; tipo?: AcaoSaudeTipo }) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["empresas_saude_agg", filters.from ?? "", filters.to ?? "", filters.enfermeiraId ?? "", filters.tipo ?? ""],
    enabled: !loading && !!user,
    queryFn: async () => {
      let aq = sb.from("acoes_saude").select("id,empresa_id,data_acao,tipo,status,total_atendidos,enfermeira_user_id");
      if (filters.from) aq = aq.gte("data_acao", filters.from);
      if (filters.to) aq = aq.lte("data_acao", filters.to);
      if (filters.enfermeiraId) aq = aq.eq("enfermeira_user_id", filters.enfermeiraId);
      if (filters.tipo) aq = aq.eq("tipo", filters.tipo);
      const { data: acoes, error: e1 } = await aq;
      if (e1) throw e1;

      const { data: emps, error: e2 } = await sb
        .from("empresas")
        .select("id,nome,codigo_contrato,cnpj,status_empresa")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (e2) throw e2;

      // Agrega triagens com risco alto por empresa nas ações filtradas
      const acaoIds = (acoes ?? []).map((a: any) => a.id);
      let riscoMap = new Map<string, number>();
      if (acaoIds.length) {
        const { data: tris } = await sb
          .from("triagens")
          .select("empresa_id,risco_geral")
          .in("acao_id", acaoIds);
        (tris ?? []).forEach((t: any) => {
          if (t.risco_geral === "alto") {
            riscoMap.set(t.empresa_id, (riscoMap.get(t.empresa_id) ?? 0) + 1);
          }
        });
      }

      const map = new Map<string, { total: number; triagens: number; ultima: string | null; risco_alto: number }>();
      (acoes ?? []).forEach((a: any) => {
        const cur = map.get(a.empresa_id) ?? { total: 0, triagens: 0, ultima: null, risco_alto: 0 };
        cur.total += 1;
        cur.triagens += a.total_atendidos ?? 0;
        if (!cur.ultima || a.data_acao > cur.ultima) cur.ultima = a.data_acao;
        map.set(a.empresa_id, cur);
      });

      return (emps ?? []).map((e: any) => {
        const agg = map.get(e.id);
        return {
          ...e,
          total_acoes: agg?.total ?? 0,
          total_triagens: agg?.triagens ?? 0,
          ultima_acao: agg?.ultima ?? null,
          risco_alto: riscoMap.get(e.id) ?? 0,
        };
      });
    },
  });
}

export function useAcoesEmpresa(empresaId?: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["acoes_saude", "empresa", empresaId],
    enabled: !loading && !!user && !!empresaId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("acoes_saude")
        .select("*, empresa:empresas(id,nome,codigo_contrato,cnpj)")
        .eq("empresa_id", empresaId)
        .order("data_acao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcaoSaude[];
    },
  });
}

export function useAcao(acaoId?: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["acoes_saude", "one", acaoId],
    enabled: !loading && !!user && !!acaoId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("acoes_saude")
        .select("*, empresa:empresas(id,nome,codigo_contrato,cnpj)")
        .eq("id", acaoId)
        .maybeSingle();
      if (error) throw error;
      return data as AcaoSaude | null;
    },
  });
}

export function useTriagens(acaoId?: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["triagens", acaoId],
    enabled: !loading && !!user && !!acaoId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("triagens")
        .select("*")
        .eq("acao_id", acaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Triagem[];
    },
  });
}

export function useSaudeMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsertAcao = useMutation({
    mutationFn: async (a: Partial<AcaoSaude> & { empresa_id: string; data_acao: string; tipo: AcaoSaudeTipo }) => {
      const payload: any = {
        empresa_id: a.empresa_id,
        data_acao: a.data_acao,
        hora_inicio: a.hora_inicio ?? null,
        hora_fim: a.hora_fim ?? null,
        tipo: a.tipo,
        status: a.status ?? "agendada",
        titulo: a.titulo ?? null,
        local: a.local ?? null,
        observacoes: a.observacoes ?? null,
        enfermeira_user_id: a.enfermeira_user_id ?? user?.id ?? null,
        enfermeira_nome: a.enfermeira_nome ?? null,
        tem_pa: a.tem_pa ?? true,
        tem_glicemia: a.tem_glicemia ?? true,
        tem_bioimpedancia: a.tem_bioimpedancia ?? false,
      };
      if (a.id) {
        const { data, error } = await sb.from("acoes_saude").update(payload).eq("id", a.id).select().single();
        if (error) throw error;
        return data;
      }
      payload.created_by = user?.id ?? null;
      const { data, error } = await sb.from("acoes_saude").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes_saude"] });
      qc.invalidateQueries({ queryKey: ["empresas_saude_agg"] });
      toast.success("Ação salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar ação"),
  });

  const deleteAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("acoes_saude").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes_saude"] });
      qc.invalidateQueries({ queryKey: ["empresas_saude_agg"] });
      toast.success("Ação removida (e triagens associadas)");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const upsertTriagem = useMutation({
    mutationFn: async (t: Partial<Triagem> & { acao_id: string; empresa_id: string; nome: string }) => {
      const payload: any = { ...t };
      // remove campos calculados pelo backend
      delete payload.imc;
      delete payload.rcq;
      delete payload.classificacao_pa;
      delete payload.classificacao_glicemia;
      delete payload.risco_geral;
      delete payload.idade;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.empresa;
      if (t.id) {
        const { data, error } = await sb.from("triagens").update(payload).eq("id", t.id).select().single();
        if (error) throw error;
        return data;
      }
      payload.created_by = user?.id ?? null;
      const { data, error } = await sb.from("triagens").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triagens"] });
      qc.invalidateQueries({ queryKey: ["acoes_saude"] });
      qc.invalidateQueries({ queryKey: ["empresas_saude_agg"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar triagem"),
  });

  const deleteTriagem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("triagens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triagens"] });
      qc.invalidateQueries({ queryKey: ["acoes_saude"] });
      toast.success("Triagem removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const enviarFichaEmail = useMutation({
    mutationFn: async (triagemId: string) => {
      const { data, error } = await supabase.functions.invoke("enviar-ficha-bio", {
        body: { triagem_id: triagemId },
      });
      if (error) throw new Error("Não foi possível enviar o e-mail agora.");
      if (data?.ok === false) {
        const raw = String(data.error ?? "");
        throw new Error(/api key/i.test(raw)
          ? "Envio de e-mail indisponível: o serviço de e-mail precisa ser reconfigurado. A ficha foi salva."
          : raw || "Falha ao enviar e-mail");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triagens"] });
      toast.success("Ficha enviada por e-mail");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar e-mail"),
  });

  return { upsertAcao, deleteAcao, upsertTriagem, deleteTriagem, enviarFichaEmail };
}

/** Lista de enfermeiras (perfis com role=enfermeira) para filtros. */
export function useEnfermeiras() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["enfermeiras_list"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("user_roles")
        .select("user_id, profiles!inner(user_id, display_name)")
        .eq("role", "enfermeira");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ user_id: r.user_id, display_name: r.profiles?.display_name ?? "—" }));
    },
  });
}
