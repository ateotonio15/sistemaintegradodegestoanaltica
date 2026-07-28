import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um classificador de solicitações de empresas clientes.
Classifique a mensagem em UM setor e gere um resumo curto (máx. 140 caracteres) no imperativo.

CRITÉRIOS (siga estritamente):

FINANCEIRO → assuntos sobre nota fiscal, cobrança, valores errados, valores duplicados na nota, cancelamento de nota.

CADASTRO → movimentação não realizada, exclusão não realizada, inclusão não realizada, relatório de vidas não enviado, e-mail não respondido, vida ativa não excluída do relatório de vidas.

RELACIONAMENTO → qualquer assunto que não se encaixe claramente em FINANCEIRO ou CADASTRO acima. É o setor padrão/fallback quando houver dúvida.

Retorne SEMPRE via a ferramenta classificar_atendimento.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return json({ error: "Não autorizado" }, 401);

    const { mensagem, empresa_id } = await req.json();
    if (!mensagem || typeof mensagem !== "string" || !mensagem.trim()) {
      return json({ error: "Mensagem obrigatória" }, 400);
    }

    // Resolve empresa: usa a informada (validando acesso via RLS) ou o vínculo direto
    let empresaId: string | null = null;
    if (typeof empresa_id === "string" && empresa_id) {
      const { data: emp } = await userClient
        .from("empresas")
        .select("id")
        .eq("id", empresa_id)
        .maybeSingle();
      if (emp?.id) empresaId = emp.id;
    }
    if (!empresaId) {
      const { data: vinculo, error: vErr } = await userClient
        .from("empresa_usuarios")
        .select("empresa_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (vErr) throw vErr;
      empresaId = (vinculo?.empresa_id as string) ?? null;
    }
    if (!empresaId) {
      return json({ error: "Usuário sem empresa vinculada" }, 403);
    }


    // Chamar Lovable AI Gateway com tool calling para classificação estruturada
    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: mensagem },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classificar_atendimento",
                description:
                  "Registra a classificação e o resumo do atendimento.",
                parameters: {
                  type: "object",
                  properties: {
                    setor: {
                      type: "string",
                      enum: ["cadastro", "relacionamento", "financeiro"],
                      description: "Setor destino conforme critérios.",
                    },
                    resumo: {
                      type: "string",
                      description: "Resumo curto da solicitação (até 140 caracteres).",
                    },
                  },
                  required: ["setor", "resumo"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "classificar_atendimento" },
          },
        }),
      },
    );

    if (aiRes.status === 429) return json({ error: "Muitas requisições. Tente novamente em instantes." }, 429);
    if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados. Fale com o suporte." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`Falha na IA: ${aiRes.status} ${t.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const toolCall =
      aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let setor: "cadastro" | "relacionamento" | "financeiro" = "relacionamento";
    let resumo = mensagem.slice(0, 140);
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall);
        if (["cadastro", "relacionamento", "financeiro"].includes(parsed.setor)) {
          setor = parsed.setor;
        }
        if (typeof parsed.resumo === "string" && parsed.resumo.trim()) {
          resumo = parsed.resumo.trim().slice(0, 240);
        }
      } catch {
        // fallback: relacionamento
      }
    }

    // Salvar registro (RLS via user_pode_ver_empresa)
    const { data: novoAtd, error: insErr } = await userClient
      .from("atendimentos")
      .insert({
        empresa_id: empresaId,
        mensagem_original: mensagem.trim(),
        resumo,
        setor_destino: setor,
        setor_original: setor,
        status: "aberto",
      })
      .select("id, setor_destino, resumo, criado_em")
      .single();
    if (insErr) throw insErr;

    const nomesSetor: Record<string, string> = {
      cadastro: "Cadastro",
      relacionamento: "Relacionamento",
      financeiro: "Financeiro",
    };

    const resposta = `Sua solicitação foi encaminhada para o setor de **${nomesSetor[setor]}**. Já registramos o pedido e nossa equipe vai retornar em breve.\n\n*Resumo:* ${resumo}`;

    return json({
      atendimento_id: novoAtd.id,
      setor_destino: setor,
      resumo,
      resposta,
    });
  } catch (err) {
    const message = String((err as Error)?.message || "Erro inesperado");
    return json({ error: message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
