import ExcelJS from "exceljs";

export interface AReceberRow {
  empresa_nome: string;
  empresa_cnpj: string | null;
  nf_numero: string | null;
  valor_total: number | null;
  valor_faturado: number | null;
  valor_inclusoes: number | null;
  valor_exclusoes: number | null;
  beneficiarios: number | null;
  dia_vencimento: number | null;
  periodo: string;
}

const PREMIO_HEADERS = [
  "CNPJ",
  "Pagador",
  "Nf",
  "Dt emissao",
  "Dt vencimento",
  "Dt Prorrog",
  "Total vidas",
  "Vidas proporcional",
  "Vidas enfermaria",
  "Vl Enfermaria",
  "Total Enfermaria",
  "Dt recebimento",
  "Mensalidade",
  "Inclusoes",
  "Exclusoes",
  "Comp mensalidade",
  "Faturado",
  "a receber",
  "Recebido",
  "Amaior",
  "Juros",
  "Cobertura mensalidade",
  "Historico mensalidade",
];

/**
 * Gera o Excel PRÊMIO no formato do template enviado pelo cliente.
 * Campos sem dado ficam vazios (não preencher conforme orientação).
 */
export async function exportarPremio(
  rows: AReceberRow[],
  opts: { mes: string; periodo: string | null },
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PRÊMIO");

  ws.columns = PREMIO_HEADERS.map((h) => ({
    header: h,
    width: Math.max(12, Math.min(28, h.length + 6)),
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  rows.forEach((r) => {
    ws.addRow([
      r.empresa_cnpj || "",
      r.empresa_nome || "",
      r.nf_numero || "",
      "", // Dt emissao
      r.dia_vencimento ? String(r.dia_vencimento).padStart(2, "0") : "",
      "", // Dt Prorrog
      r.beneficiarios ?? "",
      "", // Vidas proporcional
      "", // Vidas enfermaria
      "", // Vl Enfermaria
      "", // Total Enfermaria
      "", // Dt recebimento
      "", // Mensalidade
      r.valor_inclusoes ?? "",
      r.valor_exclusoes ?? "",
      "", // Comp mensalidade
      r.valor_faturado ?? "",
      r.valor_total ?? "", // a receber
      "", // Recebido
      "", // Amaior
      "", // Juros
      "", // Cobertura mensalidade
      "", // Historico mensalidade
    ]);
  });

  // Format moeda nas colunas de valor
  const moneyCols = [10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  moneyCols.forEach((c) => {
    const col = ws.getColumn(c);
    col.numFmt = '#,##0.00;[Red]-#,##0.00';
  });

  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const periodoSlug = opts.periodo ? opts.periodo.replace("-", "_") : "geral";
  const filename = `premio_${opts.mes}_${periodoSlug}_${stamp}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
