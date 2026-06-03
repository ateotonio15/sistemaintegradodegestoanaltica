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

/** Normaliza para casamento de nomes: maiúsculas, sem acento, sem pontuação, espaços únicos. */
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
