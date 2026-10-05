import { fetchReajustesOperadora, modalidadePlano, classePlano, type ReajusteContratoApi } from "@/lib/reajustesOperadoraApi";

let cache: { at: number; data: ReajusteContratoApi[] } | null = null;

const normNum = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "");

export interface ValoresOperadora {
  contrato: ReajusteContratoApi;
  porFaixa: boolean;
  enfermaria: { ini: number; fim: number; centavos: number }[];
  apartamento: { ini: number; fim: number; centavos: number }[];
}

/** Busca o valor atual (VL_PRECO_ATUAL) do contrato pelo NR_CONTRATO, usando o reajuste mais recente. */
export async function buscarValoresOperadora(codigoContrato: string): Promise<ValoresOperadora | null> {
  const alvo = normNum(codigoContrato);
  if (!alvo) return null;
  if (!cache || Date.now() - cache.at > 5 * 60_000) {
    cache = { at: Date.now(), data: await fetchReajustesOperadora() };
  }
  const lista = cache.data
    .filter((c) => normNum(c.NR_CONTRATO) === alvo)
    .sort((a, b) => String(b.DT_REAJUSTE).localeCompare(String(a.DT_REAJUSTE)));
  const c = lista[0];
  if (!c) return null;
  const out: ValoresOperadora = { contrato: c, porFaixa: false, enfermaria: [], apartamento: [] };
  for (const p of c.PLANOS ?? []) {
    const mod = modalidadePlano(p.NM_FANTASIA);
    if (!mod || out[mod].length) continue;
    out[mod] = (p.FAIXAS_ETARIAS ?? []).map((f) => ({
      ini: f.QT_IDADE_INICIAL,
      fim: f.QT_IDADE_FINAL,
      centavos: Math.round(Number(f.VL_PRECO_ATUAL || 0) * 100),
    }));
  }
  out.porFaixa = out.enfermaria.length > 1 || out.apartamento.length > 1;
  return out;
}

/** Classe (nome do plano) de cada modalidade do contrato, ex.: { enfermaria: "Gold", apartamento: "Gold Plus" }.
 *  Usa o reajuste do ano informado; se não houver, o mais recente do contrato. */
export async function buscarClassesPlano(
  codigoContrato: string,
  ano?: number,
): Promise<{ enfermaria?: string; apartamento?: string } | null> {
  const alvo = normNum(codigoContrato);
  if (!alvo) return null;
  if (!cache || Date.now() - cache.at > 5 * 60_000) {
    cache = { at: Date.now(), data: await fetchReajustesOperadora() };
  }
  const lista = cache.data
    .filter((c) => normNum(c.NR_CONTRATO) === alvo)
    .sort((a, b) => String(b.DT_REAJUSTE).localeCompare(String(a.DT_REAJUSTE)));
  if (!lista.length) return null;
  const c = (ano && lista.find((x) => String(x.DT_REAJUSTE).startsWith(String(ano)))) || lista[0];
  const out: { enfermaria?: string; apartamento?: string } = {};
  for (const p of c.PLANOS ?? []) {
    const mod = modalidadePlano(p.NM_FANTASIA);
    if (!mod || out[mod]) continue;
    out[mod] = classePlano(p.NM_FANTASIA);
  }
  return out;
}
