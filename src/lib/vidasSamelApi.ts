import type { Beneficiario, PaginatedResponse, VidasFilters } from "@/types/vidasSamel";

export const VIDAS_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "https://7d89d067-237e-4701-b281-3359d59c0e84-00-2zicaaljfkz2e.worf.replit.dev/api";

const TOKEN_KEY = "vidas_samel_token";
const CRED_KEY = "vidas_samel_cred";

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

export function getSavedCredentials(): Credentials {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { username: "admin", password: "admin" };
}
export function saveCredentials(c: Credentials) {
  try { localStorage.setItem(CRED_KEY, JSON.stringify(c)); } catch {}
}

export async function login(credentials?: Credentials): Promise<string> {
  const creds = credentials ?? getSavedCredentials();
  const res = await fetch(`${VIDAS_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha no login (${res.status}) ${txt}`);
  }
  const json = await res.json();
  if (!json?.token) throw new Error("Resposta de login sem token");
  setToken(json.token);
  saveCredentials(creds);
  return json.token as string;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function authedFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  let token = getToken();
  if (!token) {
    try { token = await login(); } catch (e) {
      if (onUnauthorized) onUnauthorized();
      throw e;
    }
  }
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${VIDAS_API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401 && !retried) {
    clearToken();
    try {
      await login();
      return authedFetch(path, init, true);
    } catch {
      if (onUnauthorized) onUnauthorized();
      throw new Error("Não autorizado. Faça login novamente.");
    }
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
