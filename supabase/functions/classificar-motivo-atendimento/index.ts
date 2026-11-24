import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "npm:ai";
import { z } from "npm:zod";
import { higienizarTexto } from "../_shared/lgpd-higienizar.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(300) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
    if (!claims?.claims?.sub) return json({ error: "Não autorizado" }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Requisição inválida" }, 400);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA não configurada" }, 500);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Lê com as permissões do usuário; só classifica o que ele pode ver e ainda não foi classificado
    const { data: rows, error } = await userClient.from("plantoes_atendimentos")
      .select("id, nome_cliente, assunto, observacao, motivo, classificacao_origem").in("id", parsed.data.ids);
    if (error) throw error;
    const pend = (rows ?? []).filter((r) => !r.motivo && r.classificacao_origem !== "manual");
    if (!pend.length) return json({ classificados: 0, falhas: 0 });

    const { data: listas } = await admin.from("atendimento_classificacao_listas").select("lista, valor, ordem").eq("ativo", true).order("ordem");
    const motivos = (listas ?? []).filter((l) => l.lista === "motivo").map((l) => l.valor);
    const especs = (listas ?? []).filter((l) => l.lista === "especialidade").map((l) => l.valor);
    if (!motivos.includes("Outros")) motivos.push("Outros");
    if (!especs.includes("Outras especialidades")) especs.push("Outras especialidades");

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const schema = z.object({ itens: z.array(z.object({
      n: z.number(), motivo: z.enum(motivos as [string, ...string[]]),
      especialidade: z.enum(especs as [string, ...string[]]).nullable(),
    })) });

    let classificados = 0, falhas = 0;
    for (let i = 0; i < pend.length; i += 40) {
      const lote = pend.slice(i, i + 40);
      const linhas = lote.map((r, k) => `${k + 1}. tipo/assunto: ${higienizarTexto(r.assunto ?? "")} | observação: ${higienizarTexto(r.observacao ?? "", [r.nome_cliente])}`).join("\n");
      const instructions = `Classifique cada atendimento de plano de saúde.
MOTIVO (use exatamente um): ${motivos.join("; ")}.
ESPECIALIDADE (somente quando o motivo for consulta com especialista; caso contrário null): ${especs.join("; ")}.
Entenda erros de digitação e variações (ex.: "endócrino" = Endocrinologia, "ortopedista" = Ortopedia, "dificuldade no aplicativo" = Dificuldade com o app Samel).
Se não tiver certeza, use "Outros" / "Outras especialidades". Retorne um item por atendimento, com n = número da linha.`;
      try {
        const result = streamText({
          model: provider.responses("openai/gpt-6.1-sol"),
          system: instructions,
          prompt: linhas,
          output: Output.object({ schema }),
          abortSignal: req.signal,
          providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
        });
        let out: z.infer<typeof schema>;
        try { out = await result.output as z.infer<typeof schema>; }
        catch (e) { if (NoObjectGeneratedError.isInstance(e)) out = { itens: [] }; else throw e; }
        const agora = new Date().toISOString();
        for (let k = 0; k < lote.length; k++) {
          const it = out.itens.find((x) => x.n === k + 1);
          const motivo = it?.motivo ?? "Outros";
          const esp = motivo === "Consulta com especialista" ? (it?.especialidade ?? "Outras especialidades") : null;
          await admin.from("plantoes_atendimentos").update({ motivo, especialidade: esp, classificacao_origem: it ? "ia" : "padrao", classificado_em: agora })
            .eq("id", lote[k].id).is("motivo", null);
          it ? classificados++ : falhas++;
        }
      } catch (e) {
        const st = (e as { statusCode?: number })?.statusCode;
        console.error("falha IA", st, String(e).slice(0, 300));
        if (st === 402 || st === 403) return json({ error: "IA indisponível (créditos ou permissão).", classificados, falhas: pend.length - classificados }, st);
        falhas += lote.length;
      }
    }
    return json({ classificados, falhas });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro ao classificar" }, 500);
  }
});
