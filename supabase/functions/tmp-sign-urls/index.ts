import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const { bucket, paths } = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, 600);
  return new Response(JSON.stringify({ data, error }), { headers: { ...cors, "Content-Type": "application/json" } });
});
