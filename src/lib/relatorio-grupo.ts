/** Papel de um contrato no envio de relatórios por grupo financeiro. */
export type PapelGrupoRelatorio = "principal" | "membro" | "sem_grupo";

export function papelGrupoRelatorio(
  empresaId: string | null | undefined,
  grupo: { principal_empresa_id: string | null } | null | undefined,
): PapelGrupoRelatorio {
  // Sem contrato principal definido, cada contrato continua enviando o próprio e-mail.
  if (!empresaId || !grupo?.principal_empresa_id) return "sem_grupo";
  return grupo.principal_empresa_id === empresaId ? "principal" : "membro";
}

/** Contratos do grupo que vão junto no e-mail do principal (sem o próprio principal e sem repetidos). */
export function contratosAnexosDoGrupo(
  principalContrato: string | number | null | undefined,
  membros: { contrato: string | number | null | undefined }[],
): number[] {
  const principal = Number(principalContrato);
  const lista = membros
    .map(m => Number(String(m.contrato ?? "").trim()))
    .filter(n => Number.isInteger(n) && n > 0 && n !== principal);
  return [...new Set(lista)].sort((a, b) => a - b);
}
