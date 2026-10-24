import { resolverDestino, type ResultadoDestino } from "./nfse-central-regras.ts";

export const PAGINA = 1000;

/** Lê todas as páginas (ordem estável por id). Erro do banco é falha, nunca lista vazia. */
// deno-lint-ignore no-explicit-any
export async function todas<T = any>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error("Falha ao consultar o banco");
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return out;
  }
}
const lotes = <T,>(xs: T[], n = 200) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// deno-lint-ignore no-explicit-any
export async function carregarEResolver(db: any, cnpjTomador: string, sugerida: string | null): Promise<ResultadoDestino> {
  // Candidatos filtrados no servidor pelo CNPJ normalizado (sem varrer todas as empresas).
  const { data: cand, error } = await db.rpc("nfse_central_candidatos", { _cnpj: cnpjTomador });
  if (error) throw new Error("Falha ao localizar o CNPJ do tomador");
  const empIds: string[] = [...new Set<string>((cand ?? []).map((c: any) => c.empresa_id))];
  const emps = empIds.length ? await todas((de, ate) => db.from("empresas").select("id, cnpj, exige_po_pc, aguarda_faturamento_excel").in("id", empIds).order("id").range(de, ate)) : [];
  const pags = (cand ?? []).filter((c: any) => c.origem === "pagador").map((c: any) => ({ empresa_id: c.empresa_id, cnpj: c.cnpj }));
  const movs = [];
  for (const l of lotes(empIds)) movs.push(...await todas((de, ate) => db.from("financeiro_movimentacoes").select("id, empresa_id, mes_referencia, periodo, data_envio_nota").in("empresa_id", l).order("id").range(de, ate)));
  const anexos = [];
  for (const l of lotes(movs.map((x: any) => x.id))) anexos.push(...await todas((de, ate) => db.from("anexos_financeiro").select("id, financeiro_movimentacao_id, mime_type, nome_arquivo, origem").in("financeiro_movimentacao_id", l).order("id").range(de, ate)));
  return resolverDestino({ cnpjTomador, empresas: emps, pagadores: pags, movs, anexos, sugerida });
}
