import ExcelJS from "exceljs";
import type { AnaliseResultado } from "./excel-analysis-utils";

/** Normaliza string: minúsculo, sem acentos, sem espaços nas pontas. */
function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in (v as any)) {
    return toNumber((v as any).result);
  }
  let s = String(v).trim();
  s = s.replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/**
 * Parser exclusivo para contratos "Análise Moto Honda".
 * Lê APENAS a aba `RESUMO` do .xlsx. Mapeamento:
 *   - "M.Empresarial"           → Enfermaria   (qtd | mensalidade | valor)
 *   - "M.Executivo"             → Apartamento  (qtd | mensalidade | valor)
 *   - "Proporcional / Inclusoes"→ Inclusões   (valor)
 *   - "Proporcional / Exclusoes"→ Exclusões   (valor, geralmente negativo)
 */
export async function analisarExcelMotoHonda(
  buffer: ArrayBuffer,
): Promise<Omit<AnaliseResultado, "pagador">> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const empty = { beneficiarios: 0, mensalidade: 0, total: 0 };
  const result: Omit<AnaliseResultado, "pagador"> = {
    enfermaria: { ...empty },
    apartamento: { ...empty },
    inclusoes: { quantidade: 0, total: 0 },
    exclusoes: { quantidade: 0, total: 0 },
    avisos: [],
  };

  const ws = wb.worksheets.find((w) => norm(w.name) === "resumo");
  if (!ws) {
    result.avisos.push(
      "Aba 'RESUMO' não encontrada no Excel — análise Moto Honda exige essa aba.",
    );
    return result;
  }

  let achouEmpresarial = false;
  let achouExecutivo = false;
  let achouInclusoes = false;
  let achouExclusoes = false;

  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1); // ExcelJS é 1-indexed
    const label = norm(vals[0]);
    if (!label) return;

    // M.Empresarial → Enfermaria
    if (
      !achouEmpresarial &&
      (label === "m.empresarial" || label.startsWith("m.empresarial") || label.includes("m.empresarial"))
    ) {
      const qtd = toNumber(vals[1]);
      const mens = toNumber(vals[2]);
      const tot = toNumber(vals[3]);
      result.enfermaria = {
        beneficiarios: isNaN(qtd) ? 0 : Math.round(qtd),
        mensalidade: isNaN(mens) ? 0 : mens,
        total: isNaN(tot) ? 0 : tot,
      };
      achouEmpresarial = true;
      return;
    }

    // M.Executivo → Apartamento
    if (
      !achouExecutivo &&
      (label === "m.executivo" || label.startsWith("m.executivo") || label.includes("m.executivo"))
    ) {
      const qtd = toNumber(vals[1]);
      const mens = toNumber(vals[2]);
      const tot = toNumber(vals[3]);
      result.apartamento = {
        beneficiarios: isNaN(qtd) ? 0 : Math.round(qtd),
        mensalidade: isNaN(mens) ? 0 : mens,
        total: isNaN(tot) ? 0 : tot,
      };
      achouExecutivo = true;
      return;
    }

    // Proporcional / Inclusoes (sem retroativa)
    if (!achouInclusoes && label.includes("inclus") && !label.includes("retroativ")) {
      const tot = toNumber(vals[3]);
      const qtd = toNumber(vals[1]);
      result.inclusoes = {
        quantidade: isNaN(qtd) ? 0 : Math.round(qtd),
        total: isNaN(tot) ? 0 : tot,
      };
      achouInclusoes = true;
      return;
    }

    // Cobrança Retroativa — soma em inclusoes E expõe como linha separada.
    if (label.includes("retroativ")) {
      const tot = toNumber(vals[3]);
      const qtd = toNumber(vals[1]);
      const qtdN = isNaN(qtd) ? 0 : Math.round(qtd);
      const totN = isNaN(tot) ? 0 : tot;
      result.retroativas = {
        quantidade: (result.retroativas?.quantidade ?? 0) + qtdN,
        total: (result.retroativas?.total ?? 0) + totN,
      };
      result.inclusoes = {
        quantidade: result.inclusoes.quantidade + qtdN,
        total: result.inclusoes.total + totN,
      };
      return;
    }



    // Proporcional / Exclusoes
    if (!achouExclusoes && label.includes("exclus")) {
      const tot = toNumber(vals[3]);
      const qtd = toNumber(vals[1]);
      result.exclusoes = {
        quantidade: isNaN(qtd) ? 0 : Math.round(qtd),
        total: isNaN(tot) ? 0 : tot,
      };
      achouExclusoes = true;
      return;
    }
  });

  if (!achouEmpresarial) result.avisos.push("Linha 'M.Empresarial' não encontrada na aba RESUMO.");
  if (!achouExecutivo) result.avisos.push("Linha 'M.Executivo' não encontrada na aba RESUMO.");
  if (!achouInclusoes) result.avisos.push("Linha 'Proporcional / Inclusoes' não encontrada.");
  if (!achouExclusoes) result.avisos.push("Linha 'Proporcional / Exclusoes' não encontrada.");

  return result;
}
