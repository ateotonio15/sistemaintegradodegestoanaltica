import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pendenciaEmAberto } from "@/lib/contrato-processo";

export interface PanoramaProcesso {
  divergencias: number;
  divergenciasCriticas: number;
  pendenciasAbertas: number;
  pendenciasCriticas: number;
  setoresPendencia: string[];
  titulosPendencia: string[];
  validado: boolean;
}

const vazio: PanoramaProcesso = {
  divergencias: 0,
  divergenciasCriticas: 0,
  pendenciasAbertas: 0,
  pendenciasCriticas: 0,
  setoresPendencia: [],
  titulosPendencia: [],
  validado: false,
};

/**
 * Agregados por processo usados na listagem geral de contratos:
 * divergências da validação cruzada e pendências em aberto por setor.
 */
export function useContratosPanorama() {
  return useQuery({
    queryKey: ["contratos-panorama"],
    queryFn: async () => {
      const [validacoes, pendencias] = await Promise.all([
        supabase
          .from("contrato_validacoes_cruzadas" as any)
          .select("processo_id, resultado, criticidade, pendencia_id"),
        supabase
          .from("contrato_processo_pendencias" as any)
          .select("processo_id, status, criticidade, setor, titulo"),
      ]);
      if (validacoes.error) throw validacoes.error;
      if (pendencias.error) throw pendencias.error;

      const mapa = new Map<string, PanoramaProcesso>();
      const get = (id: string) => {
        let atual = mapa.get(id);
        if (!atual) {
          atual = { ...vazio, setoresPendencia: [], titulosPendencia: [] };
          mapa.set(id, atual);
        }
        return atual;
      };

      ((validacoes.data || []) as any[]).forEach((v) => {
        const item = get(v.processo_id);
        item.validado = true;
        if (v.resultado === "divergente") {
          item.divergencias += 1;
          if (v.criticidade === "Crítica") item.divergenciasCriticas += 1;
        }
      });

      ((pendencias.data || []) as any[]).forEach((p) => {
        if (!pendenciaEmAberto(p.status)) return;
        const item = get(p.processo_id);
        item.pendenciasAbertas += 1;
        if (p.criticidade === "Crítica" || p.criticidade === "Alta") item.pendenciasCriticas += 1;
        if (p.setor && !item.setoresPendencia.includes(p.setor)) item.setoresPendencia.push(p.setor);
        if (p.titulo && item.titulosPendencia.length < 4) item.titulosPendencia.push(p.titulo);
      });

      return mapa;
    },
  });
}

export const PANORAMA_VAZIO = vazio;
