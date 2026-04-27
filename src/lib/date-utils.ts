/**
 * Converte string em Date sem deslocamento de fuso horário.
 * Para "YYYY-MM-DD" (data pura do banco), constrói como data LOCAL
 * para evitar que o navegador interprete como UTC e exiba o dia anterior
 * em fusos negativos (ex: Brasil UTC-3).
 */
function parseDateSafe(value: string | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === "string") {
    // ISO date puro: YYYY-MM-DD → constrói como local (sem timezone shift)
    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      const [, y, m, d] = isoDateMatch;
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return isNaN(dt.getTime()) ? null : dt;
    }

    // ISO com tempo (timestamp completo) ou outro formato → parse padrão
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = parseDateSafe(date);
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

export function formatDay(date: string | Date | number | null): string {
  if (!date) return "—";

  try {
    if (typeof date === "number") {
      return String(date).padStart(2, "0");
    }

    const d = parseDateSafe(date);
    if (d) {
      return String(d.getDate()).padStart(2, "0");
    }

    return "—";
  } catch {
    return "—";
  }
}

export function toISODate(date: string | Date | null): string | null {
  if (!date) return null;

  try {
    const d = parseDateSafe(date);
    if (!d) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Retorna a data de HOJE no fuso LOCAL no formato YYYY-MM-DD.
 *
 * NÃO usar `new Date().toISOString().slice(0,10)` para isso — `toISOString`
 * converte para UTC e em fusos negativos (ex.: America/Manaus, UTC-4) à
 * noite a data muda para o dia seguinte, fazendo o sistema "salvar amanhã"
 * quando o usuário seleciona "hoje".
 */
export function todayLocalISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
