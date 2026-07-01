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
 * Mapeamento explícito Bruto ← Exclusões
 * (chave = cabeçalho no BRUTO normalizado; valor = lista de cabeçalhos aceitos na PLANILHA DE EXCLUSÕES)
 */
const BRUTO_FROM_EXCL: Record<string, string[]> = {
  "tipo cobranca": [], // fixado como "Exclusão"
  "valor": [],         // sempre vazio
  "competencia": [],   // calculado (mês anterior à mensalidade)
  "fx etaria": [],     // replicado do bruto ("0 à 999")

  // Mapeamentos explícitos solicitados pelo usuário
  "titularidade": ["tipo"],
  "dt": ["dt nascimento", "dt_nascimento", "data nascimento", "data de nascimento", "nascimento"],
  "pagador": ["subestipulante"],

  // Fallbacks úteis (mesmo nome)
  "beneficiario": ["beneficiario", "nome beneficiario", "nome"],
  "cpf": ["cpf", "cpf beneficiario"],
  "cnpj": ["cnpj"],
  "matricula": ["matricula", "matricula ans", "carteirinha", "carteira"],
  "plano": ["plano"],
  "contr": ["contr", "contrato"],
  "sexo": ["sexo"],
  "dt adesao": ["dt adesao", "data adesao"],
  "dt rescisao": ["dt rescisao", "data rescisao"],
};

/** Encontra o valor de uma linha da exclusão para o cabeçalho do bruto */
function pickFromExcl(
  brutoHeader: string,
  linhaExc: unknown[],
  normExcMap: Map<string, number>,
): unknown {
  const brutoKey = normHeader(brutoHeader);
  const candidatos = BRUTO_FROM_EXCL[brutoKey] ?? [brutoKey];
  for (const c of candidatos) {
    const idx = normExcMap.get(normHeader(c));
    if (idx != null) {
      const v = linhaExc[idx];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return "";
}

function sheetToAOA(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
}

/** Retorna Date da célula, aceitando Date real ou string DD/MM/YYYY */
function toDateSafe(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10), 12));
  }
  const tmp = new Date(s);
  return isNaN(tmp.getTime()) ? null : tmp;
}

/**
 * Junta as linhas do arquivo de exclusões ao final do arquivo bruto seguindo as regras:
 *  - Tipo Cobrança  = "Exclusão"
 *  - Valor          = vazio
 *  - Competência    = mês anterior à mensalidade do bruto (dia 01)
 *  - Fx Etária      = mesma faixa do bruto (ex.: "0 à 999")
 *  - Titularidade   ← coluna "Tipo" das exclusões
 *  - Dt             ← coluna "DT_NASCIMENTO" das exclusões
 *  - Pagador        ← "SUBESTIPULANTE" das exclusões, removendo prefixo "PJ - "
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

  // Índice das colunas de destino no bruto
  const findBrutoIdx = (key: string) =>
    headersBruto.findIndex((h) => normHeader(h) === key);
  const idxTipo = findBrutoIdx("tipo cobranca");
  const idxValor = findBrutoIdx("valor");
  const idxComp = headersBruto.findIndex((h) => /^compet/.test(normHeader(h)));
  const idxFx = findBrutoIdx("fx etaria");
  const idxPagador = findBrutoIdx("pagador");

  // Descobre a competência da mensalidade (a mais recente presente no bruto)
  let maxComp: Date | null = null;
  if (idxComp >= 0) {
    for (let r = 1; r < aoaBruto.length; r++) {
      const linha = aoaBruto[r] as unknown[];
      const d = toDateSafe(linha[idxComp]);
      if (d && (!maxComp || d > maxComp)) maxComp = d;
    }
  }
  const compExclusao = maxComp
    ? new Date(Date.UTC(maxComp.getUTCFullYear(), maxComp.getUTCMonth() - 1, 1, 12))
    : null;

  // Fx etária mais comum no bruto (default "0 à 999")
  let fxEtariaBruto = "0 à 999";
  if (idxFx >= 0) {
    const cnt = new Map<string, number>();
    for (let r = 1; r < aoaBruto.length; r++) {
      const linha = aoaBruto[r] as unknown[];
      const v = String(linha[idxFx] ?? "").trim();
      if (v) cnt.set(v, (cnt.get(v) || 0) + 1);
    }
    let max = 0;
    for (const [k, v] of cnt) if (v > max) (max = v), (fxEtariaBruto = k);
  }

  // Converte exclusões em linhas alinhadas ao cabeçalho do bruto
  const novasLinhas: unknown[][] = [];
  for (let r = 1; r < aoaExc.length; r++) {
    const linhaExc = aoaExc[r] as unknown[];
    if (!linhaExc || linhaExc.every((v) => v === "" || v == null)) continue;

    const nova: unknown[] = headersBruto.map((h, ci) => {
      if (ci === idxTipo) return "Exclusão";
      if (ci === idxValor) return "";
      if (ci === idxComp) return compExclusao ?? "";
      if (ci === idxFx) return fxEtariaBruto;

      let val = pickFromExcl(h, linhaExc, normExcMap);

      // Regra especial: Pagador ← SUBESTIPULANTE (remove "PJ - ")
      if (ci === idxPagador && typeof val === "string") {
        val = val.replace(/^\s*PJ\s*[-–]\s*/i, "").trim();
      }

      return val == null ? "" : val;
    });
    novasLinhas.push(nova);
  }

  // Anexa ao final da aba bruta
  XLSX.utils.sheet_add_aoa(wsBruto, novasLinhas, { origin: -1 });

  const out = XLSX.write(wbBruto, {
    type: "array",
    bookType: "xlsx",
    cellDates: true,
  }) as ArrayBuffer;
  return out;
}
