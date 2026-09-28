import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { empresaSemExecutivaUnica, ROTULO_VARIAS_EXECUTIVAS } from "@/lib/empresa-executiva";

export interface AvaliacaoRow {
  id: string;
  envio_id: string | null;
  resposta_id: string | null;
  tipo: "rh" | "plantao";
  empresa_id: string | null;
  empresa_nome: string;
  executiva_nome: string;
  status: string;
  data_envio: string | null;
  data_resposta: string | null;
  lembrete_enviado_em: string | null;
  nota_media: number | null;
  respostas: Record<string, any> | null;
  comentario: string | null;
}

export function useAvaliacoesUnificadas() {
  return useQuery({
    queryKey: ["avaliacoes-unificadas"],
    queryFn: async (): Promise<AvaliacaoRow[]> => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .from("vw_avaliacoes_unificadas")
          .select("*")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return all.map((r) => {
        const semExec = empresaSemExecutivaUnica(r.empresa_nome, r.sem_executiva_vinculada);
        const nota = r.nota_media == null ? null : Number(r.nota_media);
        return {
          ...r,
          tipo: r.tipo === "plantao" ? "plantao" : "rh",
          empresa_nome: (r.empresa_nome || "Sem empresa").trim(),
          executiva_nome: semExec && !r.resposta_id ? ROTULO_VARIAS_EXECUTIVAS : (r.executiva_nome || (semExec ? ROTULO_VARIAS_EXECUTIVAS : "Sem executiva")).trim(),
          nota_media: nota != null && !isNaN(nota) && nota > 0 ? nota : null,
        };
      });
    },
  });
}

export function useFormulariosPerguntas() {
  return useQuery({
    queryKey: ["avaliacoes-form-perguntas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("cs_avaliacao_formularios").select("tipo, perguntas");
      const map: Record<string, string> = {};
      (data || []).forEach((f: any) =>
        (f.perguntas || []).forEach((p: any) => {
          if (p.tipo === "rating" && !map[p.id]) map[p.id] = p.titulo;
        }),
      );
      return map;
    },
  });
}

export interface Resumo {
  enviadas: number;
  respondidas: number;
  taxa: number;
  pendentes: number;
  lembrete: number;
  media: number | null;
}

export function resumir(rows: AvaliacaoRow[]): Resumo {
  const respondidas = rows.filter((r) => r.status === "respondido").length;
  const notas = rows.map((r) => r.nota_media).filter((n): n is number => n != null);
  return {
    enviadas: rows.length,
    respondidas,
    taxa: rows.length ? (respondidas / rows.length) * 100 : 0,
    pendentes: rows.filter((r) => r.status !== "respondido").length,
    lembrete: rows.filter((r) => r.status === "lembrete").length,
    media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
  };
}

export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}
