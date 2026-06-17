import type { Beneficiario, PaginatedResponse, VidasFilters } from "@/types/vidasSamel";

export const VIDAS_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";

function ensureBaseUrl(): string {
  if (!VIDAS_API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL não configurada. Defina o endpoint da API antes de usar Vidas Samel."
    );
  }
  return VIDAS_API_BASE_URL;
}

const TOKEN_KEY = "vidas_samel_token";
const USER_KEY = "vidas_samel_user";
// Legacy key – cleaned up on load to remove any plaintext password previously stored.
const LEGACY_CRED_KEY = "vidas_samel_cred";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export interface Credentials { username: string; password: string; }

// Remove any legacy plaintext credentials that may have been persisted by earlier versions.
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem(LEGACY_CRED_KEY)) {
    localStorage.removeItem(LEGACY_CRED_KEY);
  }
} catch {}

/**
 * Returns the last username used (for UX convenience only). Passwords are never
 * persisted on the client. Returns empty strings when no username is saved so
 * the login dialog appears instead of attempting auto-login with defaults.
 */
export function getSavedCredentials(): Credentials {
  try {
    const username = localStorage.getItem(USER_KEY) || "";
    return { username, password: "" };
  } catch {
    return { username: "", password: "" };
  }
}

/** Only stores the username – never the password. */
export function saveCredentials(c: Credentials) {
  try { localStorage.setItem(USER_KEY, c.username || ""); } catch {}
}

export async function login(credentials?: Credentials): Promise<string> {
  if (!credentials || !credentials.username || !credentials.password) {
    throw new Error("Credenciais necessárias para login");
  }
  const res = await fetch(`${ensureBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha no login (${res.status}) ${txt}`);
  }
  const json = await res.json();
  if (!json?.token) throw new Error("Resposta de login sem token");
  setToken(json.token);
  saveCredentials({ username: credentials.username, password: "" });
  return json.token as string;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function authedFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = getToken();
  if (!token) {
    if (onUnauthorized) onUnauthorized();
    throw new Error("Não autorizado. Faça login novamente.");
  }
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${ensureBaseUrl()}${path}`, { ...init, headers });
  if (res.status === 401 && !retried) {
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new Error("Não autorizado. Faça login novamente.");
  }
  return res;
}

function buildQuery(filters: VidasFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listVidas(filters: VidasFilters = {}): Promise<PaginatedResponse<Beneficiario>> {
  const res = await authedFetch(`/vidas-contrato${buildQuery(filters)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

export async function getVida(cd_pessoa_fisica: string): Promise<PaginatedResponse<Beneficiario>> {
  const res = await authedFetch(`/vidas-contrato/${encodeURIComponent(cd_pessoa_fisica)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

/**
 * Pagina /vidas-contrato e devolve todas as vidas, opcionalmente filtrando
 * localmente por classificação (compara DS_CLASSIFICACAO ou CD_CLASSIF_CONTRATO
 * se vier no payload). Para de paginar quando atinge `maxRows` (default 50.000).
 */
export async function listAllVidasParaContratos(opts: {
  classificacao?: string;
  maxRows?: number;
  pageSize?: number;
  onProgress?: (loaded: number, total: number) => void;
} = {}): Promise<Beneficiario[]> {
  const pageSize = opts.pageSize ?? 500;
  const maxRows = opts.maxRows ?? 50000;
  const wanted = (opts.classificacao ?? "").trim().toUpperCase();

  const matches = (b: Beneficiario): boolean => {
    if (!wanted) return true;
    const cd = (b as any).CD_CLASSIF_CONTRATO;
    if (cd !== undefined && cd !== null && String(cd).trim() === wanted) return true;
    const ds = (b.DS_CLASSIFICACAO ?? "").toString().toUpperCase().trim();
    if (!ds) return false;
    if (ds === wanted) return true;
    // Padrões "4", "4 - EMPRESARIAL", "4-EMPRESARIAL"
    const head = ds.split(/[\s\-]+/)[0];
    return head === wanted;
  };

  const out: Beneficiario[] = [];
  let page = 1;
  let totalPages = 1;
  let loaded = 0;
  do {
    const resp = await listVidas({ page, pageSize });
    const batch = resp.data ?? [];
    loaded += batch.length;
    totalPages = resp.pagination?.totalPages ?? 1;
    for (const b of batch) if (matches(b)) out.push(b);
    opts.onProgress?.(loaded, resp.pagination?.total ?? loaded);
    if (loaded >= maxRows) break;
    page += 1;
  } while (page <= totalPages);
  return out;
}

