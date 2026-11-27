import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ALERTAS_PADRAO, type AlertasConfig } from "@/lib/uber-alertas";

const QK = ["uber_alertas_config"];

export function useUberAlertasConfig() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: QK,
    enabled: !loading && !!user,
    queryFn: async (): Promise<AlertasConfig> => {
      const { data, error } = await supabase.from("uber_alertas_config" as any).select("*").maybeSingle();
      if (error) throw error;
      const d: any = data ?? {};
      return {
        ...ALERTAS_PADRAO, ...Object.fromEntries(Object.keys(ALERTAS_PADRAO).filter((k) => d[k] !== undefined && d[k] !== null).map((k) => [k, d[k]])),
        custo_limite: Number(d.custo_limite ?? ALERTAS_PADRAO.custo_limite),
        rota_preco_pct: Number(d.rota_preco_pct ?? ALERTAS_PADRAO.rota_preco_pct),
      } as AlertasConfig;
    },
  });
}

export function useSalvarUberAlertasConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (cfg: AlertasConfig) => {
      const { error } = await supabase.from("uber_alertas_config" as any)
        .upsert({ id: true, ...cfg, updated_at: new Date().toISOString(), updated_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
