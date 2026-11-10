// Navigation only; mailing_brindes RLS remains authoritative for every operation.
export function podeExibirAtalhoMailing(role: string | null): boolean {
  return role === "admin" || role === "executivo" || role === "executivo_externo";
}