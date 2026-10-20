import { EnderecoEmpresa, EnderecosEmpresa, novoEndereco } from "@/lib/empresa-enderecos";

export const ERRO_CONSULTA_CNPJ = "Não foi possível consultar os dados agora. Você pode preencher manualmente.";
export function normalizarCnpjConsulta(valor: string) {
  const cnpj = valor.replace(/[.\/\-\s]/g, "");
  return /^\d{14}$/.test(cnpj) ? cnpj : null;
}
export type DadosCnpj = { nome: string; fantasia: string; cnpj: string; situacao: string; tipoLogradouro: string; logradouro: string; telefone: string; email: string; endereco: EnderecoEmpresa };
export function mapearDadosCnpj(data: unknown): DadosCnpj | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.razao_social !== "string" || !obj.estabelecimento || typeof obj.estabelecimento !== "object") return null;
  const e = obj.estabelecimento as Record<string, unknown>;
  const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const nested = (v: unknown, key: string) => v && typeof v === "object" ? texto((v as Record<string, unknown>)[key]) : "";
  const ddd = texto(e.ddd1), telefone = texto(e.telefone1);
  return { nome: texto(obj.razao_social), fantasia: texto(e.nome_fantasia), cnpj: texto(e.cnpj), situacao: texto(e.situacao_cadastral), tipoLogradouro: texto(e.tipo_logradouro), logradouro: texto(e.logradouro), telefone: telefone ? [ddd, telefone].filter(Boolean).join(" ") : "", email: texto(e.email), endereco: { ...novoEndereco(), logradouro: [texto(e.tipo_logradouro), texto(e.logradouro)].filter(Boolean).join(" "), numero: texto(e.numero), complemento: texto(e.complemento), bairro: texto(e.bairro), cep: texto(e.cep), cidade: nested(e.cidade, "nome"), uf: nested(e.estado, "sigla") } };
}

// Draft-only patches: do not introduce fields absent from the company form.
// Never invents nome_fantasia: absent from the source stays absent from the form.
export function camposFormularioCnpj(dados: DadosCnpj, permiteNome: boolean) {
  return {
    ...(permiteNome && dados.nome ? { nome: dados.nome, razao_social: dados.nome } : {}),
    ...(permiteNome && dados.fantasia ? { nome_fantasia: dados.fantasia } : {}),
    ...(dados.telefone ? { telefone_empresa: dados.telefone } : {}),
    ...(dados.email ? { email_empresa: dados.email } : {}),
  };
}

export function enderecosComDadosCnpj(atual: EnderecosEmpresa, dados: DadosCnpj): EnderecosEmpresa {
  const principal = { ...atual.principal };
  for (const campo of ["cep", "numero", "complemento", "bairro", "cidade", "uf"] as const) {
    if (dados.endereco[campo]) principal[campo] = dados.endereco[campo];
  }
  if (dados.logradouro) {
    principal.logradouro = dados.endereco.logradouro;
    // The previous free-text address must not conceal the confirmed street.
    principal.endereco_livre = "";
  }
  return { ...atual, principal };
}