// Layout padrão das planilhas do módulo "Saúde nas Empresas"
// Cabeçalho de marca SAMEL (título verde, tagline, barra separadora) + header de colunas.
import { LOGO_SAMEL_MARCA, LOGO_SAMEL_SELO } from "./saude-excel-logos";


export const SAMEL_XLS = {
  GREEN: "FF006B45",
  GREEN_SOFT: "FF38735C",
  BAR: "FFA9CBB8",
  WHITE: "FFFFFFFF",
  FONT: "Carlito",
  TITULO: "SAMEL  |  SAÚDE NAS EMPRESAS",
  TAGLINE: "TECNOLOGIA QUE SALVA. HUMANIZAÇÃO QUE ACOLHE.",
};

export type ColunaPadrao = {
  header: string;
  key: string;
  width: number;
  align?: "left" | "center" | "right";
};

/**
 * Aplica o cabeçalho institucional e o header de colunas.
 * Retorna o número da primeira linha de dados.
 */
export function aplicarLayoutSamel(
  ws: any,
  cols: ColunaPadrao[],
  subtitulo?: string,
): number {
  const last = cols.length;
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  ws.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];

  const fillWhite = (row: any) => {
    for (let i = 1; i <= last; i++) {
      row.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SAMEL_XLS.WHITE },
      };
    }
  };

  // Linha 1 — título
  const r1 = ws.getRow(1);
  r1.height = 33.6;
  fillWhite(r1);
  ws.mergeCells(1, 1, 1, last);
  r1.getCell(1).value = SAMEL_XLS.TITULO;
  r1.getCell(1).font = { name: SAMEL_XLS.FONT, size: 20, bold: true, color: { argb: SAMEL_XLS.GREEN } };
  r1.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  // Linha 2 — tagline
  const r2 = ws.getRow(2);
  r2.height = 27.6;
  fillWhite(r2);
  ws.mergeCells(2, 1, 2, last);
  r2.getCell(1).value = SAMEL_XLS.TAGLINE;
  r2.getCell(1).font = { name: SAMEL_XLS.FONT, size: 10, color: { argb: SAMEL_XLS.GREEN_SOFT } };
  r2.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  // Linha 3 — barra separadora
  const r3 = ws.getRow(3);
  r3.height = 4.05;
  ws.mergeCells(3, 1, 3, last);
  for (let i = 1; i <= last; i++) {
    r3.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAMEL_XLS.BAR } };
  }

  // Linha 4 — contexto (empresa / data)
  const r4 = ws.getRow(4);
  r4.height = 22.35;
  fillWhite(r4);
  ws.mergeCells(4, 1, 4, last);
  if (subtitulo) {
    r4.getCell(1).value = subtitulo;
    r4.getCell(1).font = { name: SAMEL_XLS.FONT, size: 11, bold: true, color: { argb: SAMEL_XLS.GREEN_SOFT } };
    r4.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  }

  // Linha 5 — cabeçalho das colunas
  const head = ws.getRow(5);
  head.height = 22.35;
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: SAMEL_XLS.FONT, size: 11, bold: true, color: { argb: SAMEL_XLS.WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAMEL_XLS.GREEN } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: SAMEL_XLS.GREEN } },
      bottom: { style: "thin", color: { argb: SAMEL_XLS.GREEN } },
      left: { style: "thin", color: { argb: SAMEL_XLS.WHITE } },
      right: { style: "thin", color: { argb: SAMEL_XLS.WHITE } },
    };
  });

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: last } };
  return 6;
}

/** Estiliza uma linha de dados no padrão (zebra + bordas suaves). */
export function estilizarLinhaSamel(row: any, cols: ColunaPadrao[], index: number) {
  row.height = 18;
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.font = { name: SAMEL_XLS.FONT, size: 11 };
    cell.alignment = { horizontal: c.align ?? "left", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index % 2 === 0 ? SAMEL_XLS.WHITE : "FFF2F7F4" },
    };
    cell.border = {
      top: { style: "hair", color: { argb: "FFD9E5DE" } },
      bottom: { style: "hair", color: { argb: "FFD9E5DE" } },
      left: { style: "hair", color: { argb: "FFD9E5DE" } },
      right: { style: "hair", color: { argb: "FFD9E5DE" } },
    };
  });
}
