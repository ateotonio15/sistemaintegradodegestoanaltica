// Admin-only edge function to manage broker (corretora) portal access.
// Actions: create | update | delete | reset_password | gerar_usuario | link_empresa | unlink_empresa | update_portal
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
  return (limpo.slice(0, 2).join("_").toUpperCase()) || "CORRETORA";
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

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin_interno", "admin"]);
    if (!roles || roles.length === 0) return json(403, { error: "Apenas admin ou admin_interno" });

    const body = await req.json();
    const action = String(body?.action ?? "");
    if (!action) return json(400, { error: "Ação obrigatória" });

    if (action === "create") {
      const nome = String(body.nome ?? "").trim();
      if (!nome) return json(400, { error: "Nome obrigatório" });
      const patch: Record<string, unknown> = {
        nome,
        cnpj: body.cnpj ?? null,
        email: body.email ?? null,
        telefone: body.telefone ?? null,
        responsavel: body.responsavel ?? null,
      };
      const { data, error } = await admin
        .from("corretoras")
        .insert(patch)
        .select("id")
        .single();
      if (error) throw error;
      return json(200, { ok: true, id: data.id });
    }

    const corretora_id = String(body?.corretora_id ?? "");
    if (!corretora_id) return json(400, { error: "corretora_id obrigatório" });

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      ["nome", "cnpj", "email", "telefone", "responsavel"].forEach((k) => {
        if (typeof body[k] === "string") patch[k] = body[k];
      });
      if (!Object.keys(patch).length) return json(400, { error: "Nada para atualizar" });
      const { error } = await admin.from("corretoras").update(patch).eq("id", corretora_id);
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
      const { error } = await admin.from("corretoras").update(patch).eq("id", corretora_id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === "delete") {
      // remove usuários vinculados (auth) e a corretora
      const { data: vincs } = await admin
        .from("corretora_usuarios")
        .select("user_id")
        .eq("corretora_id", corretora_id);
      for (const v of vincs ?? []) {
        try { await admin.auth.admin.deleteUser((v as any).user_id); } catch {}
      }
      const { error } = await admin.from("corretoras").delete().eq("id", corretora_id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === "link_empresa") {
      const empresa_id = String(body.empresa_id ?? "");
      if (!empresa_id) return json(400, { error: "empresa_id obrigatório" });
      const { error } = await admin
        .from("corretora_empresas")
        .insert({ corretora_id, empresa_id });
      if (error && !String(error.message).includes("duplicate")) throw error;
      return json(200, { ok: true });
    }

    if (action === "unlink_empresa") {
      const empresa_id = String(body.empresa_id ?? "");
      if (!empresa_id) return json(400, { error: "empresa_id obrigatório" });
      const { error } = await admin
        .from("corretora_empresas")
        .delete()
        .eq("corretora_id", corretora_id)
        .eq("empresa_id", empresa_id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    // Descobre o usuário vinculado à corretora
    const { data: vinc } = await admin
      .from("corretora_usuarios")
      .select("user_id")
      .eq("corretora_id", corretora_id)
      .limit(1)
      .maybeSingle();

    if (action === "reset_password") {
      if (!vinc?.user_id) return json(404, { error: "Corretora sem usuário. Gere um usuário primeiro." });
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

    if (action === "gerar_usuario") {
      const { data: cor, error: cErr } = await admin
        .from("corretoras")
        .select("nome")
        .eq("id", corretora_id)
        .single();
      if (cErr) throw cErr;
      const senhaInicial = genPassword(10);
      const base = gerarUsernameBase(cor.nome);
      const username = await resolverUsernameUnico(admin, base);
      const emailInterno = `${username.toLowerCase()}@corretora.interno`;

      let userId = vinc?.user_id as string | undefined;

      if (userId) {
        await admin.auth.admin.updateUserById(userId, {
          password: senhaInicial,
          email: emailInterno,
          user_metadata: { display_name: cor.nome, username },
        });
      } else {
        const { data: novo, error: userErr } = await admin.auth.admin.createUser({
          email: emailInterno,
          password: senhaInicial,
          email_confirm: true,
          user_metadata: { display_name: cor.nome, username },
        });
        if (userErr) throw userErr;
        userId = novo.user.id;
        await admin
          .from("corretora_usuarios")
          .insert({ user_id: userId, corretora_id });
        await admin.from("user_roles").insert({ user_id: userId, role: "comum" });
      }

      await admin
        .from("profiles")
        .update({ username, must_change_password: true, display_name: cor.nome })
        .eq("user_id", userId);

      return json(200, { ok: true, username, senha: senhaInicial });
    }

    return json(400, { error: "Ação inválida" });
  } catch (err) {
    return json(400, { error: String((err as Error)?.message || "Erro inesperado") });
  }
});
