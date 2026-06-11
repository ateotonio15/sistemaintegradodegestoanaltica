import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `Você extrai dados de um documento "Anexo I — Plano Coletivo Empresarial" (texto bruto fornecido pelo usuário) e retorna APENAS um JSON válido (sem markdown, sem comentários) com este formato exato:

{
  "nome": string | null,
  "cnpj": string | null,
  "telefone": string | null,
  "email": string | null,
  "responsavel": string | null,
  "vidas": number | null,
  "data_implantacao": string | null,
  "dia_vencimento": number | null,
  "valor_enfermaria_reais": number | null,
  "valor_apartamento_reais": number | null
}

Regras:
- Se um campo não existir ou estiver ilegível, retorne null.
- Datas em pt-BR (DD/MM/YYYY) devem ser convertidas para ISO (YYYY-MM-DD).
- Valores monetários: aceite "R$ 275,00" ou "R$: 250,00" e devolva número em reais com ponto decimal.
- Retorne SOMENTE o JSON, nada antes ou depois.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { data: roles, error: rolesErr } = await userClient
      .from('user_roles').select('role').eq('user_id', userId);
    if (rolesErr) {
      return new Response(JSON.stringify({ error: 'Falha ao validar permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const allowed = ['admin', 'comum', 'vendas', 'diretora', 'financeiro'];
    if (!allowed.some((r) => roleSet.has(r))) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null) as { text?: string } | null;
    const text = body?.text?.toString().trim();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Texto do anexo vazio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text.slice(0, 20000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI gateway error', aiRes.status, errText);
      return new Response(JSON.stringify({ error: 'Falha na IA', detail: errText }), {
        status: aiRes.status === 402 || aiRes.status === 429 ? aiRes.status : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await aiRes.json();
    const content = json?.choices?.[0]?.message?.content ?? '{}';
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      data = match ? JSON.parse(match[0]) : {};
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-anexo1 error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
