import { ASSINATURA_PADRAO_B64 } from "./assinatura-padrao.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { enviarSmtp, type Anexo } from "../_shared/smtp.ts";
import { dataCorteMovimentacao } from "../_shared/data-corte.ts";
import { montarVariaveis, renderizarModelo, temVariavel, corpoParaHtml, corpoParaTexto } from "../_shared/email-modelo-render.ts";
import { CENARIOS_ENVIO, montarEmailCenario, sugerirCenario, validarEscolhaCenario } from "../_shared/cenario-envio.ts";
import { baixarRelatorioPortal, validarContratoPortal, RELATORIOS_PORTAL } from "../_shared/portal-empresa-relatorios.ts";
import { concluirEnvioRelatorio } from "../_shared/registrar-envio-relatorio.ts";
import { BUCKET_ENVIOS, bytesPorCaminho, montarItensEnvio, type AnexoEnviado, type DestinoEnvio } from "../_shared/envios-empresa.ts";

const Body = z.object({
  movimentacao_id: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  // Opcional: cópia visível (Cc) escolhida na hora do envio.
  cc: z.array(z.string().email()).max(20).optional(),
  portal_jobs: z.array(z.object({ job_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), nr_contrato: z.number().int().positive(), tipo: z.enum(["pdf", "xlsx"]) })).length(2),
  // Relatórios dos demais contratos do grupo financeiro (somente quando esta é a linha do contrato principal).
  grupo_jobs: z.array(z.object({ job_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), nr_contrato: z.number().int().positive(), tipo: z.enum(["pdf", "xlsx"]) })).max(60).optional(),
  lote: z.boolean().optional(),
  // Opcional: PNG (base64) da última página do relatório, embutido no corpo do e-mail.
  resumo_png_base64: z.string().max(4_200_000).optional(),
  // Motor de cenários: ausente = e-mail padrão de conferência (comportamento anterior).
  cenario: z.enum(["dentro_periodo", "fora_periodo", "financeiro"]).optional(),
  justificativa: z.string().max(1000).optional(),
  motivo_alteracao: z.string().max(1000).optional(),
  // "Editar envio": vale só para este e-mail; o Modelo salvo não muda.
  assunto_editado: z.string().trim().min(3).max(300).optional(),
  corpo_editado: z.string().trim().min(10).max(20000).optional(),
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
    const grupo_jobs = parsed.data.grupo_jobs ?? [];
    const resumoPng = decodificarPng(resumo_png_base64);

    // Leituras com a sessão do usuário: respeitam as permissões existentes.
    const { data: mov } = await userClient.from("movimentacoes")
      .select("id, empresa_id, mes_referencia, periodo, data_envio_empresa, responsavel_movimentacao, empresas(nome, codigo_contrato, razao_social, vidas, responsavel_contrato, contrato_suspenso)")
      .eq("id", movimentacao_id).maybeSingle();
    if (!mov) return json({ error: "Movimentação não encontrada" }, 404);
    const empContrato = (mov as any).empresas;
    const contrato = validarContratoPortal(empContrato?.codigo_contrato);
    if (new Set(portal_jobs.map(j => j.tipo)).size !== 2 || portal_jobs.some(j => j.nr_contrato !== contrato)) return json({ error: "Relatório bloqueado: contrato diferente da empresa selecionada." }, 400);

    // Grupo financeiro: só o contrato principal envia; ele leva PDF e Excel de todos os contratos ativos do grupo.
    const { data: vinculo } = await userClient.from("grupos_financeiros_contratos")
      .select("grupo_id, grupos_financeiros(nome_grupo, status, contrato_principal_empresa_id)")
      .eq("empresa_id", (mov as any).empresa_id).eq("ativo", true).maybeSingle();
    const grupo = (vinculo as any)?.grupos_financeiros;
    const principalId = grupo?.status === "Ativo" ? grupo.contrato_principal_empresa_id : null;
    const membros: { empresa_id: string; contrato: number }[] = [];
    if (principalId && principalId !== (mov as any).empresa_id) {
      return json({ error: `Este contrato faz parte do grupo "${grupo.nome_grupo}". O relatório vai no e-mail do contrato principal.` }, 409);
    }
    if (principalId) {
      const { data: lista } = await userClient.from("grupos_financeiros_contratos")
        .select("empresa_id, empresas(codigo_contrato)").eq("grupo_id", (vinculo as any).grupo_id).eq("ativo", true);
      for (const m of (lista as any[]) ?? []) {
        if (m.empresa_id === principalId) continue;
        membros.push({ empresa_id: m.empresa_id, contrato: validarContratoPortal(m?.empresas?.codigo_contrato) });
      }
    }
    const esperado = membros.flatMap(m => [`${m.contrato}:pdf`, `${m.contrato}:xlsx`]).sort();
    const recebido = grupo_jobs.map(j => `${j.nr_contrato}:${j.tipo}`).sort();
    if (JSON.stringify(esperado) !== JSON.stringify(recebido)) return json({ error: "Os contratos do grupo mudaram. Abra o relatório novamente." }, 409);
    if (lote) {
      const { data: registro, error } = await userClient.from("movimentacao_relatorios").select("status, confirmacao, destinatarios, cc").eq("movimentacao_id", movimentacao_id).maybeSingle();
      if (error || registro?.status !== "Pronto para envio" || registro.confirmacao !== "Aguardando" || !registro.destinatarios?.trim()) return json({ error: "Este relatório não está mais pronto para envio." }, 409);
      const emails = registro.destinatarios.split(/[,;\s]+/).filter(Boolean).map((e: string) => e.toLowerCase()).sort();
      if (JSON.stringify(emails) !== JSON.stringify(destinatarios.map(e => e.toLowerCase()).sort())) return json({ error: "Os destinatários do lote foram alterados. Prepare novamente." }, 409);
      const ccSalvo = (registro.cc ?? "").split(/[,;\s]+/).filter(Boolean).map((e: string) => e.toLowerCase()).sort();
      const ccEnviado = (cc ?? []).map(e => e.toLowerCase()).sort();
      if (JSON.stringify(ccSalvo) !== JSON.stringify(ccEnviado)) return json({ error: "Os e-mails em cópia do lote foram alterados. Prepare novamente." }, 409);
    }
    const anexos: Anexo[] = [];
    const anexosEnviados: AnexoEnviado[] = [];
    let total = 0;
    // Cada arquivo é baixado de novo e conferido pelo número do próprio contrato.
    for (const job of [...portal_jobs, ...grupo_jobs]) {
      const arquivo = await baixarRelatorioPortal(job.nr_contrato, job, AbortSignal.timeout(60_000));
      const bytes = new Uint8Array(await arquivo.blob.arrayBuffer());
      total += bytes.length;
      anexos.push({ nome: arquivo.nome_arquivo, mime: RELATORIOS_PORTAL[job.tipo].mime, conteudo: bytes });
      anexosEnviados.push({ nome: arquivo.nome_arquivo, mime: RELATORIOS_PORTAL[job.tipo].mime, conteudo: bytes, contrato: String(job.nr_contrato), tipo: job.tipo });
    }
    if (total > 15 * 1024 * 1024) return json({ error: "Os anexos do grupo passam de 15 MB" }, 400);

    // Remetente: o próprio cadastro do usuário (perfil Cadastro) ou o remetente geral.
    const { data: proprio } = await admin.from("config_email_remetente_usuario")
      .select("nome_remetente, email_remetente, email_resposta, assinatura_path").eq("user_id", u.user.id).maybeSingle();
    const { data: geral } = await admin.from("config_email_relatorios")
      .select("nome_remetente, email_remetente, email_resposta").eq("id", 1).maybeSingle();
    const rem = ((papeis.includes("comum") || papeis.includes("administradoras")) && proprio) ? proprio : geral;
    const contaSmtp = Deno.env.get("SMTP_USER")!;
    const nomeRem = rem?.nome_remetente || "Samel";
    const replyTo = rem?.email_resposta || rem?.email_remetente || null;
    // Remetente visível: e-mail da pessoa que enviou (quando cadastrado); senão, a conta SMTP.
    const fromEmail = rem?.email_remetente || contaSmtp;

    const emp = (mov as any).empresas ?? {};
    const nome = String(emp.nome ?? "").toUpperCase();
    const codigo = emp.codigo_contrato ?? "";
    const corte = dataCorteMovimentacao(mov.periodo, mov.mes_referencia);
    const cenarioSugerido = sugerirCenario(hojeManaus(), corte);
    const cenario = parsed.data.cenario ?? "dentro_periodo";
    if (parsed.data.cenario) {
      const bloqueio = validarEscolhaCenario({ sugerido: cenarioSugerido, escolhido: cenario, justificativa: parsed.data.justificativa, motivoAlteracao: parsed.data.motivo_alteracao });
      if (bloqueio) return json({ error: bloqueio }, 400);
    }
    // Contrato suspenso: nada de e-mail de conferência para a empresa (segue a regra de suspensos).
    if (emp.contrato_suspenso && cenario !== "financeiro") return json({ error: "Contrato suspenso — envio para empresa não aplicável." }, 409);
    const { data: perfilEnvio } = await admin.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle();
    let assunto: string; let texto: string;
    let modeloInfo: { id: string | null; nome: string; versao: number | null; editado: boolean } = { id: null, nome: CENARIOS_ENVIO[cenario].modelo, versao: null, editado: false };
    if (parsed.data.cenario) {
      // Modelo ATIVO do cenário (Configurações > Modelos de E-mail). Sem modelo, não envia.
      const { data: modelo } = await admin.from("email_modelos").select("id, nome, versao, assunto, corpo")
        .eq("cenario", cenario).eq("status", "ativo").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      if (!modelo) return json({ error: "Nenhum modelo de e-mail ativo foi encontrado para este cenário." }, 409);
      const dados = montarVariaveis({
        empresa: emp.nome, razaoSocial: emp.razao_social, contrato: codigo, mesReferencia: mov.mes_referencia, periodo: mov.periodo, corte,
        responsavelContrato: emp.responsavel_contrato, responsavelMovimentacao: (mov as any).responsavel_movimentacao, vidas: emp.vidas,
        hojeISO: hojeManaus(), usuario: perfilEnvio?.display_name, justificativa: cenario === "financeiro" ? parsed.data.justificativa : "",
      });
      const r = renderizarModelo(modelo, dados);
      const editado = !!(parsed.data.assunto_editado || parsed.data.corpo_editado);
      assunto = parsed.data.assunto_editado ?? r.assunto;
      texto = parsed.data.corpo_editado ?? r.corpo;
      if (temVariavel(assunto) || temVariavel(texto)) return json({ error: "O e-mail ainda contém códigos de variável ({{...}}). Corrija antes de enviar." }, 400);
      // Variável sem dado só bloqueia se o texto final ainda depende dela (sem edição manual).
      if (r.faltando.length && !editado) return json({ error: "Existem informações obrigatórias não preenchidas.", faltando: r.faltando }, 400);
      modeloInfo = { id: modelo.id, nome: modelo.nome, versao: modelo.versao, editado };
    } else {
      ({ assunto, texto } = montarEmailCenario(cenario, { codigo, nome, corte, justificativa: parsed.data.justificativa }));
    }
    const fechamento = ["Permanecerei à disposição.", "", "Cordialmente,"];
    // Assinatura: a da pessoa que enviou (quando cadastrada); senão, a padrão da Samel.
    let assinatura: Uint8Array | null = null;
    let assinaturaMime = "image/png";
    const pathProprio = ((papeis.includes("comum") || papeis.includes("administradoras")) && proprio?.assinatura_path) ? String(proprio.assinatura_path) : null;
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
    const comFechamento = /cordialmente/i.test(texto);
    const paragrafos = modeloInfo.id ? corpoParaHtml(texto) : texto.split("\n").filter(Boolean).map(l => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">${paragrafos}${imgResumo}${comFechamento ? "" : '<p style="margin:20px 0 12px">Permanecerei à disposição.</p><p style="margin:0 0 8px">Cordialmente,</p>'}<img src="cid:assinatura-samel" width="540" alt="Assinatura Samel" style="width:540px;max-width:100%;height:auto"></div>`;
    const textoBase = modeloInfo.id ? corpoParaTexto(texto) : texto;
    const textoCompleto = comFechamento ? textoBase : [textoBase, "", ...fechamento].join("\n");

    // Reconfere imediatamente antes do SMTP: alteração de contrato durante download bloqueia o envio.
    const { data: atual, error: erroAtual } = await userClient.from("movimentacoes").select("empresas(codigo_contrato)").eq("id", movimentacao_id).maybeSingle();
    if (erroAtual || validarContratoPortal((atual as any)?.empresas?.codigo_contrato) !== contrato) return json({ error: "O contrato da empresa foi alterado. Abra o relatório novamente." }, 409);
    const movimentacoesEnviadas = [movimentacao_id];
    let movsGrupo: { id: string; empresa_id: string; mes_referencia: string; periodo: string | null }[] = [];
    if (membros.length) {
      const { data: movsGrupoRes, error: erroGrupo } = await userClient.from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("empresa_id", membros.map(m => m.empresa_id)).eq("mes_referencia", mov.mes_referencia);
      if (erroGrupo) throw erroGrupo;
      movsGrupo = (movsGrupoRes ?? []) as typeof movsGrupo;
      movimentacoesEnviadas.push(...movsGrupo.map(m => m.id));
    }
    // Destino de cada arquivo: o do próprio contrato. Sem movimento do membro, vale o contexto do principal.
    const destinoPorContrato = new Map<string, DestinoEnvio>();
    destinoPorContrato.set(String(contrato), {
      movimentacaoId: movimentacao_id,
      empresaId: (mov as any).empresa_id,
      contrato: String(contrato),
      competencia: String(mov.mes_referencia ?? ""),
      periodo: (mov as any).periodo ?? null,
    });
    for (const m of membros) {
      const mv = movsGrupo.find(x => x.empresa_id === m.empresa_id);
      destinoPorContrato.set(String(m.contrato), {
        movimentacaoId: mv?.id ?? movimentacao_id,
        empresaId: m.empresa_id,
        contrato: String(m.contrato),
        competencia: String(mv?.mes_referencia ?? mov.mes_referencia ?? ""),
        periodo: mv?.periodo ?? (mov as any).periodo ?? null,
      });
    }
    const { data: perfil } = await admin.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle();
    const envioId = crypto.randomUUID();
    let smtpConcluido = false;
    let erroRegistro: string | undefined;
    try { await concluirEnvioRelatorio(async () => { await enviarSmtp({
      fromNome: nomeRem, fromEmail, replyTo, para: destinatarios,
      // Cópia visível escolhida na tela; a empresa vê quem está em cópia.
      cc: cc ?? [],
      // Cópia oculta para quem enviou, para o Cadastro guardar o e-mail enviado.
      bcc: [...new Set([fromEmail, replyTo].filter((e): e is string => !!e && /@/.test(e)))], assunto, html, texto: textoCompleto, anexos,
      inline: [
        ...(resumoPng ? [{ cid: cidResumo, nome: `resumo-contrato-${contrato}.png`, mime: "image/png", conteudo: resumoPng }] : []),
        { cid: "assinatura-samel", nome: "assinatura.png", mime: assinaturaMime, conteudo: assinatura },
      ],
    }); smtpConcluido = true; }, async () => {
      // Uma transação grava histórico e resumo; retry usa o mesmo ID e nunca reenvia o e-mail.
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { error } = await admin.rpc("registrar_envio_relatorio_concluido", {
          p_envio_id: envioId, p_principal: movimentacao_id, p_movimentacoes: movimentacoesEnviadas,
          p_usuario: u.user.id, p_nome: perfil?.display_name ?? "", p_destinatarios: destinatarios.join(", "),
          p_cc: (cc ?? []).join(", "), p_contrato: String(contrato),
        });
        if (!error) {
          // Cópia fiel do que foi enviado: alterar o modelo depois não muda este registro.
          await admin.from("movimentacao_email_envios").insert({
            envio_id: envioId, movimentacao_id, empresa_id: (mov as any).empresa_id, empresa_nome: emp.nome ?? null,
            contrato: String(contrato), competencia: mov.mes_referencia, periodo: (mov as any).periodo ?? null,
            cenario_sugerido: cenarioSugerido, cenario, modelo: modeloInfo.nome, modelo_id: modeloInfo.id, modelo_versao: modeloInfo.versao, editado_no_envio: modeloInfo.editado,
            destinatarios: destinatarios.join(", "), cc: (cc ?? []).join(", "),
            anexos: anexosEnviados.map(a => ({ nome: a.nome, contrato: a.contrato, tipo: a.tipo })),
            usuario_id: u.user.id, usuario_nome: perfil?.display_name ?? "",
            justificativa: cenario === "financeiro" ? parsed.data.justificativa?.trim() ?? null : null,
            motivo_alteracao: cenario !== cenarioSugerido ? (parsed.data.motivo_alteracao?.trim() || parsed.data.justificativa?.trim() || null) : null,
            assunto, corpo: textoCompleto,
          });
          // Envio direto ao Financeiro: usa a data já existente "Enviado Financ." (só se vazia).
          if (cenario === "financeiro") await admin.from("movimentacoes").update({ data_envio_financeiro: hojeManaus() }).eq("id", movimentacao_id).is("data_envio_financeiro", null);
          return;
        }
        erroRegistro = "O e-mail foi enviado, mas não foi possível registrar o histórico. Não reenvie apenas para corrigir o registro.";
      }
      throw new Error(erroRegistro);
    });
    } catch (e) {
      if (smtpConcluido) return json({ ok: true, enviado_em: hojeManaus(), registro_salvo: false, arquivo_salvo: false, aviso: erroRegistro }, 200);
      // Falha do servidor de e-mail: devolve a mensagem para a tela mostrar o aviso, sem quebrar a página.
      return json({ error: e instanceof Error ? e.message : String(e), falha_envio: true }, 200);
    }

    // E-mail enviado e histórico gravado: arquiva os arquivos no Repositório de Envios.
    // Falha aqui não reenvia, não desfaz e não esconde um envio já concluído.
    let arquivoSalvo = false;
    try {
      const itens = montarItensEnvio(anexosEnviados, destinoPorContrato, envioId);
      const bytes = bytesPorCaminho(anexosEnviados, destinoPorContrato, envioId);
      const gravados: typeof itens = [];
      for (const item of itens) {
        const conteudo = bytes.get(item.storage_path);
        if (!conteudo) continue;
        const { error } = await admin.storage.from(BUCKET_ENVIOS)
          .upload(item.storage_path, conteudo, { contentType: item.mime_type || "application/octet-stream", upsert: false });
        if (error) continue;
        gravados.push(item);
      }
      if (gravados.length) {
        const { error } = await admin.rpc("registrar_envio_empresa_arquivos", {
          p_envio_id: envioId, p_usuario: u.user.id, p_nome: perfil?.display_name ?? "", p_itens: gravados,
        });
        if (error) throw error;
      }
      arquivoSalvo = gravados.length > 0;
    } catch { arquivoSalvo = false; }

    return json({ ok: true, enviado_em: hojeManaus(), registro_salvo: true, arquivo_salvo: arquivoSalvo });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
