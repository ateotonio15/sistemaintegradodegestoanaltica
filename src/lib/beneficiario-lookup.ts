// Consulta dados do beneficiário na API Samel via CPF.
// Endpoint público (CORS liberado): retorna { status, msg?, data? } ou objeto direto.
// Como o payload real pode variar, normalizamos em { nome, cpf, empresa }.

export interface BeneficiarioLookup {
  nome?: string;
  cpf?: string;
  empresa?: string;
  raw?: any;
}

const ENDPOINT = "https://atend-back-002.samel.com.br/getDadosBeneficiario";

function pick(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function normalize(raw: any): BeneficiarioLookup | null {
  if (!raw) return null;
  // Payload real: { registros, dados: [{...}] }. Também suportamos { data }, { beneficiario } ou objeto direto.
  const source = raw.dados ?? raw.data ?? raw.beneficiario ?? raw;
  const target = Array.isArray(source) ? source[0] : source;
  if (!target || typeof target !== "object") return null;

  const nome = pick(target, [
    "nm_pessoa_fisica",
    "NM_PESSOA_FISICA",
    "nm_beneficiario",
    "NM_BENEFICIARIO",
    "nome",
    "NOME",
  ]);
  const cpf = pick(target, ["nr_cpf", "NR_CPF", "cpf", "CPF"]);
  const empresa = pick(target, [
    "nm_empresa",
    "NM_EMPRESA",
    "nm_fantasia_sub_estipulante",
    "ds_razao_social_sub_estipulante",
    "nm_fantasia_contrato",
    "ds_razao_social_contrato",
    "nm_estipulante",
    "NM_ESTIPULANTE",
    "empresa",
    "EMPRESA",
    "nome_empresa",
  ]);

  if (!nome && !cpf && !empresa) return null;
  return { nome, cpf, empresa, raw: target };
}


export async function fetchBeneficiarioByCpf(cpf: string, signal?: AbortSignal): Promise<BeneficiarioLookup | null> {
  const digits = String(cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  const res = await fetch(`${ENDPOINT}?nr_cpf=${digits}`, { signal });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json) return null;
  if (json.status === false) return null;
  return normalize(json);
}
