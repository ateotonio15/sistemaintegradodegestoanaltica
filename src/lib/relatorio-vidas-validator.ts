import ExcelJS from "exceljs";

export const COLUNAS_OBRIGATORIAS = [
  "TIPO OPERACAO", "NOME", "TITULAR", "DATA NASC", "ESTADO CIVIL",
  "NACIONALIDADE", "SEXO", "NOME DA MAE", "CPF", "UF EMISSOR",
  "ORGAO EMISSOR", "PAIS EMISSOR", "CEP", "ENDERECO", "NUMERO",
  "BAIRRO", "CIDADE", "ESTADO", "DATA ADMISSAO", "GRAU PARENTESCO",
  "NR CARTAO SUS", "TIPO LOGRADOURO", "DT CASAMENTO",
] as const;

// Validação obrigatória de preenchimento (erros). Demais geram apenas alertas.
const CAMPOS_OBRIGATORIOS_LINHA = [
  "TIPO OPERACAO", "NOME", "DATA NASC", "CPF", "GRAU PARENTESCO",
];

export type Severidade = "ok" | "alerta" | "erro";

export interface ColunaResultado {
  coluna: string;
  presente: boolean;
  preenchidas: number;
  vazias: number;
  invalidas: number;
  severidade: Severidade;
}

export interface PendenciaLinha {
  linha: number;
  coluna: string;
  motivo: string;
  severidade: Severidade;
}

export interface ValidacaoResultado {
  verificado_em: string;
  total_linhas: number;
  total_vidas: number;
  titulares: number;
  dependentes: number;
  colunas: ColunaResultado[];
  colunas_ausentes: string[];
  pendencias: PendenciaLinha[];
  erros: number;
  alertas: number;
  valido: boolean;
}

function normalize(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function isValidCPF(v: string) {
  const c = (v || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}

function isValidCEP(v: string) {
  return /^\d{8}$/.test((v || "").replace(/\D/g, ""));
}

function isValidDate(v: any) {
  if (!v) return false;
  if (v instanceof Date) return !isNaN(v.getTime());
  const s = String(v).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return !isNaN(new Date(s).getTime());
  return false;
}

export async function validarRelatorioVidas(
  buffer: ArrayBuffer,
  onProgress?: (pct: number) => void,
): Promise<ValidacaoResultado> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Planilha vazia");

  // header row = 1
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = normalize(String(cell.value ?? ""));
  });

  const colIndex: Record<string, number> = {};
  COLUNAS_OBRIGATORIAS.forEach((c) => {
    const idx = headers.findIndex((h) => h === c);
    if (idx >= 0) colIndex[c] = idx;
  });

  const colunas_ausentes = COLUNAS_OBRIGATORIAS.filter((c) => colIndex[c] === undefined);
  const colStats: Record<string, ColunaResultado> = {};
  COLUNAS_OBRIGATORIAS.forEach((c) => {
    colStats[c] = {
      coluna: c,
      presente: colIndex[c] !== undefined,
      preenchidas: 0,
      vazias: 0,
      invalidas: 0,
      severidade: colIndex[c] === undefined ? "erro" : "ok",
    };
  });

  const pendencias: PendenciaLinha[] = [];
  let titulares = 0;
  let dependentes = 0;
  let totalLinhas = 0;

  const rowCount = ws.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    totalLinhas++;

    if (onProgress && r % 200 === 0) onProgress(Math.min(99, (r / rowCount) * 100));

    const get = (col: string) => {
      const idx = colIndex[col];
      if (idx === undefined) return "";
      const v = row.getCell(idx).value;
      if (v == null) return "";
      if (typeof v === "object" && "text" in (v as any)) return String((v as any).text || "");
      if (typeof v === "object" && "result" in (v as any)) return String((v as any).result ?? "");
      return String(v);
    };

    // grau parentesco — contagem de vidas
    const grau = normalize(get("GRAU PARENTESCO"));
    if (grau === "TITULAR" || grau === "") titulares++;
    else dependentes++;

    for (const c of COLUNAS_OBRIGATORIAS) {
      if (colIndex[c] === undefined) continue;
      const raw = get(c);
      const val = (raw || "").trim();
      const obrig = CAMPOS_OBRIGATORIOS_LINHA.includes(c);

      if (!val) {
        colStats[c].vazias++;
        if (obrig) {
          colStats[c].severidade = "erro";
          pendencias.push({ linha: r, coluna: c, motivo: "vazio", severidade: "erro" });
        } else if (colStats[c].severidade === "ok") {
          colStats[c].severidade = "alerta";
        }
        continue;
      }

      colStats[c].preenchidas++;
      let invalido = false;
      let motivo = "";
      if (c === "CPF" && !isValidCPF(val)) { invalido = true; motivo = "CPF inválido"; }
      else if (c === "CEP" && !isValidCEP(val)) { invalido = true; motivo = "CEP inválido"; }
      else if ((c === "DATA NASC" || c === "DATA ADMISSAO" || c === "DT CASAMENTO") && !isValidDate(val)) {
        // DT CASAMENTO só erro se ESTADO CIVIL = CASADO
        if (c === "DT CASAMENTO") {
          const ec = normalize(get("ESTADO CIVIL"));
          if (ec === "CASADO" || ec === "CASADA" || ec === "CASADO(A)") {
            invalido = true; motivo = "data inválida";
          }
        } else {
          invalido = true; motivo = "data inválida";
        }
      }
      if (invalido) {
        colStats[c].invalidas++;
        const sev: Severidade = CAMPOS_OBRIGATORIOS_LINHA.includes(c) ? "erro" : "alerta";
        if (sev === "erro") colStats[c].severidade = "erro";
        else if (colStats[c].severidade === "ok") colStats[c].severidade = "alerta";
        pendencias.push({ linha: r, coluna: c, motivo, severidade: sev });
      }
    }
  }

  onProgress?.(100);

  const colunas = Object.values(colStats);
  const erros = pendencias.filter((p) => p.severidade === "erro").length + colunas_ausentes.length;
  const alertas = pendencias.filter((p) => p.severidade === "alerta").length;

  return {
    verificado_em: new Date().toISOString(),
    total_linhas: totalLinhas,
    total_vidas: totalLinhas,
    titulares,
    dependentes,
    colunas,
    colunas_ausentes,
    pendencias: pendencias.slice(0, 500),
    erros,
    alertas,
    valido: colunas_ausentes.length === 0 && erros === 0,
  };
}
