// Sincronização automática da situação cadastral do CNPJ (consulta pública CNPJ.ws).
// Roda a cada minuto via agendamento e processa no máximo 3 empresas por execução,
// respeitando o limite da API pública (3 consultas/minuto). Display-only: nunca
// altera status nem dados da empresa — apenas grava o resultado da consulta.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const LOTE = 3;
const REConsultaHoras = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Unauthorized" }, 401);
    // Aceita chamada do agendamento (chave pública) ou de usuário logado.
    if (token !== anon) {
      const { data, error } = await createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser();
      if (error || !data?.user) return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: empresas, error: erroEmpresas } = await db.from("empresas").select("id,cnpj");
    if (erroEmpresas) return json({ ok: false, error: erroEmpresas.message }, 500);

    const limite = new Date(Date.now() - REConsultaHoras * 3600 * 1000).toISOString();
    const { data: recentes, error: erroRecentes } = await db.from("empresa_cnpj_situacao").select("empresa_id").gte("consultado_em", limite);
    if (erroRecentes) return json({ ok: false, error: erroRecentes.message }, 500);
    const recentesSet = new Set((recentes ?? []).map((r: { empresa_id: string }) => r.empresa_id));

    const pendentes = (empresas ?? []).filter((e: { id: string; cnpj: string | null }) => {
      const cnpj = (e.cnpj ?? "").replace(/\D/g, "");
      return cnpj.length === 14 && !recentesSet.has(e.id);
    });
    const lote = pendentes.slice(0, LOTE);

    let processados = 0;
    for (const empresa of lote) {
      const cnpj = (empresa.cnpj ?? "").replace(/\D/g, "");
      const registro: Record<string, unknown> = { empresa_id: empresa.id, cnpj, consultado_em: new Date().toISOString(), erro: null, situacao: "", situacao_desde: "", endereco: null };
      try {
        const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
        if (response.status === 404) {
          registro.erro = "Empresa não encontrada para este CNPJ.";
        } else if (!response.ok) {
          registro.erro = "Consulta indisponível no momento.";
        } else {
          const result = await response.json();
          const est = result?.estabelecimento;
          if (!est || typeof result?.razao_social !== "string") {
            registro.erro = "Consulta indisponível no momento.";
          } else {
            registro.situacao = typeof est.situacao_cadastral === "string" ? est.situacao_cadastral : "";
            registro.situacao_desde = typeof est.data_situacao_cadastral === "string" ? est.data_situacao_cadastral : "";
            registro.endereco = { cep: est.cep ?? "", cidade: est.cidade?.nome ?? "", uf: est.estado?.sigla ?? "" };
          }
        }
      } catch {
        registro.erro = "Consulta indisponível no momento.";
      }
      const { error: erroUpsert } = await db.from("empresa_cnpj_situacao").upsert(registro, { onConflict: "empresa_id" });
      if (!erroUpsert) processados++;
    }

    return json({ ok: true, processados, pendentes: pendentes.length - lote.length });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
