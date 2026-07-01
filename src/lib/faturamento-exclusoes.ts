import * as XLSX from "xlsx";

/**
 * Normaliza cabeçalhos para comparação (case/acentos/espaços/underline/hífen).
 */
function normHeader(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aliases para casar variações comuns ("Tipo Cobrança" == "Tipo de Cobrança").
 */
const ALIASES: Record<string, string[]> = {
  "tipo cobranca": ["tipo cobranca", "tipo de cobranca", "tipocobranca"],
  "dt adesao": ["dt adesao", "data adesao", "data de adesao", "dtadesao"],
  "dt rescisao": ["dt rescisao", "data rescisao", "data de rescisao", "dtrescisao", "dt_rescisao"],
  "fx etaria": ["fx etaria", "faixa etaria", "fxetaria"],
  "competencia": ["competencia", "compet"],
  "beneficiario": ["beneficiario", "nome beneficiario"],
  "carteirinha": ["carteirinha", "carteira", "matricula ans"],
  "cnpj": ["cnpj", "cnpj pagador"],
  "cpf": ["cpf", "cpf beneficiario"],
};

function candidatesFor(header: string): string[] {
  const key = normHeader(header);
  const set = new Set<string>([key]);
  for (const [, list] of Object.entries(ALIASES)) {
    if (list.includes(key)) list.forEach((v) => set.add(v));
  }
  return Array.from(set);
}

type Row = Record<string, unknown>;

function sheetToAOA(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
}

/**
 * Junta as linhas do arquivo de exclusões ao final do arquivo bruto,
 * mapeando somente as colunas existentes no bruto. Preenche "Tipo Cobrança" = "Exclusão"
 * e mantém "Valor" em branco. Retorna um ArrayBuffer .xlsx pronto para ser formatado.
 */
export async function adicionarExclusoesAoBruto(
  brutoBuf: ArrayBuffer,
  exclusoesBuf: ArrayBuffer,
): Promise<ArrayBuffer> {
  const wbBruto = XLSX.read(brutoBuf, { type: "array", cellDates: true });
  const wbExc = XLSX.read(exclusoesBuf, { type: "array", cellDates: true });

  const brutoName = wbBruto.SheetNames[0];
  const excName = wbExc.SheetNames[0];
  if (!brutoName || !excName) throw new Error("Arquivos sem abas legíveis.");

  const wsBruto = wbBruto.Sheets[brutoName];
  const wsExc = wbExc.Sheets[excName];
  const aoaBruto = sheetToAOA(wsBruto);
  const aoaExc = sheetToAOA(wsExc);
  if (!aoaBruto.length) throw new Error("Arquivo bruto vazio.");
  if (!aoaExc.length) throw new Error("Arquivo de exclusões vazio.");

  const headersBruto = (aoaBruto[0] as unknown[]).map((h) => String(h ?? ""));
  const headersExc = (aoaExc[0] as unknown[]).map((h) => String(h ?? ""));
  const normExcMap = new Map<string, number>();
  headersExc.forEach((h, i) => normExcMap.set(normHeader(h), i));

  // Índice das colunas de destino
  const idxTipo = headersBruto.findIndex((h) => normHeader(h) === "tipo cobranca" || candidatesFor(h).includes("tipo cobranca"));
  const idxValor = headersBruto.findIndex((h) => normHeader(h) === "valor");

  // Converte exclusões em linhas alinhadas ao cabeçalho do bruto
  const novasLinhas: unknown[][] = [];
  for (let r = 1; r < aoaExc.length; r++) {
    const linhaExc = aoaExc[r] as unknown[];
    // Ignora linhas totalmente vazias
    if (!linhaExc || linhaExc.every((v) => v === "" || v == null)) continue;

    const nova: unknown[] = headersBruto.map((h, ci) => {
      if (ci === idxTipo) return "Exclusão";
      if (ci === idxValor) return "";
      // Procura correspondência por cabeçalho normalizado + aliases
      const cand = candidatesFor(h);
      for (const c of cand) {
        const found = normExcMap.get(c);
        if (found != null) {
          const val = linhaExc[found];
          return val == null ? "" : val;
        }
      }
      return "";
    });
    novasLinhas.push(nova);
  }

  // Anexa ao final da aba bruta
  XLSX.utils.sheet_add_aoa(wsBruto, novasLinhas, { origin: -1 });

  const out = XLSX.write(wbBruto, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer;
  return out;
}
