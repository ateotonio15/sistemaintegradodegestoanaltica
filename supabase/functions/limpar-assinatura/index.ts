import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const PROMPT = "Limpe esta imagem de assinatura manuscrita para uso em carta oficial. Mantenha exatamente os mesmos traços, formato e letras da assinatura, sem redesenhar nem inventar nada. Remova completamente o fundo (papel, sombras, linhas, manchas, textos impressos e ruídos), deixando o fundo branco puro. Deixe a tinta nítida, contínua, em tom escuro uniforme (preto-azulado), com bordas suaves e boa resolução. Recorte a imagem rente à assinatura, com pequena margem.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA não configurada" }, 500);
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getClaims(auth.slice(7));
    const uid = data?.claims?.sub;
    if (error || !uid) return json({ error: "Não autorizado" }, 401);
    const [{ data: a }, { data: c }] = await Promise.all([
      client.rpc("has_role", { _user_id: uid, _role: "admin" }),
      client.rpc("has_role", { _user_id: uid, _role: "comum" }),
    ]);
    if (!a && !c) return json({ error: "Sem permissão" }, 403);
    const { imagem } = await req.json();
    if (typeof imagem !== "string" || !/^data:image\/(png|jpeg);base64,/.test(imagem) || imagem.length > 8_000_000) return json({ error: "Envie uma imagem PNG ou JPG de até 5 MB" }, 400);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        modalities: ["image", "text"],
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: imagem } }] }],
      }),
    });
    if (r.status === 429) return json({ error: "Muitas solicitações à IA. Tente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!r.ok) return json({ error: "A IA não conseguiu limpar a imagem" }, 502);
    const out = await r.json();
    const img = out?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!img) return json({ error: "A IA não devolveu uma imagem" }, 502);
    return json({ imagem: img });
  } catch {
    return json({ error: "Não foi possível limpar a assinatura" }, 500);
  }
});
