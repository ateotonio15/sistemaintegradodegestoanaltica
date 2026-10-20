export const TIPOS_ENDERECO_SECUNDARIO = ["Filial", "Unidade", "Administrativo", "Financeiro", "Correspondência", "Outro"] as const;
export type EnderecoEmpresa = {
  tipo: string; descricao_tipo: string; endereco_livre: string;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string; referencia: string; observacao: string;
};
export type EnderecosEmpresa = { principal: EnderecoEmpresa; secundarios: EnderecoEmpresa[] };
export type AlvoEndereco = "principal" | "novo" | number;
export function temEndereco(e: EnderecoEmpresa): boolean {
  return [e.endereco_livre, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep, e.referencia, e.observacao].some(v => !!v?.trim());
}
export function alterarEndereco(data: EnderecosEmpresa, alvo: AlvoEndereco, draft: EnderecoEmpresa): EnderecosEmpresa {
  if (alvo === "principal") {
    if (temEndereco(data.principal) && !temEndereco(draft)) throw new Error("O endereço principal não pode ser apagado. Informe o novo endereço.");
    return { ...data, principal: { ...draft, tipo: "Principal" } };
  }
  if (alvo === "novo") return { ...data, secundarios: [...data.secundarios, { ...draft }] };
  return { ...data, secundarios: data.secundarios.map((e, i) => i === alvo ? { ...draft } : e) };
}
export function removerEnderecoSecundario(data: EnderecosEmpresa, index: number): EnderecosEmpresa {
  return { ...data, secundarios: data.secundarios.filter((_, i) => i !== index) };
}
export function novoEndereco(tipo = "Principal"): EnderecoEmpresa {
  return { tipo, descricao_tipo: "", endereco_livre: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", referencia: "", observacao: "" };
}
export function carregarEnderecos(endereco: string | null | undefined, salvo: unknown): EnderecosEmpresa {
  const data = salvo as Partial<EnderecosEmpresa> | null;
  return {
    principal: { ...novoEndereco(), ...data?.principal, tipo: "Principal", endereco_livre: endereco ?? data?.principal?.endereco_livre ?? "" },
    secundarios: (Array.isArray(data?.secundarios) ? data.secundarios : []).map(e => ({ ...novoEndereco("Filial"), ...e })),
  };
}
export function prepararEnderecos(data: EnderecosEmpresa) {
  if (data.principal.tipo !== "Principal" || data.secundarios.some(e => !(TIPOS_ENDERECO_SECUNDARIO as readonly string[]).includes(e.tipo))) {
    throw new Error("Cada empresa deve ter apenas um endereço principal.");
  }
  if (data.secundarios.some(e => e.tipo === "Outro" && !e.descricao_tipo.trim())) {
    throw new Error("Informe a descrição do tipo Outro.");
  }
  const p = data.principal;
  const endereco = p.endereco_livre || [p.logradouro, p.numero, p.complemento, p.bairro, p.cidade, p.uf, p.cep].filter(Boolean).join(", ");
  return { endereco, enderecos: { ...data, principal: { ...p, endereco_livre: endereco } } };
}