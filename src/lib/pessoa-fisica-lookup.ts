// Cliente para a API pública Samel de busca de Pessoa Física.
// Endpoint: /buscarPessoaFisica?q=<termo>

export interface PessoaFisicaResult {
  ID?: string;
  STATUS?: string;
  NR_SEQ_SEG?: string;
  NR_SEQ_CART?: string;
  CARTEIRINHA?: string;
  NAME?: string;
  NR_TELEFONE_CELULAR?: string;
  DS_EMAIL?: string;
  OPC?: string;
  NR_CPF?: string;
  NR_IDENTIDADE?: string;
  NM_PESSOA_FISICA?: string;
  DT_NASCIMENTO?: string;
  SEXO?: string;
  IDADE?: string;
  TELEFONE_APP?: string;
  POSSUI_EMAIL?: string;
  RNK?: string;
  [k: string]: any;
}

const ENDPOINT = "https://atend-back-002.samel.com.br/buscarPessoaFisica";

export async function buscarPessoaFisica(
  termo: string,
  signal?: AbortSignal,
): Promise<PessoaFisicaResult[]> {
  const q = String(termo || "").trim();
  if (!q) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  if (!json) return [];
  if (Array.isArray(json)) return json as PessoaFisicaResult[];
  if (Array.isArray(json?.data)) return json.data as PessoaFisicaResult[];
  if (Array.isArray(json?.dados)) return json.dados as PessoaFisicaResult[];
  return [];
}

export function isCpfValido(cpf?: string | null): boolean {
  const s = String(cpf ?? "").trim();
  return s !== "" && s !== "0";
}
