import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { enviarSmtp } from "../_shared/smtp.ts";

const Contrato = z.object({
  codigo: z.string().min(1).max(30), nome: z.string().min(1).max(200),
  titulares: z.number().int().min(0), dependentes: z.number().int().min(0), total: z.number().int().min(0),
  modulos: z.array(z.object({ nome: z.string().min(1).max(120), qtd: z.number().int().min(0) })).max(40),
});
const Body = z.object({
  administradora: z.string().min(1).max(200),
  vigencia: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  para: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  contratos: z.array(Contrato).min(1).max(30),
});
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!u.user) return json({ error: "Sessão inválida" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const papeis = (roles ?? []).map((r: { role: string }) => r.role);
    if (!papeis.some((p) => ["admin", "comum", "administradoras"].includes(p))) return json({ error: "Sem permissão para enviar" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors }, 400);
    const { administradora, vigencia, para, cc, contratos } = parsed.data;

    // Só contratos de Administradora que o usuário consegue ver.
    const { data: emps } = await userClient.from("empresas").select("codigo_contrato").eq("tipo_contrato", "ADMINISTRADORA").in("codigo_contrato", contratos.map((c) => c.codigo));
    const ok = new Set((emps ?? []).map((e: any) => String(e.codigo_contrato)));
    if (contratos.some((c) => !ok.has(c.codigo))) return json({ error: "Há contrato que não é de Administradora." }, 400);

    const { data: proprio } = await admin.from("config_email_remetente_usuario").select("nome_remetente, email_remetente, email_resposta").eq("user_id", u.user.id).maybeSingle();
    const { data: geral } = await admin.from("config_email_relatorios").select("nome_remetente, email_remetente, email_resposta").eq("id", 1).maybeSingle();
    const rem = ((papeis.includes("comum") || papeis.includes("administradoras")) && proprio) ? proprio : geral;
    const fromEmail = rem?.email_remetente || Deno.env.get("SMTP_USER")!;
    const replyTo = rem?.email_resposta || rem?.email_remetente || null;

    const codigos = contratos.map((c) => c.codigo);
    const lista = codigos.length > 1 ? `${codigos.slice(0, -1).join(", ")} e ${codigos.at(-1)}` : codigos[0];
    const saud = new Date().getUTCHours() - 4 < 12 ? "Bom dia!" : "Boa tarde!";
    const intro = `Confirmo o fechamento da vigência ${vigencia} do${codigos.length > 1 ? "s" : ""} contrato${codigos.length > 1 ? "s" : ""} ${lista} – ${administradora}.`;
    const td = "border:1px solid #000;padding:2px 8px;font-size:12px";
    const bloco = (c: z.infer<typeof Contrato>) => `
      <td style="vertical-align:top;padding:8px">
        <div style="border:3px solid #000;padding:10px 14px;min-width:320px">
          <p style="margin:0 0 6px;font-weight:bold;font-size:15px">${esc(c.codigo)} ${esc(c.nome)}</p>
          <table style="border-collapse:collapse;margin-left:20px">
            <tr><td style="${td};font-weight:bold">Total de Dependentes:</td><td style="${td}">${c.dependentes}</td></tr>
            <tr><td style="${td};font-weight:bold">Total de Beneficiário Titular:</td><td style="${td}">${c.titulares}</td></tr>
            <tr><td style="${td};font-weight:bold">Total:</td><td style="${td}">${c.total}</td></tr>
          </table>
          ${c.modulos.length ? `<p style="margin:4px 0 2px 20px;font-size:12px">Módulos:</p><table style="margin-left:20px">${c.modulos.map((m) => `<tr><td style="font-weight:bold;font-style:italic;font-size:15px;padding-right:40px">${esc(m.nome)}</td><td style="font-size:12px">${m.qtd}</td></tr>`).join("")}</table>` : ""}
        </div>
      </td>`;
    const linhas: string[] = [];
    for (let i = 0; i < contratos.length; i += 2) linhas.push(`<tr>${contratos.slice(i, i + 2).map(bloco).join("")}</tr>`);
    const html = `<div style="font-family:Arial,sans-serif;color:#000"><p>${saud}</p><p>${esc(intro).replace(esc(administradora), `<b>${esc(administradora)}</b>`)}</p><table>${linhas.join("")}</table></div>`;
    const texto = [saud, "", intro, "", ...contratos.flatMap((c) => [`${c.codigo} ${c.nome}`, `Total de Dependentes: ${c.dependentes}`, `Total de Beneficiário Titular: ${c.titulares}`, `Total: ${c.total}`, ...(c.modulos.length ? ["Módulos:", ...c.modulos.map((m) => `  ${m.nome}: ${m.qtd}`)] : []), ""])].join("\n");

    await enviarSmtp({ fromNome: rem?.nome_remetente || "Samel", fromEmail, replyTo, para, cc, bcc: [fromEmail], assunto: `FECHAMENTO VIGÊNCIA ${vigencia} - ${administradora} - CONTRATOS ${codigos.join(", ")}`, html, texto, anexos: [] });
    // Guarda os e-mails do Financeiro para o "Envio direto ao Financeiro" das Movimentações.
    await admin.from("config_emails_financeiro").upsert({ id: 1, para, cc: cc ?? [], atualizado_em: new Date().toISOString() });
    return json({ ok: true });
  } catch (e) {
    console.error("enviar-fechamento-administradora", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
