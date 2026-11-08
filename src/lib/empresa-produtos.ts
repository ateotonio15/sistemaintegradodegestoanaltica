export type AcomodacaoProduto = "Enfermaria" | "Apartamento" | "Não definida";
export interface ProdutoPlano {
  codigo_produto: number;
  nome_produto: string;
  acomodacao: AcomodacaoProduto;
  ativo: boolean;
}
export interface VinculosProdutos {
  produto_enfermaria_codigo?: number | null;
  produto_apartamento_codigo?: number | null;
  produto_nao_definido_codigo?: number | null;
}
export function selecionarProdutoContrato(produto: ProdutoPlano, acomodacao: "Enfermaria" | "Apartamento"): VinculosProdutos {
  return acomodacao === "Enfermaria"
    ? { produto_enfermaria_codigo: produto.codigo_produto }
    : { produto_apartamento_codigo: produto.codigo_produto };
}
export function temProdutoContratado(form: VinculosProdutos & { plano?: string | null }) {
  return !!(form.plano?.trim() || form.produto_enfermaria_codigo || form.produto_apartamento_codigo || form.produto_nao_definido_codigo);
}
export function produtoPorCodigo(codigo: unknown, catalogo: ProdutoPlano[]) {
  if (typeof codigo !== "number" && typeof codigo !== "string") return undefined;
  if (!/^\d+$/.test(String(codigo).trim())) return undefined;
  return catalogo.find(p => p.ativo && p.codigo_produto === Number(codigo));
}
/** Only explicit commercial codes; NR_SEQ_PLANO is not a verified commercial key. */
export function vinculosDaOperadora(planos: unknown[], catalogo: ProdutoPlano[]): VinculosProdutos {
  const grupos = new Map<AcomodacaoProduto, Set<number>>();
  for (const plano of planos) {
    if (!plano || typeof plano !== "object") continue;
    const registro = plano as Record<string, unknown>;
    const produto = produtoPorCodigo(registro.codigo_produto ?? registro.CODIGO_PRODUTO ?? registro.CD_PRODUTO, catalogo);
    if (!produto) continue;
    const codigos = grupos.get(produto.acomodacao) ?? new Set<number>();
    codigos.add(produto.codigo_produto);
    grupos.set(produto.acomodacao, codigos);
  }
  const out: VinculosProdutos = {};
  for (const [acomodacao, codigos] of grupos) {
    if (codigos.size !== 1) continue; // Ambiguous codes never overwrite a selection.
    const codigo = Array.from(codigos)[0];
    if (acomodacao === "Enfermaria") out.produto_enfermaria_codigo = codigo;
    if (acomodacao === "Apartamento") out.produto_apartamento_codigo = codigo;
    if (acomodacao === "Não definida") out.produto_nao_definido_codigo = codigo;
  }
  return out;
}