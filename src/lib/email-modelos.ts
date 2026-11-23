import { CENARIOS_ENVIO, LISTA_CENARIOS } from "../../supabase/functions/_shared/cenario-envio";

/** Cenários vêm do Motor de Cenários: um novo cenário lá aparece aqui sem mudar a tela. */
export const CENARIOS_MODELO = LISTA_CENARIOS.map(c => ({ valor: c, rotulo: CENARIOS_ENVIO[c].rotulo }));
export const rotuloCenario = (c: string) => CENARIOS_MODELO.find(x => x.valor === c)?.rotulo ?? c;
export const DESTINOS_MODELO = ["Empresa", "Financeiro", "Empresa + Financeiro", "Outro"] as const;
export const ANEXOS_MODELO = ["Relatório de Vidas", "OPS Mensalidades", "Outros"] as const;

export const VARIAVEIS_MODELO: { chave: string; descricao: string; exemplo: string }[] = [
  { chave: "empresa", descricao: "Nome da empresa", exemplo: "EMPRESA EXEMPLO LTDA" },
  { chave: "razao_social", descricao: "Razão Social", exemplo: "EMPRESA EXEMPLO COMÉRCIO LTDA" },
  { chave: "contrato", descricao: "Código do contrato", exemplo: "2194" },
  { chave: "competencia", descricao: "Competência da movimentação", exemplo: "Novembro/2026" },
  { chave: "periodo", descricao: "Período de movimentação", exemplo: "25-30" },
  { chave: "data_inicio_periodo", descricao: "Data inicial do período", exemplo: "25/11/2026" },
  { chave: "data_fim_periodo", descricao: "Data final do período", exemplo: "30/11/2026" },
  { chave: "data_corte", descricao: "Data de corte", exemplo: "30/11/2026" },
  { chave: "responsavel_contrato", descricao: "Responsável pelo contrato", exemplo: "Maria Moreira" },
  { chave: "responsavel_movimentacao", descricao: "Responsável pela movimentação", exemplo: "Junior Vieira" },
  { chave: "quantidade_vidas", descricao: "Quantidade de vidas", exemplo: "398" },
  { chave: "data_envio", descricao: "Data do envio", exemplo: "23/11/2026" },
  { chave: "usuario", descricao: "Usuário do SIGA que realizou o envio", exemplo: "Junior Vieira" },
  { chave: "justificativa_envio", descricao: "Justificativa do envio direto ao Financeiro", exemplo: "Encaminhamento realizado sem retorno da empresa." },
];
const CHAVES = new Set(VARIAVEIS_MODELO.map(v => v.chave));
export const DADOS_DEMONSTRACAO: Record<string, string> = Object.fromEntries(VARIAVEIS_MODELO.map(v => [v.chave, v.exemplo]));

/** Lista as variáveis escritas que o SIGA não reconhece, ex.: "{{empresaa}}". */
export function variaveisNaoReconhecidas(...textos: string[]): string[] {
  const achadas = new Set<string>();
  for (const t of textos) for (const m of (t ?? "").matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) if (!CHAVES.has(m[1])) achadas.add(`{{${m[1]}}}`);
  return [...achadas];
}

export function substituirVariaveis(texto: string, dados: Record<string, string>): string {
  return (texto ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (orig, k) => (k in dados ? dados[k] : orig));
}

export { corpoParaHtml } from "../../supabase/functions/_shared/email-modelo-render";
