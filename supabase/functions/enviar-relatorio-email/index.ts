import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { enviarSmtp, type Anexo } from "../_shared/smtp.ts";

const Body = z.object({
  movimentacao_id: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  anexo_ids: z.array(z.string().uuid()).min(1).max(10),
});

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function hojeManaus(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());
}

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
    if (!papeis.some(p => ["admin", "comum", "administradoras"].includes(p))) return json({ error: "Sem permissão para enviar relatórios" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors }, 400);
    const { movimentacao_id, destinatarios, anexo_ids } = parsed.data;

    // Leituras com a sessão do usuário: respeitam as permissões existentes.
    const { data: mov } = await userClient.from("movimentacoes")
      .select("id, mes_referencia, periodo, data_envio_empresa, empresas(nome, codigo_contrato)")
      .eq("id", movimentacao_id).maybeSingle();
    if (!mov) return json({ error: "Movimentação não encontrada" }, 404);
    const { data: anexosRows } = await userClient.from("anexos_movimentacao")
      .select("id, nome_arquivo, storage_path, mime_type").eq("movimentacao_id", movimentacao_id).in("id", anexo_ids);
    if (!anexosRows || anexosRows.length !== anexo_ids.length) return json({ error: "Anexo não encontrado nesta movimentação" }, 400);

    const anexos: Anexo[] = [];
    let total = 0;
    for (const a of anexosRows) {
      const { data: blob, error } = await admin.storage.from("anexos-movimentacoes").download(a.storage_path);
      if (error || !blob) return json({ error: `Não foi possível ler o arquivo "${a.nome_arquivo}"` }, 500);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      total += bytes.length;
      anexos.push({ nome: a.nome_arquivo, mime: a.mime_type || "application/octet-stream", conteudo: bytes });
    }
    if (total > 15 * 1024 * 1024) return json({ error: "Os anexos passam de 15 MB" }, 400);

    // Remetente: o próprio cadastro do usuário (perfil Cadastro) ou o remetente geral.
    const { data: proprio } = await admin.from("config_email_remetente_usuario")
      .select("nome_remetente, email_remetente, email_resposta, assinatura_path").eq("user_id", u.user.id).maybeSingle();
    const { data: geral } = await admin.from("config_email_relatorios")
      .select("nome_remetente, email_remetente, email_resposta").eq("id", 1).maybeSingle();
    const rem = (papeis.includes("comum") && proprio) ? proprio : geral;
    const contaSmtp = Deno.env.get("SMTP_USER")!;
    const nomeRem = rem?.nome_remetente || "Samel";
    const replyTo = rem?.email_resposta || rem?.email_remetente || null;
    // Remetente visível: e-mail da pessoa que enviou (quando cadastrado); senão, a conta SMTP.
    const fromEmail = rem?.email_remetente || contaSmtp;

    const emp = (mov as any).empresas ?? {};
    const nome = String(emp.nome ?? "").toUpperCase();
    const codigo = emp.codigo_contrato ?? "";
    const [ano, mes] = String(mov.mes_referencia ?? "").split("-");
    const competencia = mes ? `${MESES[Number(mes) - 1]}/${ano}` : "";
    const assunto = `RELATORIOS PARA CONFERENCIA EMPRESA ${codigo} - ${nome}`.replace(/\s+/g, " ").trim();
    const texto = `Prezados,\n\nSegue em anexo o relatório de vidas da empresa ${codigo} - ${nome}${competencia ? `, referente a ${competencia}` : ""}, para conferência.\n\nPedimos, por gentileza, que confiram as informações e nos confirmem por este e-mail se está tudo correto ou se há alguma divergência.\n\nAtenciosamente,\n${nomeRem}\nSamel`;
    // Assinatura: a da pessoa que enviou (quando cadastrada); senão, a padrão da Samel.
    let assinatura: Uint8Array | null = null;
    let assinaturaMime = "image/png";
    const pathProprio = (papeis.includes("comum") && proprio?.assinatura_path) ? String(proprio.assinatura_path) : null;
    if (pathProprio && /^[0-9a-f-]{36}\.(png|jpg)$/.test(pathProprio)) {
      const { data: blob } = await admin.storage.from("assinaturas-email").download(pathProprio);
      if (blob) {
        assinatura = new Uint8Array(await blob.arrayBuffer());
        assinaturaMime = pathProprio.endsWith(".jpg") ? "image/jpeg" : "image/png";
      }
    }
    if (!assinatura) assinatura = await Deno.readFile(new URL("./assinatura-samel.png", import.meta.url));
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">${texto.split("\n").map(l => l ? esc(l) : "").join("<br>")}<br><img src="cid:assinatura-samel" alt="Assinatura Samel" style="max-width:460px;margin-top:16px"></div>`;

    await enviarSmtp({
      fromNome: nomeRem, fromEmail, replyTo, para: destinatarios, assunto, html, texto, anexos,
      inline: [{ cid: "assinatura-samel", nome: "assinatura.png", mime: assinaturaMime, conteudo: assinatura }],
    });

    const hoje = hojeManaus();
    const { error: errRel } = await userClient.from("movimentacao_relatorios").upsert({
      movimentacao_id, status: "Enviado", destinatarios: destinatarios.join(", "), data_envio: hoje, confirmacao: "Aguardando",
    }, { onConflict: "movimentacao_id" });
    if (!mov.data_envio_empresa) {
      await userClient.from("movimentacoes").update({ data_envio_empresa: hoje }).eq("id", movimentacao_id).is("data_envio_empresa", null);
    }
    return json({ ok: true, enviado_em: hoje, registro_salvo: !errRel, aviso: errRel?.message });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
