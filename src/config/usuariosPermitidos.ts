// Usuários exibidos na tela "Produção de Guias · Ambulatório". Edite apenas aqui.
export const USUARIOS_PERMITIDOS_PRODUCAO_GUIAS: string[] = [
  "JAINA DA SILVA RODRIGUES OLIVEIRA",
  "MAYARA MEIRELES DA SILVA",
  "Marcia Tereza da Costa Ribeiro",
  "Josiane Leda Rodrigues",
  "Diane Miranda Ribeiro",
  "NAHDIA CRISTINI MONTEIRO NORONHA",
  "FRANCISCO CARLOS SALES BAYMA DUTRA",
  "JESUS ANTONIO SOSA CABEZA",
  "Laize Gabriely Hunhape De Souza",
  "Bruna Kedma Nonato Marialves",
  "DEBORAH LAURENTINO PINHEIRO",
  "Pedro Henrich Nascimento Brito",
  "Juliana Brandao de Carvalho",
  "VITORIA KARINE IZEL MONTEIRO",
  "ANA BEATRIZ DOS SANTOS NOGUEIRA",
  "TAWNNY BORGES CAVALCANTE MOTA",
  "Glaucia Magali Volpe Riebe",
  "ESTER LAIS FREITAS DE ALMEIDA",
];

export function normalizarNomeUsuario(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
