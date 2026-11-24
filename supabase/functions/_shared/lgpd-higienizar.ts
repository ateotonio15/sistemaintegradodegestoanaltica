// Remove dados pessoais de textos livres antes de enviá-los à IA.
export function higienizarTexto(texto: string, nomes: string[] = []): string {
  let t = String(texto ?? "");
  // CPF (formatado ou não)
  t = t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]");
  // Telefones
  t = t.replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]");
  // Carteirinha / matrícula: sequências longas de dígitos ou rótulos
  t = t.replace(/\b(carteirinha|matr[ií]cula|cart[aã]o)\s*[:nº°#-]*\s*[\w.-]+/gi, "[CARTEIRINHA]");
  t = t.replace(/\b\d{5,}\b/g, "[NUMERO]");
  // E-mails
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]");
  // Nomes conhecidos do atendimento (cada parte com 3+ letras)
  for (const nome of nomes) {
    for (const parte of String(nome ?? "").split(/\s+/).filter((p) => p.length >= 3)) {
      const esc = parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      t = t.replace(new RegExp(`\\b${esc}\\b`, "gi"), "[NOME]");
    }
  }
  // Marcador de matrícula usado pelo SIGA nas observações
  t = t.replace(/\[matr[^\]]*\]/gi, "[CARTEIRINHA]");
  return t.slice(0, 600);
}
