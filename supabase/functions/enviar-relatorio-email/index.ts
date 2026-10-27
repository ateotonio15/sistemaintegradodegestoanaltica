import { ASSINATURA_PADRAO_B64 } from "./assinatura-padrao.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { enviarSmtp, type Anexo } from "../_shared/smtp.ts";
import { dataCorteMovimentacao } from "../_shared/data-corte.ts";

const Body = z.object({
  movimentacao_id: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  anexo_ids: z.array(z.string().uuid()).min(1).max(10),
  // Opcional: PNG (base64) da última página do relatório, embutido no corpo do e-mail.
  resumo_png_base64: z.string().max(4_200_000).optional(),
});

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
function decodificarPng(b64: string | undefined): Uint8Array | null {
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    if (!bytes.length || bytes.length > 3_200_000) return null;
    if (!PNG_MAGIC.every((v, i) => bytes[i] === v)) return null;
    return bytes;
  } catch { return null; }
}

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const { movimentacao_id, destinatarios, anexo_ids, resumo_png_base64 } = parsed.data;
    const resumoPng = decodificarPng(resumo_png_base64);

    // Leituras com a sessão do usuário: respeitam as permissões existentes.
    const { data: mov } = await userClient.from("movimentacoes")
      .select("id, mes_referencia, periodo, data_envio_empresa, empresas(nome, codigo_contrato)")
      .eq("id", movimentacao_id).maybeSingle();
    if (!mov) return json({ error: "Movimentação não encontrada" }, 404);
    const { data: anexosRows } = await userClient.from("movimentacao_relatorio_arquivos")
      .select("id, nome_arquivo, storage_path, mime_type").eq("movimentacao_id", movimentacao_id).in("id", anexo_ids);
    if (!anexosRows || anexosRows.length !== anexo_ids.length) return json({ error: "Anexo não encontrado nesta movimentação" }, 400);

    const anexos: Anexo[] = [];
    let total = 0;
    for (const a of anexosRows) {
      const { data: blob, error } = await admin.storage.from("relatorios-movimentacoes").download(a.storage_path);
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
    const corte = dataCorteMovimentacao(mov.periodo, mov.mes_referencia);
    const prazo = corte ? `até o dia ${corte}` : "até a data de corte";
    const assunto = `RELATORIOS PARA CONFERENCIA EMPRESA ${codigo} - ${nome}`.replace(/\s+/g, " ").trim();
    const texto = [
      "Prezados!",
      "",
      "Segue, em anexo, o relatório atualizado de beneficiários para conferência e validação do faturamento.",
      "",
      `Caso identifiquem alguma divergência, solicito que nos informem ${prazo}, para que possamos realizar os ajustes necessários antes da emissão da Nota Fiscal.`,
      "",
      "Ressalto que a conferência dentro do prazo é fundamental para evitar cobranças indevidas. Após a data de corte, a Nota Fiscal será emitida automaticamente com base no relatório encaminhado.",
      "",
      "Peço, por gentileza, que confirmem o recebimento e a validação do relatório. Na ausência de manifestação até o prazo informado, o faturamento seguirá normalmente.",
    ].join("\n");
    const fechamento = ["Permanecerei à disposição.", "", "Cordialmente,"];
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
    if (!assinatura) assinatura = Uint8Array.from(atob(ASSINATURA_PADRAO_B64), (c) => c.charCodeAt(0));
    // Resumo (última página do relatório) vai no corpo, entre o texto e a assinatura.
    const imgResumo = resumoPng ? `<img src="cid:resumo-relatorio" width="760" alt="Resumo do relatório" style="width:760px;max-width:100%;height:auto;margin-top:8px;display:block">` : "";
    const paragrafos = texto.split("\n").filter(Boolean).map(l => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">${paragrafos}${imgResumo}<p style="margin:20px 0 12px">Permanecerei à disposição.</p><p style="margin:0 0 8px">Cordialmente,</p><img src="cid:assinatura-samel" width="540" alt="Assinatura Samel" style="width:540px;max-width:100%;height:auto"></div>`;
    const textoCompleto = [texto, "", ...fechamento].join("\n");

    try { await enviarSmtp({
      fromNome: nomeRem, fromEmail, replyTo, para: destinatarios,
      // Cópia oculta para quem enviou, para o Cadastro guardar o e-mail enviado.
      bcc: [...new Set([fromEmail, replyTo].filter((e): e is string => !!e && /@/.test(e)))], assunto, html, texto: textoCompleto, anexos,
      inline: [
        ...(resumoPng ? [{ cid: "resumo-relatorio", nome: "resumo-relatorio.png", mime: "image/png", conteudo: resumoPng }] : []),
        { cid: "assinatura-samel", nome: "assinatura.png", mime: assinaturaMime, conteudo: assinatura },
      ],
    });
    } catch (e) {
      // Falha do servidor de e-mail: devolve a mensagem para a tela mostrar o aviso, sem quebrar a página.
      return json({ error: e instanceof Error ? e.message : String(e), falha_envio: true }, 200);
    }

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
