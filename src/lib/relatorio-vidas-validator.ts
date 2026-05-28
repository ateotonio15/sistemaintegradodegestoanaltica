import ExcelJS from "exceljs";

export const COLUNAS_OBRIGATORIAS = [
  "TIPO OPERACAO", "NOME", "TITULAR", "DATA NASC", "ESTADO CIVIL",
  "NACIONALIDADE", "SEXO", "NOME DA MAE", "CPF", "UF EMISSOR",
  "ORGAO EMISSOR", "PAIS EMISSOR", "CEP", "ENDERECO", "NUMERO",
  "BAIRRO", "CIDADE", "ESTADO", "DATA ADMISSAO", "GRAU PARENTESCO",
  "NR CARTAO SUS", "TIPO LOGRADOURO", "DT CASAMENTO",
] as const;

// Validação obrigatória de preenchimento (erros). Demais geram apenas alertas.
// GRAU PARENTESCO e TITULAR NÃO são obrigatórios: vazio = TITULAR (regra automática ETAPA 45).
const CAMPOS_OBRIGATORIOS_LINHA = [
  "TIPO OPERACAO", "NOME", "DATA NASC", "CPF",
];

// Campos sempre obrigatórios mesmo quando CPF já existe no banco (reaproveitamento).
const CAMPOS_OBRIGATORIOS_MESMO_REAPROVEITADO = new Set([
  "TIPO OPERACAO", "CPF",
]);

export type TipoBeneficiario = "TITULAR" | "FILHO" | "CONJUGE" | "DEPENDENTE";

export function classificarParentesco(grauRaw: any): TipoBeneficiario {
  const g = (grauRaw == null ? "" : String(grauRaw)).trim();
  if (g === "") return "TITULAR";
  const n = parseInt(g, 10);
  if (n === 6) return "FILHO";
  if (n === 4) return "CONJUGE";
  return "DEPENDENTE";
}

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
  total_linhas: number; // mantido por compatibilidade = linhas_validas
  total_vidas: number;  // = linhas_validas
  titulares: number;
  dependentes: number;
  colunas: ColunaResultado[];
  colunas_ausentes: string[];
  pendencias: PendenciaLinha[];
  erros: number;
  alertas: number;
  valido: boolean;
  // Novos contadores da ETAPA 43
  linhas_lidas: number;
  linhas_validas: number;
  linhas_ignoradas_vazias: number;
  linhas_ignoradas_outro_tipo: number;
  linhas_reaproveitadas: number;
  // ETAPA 45 - classificação automática por GRAU PARENTESCO
  titulares_auto: number;
  filhos: number;
  conjuges: number;
  outros_dependentes: number;
}

export interface ValidacaoOptions {
  cpfsExistentes?: Set<string>;
}

function normalize(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function cellToString(v: any) {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String(v.text || "");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function isValidCPF(v: string) {
  const c = onlyDigits(v);
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
  return /^\d{8}$/.test(onlyDigits(v));
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
  options: ValidacaoOptions = {},
): Promise<ValidacaoResultado> {
  const cpfsExistentes = options.cpfsExistentes ?? new Set<string>();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Planilha vazia");

  let headerRowNumber = 1;
  for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
    const values: string[] = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => values.push(normalize(cellToString(cell.value))));
    if (values.some((h) => h === "NOME" || h === "BENEFICIARIO")) {
      headerRowNumber = r;
      break;
    }
  }

  const headerRow = ws.getRow(headerRowNumber);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = normalize(cellToString(cell.value));
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

  let linhas_lidas = 0;
  let linhas_validas = 0;
  let linhas_ignoradas_vazias = 0;
  let linhas_ignoradas_outro_tipo = 0;
  let linhas_reaproveitadas = 0;
  let titulares_auto = 0;
  let filhos = 0;
  let conjuges = 0;
  let outros_dependentes = 0;

  const rowCount = ws.rowCount;
  const idxTipo = colIndex["TIPO OPERACAO"];
  const idxBeneficiario = headers.findIndex((h) => h === "BENEFICIARIO");
  const idxNome = colIndex["NOME"] ?? (idxBeneficiario >= 0 ? idxBeneficiario : undefined);

  for (let r = headerRowNumber + 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;

    // Regra: só conta como linha lida/válida quando NOME está preenchido.
    // Linhas com NOME vazio são totalmente ignoradas (não entram em Linhas Lidas).
    let nomeVal = "";
    if (idxNome !== undefined) {
      const rawNome = row.getCell(idxNome).value;
      nomeVal = cellToString(rawNome).trim();
    }
    if (!nomeVal) continue;

    linhas_lidas++;

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

    // === Regra do "I": só processa quando TIPO OPERACAO = "I" ===
    let tipoOp = "";
    if (idxTipo !== undefined) {
      const rawTipo = row.getCell(idxTipo).value;
      tipoOp = normalize(cellToString(rawTipo));
    }
    if (idxTipo !== undefined) {
      if (!tipoOp) {
        linhas_ignoradas_vazias++;
        continue;
      }
      if (tipoOp !== "I") {
        linhas_ignoradas_outro_tipo++;
        continue;
      }
    }

    linhas_validas++;

    // Reaproveitamento: CPF já cadastrado no banco
    const cpfDigits = onlyDigits(get("CPF"));
    const reaproveitada = cpfDigits.length === 11 && cpfsExistentes.has(cpfDigits);
    if (reaproveitada) linhas_reaproveitadas++;

    // ETAPA 45 - classificação automática por GRAU PARENTESCO
    const grauRaw = get("GRAU PARENTESCO");
    const tipoBenef = classificarParentesco(grauRaw);
    const grau = (grauRaw || "").trim();
    if (tipoBenef === "TITULAR") { titulares++; titulares_auto++; }
    else {
      dependentes++;
      if (tipoBenef === "FILHO") filhos++;
      else if (tipoBenef === "CONJUGE") conjuges++;
      else outros_dependentes++;
    }

    for (const c of COLUNAS_OBRIGATORIAS) {
      if (colIndex[c] === undefined) continue;
      const raw = get(c);
      const val = (raw || "").trim();
      const obrigBase = CAMPOS_OBRIGATORIOS_LINHA.includes(c);
      // Se a vida já existe no banco, só seguem obrigatórios os campos chave
      const obrig = reaproveitada
        ? (obrigBase && CAMPOS_OBRIGATORIOS_MESMO_REAPROVEITADO.has(c))
        : obrigBase;

      // ESTADO CIVIL = "2" (ou "CASADO") indica casado → DT CASAMENTO obrigatório
      const ecRaw = normalize(get("ESTADO CIVIL"));
      const isCasado = ecRaw === "2" || ecRaw === "CASADO" || ecRaw === "CASADA" || ecRaw === "CASADO(A)";

      if (!val) {
        // TITULAR/GRAU PARENTESCO vazios são semanticamente válidos:
        // indicam o próprio titular. Não conta como vazia nem gera alerta/erro.
        if (c === "TITULAR" || c === "GRAU PARENTESCO") {
          colStats[c].preenchidas++;
          continue;
        }
        // DT CASAMENTO só é exigida quando ESTADO CIVIL = casado (2)
        if (c === "DT CASAMENTO" && !isCasado) {
          colStats[c].preenchidas++;
          continue;
        }
        colStats[c].vazias++;
        if (obrig || (c === "DT CASAMENTO" && isCasado)) {
          colStats[c].severidade = "erro";
          pendencias.push({ linha: r, coluna: c, motivo: "vazio", severidade: "erro" });
        } else if (!reaproveitada && colStats[c].severidade === "ok") {
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
        if (c === "DT CASAMENTO") {
          if (isCasado) { invalido = true; motivo = "data inválida"; }
        } else {
          invalido = true; motivo = "data inválida";
        }
      }
      if (invalido) {
        colStats[c].invalidas++;
        const sev: Severidade = obrig ? "erro" : "alerta";
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
    total_linhas: linhas_lidas,
    total_vidas: linhas_lidas,
    titulares,
    dependentes,
    colunas,
    colunas_ausentes,
    pendencias: pendencias.slice(0, 500),
    erros,
    alertas,
    valido: colunas_ausentes.length === 0 && erros === 0 && linhas_validas > 0,
    linhas_lidas,
    linhas_validas,
    titulares_auto,
    filhos,
    conjuges,
    outros_dependentes,
    linhas_ignoradas_vazias,
    linhas_ignoradas_outro_tipo,
    linhas_reaproveitadas,
  };
}
