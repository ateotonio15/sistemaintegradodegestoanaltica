import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BASE = "https://api-agenda-cirurgica.samel.com.br/api/integracao";
const DATA_BR = /^\d{2}\/\d{2}\/\d{4}$/;
const NUM = /^\d+$/;
const LISTA_NUM = /^\d+(,\d+)*$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ sucesso: false, mensagem: "Não autorizado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error } = await userClient.auth.getUser();
    if (error || !u?.user) return json({ sucesso: false, mensagem: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const acao = String(body?.acao ?? "listar");
    const headers: Record<string, string> = { Accept: "application/json" };
    let url: string;

    if (acao === "health") {
      url = `${BASE}/health`;
    } else {
      const key = Deno.env.get("AGENDA_CIRURGICA_API_KEY");
      if (!key) return json({ sucesso: false, mensagem: "Chave da API não configurada." }, 500);
      headers["x-api-key"] = key;
      if (acao === "detalhe") {
        const nr = String(body?.nr_sequencia ?? "");
        if (!NUM.test(nr)) return json({ sucesso: false, mensagem: "nr_sequencia inválido" }, 400);
        url = `${BASE}/agendamentos/${nr}`;
      } else {
        const f = body?.filtros ?? {};
        const p = new URLSearchParams();
        const add = (k: string, v: unknown, re?: RegExp, max = 200) => {
          if (v === undefined || v === null || v === "") return;
          const s = String(v).trim().slice(0, max);
          if (!s) return;
          if (re && !re.test(s)) throw new Error(`Parâmetro inválido: ${k}`);
          p.set(k, s);
        };
        add("dt_inicio", f.dt_inicio, DATA_BR);
        add("dt_fim", f.dt_fim, DATA_BR);
        add("cd_agenda", typeof f.cd_agenda === "string" ? f.cd_agenda.replace(/\s/g, "") : f.cd_agenda, LISTA_NUM);
        add("cd_medico", f.cd_medico, NUM);
        add("cd_convenio", f.cd_convenio, NUM);
        add("cd_estabelecimento", f.cd_estabelecimento, NUM);
        add("nm_paciente", f.nm_paciente);
        add("nm_empresa", f.nm_empresa);
        add("ie_status_agenda", f.ie_status_agenda);
        const page = Math.max(1, Number(f.page) || 1);
        const limit = Math.min(500, Math.max(1, Number(f.limit) || 50));
        p.set("page", String(page));
        p.set("limit", String(limit));
        url = `${BASE}/agendamentos?${p.toString()}`;
      }
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    let r: Response;
    try {
      r = await fetch(url, { headers, signal: ctrl.signal }).finally(() => clearTimeout(t));
    } catch {
      // API inalcançável a partir da nuvem (rede interna Samel/VPN): responde 200
      // controlado para o cliente exibir a mensagem sem tratamento de erro HTTP.
      return json({ sucesso: false, mensagem: "A API da agenda cirúrgica não respondeu. Ela só é acessível na rede interna da Samel ou via VPN — use o modo \"Direto (rede interna/VPN)\" na tela." });
    }
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message;
    return json({ sucesso: false, mensagem: msg.startsWith("Parâmetro") ? msg : "Falha ao consultar a agenda cirúrgica." }, msg.startsWith("Parâmetro") ? 400 : 200);
  }
});
