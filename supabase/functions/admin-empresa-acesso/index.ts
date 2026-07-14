// Admin-only edge function to manage empresa portal access.
// Actions: reset_password | update_empresa | update_portal
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genPassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

function gerarUsernameBase(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (limpo.slice(0, 2).join("_").toUpperCase()) || "EMPRESA";
}

async function resolverUsernameUnico(admin: any, base: string): Promise<string> {
  let candidato = base;
  let n = 1;
  while (true) {
    const { data } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("username", candidato)
      .maybeSingle();
    if (!data) return candidato;
    n += 1;
    candidato = `${base}${n}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Não autorizado" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, service);
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claims } = await userClient.auth.getClaims(token);
    const callerId = claims?.claims?.sub;
    if (!callerId) return json(401, { error: "Não autorizado" });

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin_interno")
      .maybeSingle();
    if (!role) return json(403, { error: "Apenas admin_interno" });

    const body = await req.json();
    const action = String(body?.action ?? "");
    const empresa_id = String(body?.empresa_id ?? "");
    if (!action || !empresa_id) return json(400, { error: "Parâmetros obrigatórios" });

    // Descobre o usuário vinculado à empresa (papel admin_empresa)
    const { data: vinc } = await admin
      .from("empresa_usuarios")
      .select("user_id")
      .eq("empresa_id", empresa_id)
      .eq("papel", "admin_empresa")
      .limit(1)
      .maybeSingle();

    if (action === "reset_password") {
      if (!vinc?.user_id) return json(404, { error: "Usuário da empresa não encontrado" });
      const newPass = genPassword(12);
      const { error: upErr } = await admin.auth.admin.updateUserById(vinc.user_id, {
        password: newPass,
      });
      if (upErr) throw upErr;
      await admin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", vinc.user_id);
      return json(200, { ok: true, senha: newPass });
    }

    if (action === "update_empresa") {
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string") patch.nome = body.nome;
      if (typeof body.cnpj === "string") patch.cnpj = body.cnpj;
      if (!Object.keys(patch).length) return json(400, { error: "Nada para atualizar" });
      const { error } = await admin.from("empresas").update(patch).eq("id", empresa_id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === "update_portal") {
      const patch: Record<string, unknown> = {};
      if (typeof body.portal_ativo === "boolean") patch.portal_ativo = body.portal_ativo;
      if (body.portal_secoes && typeof body.portal_secoes === "object") {
        patch.portal_secoes = body.portal_secoes;
      }
      if (!Object.keys(patch).length) return json(400, { error: "Nada para atualizar" });
      const { error } = await admin.from("empresas").update(patch).eq("id", empresa_id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(400, { error: "Ação inválida" });
  } catch (err) {
    return json(400, { error: String((err as Error)?.message || "Erro inesperado") });
  }
});
