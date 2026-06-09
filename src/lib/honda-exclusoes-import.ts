import ExcelJS from "exceljs";

export interface HondaImportRow {
  tipo_operacao: string | null;
  sequencia: string | null;
  nome_beneficiario: string;
  cpf: string;
  data_demissao: string; // YYYY-MM-DD
  motivo: string | null;
}

export interface HondaImportResult {
  valid: HondaImportRow[];
  errors: { linha: number; motivo: string }[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function cleanCpf(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 0) return null;
  return d.padStart(11, "0").slice(-11);
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // DD/MM/YYYY
  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = "20" + y;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  // Excel serial number
  const n = Number(s);
  if (!isNaN(n) && n > 25569) {
    const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

const HEADER_MAP: Record<string, keyof HondaImportRow> = {
  "tipo operacao": "tipo_operacao",
  "tipo de operacao": "tipo_operacao",
  "sequencia": "sequencia",
  "nome beneficiario": "nome_beneficiario",
  "nome do beneficiario": "nome_beneficiario",
  "nome": "nome_beneficiario",
  "cpf": "cpf",
  "data demissao": "data_demissao",
  "data de demissao": "data_demissao",
  "motivo": "motivo",
  "motivo do desligamento": "motivo",
};

function resolveHeader(h: string): keyof HondaImportRow | null {
  const n = norm(h);
  if (HEADER_MAP[n]) return HEADER_MAP[n];
  if (!n) return null;
  if (n.includes("sequenc") || n.includes("seguenc") || n.startsWith("nr ") || n === "nr" || n === "seq" || n === "seq." || n === "n" || n === "no" || n === "nº" || n === "numero" || n.startsWith("n sequenc") || n.startsWith("no sequenc")) return "sequencia";
  if (n.includes("beneficiar")) return "nome_beneficiario";
  if (n.includes("cpf")) return "cpf";
  if (n.includes("demiss")) return "data_demissao";
  if (n.includes("motivo") || n.includes("desligament")) return "motivo";
  if (n.includes("operac")) return "tipo_operacao";
  return null;
}

function rowToData(headers: string[], values: unknown[]): Partial<HondaImportRow> {
  const out: Partial<HondaImportRow> = {};
  headers.forEach((h, i) => {
    const key = resolveHeader(h);
    if (key) (out as any)[key] = values[i];
  });
  return out;
}

function buildRow(raw: Partial<HondaImportRow>, linha: number, errors: HondaImportResult["errors"]): HondaImportRow | null {
  const nome = String(raw.nome_beneficiario ?? "").trim();
  const cpf = cleanCpf(raw.cpf);
  const data = parseDate(raw.data_demissao);
  if (!nome && !cpf && !data) return null; // empty row, ignore silently
  if (!cpf || cpf.length !== 11) {
    errors.push({ linha, motivo: "CPF inválido ou ausente" });
    return null;
  }
  if (!data) {
    errors.push({ linha, motivo: "Data de demissão inválida ou ausente" });
    return null;
  }
  if (!nome) {
    errors.push({ linha, motivo: "Nome do beneficiário ausente" });
    return null;
  }
  return {
    tipo_operacao: raw.tipo_operacao != null ? String(raw.tipo_operacao).trim() || null : null,
    sequencia: raw.sequencia != null ? String(raw.sequencia).trim() || null : null,
    nome_beneficiario: nome,
    cpf,
    data_demissao: data,
    motivo: raw.motivo != null ? String(raw.motivo).trim() || null : null,
  };
}

export async function parseHondaExclusoes(file: File): Promise<HondaImportResult> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type.includes("csv");
  const errors: HondaImportResult["errors"] = [];
  const valid: HondaImportRow[] = [];

  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(buf);
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return { valid, errors };
    const sep = lines[0].includes(";") ? ";" : ",";
    const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, ""));
    const headers = split(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const vals = split(lines[i]);
      const raw = rowToData(headers, vals);
      const row = buildRow(raw, i + 1, errors);
      if (row) valid.push(row);
    }
    return { valid, errors };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { valid, errors };

  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals = (row.values as unknown[]).slice(1);
    if (rowNumber === 1) {
      headers = vals.map((v) => String(v ?? ""));
      return;
    }
    const raw = rowToData(headers, vals);
    const built = buildRow(raw, rowNumber, errors);
    if (built) valid.push(built);
  });

  return { valid, errors };
}

export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
