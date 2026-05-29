import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `Você extrai dados de um documento "Anexo I — Plano Coletivo Empresarial" (texto bruto fornecido pelo usuário) e retorna APENAS um JSON válido (sem markdown, sem comentários) com este formato exato:

{
  "nome": string | null,                       // Nome/Razão social da Empresa (campo "Empresa:")
  "cnpj": string | null,                       // CNPJ no formato 00.000.000/0000-00
  "telefone": string | null,                   // Telefone (somente dígitos OU formatado, como aparece)
  "email": string | null,                      // E-mail (do campo "Fax / E-mail")
  "responsavel": string | null,                // Nome do "Responsável:"
  "vidas": number | null,                      // Total de Associados (coluna "Total"); se ausente, soma Principais + Dependentes
  "data_implantacao": string | null,           // "Início do Atendimento" em formato ISO YYYY-MM-DD
  "dia_vencimento": number | null,             // Dia (1-31) extraído da "Data de Pré-Pagamento"
  "valor_enfermaria_reais": number | null,     // Valor em reais do Plano Enfermaria (ex: 275.00)
  "valor_apartamento_reais": number | null     // Valor em reais do Plano Apartamento (ex: 385.00)
}

Regras:
- Se um campo não existir ou estiver ilegível, retorne null.
- Datas em pt-BR (DD/MM/YYYY) devem ser convertidas para ISO (YYYY-MM-DD).
- Valores monetários: aceite "R$ 275,00" ou "R$: 250,00" e devolva número em reais com ponto decimal.
- Retorne SOMENTE o JSON, nada antes ou depois.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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
