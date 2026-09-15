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

/** Normaliza texto para comparação (upper, sem acento, sem "PJ - ", trim). */
function normText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*PJ\s*[-–]\s*/i, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Padroniza o nome do plano removendo protocolo ANS e variações. */
function normalizarPlano(s: unknown): string {
  const raw = String(s ?? "")
    .replace(/\s*[-–]\s*Protocolo\s*ANS[:\s]*\d+/i, "")
    .trim();
  const lower = raw.toLowerCase();
  if (lower.includes("master executivo")) return "Master Executivo";
  if (lower.includes("coletivo empresarial master")) return "Coletivo Empresarial Master";
  return raw;
}

/**
 * Mapeamento explícito Bruto ← Exclusões
 */
const BRUTO_FROM_EXCL: Record<string, string[]> = {
  "tipo cobranca": [],
  "valor": [],
  "competencia": [],
  "fx etaria": [],
  "cnpj": [], // preenchido pelo mapa pagador→CNPJ

  "titularidade": ["tipo"],
  "dt": ["dt nascimento", "dt_nascimento", "data nascimento", "data de nascimento", "nascimento"],
  "pagador": ["subestipulante"],

  "beneficiario": ["beneficiario", "nome beneficiario", "nome"],
  "cpf": ["cpf", "cpf beneficiario"],
  "matricula": ["matricula", "matricula ans", "carteirinha", "carteira"],
  "plano": ["plano"],
  "contr": ["contr", "contrato"],
  "sexo": ["sexo"],
  "dt adesao": ["dt adesao", "data adesao"],
  "dt rescisao": ["dt rescisao", "data rescisao"],
};

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

function fmtDataBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

function toDateSafe(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
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

/** Converte valor numérico BR/US para number. */
function toNumberSafe(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim().replace(/[R$\s]/g, "");
  // remove milhar "." quando há vírgula decimal
  const norm = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(norm);
  return isFinite(n) ? n : null;
}

/** Dias totais do mês da data. */
function diasDoMes(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Somente dígitos (para comparação de CNPJ). */
function onlyDigits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

/**
 * Proporcional de exclusão para empresa de PERÍODO específico.
 *
 * O ciclo de referência é o ciclo que está sendo faturado nesta remessa
 * (derivado da competência mais recente do arquivo bruto), e NÃO o ciclo
 * que contém a data de rescisão. Assim, exclusões lançadas em atraso
 * (rescisão no mês anterior) são cobradas até o fim do ciclo atual.
 *
 * Ex.: ciclo dia 20, competência 01/08 → ciclo 20/07 a 19/08 (31 dias).
 * Rescisão 16/07 → 35 dias proporcionais (16/07 até 19/08).
 */
export function calcularProporcionalPeriodo(
  dResc: Date,
  mensalidade: number,
  diaInicioCiclo: number,
  competenciaRef?: Date | null,
): number | null {
  const diaFim = diaInicioCiclo === 1 ? 0 : diaInicioCiclo - 1; // 0 ⇒ último dia do mês

  // Base do ciclo: mês da competência de faturamento; sem ela, usa a rescisão.
  const base = competenciaRef ?? dResc;
  let year = base.getUTCFullYear();
  let month = base.getUTCMonth();

  const buildEnd = (y: number, m: number): Date => {
    if (diaFim === 0) return new Date(Date.UTC(y, m + 1, 0, 12));
    const lastDom = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(diaFim, lastDom), 12));
  };

  let cycleEnd = buildEnd(year, month);

  if (!competenciaRef) {
    // Fallback: ciclo que contém a rescisão
    if (diaFim !== 0 && dResc.getUTCDate() > diaFim) cycleEnd = buildEnd(year, month + 1);
  } else if (dResc.getTime() > cycleEnd.getTime()) {
    // Rescisão além do ciclo de referência → avança ciclos até alcançá-la
    let guard = 0;
    while (dResc.getTime() > cycleEnd.getTime() && guard < 24) {
      month += 1;
      cycleEnd = buildEnd(year, month);
      guard++;
    }
  }

  const cycleStart = new Date(cycleEnd);
  cycleStart.setUTCMonth(cycleStart.getUTCMonth() - 1);
  cycleStart.setUTCDate(cycleStart.getUTCDate() + 1);

  const totalDiasCiclo =
    Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1;
  const diasProp = Math.round((cycleEnd.getTime() - dResc.getTime()) / 86400000) + 1;
  if (totalDiasCiclo <= 0 || diasProp <= 0) return null;
  const v = -1 * (mensalidade / totalDiasCiclo) * diasProp;
  return Math.round(v * 100) / 100;
}


export interface CnpjPeriodoSuspeita {
  cnpj: string;
  digits: string;
  nome?: string;
  diaCiclo: number;
  /** Data (YYYY-MM-DD) sugerida como periodo_cobranca_inicio (usa competência mais recente + diaCiclo). */
  dataSugerida: string;
}

/**
 * Heurística: para cada CNPJ do bruto, se o dia da competência mais frequente ≠ 01,
 * a empresa provavelmente é de PERÍODO específico com ciclo iniciando naquele dia.
 * Retorna apenas suspeitas — o chamador filtra as já cadastradas.
 */
export function detectarCnpjsDePeriodo(brutoBuf: ArrayBuffer): CnpjPeriodoSuspeita[] {
  const wb = XLSX.read(brutoBuf, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const aoa = sheetToAOA(wb.Sheets[name]);
  if (!aoa.length) return [];
  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? ""));
  const idxCnpj = headers.findIndex((h) => normHeader(h) === "cnpj");
  const idxComp = headers.findIndex((h) => /^compet/.test(normHeader(h)));
  const idxPag = headers.findIndex((h) => normHeader(h) === "pagador");
  if (idxCnpj < 0 || idxComp < 0) return [];

  const grupos = new Map<
    string,
    { digits: string; cnpj: string; nome?: string; days: Map<number, number>; ultimaComp?: Date }
  >();
  for (let r = 1; r < aoa.length; r++) {
    const linha = aoa[r] as unknown[];
    const cnpjRaw = String(linha[idxCnpj] ?? "").trim();
    if (!cnpjRaw) continue;
    const digits = onlyDigits(cnpjRaw);
    if (digits.length < 8) continue;
    const d = toDateSafe(linha[idxComp]);
    if (!d) continue;
    if (!grupos.has(digits)) {
      const nome =
        idxPag >= 0
          ? String(linha[idxPag] ?? "").replace(/^\s*PJ\s*[-–]\s*/i, "").trim() || undefined
          : undefined;
      grupos.set(digits, { digits, cnpj: cnpjRaw, nome, days: new Map(), ultimaComp: d });
    }
    const g = grupos.get(digits)!;
    const day = d.getUTCDate();
    g.days.set(day, (g.days.get(day) ?? 0) + 1);
    if (!g.ultimaComp || d > g.ultimaComp) g.ultimaComp = d;
  }

  const out: CnpjPeriodoSuspeita[] = [];
  for (const g of grupos.values()) {
    let bestDay = 1;
    let bestC = 0;
    for (const [dy, c] of g.days) {
      if (c > bestC) {
        bestC = c;
        bestDay = dy;
      }
    }
    if (bestDay === 1) continue;
    const base = g.ultimaComp ?? new Date();
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(bestDay).padStart(2, "0");
    out.push({
      cnpj: g.cnpj,
      digits: g.digits,
      nome: g.nome,
      diaCiclo: bestDay,
      dataSugerida: `${yyyy}-${mm}-${dd}`,
    });
  }
  return out;
}

export interface AdicionarExclusoesOpts {
  /** Mapa CNPJ (somente dígitos) → dia de início do ciclo (1..31) para empresas de período. */
  periodoPorCnpj?: Map<string, number>;
}

export async function adicionarExclusoesAoBruto(
  brutoBuf: ArrayBuffer,
  exclusoesBuf: ArrayBuffer,
  opts?: AdicionarExclusoesOpts,
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

  const findBrutoIdx = (key: string) =>
    headersBruto.findIndex((h) => normHeader(h) === key);
  const idxTipo = findBrutoIdx("tipo cobranca");
  const idxValor = findBrutoIdx("valor");
  const idxComp = headersBruto.findIndex((h) => /^compet/.test(normHeader(h)));
  const idxFx = findBrutoIdx("fx etaria");
  const idxPagador = findBrutoIdx("pagador");
  const idxCnpj = findBrutoIdx("cnpj");
  const idxPlano = findBrutoIdx("plano");

  // Normaliza a coluna Plano no bruto (in-place na AOA)
  if (idxPlano >= 0) {
    for (let r = 1; r < aoaBruto.length; r++) {
      const linha = aoaBruto[r] as unknown[];
      if (linha[idxPlano]) linha[idxPlano] = normalizarPlano(linha[idxPlano]);
    }
  }

  // Mapa pagador (normalizado) → CNPJ, a partir do bruto
  const pagadorCnpjMap = new Map<string, string>();
  const cnpjsDistintos: string[] = [];
  if (idxCnpj >= 0) {
    for (let r = 1; r < aoaBruto.length; r++) {
      const linha = aoaBruto[r] as unknown[];
      const cnpj = String(linha[idxCnpj] ?? "").trim();
      if (cnpj && !cnpjsDistintos.includes(cnpj)) cnpjsDistintos.push(cnpj);
      if (idxPagador >= 0) {
        const pag = normText(linha[idxPagador]);
        if (pag && cnpj && !pagadorCnpjMap.has(pag)) pagadorCnpjMap.set(pag, cnpj);
      }
    }
  }

  /**
   * Resolve o CNPJ da linha de exclusão a partir do nome do pagador.
   * Aceita nomes truncados/abreviados (comparação por prefixo) e, quando o
   * bruto possui um único CNPJ, usa-o como fallback — sem isso a empresa de
   * PERÍODO não era reconhecida e o proporcional caía na regra mensal.
   */
  const resolverCnpj = (pagVal: string): string => {
    const unico = cnpjsDistintos.length === 1 ? cnpjsDistintos[0] : "";
    const key = normText(pagVal);
    if (!key) return unico;
    const exato = pagadorCnpjMap.get(key);
    if (exato) return exato;
    for (const [k, v] of pagadorCnpjMap) {
      if (k.startsWith(key) || key.startsWith(k)) return v;
    }
    const p = key.slice(0, 12);
    if (p.length >= 6) {
      for (const [k, v] of pagadorCnpjMap) if (k.slice(0, 12) === p) return v;
    }
    return unico;
  };

  // Detecta mensalidade por plano (moda dos valores em linhas de Mensalidade)
  const mensalidadePorPlano = new Map<string, number>();
  if (idxTipo >= 0 && idxPlano >= 0 && idxValor >= 0) {
    const counts = new Map<string, Map<number, number>>();
    for (let r = 1; r < aoaBruto.length; r++) {
      const linha = aoaBruto[r] as unknown[];
      const tipo = normText(linha[idxTipo]);
      if (!tipo.includes("MENSALIDADE")) continue;
      const plano = normalizarPlano(linha[idxPlano]);
      const val = toNumberSafe(linha[idxValor]);
      if (!plano || val == null || val <= 0) continue;
      if (!counts.has(plano)) counts.set(plano, new Map());
      const inner = counts.get(plano)!;
      inner.set(val, (inner.get(val) ?? 0) + 1);
    }
    for (const [plano, valMap] of counts) {
      let bestVal = 0;
      let bestCount = 0;
      for (const [v, c] of valMap) {
        if (c > bestCount || (c === bestCount && v > bestVal)) {
          bestVal = v;
          bestCount = c;
        }
      }
      if (bestVal > 0) mensalidadePorPlano.set(plano, bestVal);
    }
  }

  // Competência da mensalidade (a mais recente presente no bruto)
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

  // Fx etária mais comum
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

  const compExclusaoStr = compExclusao ? fmtDataBR(compExclusao) : "";

  // Índice do cabeçalho "Dt Rescisão" nas exclusões (para calcular proporcional)
  const idxRescExc =
    normExcMap.get("dt rescisao") ??
    normExcMap.get("data rescisao") ??
    normExcMap.get("dt_rescisao");

  const novasLinhas: unknown[][] = [];
  for (let r = 1; r < aoaExc.length; r++) {
    const linhaExc = aoaExc[r] as unknown[];
    if (!linhaExc || linhaExc.every((v) => v === "" || v == null)) continue;

    // Descobre plano e valor proporcional da linha
    const planoRaw = idxPlano >= 0 ? pickFromExcl(headersBruto[idxPlano], linhaExc, normExcMap) : "";
    const planoNorm = normalizarPlano(planoRaw);
    const mensalidade = planoNorm ? mensalidadePorPlano.get(planoNorm) ?? null : null;

    // Resolve CNPJ da linha (para consultar se a empresa é de PERÍODO específico)
    let cnpjLinha = "";
    if (idxCnpj >= 0) {
      const raw = pickFromExcl(headersBruto[idxCnpj], linhaExc, normExcMap);
      cnpjLinha = String(raw ?? "").trim();
    }
    if (!cnpjLinha && idxPagador >= 0) {
      const pagVal = String(pickFromExcl(headersBruto[idxPagador], linhaExc, normExcMap) ?? "");
      const key = normText(pagVal);
      cnpjLinha = (key ? pagadorCnpjMap.get(key) : "") ?? "";
    }
    const diaInicioPeriodo = opts?.periodoPorCnpj?.get(onlyDigits(cnpjLinha));

    let valorProporcional: number | "" = "";
    if (mensalidade != null && idxRescExc != null) {
      const dResc = toDateSafe(linhaExc[idxRescExc]);
      if (dResc) {
        if (diaInicioPeriodo && diaInicioPeriodo >= 1 && diaInicioPeriodo <= 31) {
          const v = calcularProporcionalPeriodo(dResc, mensalidade, diaInicioPeriodo, maxComp);
          if (v != null) valorProporcional = v;
        } else {
          const totalDias = diasDoMes(dResc);
          const diasProp = totalDias - dResc.getUTCDate() + 1;
          if (diasProp > 0) {
            const v = -1 * (mensalidade / totalDias) * diasProp;
            valorProporcional = Math.round(v * 100) / 100;
          }
        }
      }
    }


    const nova: unknown[] = headersBruto.map((h, ci) => {
      if (ci === idxTipo) return "Exclusão";
      if (ci === idxValor) return valorProporcional;
      if (ci === idxComp) return compExclusaoStr;
      if (ci === idxFx) return fxEtariaBruto;
      if (ci === idxPlano) return planoNorm;

      let val = pickFromExcl(h, linhaExc, normExcMap);

      if (ci === idxPagador && typeof val === "string") {
        val = val.replace(/^\s*PJ\s*[-–]\s*/i, "").trim();
      }

      // CNPJ: se veio vazio, buscar via mapa pagador→CNPJ
      if (ci === idxCnpj && (val === "" || val == null)) {
        const pagVal =
          idxPagador >= 0
            ? String(pickFromExcl(headersBruto[idxPagador], linhaExc, normExcMap) ?? "")
            : "";
        const key = normText(pagVal);
        const cnpj = key ? pagadorCnpjMap.get(key) : undefined;
        if (cnpj) val = cnpj;
      }

      // Datas: garante formato DD/MM/YYYY como texto
      const hNorm = normHeader(h);
      if (
        (hNorm === "dt" || hNorm.startsWith("dt ") || hNorm.startsWith("data")) &&
        val !== "" &&
        val != null
      ) {
        const d = toDateSafe(val);
        if (d) val = fmtDataBR(d);
      }

      return val == null ? "" : val;
    });
    novasLinhas.push(nova);
  }

  // Regrava a aba do bruto (para persistir a normalização de Plano)
  const wsAtualizado = XLSX.utils.aoa_to_sheet(aoaBruto);
  wbBruto.Sheets[brutoName] = wsAtualizado;

  XLSX.utils.sheet_add_aoa(wsAtualizado, novasLinhas, { origin: -1 });

  const out = XLSX.write(wbBruto, {
    type: "array",
    bookType: "xlsx",
    cellDates: true,
  }) as ArrayBuffer;
  return out;
}
