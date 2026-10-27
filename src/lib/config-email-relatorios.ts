export type ConfigEmailRelatorios = {
  dominio: string;
  nome_remetente: string;
  email_remetente: string;
  email_resposta: string;
};

export function validarConfigEmail(dados: ConfigEmailRelatorios): string | null {
  const dominio = dados.dominio.trim().toLowerCase();
  const email = dados.email_remetente.trim().toLowerCase();
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(dominio)) return "Informe um domínio válido, sem https:// ou caminhos.";
  if (!dados.nome_remetente.trim()) return "Informe o nome do remetente.";
  if (!valido.test(email)) return "Informe um e-mail de remetente válido.";
  if (email.split("@")[1] !== dominio) return "O e-mail do remetente deve pertencer ao domínio informado.";
  if (dados.email_resposta.trim() && !valido.test(dados.email_resposta.trim())) return "Informe um e-mail para respostas válido.";
  return null;
}
export type RemetenteUsuario = { nome_remetente: string; email_remetente: string; email_resposta: string };

/** Remetente individual do perfil Cadastro: sempre um endereço @samel.com.br. */
export function validarRemetenteUsuario(dados: RemetenteUsuario): string | null {
  if (!dados.nome_remetente.trim()) return "Informe o nome do remetente.";
  if (!/^[^\s@]+@samel\.com\.br$/i.test(dados.email_remetente.trim())) return "Use seu e-mail @samel.com.br.";
  const resp = dados.email_resposta.trim();
  if (resp && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resp)) return "Informe um e-mail para respostas válido.";
  return null;
}
