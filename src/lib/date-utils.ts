export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return "—";

  try {
    if (date instanceof Date) {
      return date.toLocaleDateString("pt-BR");
    }

    if (typeof date === "string") {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("pt-BR");
      }
    }

    return "—";
  } catch {
    return "—";
  }
}

export function formatDay(date: string | Date | number | null): string {
  if (!date) return "—";

  try {
    if (typeof date === "number") {
      return String(date).padStart(2, "0");
    }

    const d = new Date(date);
    if (!isNaN(d.getTime())) {
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
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
