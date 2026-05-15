export const CATEGORIAS_ARQUIVO = [
  "Boletos",
  "Notas Fiscais",
  "Contratos",
  "Excel Financeiro",
  "PDF Financeiro",
  "Comprovantes",
  "Inclusões",
  "Exclusões",
  "Outros",
] as const;

export type CategoriaArquivo = (typeof CATEGORIAS_ARQUIVO)[number];

const ALLOWED_EXT = ["pdf", "xlsx", "xls", "csv", "docx", "png", "jpg", "jpeg"];
const BLOCKED_EXT = ["exe", "bat", "sh", "cmd", "msi", "js", "ps1", "vbs", "scr", "jar"];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "", // alguns navegadores não preenchem mime
];

export function validarArquivo(f: File): { ok: true } | { ok: false; motivo: string } {
  if (f.size > MAX_BYTES) return { ok: false, motivo: "Arquivo maior que 25 MB" };
  const ext = (f.name.split(".").pop() ?? "").toLowerCase();
  if (BLOCKED_EXT.includes(ext)) return { ok: false, motivo: "Tipo de arquivo não permitido" };
  if (!ALLOWED_EXT.includes(ext)) return { ok: false, motivo: `Extensão .${ext} não permitida` };
  if (f.type && !ALLOWED_MIME.includes(f.type)) {
    return { ok: false, motivo: `MIME type não permitido (${f.type})` };
  }
  return { ok: true };
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatBytes(b: number | null | undefined): string {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function tipoArquivo(ext: string | null | undefined): "PDF" | "Excel" | "Imagem" | "Doc" | "Outro" {
  const e = (ext ?? "").toLowerCase();
  if (e === "pdf") return "PDF";
  if (["xlsx", "xls", "csv"].includes(e)) return "Excel";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return "Imagem";
  if (["docx", "doc"].includes(e)) return "Doc";
  return "Outro";
}

export function compLabel(c: string): string {
  const [y, m] = c.split("-");
  if (!y || !m) return c;
  return `${m}/${y}`;
}
