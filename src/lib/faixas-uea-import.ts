import * as XLSX from "xlsx";
import { toISODateLocal } from "@/lib/dependentes-uea";

export interface FaixaImportLinha {
  idade_inicial: number;
  idade_final: number | null;
  valor_mensal: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacao: string | null;
  /** Capa da tabela (descrição), opcional na planilha. */
  tabela_nome: string | null;
  plano: string | null;
  sequencia: string | null;
  linha: number;
  erro?: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function acharCol(headers: string[], alvos: string[]): number {
  const h = headers.map(norm);
  for (const alvo of alvos) {
    const i = h.findIndex((x) => x === alvo);
    if (i >= 0) return i;
  }
  for (const alvo of alvos) {
    const i = h.findIndex((x) => x.includes(alvo));
    if (i >= 0) return i;
  }
  return -1;
}

function parseNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/r\$/i, "").replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseIdadeFaixa(v: unknown): { inicial: number | null; final: number | null } {
  const s = String(v ?? "").trim();
  if (!s) return { inicial: null, final: null };
  const nums = s.match(/\d+/g);
  if (!nums) return { inicial: null, final: null };
  if (nums.length === 1) {
    const n = Number(nums[0]);
    // "59+", "59 ou mais", "acima de 59" => sem limite superior
    if (/\+|mais|acima|superior/i.test(s)) return { inicial: n, final: null };
    return { inicial: n, final: n };
  }
  return { inicial: Number(nums[0]), final: Number(nums[1]) };
}

function parseData(v: unknown, fallback: string | null): string | null {
  if (v === null || v === undefined || v === "") return fallback;
  if (v instanceof Date) return toISODateLocal(v);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return fallback;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return fallback;
}

/**
 * Lê uma planilha (xlsx/xls/csv) com as faixas etárias e valores.
 * Colunas aceitas (nomes flexíveis, acentos opcionais):
 *  - "Faixa" (ex.: "0 a 18", "59+") OU "Idade inicial" + "Idade final"
 *  - "Valor mensal" (obrigatório)
 *  - "Vigência início", "Vigência fim", "Observação" (opcionais)
 */
export async function lerPlanilhaFaixas(file: File): Promise<FaixaImportLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
  if (matriz.length === 0) return [];

  const headerIdx = matriz.findIndex((r) =>
    (r ?? []).some((c) => /valor/i.test(String(c ?? ""))),
  );
  const hIdx = headerIdx >= 0 ? headerIdx : 0;
  const headers = (matriz[hIdx] ?? []).map((c) => String(c ?? ""));

  const cFaixa = acharCol(headers, ["faixa", "faixa etaria", "idade"]);
  const cIni = acharCol(headers, ["idade inicial", "de", "inicio", "idade de"]);
  const cFim = acharCol(headers, ["idade final", "ate", "fim", "idade ate"]);
  const cValor = acharCol(headers, [
    "valor mensal",
    "preco atual",
    "valor",
    "mensalidade",
    "preco",
  ]);
  const cVigIni = acharCol(headers, ["vigencia inicio", "vigencia", "inicio vigencia"]);
  const cVigFim = acharCol(headers, ["vigencia fim", "fim vigencia"]);
  const cObs = acharCol(headers, ["observacao", "obs"]);
  const cTabela = acharCol(headers, ["tabela", "descricao", "tabela nome", "capa"]);
  const cPlano = acharCol(headers, ["plano", "produto"]);

  const hoje = toISODateLocal(new Date());
  const linhas: FaixaImportLinha[] = [];

  for (let i = hIdx + 1; i < matriz.length; i++) {
    const row = matriz[i] ?? [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    let inicial = cIni >= 0 ? parseNumero(row[cIni]) : null;
    let final = cFim >= 0 ? parseNumero(row[cFim]) : null;
    if (inicial === null && cFaixa >= 0) {
      const p = parseIdadeFaixa(row[cFaixa]);
      inicial = p.inicial;
      if (final === null) final = p.final;
    }
    const valor = cValor >= 0 ? parseNumero(row[cValor]) : null;
    const vigIni = parseData(cVigIni >= 0 ? row[cVigIni] : null, hoje) ?? hoje;
    const vigFim = parseData(cVigFim >= 0 ? row[cVigFim] : null, null);
    const obs = cObs >= 0 && row[cObs] ? String(row[cObs]).trim() : null;
    const tabela = cTabela >= 0 && row[cTabela] ? String(row[cTabela]).trim() : null;
    const plano = cPlano >= 0 && row[cPlano] ? String(row[cPlano]).trim() : null;

    const erros: string[] = [];
    if (inicial === null) erros.push("idade inicial não identificada");
    if (valor === null || valor <= 0) erros.push("valor mensal inválido");
    if (inicial !== null && final !== null && final < inicial) erros.push("idade final menor que a inicial");

    linhas.push({
      idade_inicial: inicial ?? 0,
      idade_final: final ?? null,
      valor_mensal: valor ?? 0,
      vigencia_inicio: vigIni,
      vigencia_fim: vigFim,
      observacao: obs,
      tabela_nome: tabela,
      plano,
      linha: i + 1,
      erro: erros.length ? erros.join("; ") : undefined,
    });
  }

  return linhas;
}

export function modeloPlanilhaFaixas(): Blob {
  const dados = [
    ["Faixa", "Idade inicial", "Idade final", "Valor mensal", "Vigência início", "Vigência fim", "Tabela", "Plano", "Observação"],
    ["0 a 18", 0, 18, 263.71, "01/01/2026", "", "Tabela UEA - 1", "Quality Plus - Apartamento", ""],
    ["19 a 23", 19, 23, 298.9, "01/01/2026", "", "Tabela UEA - 1", "Quality Plus - Apartamento", ""],
    ["59+", 59, "", 780.5, "01/01/2026", "", "Tabela UEA - 1", "Quality - Enfermaria", "Última faixa"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Faixas");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
