import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UPSTREAM = "https://api-iasam.samel.com.br/vidas-operadora/agrupado";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ status: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ status: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const allowed = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "diretora"
    );
    if (!allowed) {
      return new Response(JSON.stringify({ status: false, message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aceita ds_classificacao via query string OU body JSON
    let dsClassificacao: string | null = null;
    const url = new URL(req.url);
    dsClassificacao = url.searchParams.get("ds_classificacao");
    if (!dsClassificacao && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        if (body && typeof body.ds_classificacao === "string") {
          dsClassificacao = body.ds_classificacao;
        }
      } catch {
        // ignora body inválido
      }
    }

    const upstreamUrl = new URL(UPSTREAM);
    if (dsClassificacao && dsClassificacao.trim() && dsClassificacao !== "TODOS") {
      upstreamUrl.searchParams.set("ds_classificacao", dsClassificacao);
    }

    const r = await fetch(upstreamUrl.toString(), { method: "GET" });
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
