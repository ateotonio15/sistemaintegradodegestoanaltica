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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pp_pesquisas"] });
      qc.invalidateQueries({ queryKey: ["pp_pesquisa_geral"] });
    },
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
  origem: "palestra" | "acao";
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
        .select("id, palestra_id, token, aberta, tipo, titulo");
      if (e1) throw e1;
      if (!pesquisas?.length) return [] as RespostaItemFlat[];

      const palestraIds = pesquisas.map((p: any) => p.palestra_id).filter(Boolean);
      const { data: palestras } = palestraIds.length
        ? await db.from("palestras_saude").select("id, empresa, tema, data").in("id", palestraIds)
        : { data: [] };
      const palestraMap = new Map<string, any>((palestras ?? []).map((p: any) => [p.id, p]));

      const pesquisaIds = pesquisas.map((p: any) => p.id);
      const { data: respostas } = await db
        .from("palestra_pesquisa_respostas")
        .select("id, pesquisa_id, respondido_em, empresa_nome")
        .eq("teste", false)
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
          palestra_id: pes?.palestra_id ?? pes?.id,
          origem: (pes?.tipo === "acao" ? "acao" : "palestra") as "palestra" | "acao",
          empresa: pal?.empresa ?? resp?.empresa_nome ?? "—",
          tema: pal?.tema ?? null,
          data: pal?.data ?? String(resp?.respondido_em ?? "").slice(0, 10),
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
        .eq("teste", false)
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

/** Quantidade de respostas marcadas como teste (não entram nos resultados) */
export function useContagemTestes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_testes"],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await db
        .from("palestra_pesquisa_respostas")
        .select("id", { count: "exact", head: true })
        .eq("teste", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Apaga todas as respostas de teste */
export function useLimparTestes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: ids, error: e1 } = await db
        .from("palestra_pesquisa_respostas")
        .select("id")
        .eq("teste", true);
      if (e1) throw e1;
      const lista = (ids ?? []).map((r: any) => r.id);
      if (!lista.length) return 0;
      await db.from("palestra_pesquisa_respostas_itens").delete().in("resposta_id", lista);
      const { error } = await db.from("palestra_pesquisa_respostas").delete().in("id", lista);
      if (error) throw error;
      return lista.length;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} resposta(s) de teste removida(s)` : "Nenhuma resposta de teste");
      qc.invalidateQueries({ queryKey: ["pp_testes"] });
      qc.invalidateQueries({ queryKey: ["pp_resultados"] });
      qc.invalidateQueries({ queryKey: ["pp_contagem"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao limpar testes"),
  });
}

/** Perguntas padrão para a pesquisa das Ações de saúde */
export const PERGUNTAS_PADRAO_ACOES: Partial<Pergunta>[] = [
  { texto: "Como você avalia a ação de saúde realizada na sua empresa?", tipo: "nota", opcoes: [], obrigatoria: true },
  { texto: "Como você avalia o atendimento da equipe de saúde?", tipo: "nota", opcoes: [], obrigatoria: true },
  { texto: "A estrutura e o local da ação foram adequados?", tipo: "nota", opcoes: [], obrigatoria: true },
  {
    texto: "Qual ação você participou?",
    tipo: "multipla_escolha",
    opcoes: ["Triagem", "Aferição de sinais vitais", "Bioimpedância", "Exame preventivo/PSA", "Outra"],
    obrigatoria: true,
  },
  {
    texto: "Você recomendaria esta ação para outros colaboradores?",
    tipo: "multipla_escolha",
    opcoes: ["Sim", "Talvez", "Não"],
    obrigatoria: true,
  },
  { texto: "Deixe um comentário ou sugestão", tipo: "texto_livre", opcoes: [], obrigatoria: false },
];

/** Pesquisa geral única por tipo (QR Code e link únicos) */
export function usePesquisaGeral(tipo: "palestra" | "acao" = "palestra") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pp_pesquisa_geral", tipo],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("palestra_pesquisas")
        .select("*")
        .eq("geral", true)
        .eq("tipo", tipo)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as (Pesquisa & { geral: boolean; titulo: string | null; tipo: string }) | null;
    },
  });
}

/** Cria (uma única vez) a pesquisa geral do tipo informado */
export function useCriarPesquisaGeral(tipo: "palestra" | "acao" = "palestra") {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { data: existente } = await db
        .from("palestra_pesquisas")
        .select("*")
        .eq("geral", true)
        .eq("tipo", tipo)
        .maybeSingle();
      if (existente) return existente;

      const { data: nova, error } = await db
        .from("palestra_pesquisas")
        .insert({
          geral: true,
          tipo,
          palestra_id: null,
          titulo:
            tipo === "acao"
              ? "Pesquisa de Satisfação — Ações de Saúde"
              : "Pesquisa de Satisfação — Palestras de Saúde",
          criado_por: user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (tipo === "acao") {
        await db.from("palestra_pesquisa_perguntas").insert(
          PERGUNTAS_PADRAO_ACOES.map((p, i) => ({
            pesquisa_id: nova.id,
            texto: p.texto,
            tipo: p.tipo,
            opcoes: p.opcoes ?? [],
            obrigatoria: p.obrigatoria ?? true,
            ordem: i + 1,
          })),
        );
      } else {
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
      }
      return nova;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pp_pesquisa_geral"] });
      qc.invalidateQueries({ queryKey: ["pp_perguntas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar pesquisa geral"),
  });
}
