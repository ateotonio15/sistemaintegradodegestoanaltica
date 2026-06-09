import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface HondaExclusao {
  id: string;
  tipo_operacao: string | null;
  sequencia: string | null;
  nome_beneficiario: string;
  cpf: string;
  data_demissao: string;
  motivo: string | null;
  concluido: boolean;
  importado_por: string | null;
  importado_em: string;
  created_at: string;
  updated_at: string;
}

export function useHondaExclusoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["honda-exclusoes"],
    queryFn: async (): Promise<HondaExclusao[]> => {
      const { data, error } = await supabase
        .from("honda_exclusoes" as any)
        .select("*")
        .order("data_demissao", { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCanAccessHonda() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["can-access-honda", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("can_access_honda_exclusoes" as any, {
        _user_id: user.id,
      });
      if (error) return false;
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

export type HondaStatus = "Programado" | "Amanhã" | "Hoje" | "Concluído" | "Atrasado";

export function getHondaStatus(item: HondaExclusao): HondaStatus {
  if (item.concluido) return "Concluído";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = item.data_demissao.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return "Atrasado";
  return "Programado";
}

export function getDiasRestantes(item: HondaExclusao): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = item.data_demissao.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
