export interface LinhaPeriodo {
  mes: string;
  premioEmpresa: number;
  premioDemissionario: number;
  premioTotal: number;
  sinistro: number;
  sinPct: number; // %
  breakEvenPct: number;
  distorcaoPct: number;
}

export interface ResumoPeriodo {
  media: number;
  mesesAcima100: number;
  mesPico: { mes: string; valor: number } | null;
  distorcaoAcumulada: number;
}

export function calcularResumo(linhas: LinhaPeriodo[]): ResumoPeriodo {
  if (linhas.length === 0) return { media: 0, mesesAcima100: 0, mesPico: null, distorcaoAcumulada: 0 };
  const media = linhas.reduce((s, l) => s + l.sinPct, 0) / linhas.length;
  const mesesAcima100 = linhas.filter((l) => l.sinPct > 100).length;
  const mesPico = linhas.reduce<{ mes: string; valor: number }>(
    (best, l) => (l.sinPct > best.valor ? { mes: l.mes, valor: l.sinPct } : best),
    { mes: linhas[0].mes, valor: linhas[0].sinPct }
  );
  const distorcaoAcumulada = linhas.reduce((s, l) => s + Math.max(0, l.sinPct - l.breakEvenPct), 0);
  return { media, mesesAcima100, mesPico, distorcaoAcumulada };
}

export type ComparativoStatus = "melhorou" | "piorou" | "estavel";

export function compararPeriodos(ant: ResumoPeriodo, atu: ResumoPeriodo): { status: ComparativoStatus; deltaMedia: number } {
  const delta = atu.media - ant.media;
  if (Math.abs(delta) <= 2) return { status: "estavel", deltaMedia: delta };
  return { status: delta < 0 ? "melhorou" : "piorou", deltaMedia: delta };
}

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function gerarTextos(ant: ResumoPeriodo, atu: ResumoPeriodo): { anterior: string; atual: string; conclusao: string } {
  const cmp = compararPeriodos(ant, atu);
  const anterior = `Período anterior: sinistralidade média de ${fmtPct(ant.media)}, ${ant.mesesAcima100} mês(es) acima de 100%${
    ant.mesPico ? `, pico em ${ant.mesPico.mes} (${fmtPct(ant.mesPico.valor)})` : ""
  }. Distorção acumulada de ${fmtPct(ant.distorcaoAcumulada)} sobre o break-even.`;
  const atual = `Período atual: sinistralidade média de ${fmtPct(atu.media)}, ${atu.mesesAcima100} mês(es) acima de 100%${
    atu.mesPico ? `, pico em ${atu.mesPico.mes} (${fmtPct(atu.mesPico.valor)})` : ""
  }. Distorção acumulada de ${fmtPct(atu.distorcaoAcumulada)}. Variação de ${cmp.deltaMedia >= 0 ? "+" : ""}${cmp.deltaMedia.toFixed(1)} p.p. vs. período anterior.`;
  const labelStatus =
    cmp.status === "melhorou"
      ? "O contrato apresenta MELHORIA na sinistralidade."
      : cmp.status === "piorou"
      ? "O contrato apresenta PIORA na sinistralidade — atenção redobrada."
      : "O contrato está ESTÁVEL na comparação entre períodos.";
  const conclusao = `${labelStatus} Variação observada: ${cmp.deltaMedia >= 0 ? "+" : ""}${cmp.deltaMedia.toFixed(1)} p.p. na média.`;
  return { anterior, atual, conclusao };
}
