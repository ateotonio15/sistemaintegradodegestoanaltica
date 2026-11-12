/** Textos e números agregados da apresentação "Resultados da Campanha de Saúde". Sem dados individuais (LGPD). */
export interface ContagensApresentacao {
  total: number;
  paCounts: Record<string, number>;
  gliCounts: Record<string, number>;
  encaminhamentos: number;
}

export const pctDe = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
export const emCada10 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10) : 0);

export function frasePorDez(x: number, sujeito: string, verboSing: string, verboPlural: string) {
  if (x === 5) return `Metade dos ${sujeito} ${verboSing}`;
  if (x === 10) return `Todos os ${sujeito} ${verboPlural}`;
  return `${x} em cada 10 ${sujeito} ${x === 1 ? verboSing : verboPlural}`;
}

export function resumoApresentacao(c: ContagensApresentacao) {
  const pa = (k: string) => c.paCounts[k] ?? 0;
  const gl = (k: string) => c.gliCounts[k] ?? 0;
  const paNR = pa("Não realizado");
  const gliNR = gl("Não realizado");
  const basePa = c.total - paNR;
  const baseGli = c.total - gliNR;
  const paOk = pa("Ótima") + pa("Normal");
  const paAtencao = pa("PA Elevada") + pa("Hipertensão Estágio 1");
  const paGrave = pa("Hipertensão Estágio 2") + pa("Hipertensão Estágio 3");
  const paAlt = paAtencao + paGrave;
  const gliAlt = gl("Pré-Diabetes") + gl("Alterada pós-prandial") + gl("Diabetes");
  const pctPaAlt = pctDe(paAlt, basePa);
  const pctGliAlt = pctDe(gliAlt, baseGli);

  const tituloNumeros = c.total > 0
    ? `${frasePorDez(emCada10(c.encaminhamentos, c.total), "colaboradores triados", "precisa de acompanhamento", "precisam de acompanhamento")}`
    : "Nenhum colaborador foi triado nesta ação";
  const tituloGlicemia = baseGli > 0
    ? frasePorDez(emCada10(gliAlt, baseGli), "colaboradores", "tem glicemia fora do ideal", "têm glicemia fora do ideal")
    : "A glicemia não foi aferida nesta ação";
  const tituloPa = basePa > 0
    ? `${emCada10(paOk, basePa)} em cada 10 estão com a pressão em dia; ${emCada10(paAlt, basePa)} em cada 10 precisam de atenção`
    : "A pressão arterial não foi aferida nesta ação";

  return {
    basePa, baseGli, paNR, gliNR, paOk, paAtencao, paGrave, paAlt, gliAlt, pctPaAlt, pctGliAlt,
    pctEnc: pctDe(c.encaminhamentos, c.total),
    tituloNumeros, tituloGlicemia, tituloPa,
    /** PA vem antes da glicemia quando é o principal ponto de atenção. */
    paPrimeiro: pctPaAlt > pctGliAlt,
  };
}
