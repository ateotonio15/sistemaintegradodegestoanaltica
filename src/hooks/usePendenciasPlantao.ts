import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseAssunto } from "@/components/plantoes/AtendimentoDialog";

export interface PendenciaDia {
  key: string; // empresaId|data
  empresaId: string;
  empresaNome: string;
  data: string;
  plantaoIds: string[];
  plantonistas: string[];
  total: number;
}

/**
 * Pendências de plantão = atendimentos ainda não "Resolvido" nem "Cancelado"
 * (mesma regra da caixa PENDÊNCIAS dos cards). Agrupado por empresa + dia.
 */
export function usePendenciasPlantao(enabled = true) {
  return useQuery({
    queryKey: ["plantoes_atendimentos", "pendencias-globais"],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantoes_atendimentos")
        .select("id, assunto, resolvido, plantao:plantoes!inner(id, data, plantonista, empresa_id, empresa:plantoes_empresas(nome))")
        .eq("resolvido", false)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, PendenciaDia>();
      for (const a of (data as any[]) ?? []) {
        const meta = parseAssunto(a.assunto, a.resolvido);
        if (meta.status === "Resolvido" || meta.status === "Cancelado") continue;
        const p = a.plantao;
        if (!p) continue;
        const key = `${p.empresa_id}|${p.data}`;
        let g = map.get(key);
        if (!g) {
          g = { key, empresaId: p.empresa_id, empresaNome: p.empresa?.nome ?? "Empresa", data: p.data, plantaoIds: [], plantonistas: [], total: 0 };
          map.set(key, g);
        }
        g.total++;
        if (!g.plantaoIds.includes(p.id)) g.plantaoIds.push(p.id);
        if (p.plantonista && !g.plantonistas.includes(p.plantonista)) g.plantonistas.push(p.plantonista);
      }
      const dias = Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
      const total = dias.reduce((s, d) => s + d.total, 0);
      return { dias, total };
    },
  });
}
