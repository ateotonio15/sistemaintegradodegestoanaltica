import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sb = supabase as any;

export type ColetaStatus = "agendada" | "pendente" | "concluida" | "cancelada";
export type InscricaoStatus = "inscrita" | "realizada" | "faltou" | "cancelada";

export interface ColetaAgendamento {
  id: string;
  empresa_id: string;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  responsavel: string | null;
  local: string | null;
  vagas: number | null;
  observacoes: string | null;
  status: ColetaStatus;
  token: string;
  link_ativo: boolean;
  data_limite: string | null;
  empresa?: { id: string; nome: string; email_empresa: string | null };
  inscricoes?: { status: InscricaoStatus }[];
}

export interface ColetaInscricao {
  id: string;
  agendamento_id: string;
  empresa_id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  telefone: string;
  setor: string | null;
  origem: string;
  status: InscricaoStatus;
  confirmado_em: string | null;
  confirmado_por_nome: string | null;
  created_at: string;
}

export const STATUS_INSCRICAO_LABEL: Record<InscricaoStatus, string> = {
  inscrita: "Inscrita",
  realizada: "Coleta realizada",
  faltou: "Não compareceu",
  cancelada: "Cancelada",
};

export function useColetaAgendamentos(fromISO: string, toISO: string) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["coleta_agendamentos", fromISO, toISO],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("coleta_agendamentos")
        .select("*, empresa:empresas(id,nome,email_empresa), inscricoes:coleta_inscricoes(status)")
        .gte("data", fromISO)
        .lte("data", toISO)
        .order("data")
        .order("horario_inicio");
      if (error) throw error;
      return (data ?? []) as ColetaAgendamento[];
    },
  });
}

export function useColetaInscricoes(agendamentoId?: string) {
  return useQuery({
    queryKey: ["coleta_inscricoes", agendamentoId],
    enabled: !!agendamentoId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("coleta_inscricoes")
        .select("*")
        .eq("agendamento_id", agendamentoId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ColetaInscricao[];
    },
  });
}

export function useColetaMutations() {
  const qc = useQueryClient();
  const { user, displayName } = useAuth() as any;
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["coleta_agendamentos"] });
    qc.invalidateQueries({ queryKey: ["coleta_inscricoes"] });
  };

  const salvarAgendamento = useMutation({
    mutationFn: async (p: Partial<ColetaAgendamento> & { id?: string }) => {
      const { id, empresa, inscricoes, token, ...rest } = p as any;
      if (id) {
        const { error } = await sb.from("coleta_agendamentos").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("coleta_agendamentos").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => { inv(); toast.success("Agendamento salvo"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const excluirAgendamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("coleta_agendamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Agendamento excluído"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const atualizarStatusInscricoes = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: InscricaoStatus }) => {
      const patch: any = { status };
      if (status === "realizada") {
        patch.confirmado_em = new Date().toISOString();
        patch.confirmado_por = user?.id ?? null;
        patch.confirmado_por_nome = displayName ?? user?.email ?? null;
      } else {
        patch.confirmado_em = null; patch.confirmado_por = null; patch.confirmado_por_nome = null;
      }
      const { error } = await sb.from("coleta_inscricoes").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const inscricaoManual = useMutation({
    mutationFn: async (row: Omit<ColetaInscricao, "id" | "status" | "confirmado_em" | "confirmado_por_nome" | "created_at" | "origem">) => {
      const { error } = await sb.from("coleta_inscricoes").insert({ ...row, origem: "manual", consentimento: true });
      if (error) {
        if (error.code === "23505") throw new Error("CPF já inscrito neste agendamento");
        throw error;
      }
    },
    onSuccess: () => { inv(); toast.success("Participante cadastrada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });

  return { salvarAgendamento, excluirAgendamento, atualizarStatusInscricoes, inscricaoManual };
}

export function cpfValido(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export const maskCpf = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export const maskTel = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

export const fmtDataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const fmtHora = (t?: string | null) => (t ? t.slice(0, 5) : "");
