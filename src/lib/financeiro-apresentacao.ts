import type { AnaliseResultado, InclusaoResultado } from "./excel-analysis-utils";

export function temMensalidade(r: AnaliseResultado): boolean {
  return r.enfermaria.total !== 0 || r.enfermaria.beneficiarios > 0 ||
    r.apartamento.total !== 0 || r.apartamento.beneficiarios > 0;
}

export function linhasRetroativo(retro: InclusaoResultado) {
  const detalhes = retro.mesesDetalhe ?? [];
  const soma = detalhes.reduce((total, d) => total + d.total, 0);
  // Incomplete detail must never replace the authoritative parsed total.
  if (!detalhes.length || Math.abs(soma - retro.total) > 0.01) {
    return [{ label: "Retroativo", beneficiarios: retro.quantidade, mensalidade: null, total: retro.total }];
  }
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mesIndice = (mes: string) => meses.findIndex((nome) => mes.toLocaleLowerCase("pt-BR").startsWith(nome.slice(0, 3)));
  return [...detalhes].sort((a, b) => {
    const anoA = Number(a.mes.match(/\d{2,4}$/)?.[0] ?? 0);
    const anoB = Number(b.mes.match(/\d{2,4}$/)?.[0] ?? 0);
    return anoA - anoB || mesIndice(a.mes) - mesIndice(b.mes);
  }).map((d) => ({
    label: `Retroativo - ${meses[mesIndice(d.mes)] ?? d.mes}`,
    beneficiarios: d.quantidade,
    mensalidade: null,
    total: d.total,
  }));
}

export function selecionarResultadoHistorico(resultados: AnaliseResultado[] | null, indice?: number): AnaliseResultado[] | null {
  if (indice === undefined) return resultados;
  const resultado = resultados?.[indice];
  return resultado ? [resultado] : null;
}