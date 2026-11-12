// API somente leitura do SIGA para o backend do Portal Financeiro (HMAC, servidor-a-servidor, sem CORS).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  canonicalPath, decodeCursor, encodeCursor, verificarAssinatura,
  RE_COMPETENCIA, RE_PERIODO, RE_UUID, STATUS_VALIDOS, TIPOS_VALIDOS,
} from "./lib.ts";

const URL_EXPIRA_SEG = 120;

class ApiError extends Error {
  constructor(public status: number, public code: string, public title: string, detail: string) { super(detail); }
}

function problem(status: number, code: string, title: string, detail: string, correlationId: string) {
  return new Response(JSON.stringify({ type: `about:blank`, title, status, code, detail, correlation_id: correlationId }), {
    status, headers: { "Content-Type": "application/problem+json", "X-Correlation-Id": correlationId },
  });
}
const json = (body: unknown, correlationId: string) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "X-Correlation-Id": correlationId } });

const bad = (detail: string) => new ApiError(400, "PARAMETRO_INVALIDO", "Parâmetro inválido", detail);
function competencia(q: URLSearchParams) {
  const c = q.get("competencia");
  if (!c || !RE_COMPETENCIA.test(c)) throw bad("competencia obrigatória no formato YYYY-MM");
  return c;
}
function tipoContrato(q: URLSearchParams) {
  const t = q.get("tipo_contrato");
  if (t === null || t === "") return null;
  if (!TIPOS_VALIDOS.includes(t.toUpperCase())) throw bad("tipo_contrato deve ser EMPRESARIAL ou ADMINISTRADORA");
  return t.toUpperCase();
}

// deno-lint-ignore no-explicit-any
let _db: any = null;
const db = () => (_db ??= createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
}));

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(fn, args);
  if (error) {
    console.error(JSON.stringify({ nivel: "erro", rpc: fn, code: error.code, message: error.message }));
    throw new ApiError(500, "ERRO_INTERNO", "Erro interno", "Falha ao consultar o SIGA");
  }
  return data as any;
}

async function rotear(path: string, q: URLSearchParams) {
  const seg = path.split("/").filter(Boolean); // ["v1", ...]
  if (seg[0] !== "v1") throw new ApiError(404, "NAO_ENCONTRADO", "Não encontrado", "Rota inexistente");

  if (seg.length === 2 && seg[1] === "movimentacoes") {
    const periodo = q.get("periodo"), status = q.get("status"), cursor = q.get("cursor");
    if (periodo && !RE_PERIODO.test(periodo)) throw bad("periodo no formato DD-DD");
    if (status && !STATUS_VALIDOS.includes(status)) throw bad(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    const cnpj = q.get("cnpj") ? q.get("cnpj")!.replace(/\D/g, "") : null;
    if (cnpj !== null && (cnpj.length === 0 || cnpj.length > 14)) throw bad("cnpj inválido");
    const limitRaw = q.get("limit");
    const limit = limitRaw === null ? 100 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw bad("limit entre 1 e 500");
    const afterId = cursor ? decodeCursor(cursor) : null;
    if (cursor && !afterId) throw bad("cursor inválido");
    const r = await rpc("integracao_listar_movimentacoes", {
      p_competencia: competencia(q), p_periodo: periodo || null, p_status: status || null,
      p_contrato: q.get("contrato") || null, p_cnpj: cnpj, p_tipo_contrato: tipoContrato(q),
      p_after_id: afterId, p_limit: limit,
    });
    return { data: r.data, next_cursor: r.has_more && r.last_id ? encodeCursor(r.last_id) : null, has_more: !!r.has_more };
  }

  if (seg[1] === "movimentacoes" && seg.length >= 3 && seg.length <= 4) {
    const id = seg[2];
    if (!RE_UUID.test(id)) throw bad("id deve ser UUID");
    const naoEncontrada = () => new ApiError(404, "NAO_ENCONTRADO", "Não encontrado", "Movimentação não encontrada");
    if (seg.length === 3) {
      const r = await rpc("integracao_obter_movimentacao", { p_id: id });
      if (!r) throw naoEncontrada();
      return r;
    }
    if (seg[3] === "anexos") {
      const lista = (await rpc("integracao_listar_anexos", { p_movimentacao_id: id })) as any[];
      const expira = new Date(Date.now() + URL_EXPIRA_SEG * 1000).toISOString();
      const data = await Promise.all(lista.map(async ({ storage_path, ...a }) => {
        const { data: s } = storage_path
          ? await db().storage.from("anexos-movimentacoes").createSignedUrl(storage_path, URL_EXPIRA_SEG)
          : { data: null };
        return { ...a, url: s?.signedUrl ?? null, url_expira_em: s?.signedUrl ? expira : null };
      }));
      return { data };
    }
    if (seg[3] === "historico") return { data: await rpc("integracao_historico_movimentacao", { p_id: id }) };
  }

  if (seg.length === 2 && seg[1] === "resumo-periodos") {
    return await rpc("integracao_resumo_periodos", { p_competencia: competencia(q), p_tipo_contrato: tipoContrato(q) });
  }
  if (seg.length === 2 && seg[1] === "contratos-suspensos") {
    return { data: await rpc("integracao_contratos_suspensos", { p_competencia: competencia(q) }) };
  }
  throw new ApiError(404, "NAO_ENCONTRADO", "Não encontrado", "Rota inexistente");
}

export async function handler(req: Request): Promise<Response> {
  const inicio = Date.now();
  const cidIn = req.headers.get("X-Correlation-Id");
  const correlationId = cidIn && cidIn.length <= 100 ? cidIn : crypto.randomUUID();
  const client = req.headers.get("X-Siga-Client");
  const url = new URL(req.url);
  const path = canonicalPath(url.pathname, url.search);
  const rota = path ? path.split("?")[0] : url.pathname;
  let status = 200;
  try {
    if (req.method !== "GET") throw new ApiError(405, "METODO_NAO_PERMITIDO", "Método não permitido", "Somente GET");
    const secret = Deno.env.get("PORTAL_FINANCEIRO_HMAC_SECRET");
    if (!secret) throw new ApiError(500, "NAO_CONFIGURADO", "Não configurado", "Integração não configurada");
    const auth = await verificarAssinatura({
      secret, client, timestamp: req.headers.get("X-Siga-Timestamp"),
      signature: req.headers.get("X-Siga-Signature"), method: req.method, path, body: "",
    });
    if (!auth.ok) {
      console.warn(JSON.stringify({ nivel: "aviso", evento: "auth_falhou", motivo: auth.detail, canonical_path: path, correlation_id: correlationId }));
      throw new ApiError(401, "NAO_AUTORIZADO", "Não autorizado", auth.detail);
    }
    return json(await rotear(rota, url.searchParams), correlationId);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(500, "ERRO_INTERNO", "Erro interno", "Erro inesperado");
    if (!(e instanceof ApiError)) console.error(JSON.stringify({ nivel: "erro", erro: String(e), correlation_id: correlationId }));
    status = err.status;
    return problem(err.status, err.code, err.title, err.message, correlationId);
  } finally {
    console.log(JSON.stringify({ client, rota, status, duracao_ms: Date.now() - inicio, correlation_id: correlationId }));
  }
}

if (import.meta.main) Deno.serve(handler);
