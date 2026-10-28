import { ASSINATURA_PADRAO_B64 } from "./assinatura-padrao.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { enviarSmtp, type Anexo } from "../_shared/smtp.ts";
import { dataCorteMovimentacao } from "../_shared/data-corte.ts";
import { baixarRelatorioPortal, validarContratoPortal, RELATORIOS_PORTAL } from "../_shared/portal-empresa-relatorios.ts";

const Body = z.object({
  movimentacao_id: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  // Opcional: cópia visível (Cc) escolhida na hora do envio.
  cc: z.array(z.string().email()).max(20).optional(),
  portal_jobs: z.array(z.object({ job_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), nr_contrato: z.number().int().positive(), tipo: z.enum(["pdf", "xlsx"]) })).length(2),
  lote: z.boolean().optional(),
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

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));

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
    const { movimentacao_id, destinatarios, cc, portal_jobs, lote, resumo_png_base64 } = parsed.data;
    const resumoPng = decodificarPng(resumo_png_base64);

    // Leituras com a sessão do usuário: respeitam as permissões existentes.
    const { data: mov } = await userClient.from("movimentacoes")
      .select("id, mes_referencia, periodo, data_envio_empresa, empresas(nome, codigo_contrato)")
      .eq("id", movimentacao_id).maybeSingle();
    if (!mov) return json({ error: "Movimentação não encontrada" }, 404);
    const empContrato = (mov as any).empresas;
    const contrato = validarContratoPortal(empContrato?.codigo_contrato);
    if (new Set(portal_jobs.map(j => j.tipo)).size !== 2 || portal_jobs.some(j => j.nr_contrato !== contrato)) return json({ error: "Relatório bloqueado: contrato diferente da empresa selecionada." }, 400);
    if (lote) {
      const { data: registro, error } = await userClient.from("movimentacao_relatorios").select("status, confirmacao, destinatarios").eq("movimentacao_id", movimentacao_id).maybeSingle();
      if (error || registro?.status !== "Pronto para envio" || registro.confirmacao !== "Aguardando" || !registro.destinatarios?.trim()) return json({ error: "Este relatório não está mais pronto para envio." }, 409);
      const emails = registro.destinatarios.split(/[,;\s]+/).filter(Boolean).map((e: string) => e.toLowerCase()).sort();
      if (JSON.stringify(emails) !== JSON.stringify(destinatarios.map(e => e.toLowerCase()).sort())) return json({ error: "Os destinatários do lote foram alterados. Prepare novamente." }, 409);
    }
    const anexos: Anexo[] = [];
    let total = 0;
    for (const job of portal_jobs) {
      const arquivo = await baixarRelatorioPortal(contrato, job, AbortSignal.timeout(60_000));
      const bytes = new Uint8Array(await arquivo.blob.arrayBuffer());
      total += bytes.length;
      anexos.push({ nome: arquivo.nome_arquivo, mime: RELATORIOS_PORTAL[job.tipo].mime, conteudo: bytes });
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
    const cidResumo = `resumo-${crypto.randomUUID()}@samel`;
    const imgResumo = resumoPng ? `<img src="cid:${cidResumo}" width="760" alt="Resumo do relatório" style="width:760px;max-width:100%;height:auto;margin-top:8px;display:block">` : "";
    const paragrafos = texto.split("\n").filter(Boolean).map(l => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">${paragrafos}${imgResumo}<p style="margin:20px 0 12px">Permanecerei à disposição.</p><p style="margin:0 0 8px">Cordialmente,</p><img src="cid:assinatura-samel" width="540" alt="Assinatura Samel" style="width:540px;max-width:100%;height:auto"></div>`;
    const textoCompleto = [texto, "", ...fechamento].join("\n");

    // Reconfere imediatamente antes do SMTP: alteração de contrato durante download bloqueia o envio.
    const { data: atual, error: erroAtual } = await userClient.from("movimentacoes").select("empresas(codigo_contrato)").eq("id", movimentacao_id).maybeSingle();
    if (erroAtual || validarContratoPortal((atual as any)?.empresas?.codigo_contrato) !== contrato) return json({ error: "O contrato da empresa foi alterado. Abra o relatório novamente." }, 409);
    try { await enviarSmtp({
      fromNome: nomeRem, fromEmail, replyTo, para: destinatarios,
      // Cópia visível escolhida na tela; a empresa vê quem está em cópia.
      cc: cc ?? [],
      // Cópia oculta para quem enviou, para o Cadastro guardar o e-mail enviado.
      bcc: [...new Set([fromEmail, replyTo].filter((e): e is string => !!e && /@/.test(e)))], assunto, html, texto: textoCompleto, anexos,
      inline: [
        ...(resumoPng ? [{ cid: cidResumo, nome: `resumo-contrato-${contrato}.png`, mime: "image/png", conteudo: resumoPng }] : []),
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
