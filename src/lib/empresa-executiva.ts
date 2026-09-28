/**
 * Regra central: empresas atendidas por várias executivas geram QR Code/link
 * de avaliação sem executiva vinculada. A fonte principal é a coluna
 * `empresas.sem_executiva_vinculada`; a lista abaixo é um fallback por nome.
 */
export const EMPRESAS_SEM_EXECUTIVA_UNICA = ["YAMAHA", "HONDA"];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export function empresaSemExecutivaUnica(
  nomeEmpresa?: string | null,
  flag?: boolean | null,
): boolean {
  if (flag) return true;
  if (!nomeEmpresa) return false;
  const n = normalizar(nomeEmpresa);
  return EMPRESAS_SEM_EXECUTIVA_UNICA.some((k) => n.includes(normalizar(k)));
}

export const ROTULO_VARIAS_EXECUTIVAS = "Várias executivas";
