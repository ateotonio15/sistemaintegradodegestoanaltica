import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const db = supabase as any;

export type PerguntaTipo = "nota" | "multipla_escolha" | "texto_livre";

export interface Pergunta {
  id: string;
  template_id: string | null;
  pesquisa_id: string | null;
  texto: string;
  tipo: PerguntaTipo;
  opcoes: string[];
  obrigatoria: boolean;
  ordem: number;
}

export interface Pesquisa {
  id: string;
  palestra_id: string;
  token: string;
  aberta: boolean;
  created_at: string;
}

export const TIPO_LABEL: Record<PerguntaTipo, string> = {
  nota: "Nota (1 a 5)",
  multipla_escolha: "Múltipla escolha",
  texto_livre: "Texto livre",
};

/** Template padrão (o primeiro ativo) + suas perguntas */
export function useTemplatePadrao() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_template_padrao"],
    enabled: !!user,
    queryFn: async () => {
      const { data: tpl, error } = await db
        .from("palestra_pesquisa_templates")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!tpl) return null;
      const { data: perguntas } = await db
        .from("palestra_pesquisa_perguntas")
        .select("*")
        .eq("template_id", tpl.id)
        .order("ordem", { ascending: true });
      return { ...tpl, perguntas: (perguntas ?? []) as Pergunta[] };
    },
  });
}

/** Pesquisas existentes para uma lista de palestras */
export function usePesquisasPorPalestras(palestraIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_pesquisas", palestraIds.slice().sort().join(",")],
    enabled: !!user && palestraIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("palestra_pesquisas")
        .select("*")
        .in("palestra_id", palestraIds);
      if (error) throw error;
      return (data ?? []) as Pesquisa[];
    },
  });
}

export function usePerguntasPesquisa(pesquisaId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_perguntas", pesquisaId],
    enabled: !!user && !!pesquisaId,
    queryFn: async () => {
      const { data, error } = await db
        .from("palestra_pesquisa_perguntas")
        .select("*")
        .eq("pesquisa_id", pesquisaId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pergunta[];
    },
  });
}

/** Cria a pesquisa de uma palestra copiando as perguntas do template padrão */
export function useCriarPesquisa() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (palestraId: string) => {
      const { data: existente } = await db
        .from("palestra_pesquisas")
        .select("*")
        .eq("palestra_id", palestraId)
        .maybeSingle();
      if (existente) return existente as Pesquisa;

      const { data: nova, error } = await db
        .from("palestra_pesquisas")
        .insert({ palestra_id: palestraId, criado_por: user?.id ?? null })
        .select("*")
        .single();
      if (error) throw error;

      const { data: tpl } = await db
        .from("palestra_pesquisa_templates")
        .select("id")
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (tpl) {
        const { data: perguntas } = await db
          .from("palestra_pesquisa_perguntas")
          .select("*")
          .eq("template_id", tpl.id)
          .order("ordem", { ascending: true });
        if (perguntas?.length) {
          await db.from("palestra_pesquisa_perguntas").insert(
            perguntas.map((p: Pergunta) => ({
              pesquisa_id: nova.id,
              texto: p.texto,
              tipo: p.tipo,
              opcoes: p.opcoes,
              obrigatoria: p.obrigatoria,
              ordem: p.ordem,
            })),
          );
        }
      }
      return nova as Pesquisa;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pp_pesquisas"] });
      qc.invalidateQueries({ queryKey: ["pp_perguntas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar pesquisa"),
  });
}

export function useSalvarPerguntas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pesquisaId,
      perguntas,
      removidas,
    }: {
      pesquisaId: string;
      perguntas: Partial<Pergunta>[];
      removidas: string[];
    }) => {
      if (removidas.length) {
        const { error } = await db.from("palestra_pesquisa_perguntas").delete().in("id", removidas);
        if (error) throw error;
      }
      for (let i = 0; i < perguntas.length; i++) {
        const p = perguntas[i];
        const payload = {
          pesquisa_id: pesquisaId,
          texto: p.texto,
          tipo: p.tipo,
          opcoes: p.opcoes ?? [],
          obrigatoria: p.obrigatoria ?? true,
          ordem: i + 1,
        };
        if (p.id && !String(p.id).startsWith("novo-")) {
          const { error } = await db
            .from("palestra_pesquisa_perguntas")
            .update(payload)
            .eq("id", p.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("palestra_pesquisa_perguntas").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Perguntas salvas");
      qc.invalidateQueries({ queryKey: ["pp_perguntas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar perguntas"),
  });
}

export function useToggleAberta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aberta }: { id: string; aberta: boolean }) => {
      const { error } = await db.from("palestra_pesquisas").update({ aberta }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pp_pesquisas"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar pesquisa"),
  });
}

/** Salva as perguntas atuais como novo template padrão */
export function useSalvarComoPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, perguntas }: { nome: string; perguntas: Partial<Pergunta>[] }) => {
      await db.from("palestra_pesquisa_templates").update({ ativo: false }).eq("ativo", true);
      const { data: tpl, error } = await db
        .from("palestra_pesquisa_templates")
        .insert({ nome, ativo: true })
        .select("id")
        .single();
      if (error) throw error;
      if (perguntas.length) {
        await db.from("palestra_pesquisa_perguntas").insert(
          perguntas.map((p, i) => ({
            template_id: tpl.id,
            texto: p.texto,
            tipo: p.tipo,
            opcoes: p.opcoes ?? [],
            obrigatoria: p.obrigatoria ?? true,
            ordem: i + 1,
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Conjunto salvo como padrão");
      qc.invalidateQueries({ queryKey: ["pp_template_padrao"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar padrão"),
  });
}

export interface RespostaItemFlat {
  resposta_id: string;
  respondido_em: string;
  pesquisa_id: string;
  palestra_id: string;
  empresa: string;
  tema: string | null;
  data: string;
  pergunta_id: string;
  pergunta: string;
  tipo: PerguntaTipo;
  valor_nota: number | null;
  valor_texto: string | null;
}

/** Todos os resultados (respostas + palestra), para o dashboard */
export function useResultadosPesquisas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_resultados"],
    enabled: !!user,
    queryFn: async () => {
      const { data: pesquisas, error: e1 } = await db
        .from("palestra_pesquisas")
        .select("id, palestra_id, token, aberta");
      if (e1) throw e1;
      if (!pesquisas?.length) return [] as RespostaItemFlat[];

      const palestraIds = pesquisas.map((p: any) => p.palestra_id);
      const { data: palestras } = await db
        .from("palestras_saude")
        .select("id, empresa, tema, data")
        .in("id", palestraIds);
      const palestraMap = new Map<string, any>((palestras ?? []).map((p: any) => [p.id, p]));

      const pesquisaIds = pesquisas.map((p: any) => p.id);
      const { data: respostas } = await db
        .from("palestra_pesquisa_respostas")
        .select("id, pesquisa_id, respondido_em")
        .in("pesquisa_id", pesquisaIds);
      if (!respostas?.length) return [] as RespostaItemFlat[];

      const respostaMap = new Map<string, any>((respostas ?? []).map((r: any) => [r.id, r]));
      const { data: itensReais } = await db
        .from("palestra_pesquisa_respostas_itens")
        .select("resposta_id, pergunta_id, valor_nota, valor_texto")
        .in("resposta_id", respostas.map((r: any) => r.id));

      const perguntaIds = Array.from(new Set((itensReais ?? []).map((i: any) => i.pergunta_id)));
      const { data: perguntas } = perguntaIds.length
        ? await db
            .from("palestra_pesquisa_perguntas")
            .select("id, texto, tipo")
            .in("id", perguntaIds)
        : { data: [] };
      const perguntaMap = new Map<string, any>((perguntas ?? []).map((p: any) => [p.id, p]));
      const pesquisaMap = new Map<string, any>(pesquisas.map((p: any) => [p.id, p]));

      return (itensReais ?? []).map((i: any) => {
        const resp = respostaMap.get(i.resposta_id);
        const pes = pesquisaMap.get(resp?.pesquisa_id);
        const pal = palestraMap.get(pes?.palestra_id);
        const q = perguntaMap.get(i.pergunta_id);
        return {
          resposta_id: i.resposta_id,
          respondido_em: resp?.respondido_em,
          pesquisa_id: resp?.pesquisa_id,
          palestra_id: pes?.palestra_id,
          empresa: pal?.empresa ?? "—",
          tema: pal?.tema ?? null,
          data: pal?.data,
          pergunta_id: i.pergunta_id,
          pergunta: q?.texto ?? "",
          tipo: (q?.tipo ?? "nota") as PerguntaTipo,
          valor_nota: i.valor_nota,
          valor_texto: i.valor_texto,
        } as RespostaItemFlat;
      });
    },
  });
}

/** Contagem de respostas por pesquisa */
export function useContagemRespostas(pesquisaIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_contagem", pesquisaIds.slice().sort().join(",")],
    enabled: !!user && pesquisaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("palestra_pesquisa_respostas")
        .select("id, pesquisa_id")
        .in("pesquisa_id", pesquisaIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.pesquisa_id] = (map[r.pesquisa_id] ?? 0) + 1;
      });
      return map;
    },
  });
}
