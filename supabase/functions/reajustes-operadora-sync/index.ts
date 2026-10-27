// Sincronização diária automática dos reajustes da operadora (mesma regra do botão "Sincronizar").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UPSTREAM = "https://api-iasam.samel.com.br/reajuste-contratos/agrupado";

type Faixa = { QT_IDADE_INICIAL: number; QT_IDADE_FINAL: number; VL_PRECO_ATUAL: number };
type Plano = { NM_FANTASIA: string; FAIXAS_ETARIAS: Faixa[] };
type Api = { NR_SEQ_CONTRATO: number; NR_CONTRATO: number; NM_CONTRATO: string; TX_REAJUSTE: number; DT_REAJUSTE: string; PLANOS: Plano[] };

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function modalidade(nome: string) {
  const n = norm(nome);
  if (n.includes("executivo") || n.includes("apartamento")) return "apartamento";
  if (n.includes("empresarial") || n.includes("enfermaria") || /\benf\b/.test(n)) return "enfermaria";
  return null;
}
function faixas(p: Plano, tx: number) {
  const fator = 1 + (tx || 0) / 100;
  return (p.FAIXAS_ETARIAS ?? []).map((f) => {
    const reaj = Math.round(Number(f.VL_PRECO_ATUAL || 0) * 100);
    return { idade_inicial: f.QT_IDADE_INICIAL, idade_final: f.QT_IDADE_FINAL, reajustado: reaj, antigo: fator > 0 ? Math.round(reaj / fator) : reaj };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Agendamento autentica com token guardado em config_sync; senão exige usuário logado.
    const { data: cfg } = await db.from("config_sync").select("valor").eq("chave", "sync_reajustes_token").maybeSingle();
    const tokenAgendamento = req.headers.get("x-sync-token") ?? "";
    if (!cfg?.valor || tokenAgendamento !== cfg.valor) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ ok: false, error: "Unauthorized" }, 401);
      const { data, error } = await createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser();
      if (error || !data?.user) return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const r = await fetch(UPSTREAM);
    const body = await r.json();
    if (!body?.status) return json({ ok: false, error: body?.message || "API indisponível" }, 502);
    const api = (body.data ?? []) as Api[];

    const fetchAll = async (t: string, c: string) => {
      const all: any[] = [];
      for (let f = 0; ; f += 1000) {
        const { data, error } = await db.from(t).select(c).range(f, f + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    };
    const [emps, reas] = await Promise.all([fetchAll("empresas", "id,codigo_contrato,isento_reajuste"), fetchAll("reajustes_anuais", "empresa_id,ano")]);
    const porContrato = new Map<string, string>();
    const isentos = new Set<string>();
    emps.forEach((e) => {
      const c = String(e.codigo_contrato ?? "").trim().replace(/^0+/, "");
      if (e.isento_reajuste) isentos.add(e.id);
      if (c) porContrato.set(c, e.id);
    });
    const existentes = new Set(reas.map((x) => `${x.empresa_id}|${x.ano}`));

    let importados = 0; const falhas: string[] = [];
    for (const a of api) {
      const m = String(a.DT_REAJUSTE || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) continue;
      const ano = +m[1], mes = +m[2], data = `${m[1]}-${m[2]}-${m[3]}`;
      const empId = porContrato.get(String(a.NR_CONTRATO).replace(/^0+/, ""));
      if (!empId || isentos.has(empId) || existentes.has(`${empId}|${ano}`)) continue;
      const enf: any[] = [], apt: any[] = [];
      for (const p of a.PLANOS ?? []) {
        const md = modalidade(p.NM_FANTASIA);
        if (md === "enfermaria") enf.push(...faixas(p, a.TX_REAJUSTE));
        else if (md === "apartamento") apt.push(...faixas(p, a.TX_REAJUSTE));
      }
      try {
        const eU = enf.length === 1, aU = apt.length === 1;
        const rE = eU ? enf[0].reajustado : 0, rA = aU ? apt[0].reajustado : 0;
        const { data: ins, error } = await db.from("reajustes_anuais").insert({
          empresa_id: empId, ano, mes_reajuste: mes, data_aplicacao: data,
          competencia: `${String(mes).padStart(2, "0")}/${ano}`, percentual: a.TX_REAJUSTE,
          status: "reajustado", status_reajuste: "reajustado",
          possui_enfermaria: enf.length > 0, possui_apartamento: apt.length > 0,
          usa_faixa_etaria_enfermaria: enf.length > 1, usa_faixa_etaria_apartamento: apt.length > 1,
          percentual_unico_enfermaria: true, percentual_unico_apartamento: true,
          valor_antigo_enfermaria_centavos: eU ? enf[0].antigo : null, valor_reajustado_enfermaria_centavos: eU ? rE : null, valor_final_enfermaria_centavos: rE,
          valor_antigo_apartamento_centavos: aU ? apt[0].antigo : null, valor_reajustado_apartamento_centavos: aU ? rA : null, valor_final_apartamento_centavos: rA,
          meses_retroativos: 0,
          observacao: `Importado automaticamente da API operadora (contrato ${a.NR_CONTRATO}, seq ${a.NR_SEQ_CONTRATO})`,
          usuario_id: null, usuario_nome: "Sincronização automática",
        }).select("id").single();
        if (error) throw error;
        const fx = [
          ...(enf.length > 1 ? enf.map((f) => ({ ...f, modalidade: "enfermaria" })) : []),
          ...(apt.length > 1 ? apt.map((f) => ({ ...f, modalidade: "apartamento" })) : []),
        ].map((f) => ({
          reajuste_id: ins.id, modalidade: f.modalidade, idade_inicial: f.idade_inicial, idade_final: f.idade_final,
          percentual: a.TX_REAJUSTE, valor_atual_centavos: f.antigo, valor_reajustado_centavos: f.reajustado,
          valor_retroativo_centavos: 0, valor_final_centavos: f.reajustado,
        }));
        if (fx.length) { const { error: fe } = await db.from("reajuste_faixas").insert(fx); if (fe) throw fe; }
        await db.from("reajustes_historico").insert({
          reajuste_id: ins.id, empresa_id: empId, evento: "importado_api_operadora",
          observacao: `Reajuste ${a.TX_REAJUSTE}% em ${data.split("-").reverse().join("/")} importado automaticamente da API da operadora`,
          dados: a, usuario_id: null, usuario_nome: "Sincronização automática",
        });
        existentes.add(`${empId}|${ano}`);
        importados++;
      } catch (e) { falhas.push(`${a.NR_CONTRATO}: ${(e as Error).message ?? e}`); }
    }
    console.log(`sync reajustes: ${importados} importados, ${falhas.length} falhas`, falhas.slice(0, 5));
    return json({ ok: true, importados, falhas });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
