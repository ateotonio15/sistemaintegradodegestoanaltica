import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { podeVerAvisosCirurgia } from "@/lib/cirurgia-notificacao";

export function useNotificacoesCirurgia() {
  const { user, role } = useAuth();
  const enabled = !!user && podeVerAvisosCirurgia(role);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["avisos-cirurgia", user?.id, role], enabled,
    queryFn: async () => {
      if (!user) return { avisos: [], sync: null };
      const [avisos, lidas, sync] = await Promise.all([
        supabase.from("demandas_cirurgia_notificacoes").select("*").order("created_at", { ascending: false }),
        supabase.from("demandas_cirurgia_lidas").select("notificacao_id").eq("user_id", user.id),
        supabase.from("demandas_cirurgia_sync").select("ultimo_sucesso_em,erro").eq("id",true).maybeSingle(),
      ]);
      if (avisos.error || lidas.error || sync.error) throw avisos.error ?? lidas.error ?? sync.error;
      const ids = new Set(lidas.data?.map(n => n.notificacao_id));
      return { avisos: (avisos.data ?? []).filter(n => !ids.has(n.id)), sync: sync.data };
    }, staleTime: 15000, refetchInterval: 60000, refetchOnWindowFocus: true,
  });
  const marcar = useMutation({ mutationFn: async (ids: string[]) => {
    if (!enabled || !user || !ids.length) return;
    const { error } = await supabase.from("demandas_cirurgia_lidas").upsert(ids.map(id => ({ notificacao_id: id, user_id: user.id })), { onConflict: "notificacao_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["avisos-cirurgia"] }); } });
  return { enabled, avisos: enabled ? query.data?.avisos ?? [] : [], sync: enabled ? query.data?.sync : null, erro: query.isError, marcar: marcar.mutateAsync };
}

export function useCirurgiaRealtime() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user || !podeVerAvisosCirurgia(role)) return;
    const channel = supabase.channel(`cirurgias-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "demandas_cirurgia_notificacoes" }, () => { qc.invalidateQueries({ queryKey: ["avisos-cirurgia"] }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "demandas_cirurgia_lidas", filter: `user_id=eq.${user.id}` }, () => { qc.invalidateQueries({ queryKey: ["avisos-cirurgia"] }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role, qc]);
}