/**
 * Calculadora de Cobrança Retroativa
 * Trabalha em centavos para precisão.
 */

export type TipoLancamento = "cobranca" | "devolucao";

export interface PeriodoMensal {
  mes: string; // YYYY-MM
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
  diasMes: number;
  diasCobrados: number;
  mensalidadeCentavos: number;
  valorDiarioCentavos: number; // pode ter frações
  valorCalculadoCentavos: number; // arredondado em centavos
}

export interface ItemCalculoInput {
  mensalidadeCentavos: number;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  tipo: TipoLancamento;
}

export interface ItemCalculoResultado {
  diasProporcionais: number;
  valorCalculadoCentavos: number; // com sinal (devolução negativo)
  periodos: PeriodoMensal[];
  atravessaMes: boolean;
}

function parseISO(d: string): Date {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Data inválida: ${d}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function diasDoMes(ano: number, mes1a12: number): number {
  return new Date(ano, mes1a12, 0).getDate();
}

export function diasEntreInclusivo(inicioISO: string, fimISO: string): number {
  const a = parseISO(inicioISO).getTime();
  const b = parseISO(fimISO).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

/** Quebra um intervalo [inicio, fim] em sub-intervalos por mês. */
export function quebrarPeriodoPorMes(
  inicioISO: string,
  fimISO: string,
): Array<{ mes: string; inicio: string; fim: string; diasMes: number; diasCobrados: number }> {
  const inicio = parseISO(inicioISO);
  const fim = parseISO(fimISO);
  if (fim < inicio) return [];

  const out: ReturnType<typeof quebrarPeriodoPorMes> = [];
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  while (cursor <= fim) {
    const y = cursor.getFullYear();
    const mIdx = cursor.getMonth();
    const ultimoDiaMes = new Date(y, mIdx + 1, 0);
    const fimDoBloco = ultimoDiaMes < fim ? ultimoDiaMes : fim;
    const diasMes = diasDoMes(y, mIdx + 1);
    const diasCobrados =
      Math.round((fimDoBloco.getTime() - cursor.getTime()) / 86400000) + 1;
    out.push({
      mes: `${y}-${String(mIdx + 1).padStart(2, "0")}`,
      inicio: toISO(cursor),
      fim: toISO(fimDoBloco),
      diasMes,
      diasCobrados,
    });
    cursor = new Date(y, mIdx + 1, 1);
  }
  return out;
}

export function calcularItem(input: ItemCalculoInput): ItemCalculoResultado {
  const blocos = quebrarPeriodoPorMes(input.dataInicio, input.dataFim);
  const periodos: PeriodoMensal[] = blocos.map((b) => {
    const valorDiarioCentavos = input.mensalidadeCentavos / b.diasMes;
    const valorCalculadoCentavos = Math.round(valorDiarioCentavos * b.diasCobrados);
    return {
      mes: b.mes,
      inicio: b.inicio,
      fim: b.fim,
      diasMes: b.diasMes,
      diasCobrados: b.diasCobrados,
      mensalidadeCentavos: input.mensalidadeCentavos,
      valorDiarioCentavos,
      valorCalculadoCentavos,
    };
  });

  const diasProporcionais = periodos.reduce((s, p) => s + p.diasCobrados, 0);
  const bruto = periodos.reduce((s, p) => s + p.valorCalculadoCentavos, 0);
  const sinal = input.tipo === "devolucao" ? -1 : 1;
  return {
    diasProporcionais,
    valorCalculadoCentavos: bruto * sinal,
    periodos,
    atravessaMes: periodos.length > 1,
  };
}

export interface TotaisCalculo {
  totalBeneficiarios: number;
  totalCobrancasCentavos: number;
  totalDevolucoesCentavos: number; // negativo
  valorLiquidoCentavos: number;
}

export function calcularTotais(
  itens: Array<{ valorFinalCentavos: number; tipo: TipoLancamento }>,
): TotaisCalculo {
  let cobrancas = 0;
  let devolucoes = 0;
  for (const it of itens) {
    if (it.tipo === "cobranca") cobrancas += Math.abs(it.valorFinalCentavos);
    else devolucoes += -Math.abs(it.valorFinalCentavos);
  }
  return {
    totalBeneficiarios: itens.length,
    totalCobrancasCentavos: cobrancas,
    totalDevolucoesCentavos: devolucoes,
    valorLiquidoCentavos: cobrancas + devolucoes,
  };
}

export function formatBRLFromCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
