type EmpresaPrimeiraCompetencia = {
  status_implantacao?: string | null;
  primeira_competencia_financeira?: string | null;
};

/** The first competence remains a lower bound even after activation. */
export function permiteCompetenciaMovimentacao(
  empresa: EmpresaPrimeiraCompetencia | null | undefined,
  competencia: string,
): boolean {
  const primeira = empresa?.primeira_competencia_financeira;
  if (primeira) return competencia >= primeira;
  return empresa?.status_implantacao !== "aguardando_primeiro_fechamento";
}