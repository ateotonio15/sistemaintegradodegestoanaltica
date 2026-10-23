import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { carregarEResolver } from "../_shared/nfse-central-db.ts";

/**
 * Receptor de PDFs da Central de NFS-e (contrato v1).
 * Nunca anexa sem validação estrita (diferença zero). Enquanto o validador
 * servidor do PDF não existir, entregas elegíveis ficam em "validacao_inconclusiva".
 */
const CORTE_EMISSAO = Date.parse("2026-10-22T04:00:00Z"); // 22/10/2026 00:00 Manaus
const MAX_BYTES = 10 * 1024 * 1024;
const VALIDADOR_VERSAO = "v2-siga-estrito";

const Meta = z.object({
  versao_contrato: z.literal(1),
  entrega_id: z.string().uuid(),
  documento_origem_id: z.string().max(200).optional(),
  chave_acesso: z.string().min(10).max(80),
  cnpj_prestador: z.string().max(20),
  cnpj_tomador: z.string().max(20),
  numero_nfse: z.string().max(40).optional(),
  emitida_em: z.string().refine((s) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) && !isNaN(Date.parse(s)), "timestamp com fuso"),
  competencia_fiscal: z.string().max(10).optional(),
  pdf_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  pdf_tamanho_bytes: z.number().int().positive(),
  pdf_tipo: z.enum(["oficial", "gerado_central"]).optional(),
  gerador_versao: z.string().max(40).optional(),
  nome_arquivo: z.string().max(200).optional(),
  movimentacao_destino_id: z.string().uuid().optional(),
  homologacao: z.boolean().optional(),
});

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenOk(req: Request) {
  const esperado = Deno.env.get("CENTRAL_NFSE_TOKEN") ?? "";
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!esperado || recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);
  if (!tokenOk(req)) return json({ erro: "Credencial inválida" }, 401);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ erro: "multipart/form-data esperado" }, 400); }
  let metaRaw: unknown;
  try { metaRaw = JSON.parse(String(form.get("metadados") ?? "")); } catch { return json({ erro: "metadados JSON inválido" }, 400); }
  const parsed = Meta.safeParse(metaRaw);
  if (!parsed.success) return json({ erro: parsed.error.flatten().fieldErrors }, 400);
  const m = parsed.data;
  const file = form.get("arquivo");
  if (!(file instanceof File)) return json({ erro: "arquivo PDF ausente" }, 400);
  if (file.size > MAX_BYTES) return json({ erro: "PDF acima de 10 MB" }, 413);
  const bytes = await file.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  if (head !== "%PDF-") return json({ erro: "arquivo não é PDF" }, 400);
  const hash = await sha256Hex(bytes);
  if (hash !== m.pdf_sha256.toLowerCase() || bytes.byteLength !== m.pdf_tamanho_bytes)
    return json({ erro: "hash ou tamanho não conferem com os bytes recebidos" }, 400);
  const cnpjTomador = digits(m.cnpj_tomador);
  const cnpjPrestador = digits(m.cnpj_prestador);
  if (cnpjTomador.length !== 14 || cnpjPrestador.length !== 14) return json({ erro: "CNPJ com 14 dígitos obrigatório" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotência por entrega
  const { data: existente } = await db.from("nfse_recebimentos").select("*")
    .eq("origem", "central_nfse").eq("entrega_id", m.entrega_id).maybeSingle();
  if (existente) {
    if (existente.pdf_sha256 !== hash) return json({ recebimento_id: existente.id, estado: "conflito", motivo: "Mesma entrega com conteúdo diferente; nada foi sobrescrito." }, 409);
    await db.from("nfse_recebimentos").update({ tentativas: existente.tentativas + 1, updated_at: new Date().toISOString() }).eq("id", existente.id);
    return json({ recebimento_id: existente.id, estado: existente.estado === "vinculado" ? "vinculado" : existente.estado, ja_recebido: true, motivo: existente.motivo, anexo_financeiro_id: existente.anexo_financeiro_id });
  }

  const base = {
    origem: "central_nfse", entrega_id: m.entrega_id, documento_origem_id: m.documento_origem_id ?? null,
    chave_acesso: m.chave_acesso, cnpj_prestador: cnpjPrestador, cnpj_tomador: cnpjTomador,
    numero_nfse: m.numero_nfse ?? null, emitida_em: new Date(m.emitida_em).toISOString(),
    competencia_fiscal: m.competencia_fiscal ?? null, pdf_sha256: hash, pdf_tamanho_bytes: bytes.byteLength,
    pdf_tipo: m.pdf_tipo ?? null, gerador_versao: m.gerador_versao ?? null,
    nome_arquivo: (m.nome_arquivo ?? "nota.pdf").replace(/[^\w.\- ]/g, "_"),
    movimentacao_sugerida_id: m.movimentacao_destino_id ?? null, homologacao: m.homologacao === true, validador_versao: VALIDADOR_VERSAO,
  };

  const registrar = async (extra: Record<string, unknown>) => {
    const { data, error } = await db.from("nfse_recebimentos").insert({ ...base, ...extra }).select("id, estado, motivo").single();
    if (error) return json({ erro: "Falha ao registrar recebimento" }, 500);
    return json({ recebimento_id: data.id, estado: data.estado, motivo: data.motivo });
  };

  if (Date.parse(m.emitida_em) < CORTE_EMISSAO)
    return registrar({ estado: "fora_do_periodo", motivo: "Emissão anterior a 22/10/2026." });

  // Mesma nota já recebida em outra entrega
  const { data: mesmaNota } = await db.from("nfse_recebimentos").select("id, pdf_sha256, estado")
    .eq("origem", "central_nfse").eq("cnpj_prestador", cnpjPrestador).eq("chave_acesso", m.chave_acesso);
  if ((mesmaNota ?? []).some((r) => r.pdf_sha256 === hash))
    return registrar({ estado: "ja_recebido", motivo: "Mesma nota e mesmo PDF já recebidos em outra entrega." });

  // Guarda o PDF em área privada (fora dos anexos financeiros ativos)
  const storagePath = `${cnpjTomador}/${m.entrega_id}/${hash}.pdf`;
  const up = await db.storage.from("nfse-entrada").upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) return json({ erro: "Falha ao guardar o PDF" }, 500);
  const comArquivo = { storage_path: storagePath };

  if ((mesmaNota ?? []).length)
    return registrar({ ...comArquivo, estado: "validacao_inconclusiva", motivo: "Nova versão de PDF para nota já recebida; requer análise." });

  // Destino pelo CNPJ completo do tomador (regras compartilhadas)
  const r = await carregarEResolver(db, cnpjTomador, m.movimentacao_destino_id ?? null);
  return registrar({ ...comArquivo, estado: r.estado, motivo: r.motivo, movimentacao_destino_id: r.destino?.id ?? null, status_observado: r.destino ? "Faturado" : null });
});
