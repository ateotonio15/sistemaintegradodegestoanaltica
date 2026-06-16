import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FeriadoTipo = "Nacional" | "Estadual" | "Municipal" | "Facultativo";

export interface Feriado {
  id: string;
  nome: string;
  data: string; // YYYY-MM-DD
  ano: number;
  tipo: FeriadoTipo;
}

export function useFeriados(ano?: number) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["feriados", ano ?? "all"],
    enabled: !loading && !!user,
    queryFn: async () => {
      let q = supabase.from("feriados").select("*").order("data");
      if (ano) q = q.eq("ano", ano);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function feriadoNaData(feriados: Feriado[], iso: string): Feriado | null {
  return feriados.find((f) => f.data === iso) ?? null;
}
