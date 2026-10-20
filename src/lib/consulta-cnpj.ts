import { EnderecoEmpresa, novoEndereco } from "@/lib/empresa-enderecos";

export const ERRO_CONSULTA_CNPJ = "Não foi possível consultar os dados agora. Você pode preencher manualmente.";
export function normalizarCnpjConsulta(valor: string) {
  const cnpj = valor.replace(/[.\/\-\s]/g, "");
  return /^\d{14}$/.test(cnpj) ? cnpj : null;
}
export type DadosCnpj = { nome: string; fantasia: string; endereco: EnderecoEmpresa };
export function mapearDadosCnpj(data: unknown): DadosCnpj | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.razao_social !== "string" || !obj.estabelecimento || typeof obj.estabelecimento !== "object") return null;
  const e = obj.estabelecimento as Record<string, unknown>;
  const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const nested = (v: unknown, key: string) => v && typeof v === "object" ? texto((v as Record<string, unknown>)[key]) : "";
  return { nome: obj.razao_social, fantasia: texto(e.nome_fantasia), endereco: { ...novoEndereco(), logradouro: [texto(e.tipo_logradouro), texto(e.logradouro)].filter(Boolean).join(" "), numero: texto(e.numero), complemento: texto(e.complemento), bairro: texto(e.bairro), cep: texto(e.cep), cidade: nested(e.cidade, "nome"), uf: nested(e.estado, "sigla") } };
}