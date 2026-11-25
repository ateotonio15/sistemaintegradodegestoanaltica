// Consulta cadastral oficial de CPF (Etapa 5 — Vidas Ativas).
// Credenciais do serviço ficam só no servidor. CPF completo nunca vai para logs nem respostas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const CACHE_DIAS = 30;

type Status = "validado_oficial" | "divergencia" | "nao_localizado" | "situacao_atencao" | "indisponivel" | "sem_data_nasc";
type Resultado = { status: Status; situacao?: string | null };

const Item = z.object({ linha: z.number().int(), nome: z.string().max(200), cpf: z.string().max(20), data_nasc: z.string().max(20).optional().nullable() });
const Body = z.object({ implantacao_id: z.string().uuid().optional().nullable(), itens: z.array(Item).min(1).max(25) });

const dig = (v: string) => v.replace(/\D/g, "");
const mascara = (c: string) => `***.***.***-${c.slice(-2)}`;
function cpfOk(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === +c[9] && calc(10) === +c[10];
}
function dataIso(v?: string | null): string | null {
  const s = (v || "").trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
async function chave(cpf: string, nasc: string) {
  const pepper = Deno.env.get("CPF_HASH_PEPPER") || "";
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}|${cpf}|${nasc}`));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Ponto único de integração com o serviço oficial. Enquanto não houver serviço
// configurado, devolve "indisponível" — nunca inventa válido/inválido.
async function consultarServico(_cpf: string, _nasc: string): Promise<{ r: Resultado; origem: string }> {
  return { r: { status: "indisponivel" }, origem: "nao_configurado" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const user = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: cl, error: ce } = await user.auth.getClaims(auth.slice(7));
    const uid = cl?.claims?.sub; if (ce || !uid) return json({ error: "Não autenticado" }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
    const admin = createClient(url, srv);
    const desde = new Date(Date.now() - CACHE_DIAS * 864e5).toISOString();
    const out = [];
    for (const it of parsed.data.itens) {
      const cpf = dig(it.cpf);
      if (!cpfOk(cpf)) { out.push({ linha: it.linha, status: "ignorado" }); continue; } // inválido local nunca é consultado
      const nasc = dataIso(it.data_nasc);
      const base = { implantacao_id: parsed.data.implantacao_id ?? null, linha: it.linha, beneficiario: it.nome, cpf_mascarado: mascara(cpf), usuario_id: uid };
      let r: Resultado, origem: string, reaproveitado = false;
      const k = await chave(cpf, nasc || "");
      if (!nasc) { r = { status: "sem_data_nasc" }; origem = "siga"; }
      else {
        const { data: prev } = await admin.from("cpf_validacoes").select("status,situacao,origem")
          .eq("chave_consulta", k).neq("status", "indisponivel").neq("status", "sem_data_nasc")
          .gte("consultado_em", desde).order("consultado_em", { ascending: false }).limit(1).maybeSingle();
        if (prev) { r = { status: prev.status as Status, situacao: prev.situacao }; origem = prev.origem; reaproveitado = true; }
        else { const c = await consultarServico(cpf, nasc).catch(() => ({ r: { status: "indisponivel" as Status }, origem: "erro_tecnico" })); r = c.r; origem = c.origem; }
      }
      const { data: row } = await admin.from("cpf_validacoes").insert({ ...base, chave_consulta: k, status: r.status, situacao: r.situacao ?? null, origem: reaproveitado ? `${origem} (reaproveitada)` : origem }).select("consultado_em").single();
      out.push({ linha: it.linha, status: r.status, situacao: r.situacao ?? null, origem: reaproveitado ? `${origem} (reaproveitada)` : origem, consultado_em: row?.consultado_em ?? new Date().toISOString() });
    }
    return json({ resultados: out });
  } catch { return json({ error: "Consulta indisponível" }, 503); }
});
