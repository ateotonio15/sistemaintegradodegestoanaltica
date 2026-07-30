import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ORBIT_URL = "https://orbit-samel.lovable.app/api/public/daily-companies";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ORBIT_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ORBIT_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    if (entries.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma empresa selecionada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = { entries };
    if (body?.date) payload.date = body.date;

    const res = await fetch(ORBIT_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let out: unknown;
    try { out = JSON.parse(text); } catch { out = { raw: text }; }

    return new Response(JSON.stringify(out), {
      status: res.ok ? 200 : res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
