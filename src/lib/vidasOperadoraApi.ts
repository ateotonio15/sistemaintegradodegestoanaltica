import { supabase } from "@/integrations/supabase/client";

export const VIDAS_OPERADORA_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vidas-operadora-proxy`;

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

export async function fetchVidasOperadoraAgrupado(
  dsClassificacao?: string,
): Promise<VidasOperadoraResponse["data"]> {
  const { data, error } = await supabase.functions.invoke<VidasOperadoraResponse>(
    "vidas-operadora-proxy",
    {
      method: "POST",
      body: dsClassificacao && dsClassificacao !== "TODOS"
        ? { ds_classificacao: dsClassificacao }
        : {},
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.status || !data?.data) throw new Error(data?.message || "Resposta inválida");
  return data.data;
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
