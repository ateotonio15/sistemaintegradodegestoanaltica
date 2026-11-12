// Funções puras da siga-api (testáveis sem rede).
const enc = new TextEncoder();

export const CLIENTE_PERMITIDO = "portal-financeiro";
export const JANELA_SEGUNDOS = 300;

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256hex(body: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(body)));
}

/** Trecho do pathname APÓS o segmento "/siga-api" + search exatamente como recebido. */
export function canonicalPath(pathname: string, search: string): string | null {
  const marker = "/siga-api";
  const i = pathname.indexOf(marker + "/");
  const resto = i >= 0 ? pathname.slice(i + marker.length) : null;
  if (!resto || !resto.startsWith("/v1/")) return null;
  return resto + (search ?? "");
}

export async function assinar(secret: string, timestamp: string, method: string, path: string, body = ""): Promise<string> {
  const canonical = `${timestamp}\n${method.toUpperCase()}\n${path}\n${await sha256hex(body)}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return "v1=" + hex(await crypto.subtle.sign("HMAC", key, enc.encode(canonical)));
}

export function iguaisTempoConstante(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export type ResultadoAuth = { ok: true } | { ok: false; detail: string };

export async function verificarAssinatura(
  opts: { secret: string; client: string | null; timestamp: string | null; signature: string | null;
          method: string; path: string | null; body?: string; agoraSeg?: number },
): Promise<ResultadoAuth> {
  if (opts.client !== CLIENTE_PERMITIDO) return { ok: false, detail: "Cliente não autorizado" };
  if (!opts.timestamp || !/^\d{1,12}$/.test(opts.timestamp)) return { ok: false, detail: "Timestamp ausente ou inválido" };
  const agora = opts.agoraSeg ?? Math.floor(Date.now() / 1000);
  if (Math.abs(agora - Number(opts.timestamp)) > JANELA_SEGUNDOS) return { ok: false, detail: "Timestamp fora da janela" };
  if (!opts.path) return { ok: false, detail: "Caminho inválido" };
  if (!opts.signature) return { ok: false, detail: "Assinatura ausente" };
  const esperado = await assinar(opts.secret, opts.timestamp, opts.method, opts.path, opts.body ?? "");
  if (!iguaisTempoConstante(esperado, opts.signature)) return { ok: false, detail: "Assinatura inválida" };
  return { ok: true };
}

export const encodeCursor = (id: string) =>
  btoa(id).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function decodeCursor(c: string): string | null {
  try {
    const s = atob(c.replace(/-/g, "+").replace(/_/g, "/"));
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
  } catch { return null; }
}

export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RE_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export const RE_PERIODO = /^\d{2}-\d{2}$/;
export const STATUS_VALIDOS = ["aguardando_envio", "enviado_empresa", "fora_do_prazo", "enviado_financeiro"];
export const TIPOS_VALIDOS = ["EMPRESARIAL", "ADMINISTRADORA"];
