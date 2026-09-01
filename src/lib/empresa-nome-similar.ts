// Normalização e unificação de nomes de empresas digitados livremente
// (ex.: "Vitória regia" e "Indústrias Reunidas Vitória Régia LTDA" = mesma empresa).

const STOPWORDS = new Set([
  "ltda", "ltd", "me", "epp", "eireli", "sa", "s", "a", "cia", "companhia",
  "industria", "industrias", "indústria", "reunida", "reunidas", "comercio",
  "comercial", "servicos", "servico", "do", "da", "de", "dos", "das", "e",
  "grupo", "empresa", "filial", "matriz", "brasil", "am", "manaus",
]);

export function normalizeEmpresaNome(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function empresaTokens(nome: string): string[] {
  return normalizeEmpresaNome(nome)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function similaridade(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((t) => { if (sb.has(t)) inter++; });
  // proporção sobre o menor conjunto: "vitoria regia" ⊂ "vitoria regia ..." => 1
  return inter / Math.min(sa.size, sb.size);
}

export function mesmaEmpresa(a: string, b: string): boolean {
  const ta = empresaTokens(a);
  const tb = empresaTokens(b);
  if (!ta.length || !tb.length) return normalizeEmpresaNome(a) === normalizeEmpresaNome(b);
  return similaridade(ta, tb) >= 0.8;
}

/**
 * Agrupa nomes parecidos. Retorna um mapa nome original -> nome canônico
 * (o nome mais frequente do grupo; em empate, o mais longo/completo).
 */
export function unificarEmpresas(nomes: string[]): Map<string, string> {
  const freq = new Map<string, number>();
  nomes.forEach((n) => {
    const k = (n ?? "").trim();
    if (!k) return;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  });

  const grupos: { membros: string[]; tokens: string[] }[] = [];
  Array.from(freq.keys()).forEach((nome) => {
    const tk = empresaTokens(nome);
    const g = grupos.find((grp) => similaridade(grp.tokens, tk) >= 0.8);
    if (g) {
      g.membros.push(nome);
      // mantém o conjunto de tokens mais enxuto (núcleo do nome)
      if (tk.length < g.tokens.length) g.tokens = tk;
    } else {
      grupos.push({ membros: [nome], tokens: tk });
    }
  });

  const mapa = new Map<string, string>();
  grupos.forEach(({ membros }) => {
    const canonico = [...membros].sort((a, b) => {
      const fa = freq.get(a) ?? 0;
      const fb = freq.get(b) ?? 0;
      if (fb !== fa) return fb - fa;
      return b.length - a.length;
    })[0];
    membros.forEach((m) => mapa.set(m, canonico));
  });
  return mapa;
}
