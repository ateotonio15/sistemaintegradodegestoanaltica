import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function genPassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

// Gera "ADATA_ELECTRONICS" a partir de "Adata Electronics Ltda"
function gerarUsernameBase(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, " ") // remove pontuação
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const duas = limpo.slice(0, 2).join("_").toUpperCase();
  return duas || "EMPRESA";
}

async function resolverUsernameUnico(
  admin: ReturnType<typeof createClient>,
  base: string,
): Promise<string> {
  let candidato = base;
  let n = 1;
  // tenta base, depois base2, base3...
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin_interno")
      .maybeSingle();
    if (!role) throw new Error("Apenas admin_interno pode cadastrar empresas");

    const body = await req.json();
    const {
      nome,
      cnpj,
      valor_mensal,
      data_inicio,
      codigo_contrato,
    }: {
      nome: string;
      cnpj?: string;
      valor_mensal: number;
      data_inicio: string;
      codigo_contrato: string;
    } = body;

    if (!nome || !valor_mensal || !data_inicio || !codigo_contrato) {
      throw new Error(
        "Campos obrigatórios: nome, valor_mensal, data_inicio, codigo_contrato",
      );
    }

    // 1. Username único a partir do nome
    const base = gerarUsernameBase(nome);
    const username = await resolverUsernameUnico(admin, base);
    const emailInterno = `${username.toLowerCase()}@login.interno`;
    const codigoContrato = String(codigo_contrato).trim();
    const senhaInicial = genPassword(12);

    // 2. Criar empresa
    const { data: empresa, error: empErr } = await admin
      .from("empresas")
      .insert({
        nome,
        cnpj: cnpj ?? null,
        codigo_contrato: codigoContrato,
        email_empresa: emailInterno,
        status_empresa: "ativo",
        data_implantacao: data_inicio,
      })
      .select("id")
      .single();
    if (empErr) throw empErr;

    // 3. Contrato
    const { error: contratoErr } = await admin.from("contratos").insert({
      empresa_id: empresa.id,
      valor_mensal,
      data_inicio,
      status: "ativo",
    });
    if (contratoErr) throw contratoErr;

    // 4. Usuário no Auth
    const { data: novo, error: userErr } = await admin.auth.admin.createUser({
      email: emailInterno,
      password: senhaInicial,
      email_confirm: true,
      user_metadata: { display_name: nome, username },
    });
    if (userErr) {
      await admin.from("empresas").delete().eq("id", empresa.id);
      throw userErr;
    }
    const userId = novo.user.id;

    // 5. Preenche profile (username + troca de senha obrigatória)
    await admin
      .from("profiles")
      .update({
        username,
        must_change_password: true,
        display_name: nome,
      })
      .eq("user_id", userId);

    // 6. Vincular à empresa
    await admin.from("empresa_usuarios").insert({
      user_id: userId,
      empresa_id: empresa.id,
      papel: "admin_empresa",
    });

    // 7. Papel base
    await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "comum" });

    return new Response(
      JSON.stringify({
        empresa_id: empresa.id,
        user_id: userId,
        username,
        senha_inicial: senhaInicial,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = String((err as Error)?.message || "Erro inesperado");
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
