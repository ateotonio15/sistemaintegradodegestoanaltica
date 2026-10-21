/**
 * Linhas de cobrança retroativa na NFS-e (texto já normalizado, sem acentos).
 * Aceita "Cobrança retroativa: 388,52", "Retroativo agosto: 436,74",
 * "Retroativo - Setembro/26 R$ 436,74", "Retroação 08/2026 = 436,74".
 * O valor precisa ter centavos (",dd") para não capturar ano ou quantidade.
 */
export function regexRetroativoNf(): RegExp {
  const MES = String.raw`(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:\/|-|de)?\s*\d{2,4}(?![\d,]))?`;
  const COMP = String.raw`\d{1,2}\s*\/\s*\d{2,4}(?![\d,])`;
  return new RegExp(
    String.raw`(?:^|[\s/;|(])(?:cobranca\s*)?retroa(?:tiv[ao]s?|cao)(?:\s+(?:a|de|ref\.?|referente(?:\s+a)?))?(?:\s*[-:]?\s*(?:${MES}|${COMP}))?\s*(?:\(\s*\d+\s*[a-z]*\s*\))?\s*[:\-=]?\s*(?:r\s*\$)?\s*(\d[\d.]*,\d{2})`,
    "gi",
  );
}
