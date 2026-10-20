import { EnderecoEmpresa, EnderecosEmpresa, novoEndereco } from "@/lib/empresa-enderecos";

export const ERRO_CONSULTA_CNPJ = "Não foi possível consultar os dados agora. Você pode preencher manualmente.";
export function normalizarCnpjConsulta(valor: string) {
  const cnpj = valor.replace(/[.\/\-\s]/g, "");
  return /^\d{14}$/.test(cnpj) ? cnpj : null;
}
export type DadosCnpj = { nome: string; fantasia: string; cnpj: string; situacao: string; situacaoDesde: string; tipoLogradouro: string; logradouro: string; telefone: string; email: string; endereco: EnderecoEmpresa };
export function mapearDadosCnpj(data: unknown): DadosCnpj | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.razao_social !== "string" || !obj.estabelecimento || typeof obj.estabelecimento !== "object") return null;
  const e = obj.estabelecimento as Record<string, unknown>;
  const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const nested = (v: unknown, key: string) => v && typeof v === "object" ? texto((v as Record<string, unknown>)[key]) : "";
  const ddd = texto(e.ddd1), telefone = texto(e.telefone1);
  return { nome: texto(obj.razao_social), fantasia: texto(e.nome_fantasia), cnpj: texto(e.cnpj), situacao: texto(e.situacao_cadastral), situacaoDesde: texto(e.data_situacao_cadastral), tipoLogradouro: texto(e.tipo_logradouro), logradouro: texto(e.logradouro), telefone: telefone ? [ddd, telefone].filter(Boolean).join(" ") : "", email: texto(e.email), endereco: { ...novoEndereco(), logradouro: [texto(e.tipo_logradouro), texto(e.logradouro)].filter(Boolean).join(" "), numero: texto(e.numero), complemento: texto(e.complemento), bairro: texto(e.bairro), cep: texto(e.cep), cidade: nested(e.cidade, "nome"), uf: nested(e.estado, "sigla") } };
}

// CNPJ registry status is display-only: it never replaces the company's internal status.
export type TomSituacaoCnpj = "verde" | "amarelo" | "vermelho" | "neutro";
export function rotuloSituacaoCnpj(situacao: string): { rotulo: string; tom: TomSituacaoCnpj } | null {
  const valor = situacao.trim();
  if (!valor) return null;
  const rotulo = valor.toUpperCase();
  const chave = rotulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tons: Record<string, TomSituacaoCnpj> = { ATIVA: "verde", SUSPENSA: "amarelo", BAIXADA: "vermelho", INAPTA: "vermelho", NULA: "vermelho" };
  return { rotulo: `CNPJ ${rotulo}`, tom: tons[chave] ?? "neutro" };
}
export function formatarDataSituacaoCnpj(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

// Resultado da sincronização automática (tabela empresa_cnpj_situacao). Display-only.
export type SituacaoCnpjRegistro = {
  empresa_id: string;
  cnpj: string;
  situacao: string;
  situacao_desde: string;
  endereco: { cep?: string; cidade?: string; uf?: string } | null;
  erro: string | null;
  consultado_em: string;
};

const normTexto = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// Compara o endereço retornado pela consulta com o endereço principal cadastrado.
// Só acusa divergência quando há dados suficientes dos dois lados.
export function enderecoDivergente(enderecoConsulta: SituacaoCnpjRegistro["endereco"], principal: EnderecoEmpresa | null | undefined): boolean {
  if (!enderecoConsulta || !principal) return false;
  const cepA = (enderecoConsulta.cep ?? "").replace(/\D/g, "");
  const cepB = (principal.cep ?? "").replace(/\D/g, "");
  if (cepA && cepB) return cepA !== cepB;
  const cidadeA = normTexto(enderecoConsulta.cidade ?? ""), cidadeB = normTexto(principal.cidade ?? "");
  if (!cidadeA || !cidadeB) return false;
  const ufA = normTexto(enderecoConsulta.uf ?? ""), ufB = normTexto(principal.uf ?? "");
  return cidadeA !== cidadeB || (!!ufA && !!ufB && ufA !== ufB);
}

// Motivo de divergência para o filtro "Divergências CNPJ"; null = sem divergência.
export function divergenciaCnpj(registro: SituacaoCnpjRegistro | null | undefined, principal: EnderecoEmpresa | null | undefined): string | null {
  if (!registro) return null;
  if (registro.erro) return registro.erro;
  const info = rotuloSituacaoCnpj(registro.situacao);
  if (info && info.tom !== "verde") return `Situação do CNPJ: ${info.rotulo}`;
  if (!info) return "Situação do CNPJ não informada";
  if (enderecoDivergente(registro.endereco, principal)) return "Endereço divergente do cadastro";
  return null;
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