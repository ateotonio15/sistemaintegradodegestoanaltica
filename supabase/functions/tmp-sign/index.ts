import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const bucket = url.searchParams.get("b") || "anexos-financeiro";
  const path = url.searchParams.get("p") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 600);
  return new Response(JSON.stringify({ data, error }), { headers: { "content-type": "application/json" } });
});
