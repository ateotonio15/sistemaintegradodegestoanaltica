/** Confere se o texto da página traz "CONTRATO : <número>" igual ao esperado. */
export function ultimaPaginaDoContrato(texto: string, contrato: string | number): boolean {
  const esperado = String(contrato).replace(/\D/g, "").replace(/^0+/, "");
  const achados = [...texto.matchAll(/CONTRATO\s*:?\s*(\d+)/gi)].map((m) => m[1].replace(/^0+/, ""));
  return achados.length > 0 && achados.every((n) => n === esperado);
}
