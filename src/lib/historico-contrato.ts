export interface AlteracaoHistorico {
  campo: string;
  rotulo: string;
  categoria: string;
  valor_anterior: unknown;
  valor_novo: unknown;
}

export interface NomeProduto { codigo_produto: number; nome_produto: string; acomodacao: string }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

function data(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Formata um valor armazenado no histórico para leitura. */
export function formatarValorHistorico(campo: string, valor: unknown, produtos: NomeProduto[] = []): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (campo.endsWith("_centavos") && typeof valor === "number") return brl(valor);
  if (campo.startsWith("produto_") && campo.endsWith("_codigo")) {
    const p = produtos.find(x => x.codigo_produto === Number(valor));
    return p ? `${valor} - ${p.nome_produto} - ${p.acomodacao}` : String(valor);
  }
  if (["data_vencimento_fatura", "data_emissao_fatura", "data_corte", "dia_movimentacao"].includes(campo) && typeof valor === "number") {
    return String(valor).padStart(2, "0");
  }
  if (campo === "faixas_etarias" && Array.isArray(valor)) {
    return valor.map((f: any) => {
      const faixa = f?.faixa ?? [f?.idade_inicial, f?.idade_final].filter(x => x != null).join("-");
      const vals = Object.entries(f ?? {})
        .filter(([k, v]) => k.endsWith("_centavos") && typeof v === "number")
        .map(([k, v]) => `${k.replace("valor_", "").replace("_centavos", "")}: ${brl(v as number)}`);
      return [faixa, ...vals].filter(Boolean).join(" ");
    }).join(" | ") || "—";
  }
  if (campo === "enderecos" && typeof valor === "object") {
    const p: any = (valor as any)?.principal;
    const qtd = Array.isArray((valor as any)?.secundarios) ? (valor as any).secundarios.length : 0;
    const princ = p ? [p.logradouro, p.numero, p.bairro, p.cidade].filter(Boolean).join(", ") : "";
    return [princ || "Sem endereço principal", qtd ? `+${qtd} secundário(s)` : ""].filter(Boolean).join(" ");
  }
  if (typeof valor === "string") return data(valor);
  if (typeof valor === "number") return String(valor);
  return JSON.stringify(valor);
}

export const CATEGORIAS_HISTORICO = ["Cadastro", "Contrato", "Movimentação", "Produto/Plano", "Valores", "Financeiro", "Reajuste", "Suspensão", "Sistema"];

export type TomEvento = "suspensao" | "reativacao" | "reajuste" | "neutro";
export function tomDoEvento(acao: string, categoria: string): TomEvento {
  if (acao === "Contrato suspenso") return "suspensao";
  if (acao === "Contrato reativado") return "reativacao";
  if (categoria === "Reajuste") return "reajuste";
  return "neutro";
}

/** Busca livre por campo, usuário ou valor. */
export function eventoCombinaBusca(
  ev: { acao: string; usuario_nome: string | null; origem: string; alteracoes: AlteracaoHistorico[]; motivo?: string | null },
  termo: string,
  produtos: NomeProduto[] = [],
) {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  const partes = [ev.acao, ev.usuario_nome ?? "", ev.origem, ev.motivo ?? ""];
  for (const a of ev.alteracoes) {
    partes.push(a.rotulo, formatarValorHistorico(a.campo, a.valor_anterior, produtos), formatarValorHistorico(a.campo, a.valor_novo, produtos));
  }
  return partes.join(" ").toLowerCase().includes(t);
}
