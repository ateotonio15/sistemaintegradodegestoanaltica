/**
 * Registry de regras empresariais especiais aplicadas durante a análise
 * financeira (Excel × PDF). São exceções pontuais para pagadores com
 * particularidades — por padrão a análise agrupa por CNPJ; estas regras
 * permitem sobrescrever esse comportamento por pagador específico.
 *
 * Persistência: regras customizadas ficam em localStorage para que o
 * usuário possa cadastrar novas exceções sem precisar de deploy.
 */

const STORAGE_KEY = "financeiro:regras_empresariais:v1";

export type RegraTipo = "agrupar_por_nome";

export interface RegraEmpresarial {
  id: string;
  /** Nome do pagador / subestipulante usado como gatilho (case-insensitive,
   * acento-insensitive). Match por "contém". */
  padrao: string;
  /** Nome amigável da empresa (ex.: "Pioneiro Combustíveis"). */
  empresa: string;
  tipo: RegraTipo;
  /** Descrição detalhada do que a regra faz e por quê. */
  descricao: string;
  /** Origem: built-in (código) ou criada pelo usuário. */
  origem: "builtin" | "custom";
  criado_em?: string;
}

/** Regras embutidas no código — sempre presentes, não podem ser removidas. */
const BUILTIN_REGRAS: RegraEmpresarial[] = [
  {
    id: "builtin:pioneiro_combustiveis",
    padrao: "pioneiro combustiveis",
    empresa: "Pioneiro Combustíveis LTD",
    tipo: "agrupar_por_nome",
    origem: "builtin",
    descricao:
      "Todos os beneficiários cujo subestipulante (coluna Pagador) contenha " +
      '"PIONEIRO COMBUSTIVEIS LTD" são consolidados em um único bloco de análise, ' +
      "independente do CNPJ. Isso significa que matriz + filiais (CNPJs diferentes) " +
      "são tratadas como uma só empresa: vidas de enfermaria/apartamento, inclusões, " +
      "exclusões, devoluções, retroativas, taxa de adesão e faixas etárias são somados " +
      "antes da comparação com o PDF. O aviso do bloco lista todos os CNPJs agrupados.",
  },
  {
    id: "builtin:jabil_industrial",
    padrao: "jabil industrial do brasil",
    empresa: "Jabil Industrial do Brasil LTDA",
    tipo: "agrupar_por_nome",
    origem: "builtin",
    descricao:
      'Beneficiários cujo subestipulante contenha "JABIL INDUSTRIAL DO BRASIL" são ' +
      "agrupados pelo NOME completo do pagador (ignorando CNPJ). Como matriz e filial " +
      'têm nomes distintos ("JABIL INDUSTRIAL DO BRASIL LTDA" vs. ' +
      '"JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL"), cada uma continua em seu próprio ' +
      "bloco de análise — tratadas como empresas independentes — mas eventuais CNPJs " +
      "distintos dentro do mesmo nome são consolidados.",
  },
];

function loadCustom(): RegraEmpresarial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        typeof r.padrao === "string" &&
        typeof r.empresa === "string" &&
        typeof r.descricao === "string",
    ).map((r) => ({ ...r, origem: "custom" as const }));
  } catch {
    return [];
  }
}

function saveCustom(regras: RegraEmpresarial[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(regras));
  // Notifica outras abas/componentes
  window.dispatchEvent(new CustomEvent("regras-empresariais:changed"));
}

export function listarRegras(): RegraEmpresarial[] {
  return [...BUILTIN_REGRAS, ...loadCustom()];
}

export function adicionarRegra(
  input: Omit<RegraEmpresarial, "id" | "origem" | "criado_em">,
): RegraEmpresarial {
  const nova: RegraEmpresarial = {
    ...input,
    id: `custom:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    origem: "custom",
    criado_em: new Date().toISOString(),
  };
  const atuais = loadCustom();
  atuais.push(nova);
  saveCustom(atuais);
  return nova;
}

export function removerRegra(id: string): void {
  if (id.startsWith("builtin:")) return;
  const atuais = loadCustom().filter((r) => r.id !== id);
  saveCustom(atuais);
}

/**
 * Padrões (normalizados) que devem ser usados para forçar agrupamento por nome
 * durante a análise do Excel. Consumido pelo `excel-analysis-utils`.
 */
export function getForceGroupByNamePatterns(): string[] {
  return listarRegras()
    .filter((r) => r.tipo === "agrupar_por_nome")
    .map((r) => normalize(r.padrao))
    .filter(Boolean);
}

function normalize(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
