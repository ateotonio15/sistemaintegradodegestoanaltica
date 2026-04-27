import ExcelJS from "exceljs";

export interface CategoriaResultado {
  beneficiarios: number;
  mensalidade: number;
  total: number;
}

export interface InclusaoResultado {
  quantidade: number;
  total: number;
}

export interface AnaliseResultado {
  pagador: string;
  enfermaria: CategoriaResultado;
  apartamento: CategoriaResultado;
  inclusoes: InclusaoResultado;
  avisos: string[];
}

/** Normaliza string: minúsculo, sem acentos, sem espaços nas pontas. */
function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Converte qualquer célula em número (aceita "R$ 1.234,56"). */
function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in (v as any)) {
    return toNumber((v as any).result);
  }
  let s = String(v).trim();
  // Remove símbolos de moeda e espaços
  s = s.replace(/[R$\s]/g, "");
  // Se tiver vírgula como decimal: "1.234,56" -> "1234.56"
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/** Variações aceitas para cada coluna. */
const COL_PLANO = ["plano", "planos", "tipo plano", "tipo de plano", "nome do plano"];
const COL_TIPO_COBRANCA = [
  "tipo cobranca",
  "tipo de cobranca",
  "tipo cobrança",
  "cobranca",
  "movimento",
  "tipo movimento",
];
const COL_VALOR = ["valor", "mensalidade", "valor mensalidade", "vlr", "preco", "valor total"];

function findColumnIndex(header: unknown[], aliases: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (!h) continue;
    for (const alias of aliases) {
      if (h === alias || h.includes(alias)) return i;
    }
  }
  return -1;
}

/** Classifica o nome do plano em "enfermaria" | "apartamento" | null. */
function classificarPlano(plano: string): "enfermaria" | "apartamento" | null {
  const p = norm(plano);
  if (!p) return null;
  // Apartamento (verificar antes pq "executivo" pode aparecer junto com "master")
  if (
    p.includes("master executivo") ||
    p.includes("coletivo executivo master") ||
    p.includes("apartamento")
  ) {
    return "apartamento";
  }
  if (
    p.includes("coletivo empresarial master") ||
    p.includes("master empresarial") ||
    p.includes("enfermaria")
  ) {
    return "enfermaria";
  }
  return null;
}

function isInclusao(tipo: string): boolean {
  const t = norm(tipo);
  return t.includes("inclusao") || t.includes("inclusão");
}

/**
 * Lê um buffer .xlsx/.xls e devolve análise: Enfermaria, Apartamento e Inclusões.
 * As colunas obrigatórias são "Plano" e "Tipo Cobrança" (variações aceitas).
 */
export async function analisarExcelFinanceiro(
  buffer: ArrayBuffer,
): Promise<Omit<AnaliseResultado, "pagador">> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  const avisos: string[] = [];

  const empty: CategoriaResultado = { beneficiarios: 0, mensalidade: 0, total: 0 };

  if (!ws) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { quantidade: 0, total: 0 },
      avisos: ["Planilha vazia ou ilegível."],
    };
  }

  // Coletar todas as linhas brutas (até 2000 para evitar travas)
  const allRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length >= 2000) return;
    const values = (row.values as unknown[]).slice(1); // ExcelJS é 1-indexed
    allRows.push(values);
  });

  // Procurar a linha de cabeçalho dentro das primeiras 10
  let headerRow: unknown[] | null = null;
  let headerIdx = -1;
  let idxPlano = -1;
  let idxTipo = -1;
  let idxValor = -1;

  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const r = allRows[i];
    const p = findColumnIndex(r, COL_PLANO);
    const t = findColumnIndex(r, COL_TIPO_COBRANCA);
    const v = findColumnIndex(r, COL_VALOR);
    // Considera cabeçalho se achou pelo menos plano OU tipo cobrança
    if (p >= 0 || t >= 0) {
      headerRow = r;
      headerIdx = i;
      idxPlano = p;
      idxTipo = t;
      idxValor = v;
      break;
    }
  }

  if (!headerRow) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { quantidade: 0, total: 0 },
      avisos: [
        "Não foi possível identificar a linha de cabeçalho (esperado: 'Plano' e 'Tipo Cobrança').",
      ],
    };
  }

  if (idxPlano < 0) avisos.push("Coluna 'Plano' não encontrada.");
  if (idxTipo < 0) avisos.push("Coluna 'Tipo Cobrança' não encontrada.");
  if (idxValor < 0) avisos.push("Coluna 'Valor' / 'Mensalidade' não encontrada — totais serão 0.");

  const enfValores: number[] = [];
  const aptValores: number[] = [];
  let incQtd = 0;
  let incTotal = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;

    const planoCell = idxPlano >= 0 ? r[idxPlano] : "";
    const tipoCell = idxTipo >= 0 ? r[idxTipo] : "";
    const valorCell = idxValor >= 0 ? r[idxValor] : 0;

    const valor = toNumber(valorCell);
    const valorValido = !isNaN(valor) && valor >= 0;

    // Inclusão tem prioridade — não soma em enfermaria/apartamento
    if (idxTipo >= 0 && isInclusao(String(tipoCell))) {
      incQtd += 1;
      if (valorValido) incTotal += valor;
      continue;
    }

    if (idxPlano < 0) continue;

    const cat = classificarPlano(String(planoCell));
    if (!cat) continue;

    if (cat === "enfermaria") {
      enfValores.push(valorValido ? valor : 0);
    } else {
      aptValores.push(valorValido ? valor : 0);
    }
  }

  const buildCategoria = (vals: number[]): CategoriaResultado => {
    const total = vals.reduce((s, v) => s + v, 0);
    const beneficiarios = vals.length;
    // Mensalidade "média" — se todos iguais, mostra o próprio valor
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };

  return {
    enfermaria: buildCategoria(enfValores),
    apartamento: buildCategoria(aptValores),
    inclusoes: { quantidade: incQtd, total: incTotal },
    avisos,
  };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(n: number): string {
  if (!isFinite(n)) return "R$ 0,00";
  return brl.format(n);
}
