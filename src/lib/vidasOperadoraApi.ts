export const VIDAS_OPERADORA_URL =
  "https://api-iasam.samel.com.br/vidas-operadora/agrupado";

export interface PorEmpresa { NM_ESTIPULANTE: string; QT_VIDAS: number; }
export interface PorFaixaEtaria { FAIXA_ETARIA: string; QT_VIDAS: number; }
export interface PorClassificacao { DS_CLASSIFICACAO: string; QT_VIDAS: number; }

export interface VidasOperadoraResponse {
  status: boolean;
  message: string;
  data: {
    porEmpresa: PorEmpresa[];
    porFaixaEtaria: PorFaixaEtaria[];
    porClassificacao: PorClassificacao[];
  };
}

export async function fetchVidasOperadoraAgrupado(): Promise<VidasOperadoraResponse["data"]> {
  const res = await fetch(VIDAS_OPERADORA_URL, { method: "GET" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as VidasOperadoraResponse;
  if (!json?.status || !json?.data) throw new Error(json?.message || "Resposta inválida");
  return json.data;
}

/** Normaliza nome (maiúsculas, sem acento, sem pontuação, espaços únicos). */
export function normalizeNome(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_TOKENS = new Set([
  "SA","S","A","LTDA","EIRELI","ME","EPP","PME","MATRIZ","FILIAL","CIA",
  "DE","DA","DO","DAS","DOS","E","EM","DI","D","O","AS","OS",
]);

/** Normalização estrita: remove sufixos jurídicos e stopwords para casamento robusto. */
export function normalizeNomeStrict(s: string | null | undefined): string {
  const base = normalizeNome(s);
  const tokens = base.split(" ").filter((t) => t && !STOP_TOKENS.has(t));
  return tokens.join(" ");
}

/** Conjunto de tokens significativos (≥3 chars, sem stopwords). */
export function tokensSignificativos(s: string | null | undefined): Set<string> {
  return new Set(
    normalizeNome(s)
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t)),
  );
}

/** Jaccard entre dois conjuntos. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
}
