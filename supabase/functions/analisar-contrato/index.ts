import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um assistente especializado em analisar contratos de prestação de serviços para determinar elegibilidade de inclusão em plano de saúde empresarial.
Analise o contrato fornecido e extraia as informações no formato JSON especificado.
NÃO invente informações que não estejam explicitamente no texto — use null quando o dado não estiver presente.

Responda APENAS com um objeto JSON válido, sem texto adicional, no seguinte formato:
{
  "contratante": { "nome": "", "cnpj": "" },
  "contratado": { "nome": "", "documento": "", "tipo_documento": "CPF ou RG" },
  "tipo_vinculo": "PJ, CLT, ou não especificado",
  "valor_honorarios": "",
  "data_assinatura": "",
  "assinado_por_ambas_partes": true,
  "clausula_formalizacao_pj": true,
  "vigencia": "determinada ou indeterminada",
  "criterios_atendidos": [
    { "criterio": "descrição do critério", "atendido": true, "observacao": "breve justificativa baseada no texto" }
  ],
  "status_elegibilidade": "elegível, não elegível, ou revisar manualmente",
  "alertas": ["pontos que precisam de verificação humana"]
}
Em "atendido" use true, false ou a string "indeterminado".
Avalie UM item de "criterios_atendidos" para CADA critério de elegibilidade informado, na mesma ordem.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const allowed = ["admin", "comum", "vendas", "diretora", "financeiro", "administradoras"];
    if (!allowed.some((r) => roleSet.has(r))) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as { texto?: string; criterios?: string[] } | null;
    const texto = body?.texto?.toString().trim();
    const criterios = (body?.criterios ?? []).filter((c) => !!c && c.trim().length > 0);
    if (!texto) {
      return new Response(JSON.stringify({ error: "Texto do contrato vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const criteriosTxt = criterios.length
      ? criterios.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : "Nenhum critério específico informado — avalie apenas os dados extraídos e marque status_elegibilidade como 'revisar manualmente'.";

    const userMsg = `CRITÉRIOS DE ELEGIBILIDADE DA OPERADORA:\n${criteriosTxt}\n\nTEXTO DO CONTRATO:\n"""\n${texto.slice(0, 60000)}\n"""`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na análise de IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      data = m ? JSON.parse(m[0]) : {};
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analisar-contrato error", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
