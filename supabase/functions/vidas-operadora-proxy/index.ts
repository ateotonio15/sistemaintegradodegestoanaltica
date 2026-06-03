import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UPSTREAM = "https://api-iasam.samel.com.br/vidas-operadora/agrupado";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const r = await fetch(UPSTREAM, { method: "GET" });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ status: false, message: (e as Error).message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
