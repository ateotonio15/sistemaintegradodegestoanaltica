/**
 * Separa o campo "observacao" dos atendimentos de plantão em matrícula + observação.
 * O texto pode vir como "Matrícula: 12345\nCardiologia", invertido, ou sem matrícula.
 */
export function parseObservacaoPlantao(texto?: string | null): {
  matricula: string;
  observacao: string;
} {
  const raw = String(texto ?? "").trim();
  if (!raw) return { matricula: "", observacao: "" };

  let matricula = "";
  const linhas = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const restantes: string[] = [];
  for (const linha of linhas) {
    const m = linha.match(/matr[ií]cula\s*[:\-]?\s*([^\s|,;]+)/i);
    if (m && !matricula) {
      matricula = m[1].trim();
      const resto = linha.replace(m[0], "").replace(/^[\s:\-|,;]+/, "").trim();
      if (resto) restantes.push(resto);
      continue;
    }
    restantes.push(linha);
  }

  return { matricula, observacao: restantes.join(" · ") };
}
