import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um extrator de dados de contratos de plano de saúde brasileiros (documentos "Anexo 1").
Retorne SEMPRE um JSON válido com EXATAMENTE estes campos (use null quando não encontrar):
{
  "nome_empresa": string|null,
  "cnpj": string|null (apenas dígitos),
  "telefone": string|null,
  "inscricao_municipal": string|null,
  "inscricao_estadual": string|null,
  "endereco": string|null,
  "cep": string|null,
  "grupo_contrato": string|null,
  "valor_enfermaria_centavos": number|null (em centavos, ex: 12345 = R$ 123,45),
  "valor_apartamento_centavos": number|null (em centavos),
  "inicio_atendimento": string|null (formato YYYY-MM-DD)
}
Não inclua texto antes ou depois do JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Autenticação obrigatória ---
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

    // --- Verificação de role ---
    const { data: roles, error: rolesErr } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) {
      return new Response(JSON.stringify({ error: "Falha ao validar permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const allowed = ["admin", "comum", "vendas", "diretora", "financeiro"];
    if (!allowed.some((r) => roleSet.has(r))) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storage_path, mime_type } = await req.json();
    if (!storage_path || typeof storage_path !== "string"
        || !/^[A-Za-z0-9._\/\-]+$/.test(storage_path)
        || storage_path.includes("..")) {
      return new Response(JSON.stringify({ error: "storage_path inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vendas: só pode acessar anexos de implantações criadas pelo próprio usuário
    if (roleSet.has("vendas") && !roleSet.has("admin")
        && !roleSet.has("comum") && !roleSet.has("diretora") && !roleSet.has("financeiro")) {
      const { data: owned, error: ownErr } = await userClient
        .from("implantacao_anexos")
        .select("implantacao_id, implantacoes_contratos!inner(created_by)")
        .eq("storage_path", storage_path)
        .limit(1)
        .maybeSingle();
      if (ownErr || !owned || (owned as any).implantacoes_contratos?.created_by !== userId) {
        return new Response(JSON.stringify({ error: "Permissão negada" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: file, error: dlErr } = await admin.storage
      .from("anexos-implantacao")
      .download(storage_path);
    if (dlErr || !file) throw new Error("Falha ao baixar: " + dlErr?.message);

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const b64 = btoa(binary);
    const mime = mime_type || "application/pdf";

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste Anexo 1." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI: " + t);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let dados: any = {};
    try { dados = JSON.parse(content); } catch { dados = {}; }

    if (dados.cnpj) dados.cnpj = String(dados.cnpj).replace(/\D/g, "");

    return new Response(JSON.stringify({ dados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
