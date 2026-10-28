/**
 * Confere se a última página é do contrato esperado.
 * Bloqueia só quando aparece "CONTRATO : <outro número>"; quando o PDF separa
 * o rótulo do número no texto, aceita se o número esperado aparece isolado na página.
 */
export function ultimaPaginaDoContrato(texto: string, contrato: string | number): boolean {
  const esperado = String(contrato).replace(/\D/g, "").replace(/^0+/, "");
  if (!esperado) return false;
  const achados = [...texto.matchAll(/CONTRATO\s*:?\s*(\d+)/gi)].map((m) => m[1].replace(/^0+/, ""));
  if (achados.length > 0) return achados.every((n) => n === esperado);
  const tokens = texto.split(/[^\d]+/).filter(Boolean).map((t) => t.replace(/^0+/, ""));
  return tokens.includes(esperado);
}
