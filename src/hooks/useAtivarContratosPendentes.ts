import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Ao montar (uma vez por sessão), aciona a RPC que ativa contratos
 * recém-implantados cuja primeira_competencia_financeira já chegou.
 * Faz com que o status "aguardando_primeiro_fechamento" → "ativo"
 * sem depender exclusivamente do cron job diário.
 */
export function useAtivarContratosPendentes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user || ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("ativar_contratos_pendentes" as any);
        if (!error && typeof data === "number" && data > 0) {
          queryClient.invalidateQueries({ queryKey: ["contratos-recem-implantados"] });
          queryClient.invalidateQueries({ queryKey: ["empresas"] });
        }
      } catch {
        /* noop */
      }
    })();
  }, [user, queryClient]);
}
