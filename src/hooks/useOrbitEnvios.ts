import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrbitEnvioInfo {
  orbit_user: string;
  enviado_em: string;
}

/** Chave do envio: competência + empresa (nome) + contrato */
export const orbitEnvioKey = (
  competencia?: string | null,
  nome?: string | null,
  contrato?: string | null,
) => `${(competencia ?? "").trim()}|${(nome ?? "").trim().toLowerCase()}|${(contrato ?? "").trim()}`;

/** Último envio ao Orbit por competência + empresa (nome + contrato) */
export function useOrbitEnvios() {
  return useQuery({
    queryKey: ["orbit-envios-map"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orbit_envios")
        .select("empresa_nome, contrato, orbit_user, enviado_em, competencia")
        .order("enviado_em", { ascending: false });
      if (error) throw error;

      const map = new Map<string, OrbitEnvioInfo>();
      for (const row of data ?? []) {
        const nome = (row.empresa_nome ?? "").replace(/\s*\(Contrato[^)]*\)\s*$/i, "");
        const comp =
          (row as any).competencia ?? String(row.enviado_em ?? "").slice(0, 7);
        const keys = [
          orbitEnvioKey(comp, nome, row.contrato),
          orbitEnvioKey(comp, nome, null),
        ];
        for (const k of keys) {
          if (!map.has(k)) map.set(k, { orbit_user: row.orbit_user, enviado_em: row.enviado_em });
        }
      }
      return map;
    },
  });
}

/** Invalida o cache de envios quando o dialog do Orbit registra novos envios */
export function useOrbitEnviosRefresh() {
  const qc = useQueryClient();
  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["orbit-envios-map"] });
    window.addEventListener("orbit-envios-updated", handler);
    return () => window.removeEventListener("orbit-envios-updated", handler);
  }, [qc]);
}
