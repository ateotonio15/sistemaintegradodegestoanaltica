// deno-lint-ignore-file
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (v: any) =>
  String(v ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // --- Auth obrigatória ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const { data: roles } = await userClient
      .from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const allowed = ["admin", "enfermeira"];
    if (!allowed.some((r) => roleSet.has(r))) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");

    const { triagem_id } = await req.json();
    if (!triagem_id) throw new Error("triagem_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: t, error } = await supabase
      .from("triagens")
      .select("*, empresa:empresas(nome)")
      .eq("id", triagem_id)
      .maybeSingle();
    if (error) throw error;
    if (!t) throw new Error("Triagem não encontrada");
    if (!t.email) throw new Error("Triagem sem e-mail do colaborador");

    const row = (label: string, value: any) =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555">${esc(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${esc(value)}</td></tr>`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;color:#111">
        <h1 style="color:#16a34a;margin:0 0 4px">Ficha de Bioimpedância</h1>
        <p style="color:#555;margin:0 0 16px">${esc(t.empresa?.nome ?? "")}</p>
        <h3 style="margin:16px 0 6px">Identificação</h3>
        <table style="width:100%;border-collapse:collapse">
          ${row("Nome", t.nome)}${row("CPF", t.cpf)}${row("Idade", t.idade)}${row("Setor", t.setor)}${row("Cargo", t.cargo)}
        </table>
        <h3 style="margin:16px 0 6px">Antropometria</h3>
        <table style="width:100%;border-collapse:collapse">
          ${row("Peso (kg)", t.peso_kg)}${row("Altura (cm)", t.altura_cm)}${row("IMC", t.imc)}
          ${row("Gordura %", t.gordura_pct)}${row("Massa muscular (kg)", t.massa_muscular_kg)}
          ${row("Água corporal %", t.agua_corporal_pct)}${row("TMB (kcal)", t.tmb_kcal)}
          ${row("Idade metabólica", t.idade_metabolica)}${row("Gordura visceral", t.gordura_visceral)}
        </table>
        <h3 style="margin:16px 0 6px">Sinais vitais</h3>
        <table style="width:100%;border-collapse:collapse">
          ${row("Pressão arterial", `${t.pas_mmhg ?? "—"}/${t.pad_mmhg ?? "—"} (${t.classificacao_pa ?? "—"})`)}
          ${row("Glicemia", `${t.glicemia_mg_dl ?? "—"} mg/dL (${t.classificacao_glicemia ?? "—"}${t.jejum ? ", jejum" : ""})`)}
          ${row("Frequência cardíaca", t.freq_cardiaca)}${row("Saturação O₂", t.sat_o2 ? t.sat_o2 + "%" : "—")}
        </table>
        ${t.recomendacao ? `<h3 style="margin:16px 0 6px">Recomendação</h3><p style="background:#f8fafc;padding:12px;border-radius:8px">${esc(t.recomendacao)}</p>` : ""}
        <p style="color:#888;font-size:12px;margin-top:24px">Risco geral: <strong>${esc(t.risco_geral ?? "—")}</strong></p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Saúde nas Empresas <onboarding@resend.dev>",
        to: [t.email],
        subject: `Sua Ficha de Bioimpedância — ${t.empresa?.nome ?? ""}`,
        html,
      }),
    });
    const out = await resp.json();
    if (!resp.ok) throw new Error(out?.message ?? "Falha ao enviar via Resend");

    await supabase.from("triagens").update({ enviado_email_em: new Date().toISOString() }).eq("id", triagem_id);
    return new Response(JSON.stringify({ ok: true, id: out.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("enviar-ficha-bio error", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
