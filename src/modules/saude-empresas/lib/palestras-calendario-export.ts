import { format, eachDayOfInterval, endOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { feriadoEm } from "./feriados";
import { CAMPANHAS } from "./palestras-calendario";

export interface CalEvento {
  data: string; // YYYY-MM-DD
  empresa: string;
  executiva: string | null;
  tema: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string;
}

export interface CalBloqueio {
  data: string;
  periodo: string;
  motivo: string;
}

const STATUS_HEX: Record<string, string> = {
  a_confirmar: "#f59e0b",
  confirmado: "#0ea5e9",
  concluido: "#10b981",
  cancelado: "#f43f5e",
};
const STATUS_LABEL: Record<string, string> = {
  a_confirmar: "A confirmar",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = test;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

import headerAsset from "@/assets/saude-header-banner.png.asset.json";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Desenha o calendário do mês em um canvas e devolve o elemento. */
export async function renderCalendarioCanvas(
  cursor: Date,
  eventos: CalEvento[],
  bloqueios: CalBloqueio[],
): Promise<HTMLCanvasElement> {
  const headerImg = await loadImage(headerAsset.url);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const dias = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(
    (d) => d.getDay() >= 1 && d.getDay() <= 5,
  );

  const porDia = new Map<string, CalEvento[]>();
  eventos.forEach((e) => {
    const arr = porDia.get(e.data) ?? [];
    arr.push(e);
    porDia.set(e.data, arr);
  });
  porDia.forEach((arr) =>
    arr.sort((a, b) => (a.horario_inicio ?? "").localeCompare(b.horario_inicio ?? "")),
  );
  const bloqMap = new Map(bloqueios.map((b) => [b.data, b]));

  const padStart = dias.length ? (dias[0].getDay() || 7) - 1 : 0;
  const totalCells = padStart + dias.length;
  const rows = Math.ceil(totalCells / 5);

  const scale = 2;
  const W = 1600;
  const marginX = 40;
  const headerH = 250;
  const weekH = 44;
  const cellW = (W - marginX * 2) / 5;
  const cellH = 210;
  const legendH = 70;
  const H = headerH + weekH + rows * cellH + legendH + 40;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // fundo
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // faixa institucional com as logos Samel / Saúde nas Empresas
  const bannerH = 130;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, bannerH);
  if (headerImg) {
    const r = headerImg.width / headerImg.height;
    const drawH = Math.min(bannerH, W / r);
    const drawW = drawH * r;
    ctx.drawImage(headerImg, (W - drawW) / 2, (bannerH - drawH) / 2, drawW, drawH);
  }

  ctx.fillStyle = "#0f6d3c";
  ctx.fillRect(0, bannerH, W, 6);

  // título
  const baseY = bannerH + 6;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px Helvetica, Arial, sans-serif";
  ctx.fillText("Calendário de Palestras", marginX, baseY + 46);
  ctx.fillStyle = "#475569";
  ctx.font = "20px Helvetica, Arial, sans-serif";
  const titulo = format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  ctx.fillText(titulo.charAt(0).toUpperCase() + titulo.slice(1), marginX, baseY + 78);

  const camp = CAMPANHAS[cursor.getMonth()];
  if (camp) {
    ctx.fillStyle = camp.hex;
    ctx.font = "bold 18px Helvetica, Arial, sans-serif";
    const txt = `Campanha do mês: ${camp.tema}`;
    ctx.fillText(txt, W - marginX - ctx.measureText(txt).width, baseY + 46);
  }
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px Helvetica, Arial, sans-serif";
  const total = `${eventos.length} agendamento(s)`;
  ctx.fillText(total, W - marginX - ctx.measureText(total).width, baseY + 76);


  // cabeçalho dos dias
  const top = headerH;
  const nomes = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(marginX, top, cellW * 5, weekH);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  nomes.forEach((n, i) => {
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 13px Helvetica, Arial, sans-serif";
    const x = marginX + i * cellW;
    ctx.fillText(n, x + cellW / 2 - ctx.measureText(n).width / 2, top + 28);
    ctx.strokeRect(x, top, cellW, weekH);
  });

  // células
  for (let idx = 0; idx < rows * 5; idx++) {
    const r = Math.floor(idx / 5);
    const c = idx % 5;
    const x = marginX + c * cellW;
    const y = top + weekH + r * cellH;
    const dayIdx = idx - padStart;
    const d = dayIdx >= 0 && dayIdx < dias.length ? dias[dayIdx] : null;

    ctx.fillStyle = d ? "#ffffff" : "#f8fafc";
    ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(x, y, cellW, cellH);
    if (!d) continue;

    const key = isoDate(d);
    const fer = feriadoEm(d);
    const bl = bloqMap.get(key);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 18px Helvetica, Arial, sans-serif";
    ctx.fillText(String(d.getDate()), x + 12, y + 26);

    let cy = y + 40;

    const chip = (label: string, color: string, bg: string) => {
      ctx.fillStyle = bg;
      ctx.fillRect(x + 10, cy, cellW - 20, 22);
      ctx.fillStyle = color;
      ctx.font = "bold 11px Helvetica, Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x + 16, cy + 15);
      cy += 28;
    };
    if (fer) chip(fer.nome, "#b91c1c", "#fee2e2");
    if (bl)
      chip(
        bl.periodo === "dia_todo" ? `Bloqueado: ${bl.motivo}` : `${bl.periodo === "manha" ? "Manhã" : "Tarde"} bloqueada`,
        "#c2410c",
        "#ffedd5",
      );

    const evs = porDia.get(key) ?? [];
    for (const ev of evs) {
      if (cy > y + cellH - 34) {
        ctx.fillStyle = "#64748b";
        ctx.font = "11px Helvetica, Arial, sans-serif";
        ctx.fillText(`+ mais agendamentos`, x + 12, cy + 12);
        break;
      }
      const cor = STATUS_HEX[ev.status] ?? "#64748b";
      const boxH = 58;
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(x + 10, cy, cellW - 20, boxH);
      ctx.fillStyle = cor;
      ctx.fillRect(x + 10, cy, 4, boxH);

      ctx.fillStyle = cor;
      ctx.font = "bold 11px Helvetica, Arial, sans-serif";
      const hora = [ev.horario_inicio?.slice(0, 5), ev.horario_fim?.slice(0, 5)].filter(Boolean).join(" - ");
      if (hora) ctx.fillText(hora, x + 20, cy + 15);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px Helvetica, Arial, sans-serif";
      const emp = wrapText(ctx, ev.empresa, cellW - 34, 1)[0] ?? "";
      ctx.fillText(emp, x + 20, cy + (hora ? 31 : 20));

      ctx.fillStyle = "#475569";
      ctx.font = "11px Helvetica, Arial, sans-serif";
      if (ev.executiva) ctx.fillText(wrapText(ctx, ev.executiva, cellW - 34, 1)[0], x + 20, cy + 44);
      if (ev.tema) {
        ctx.fillStyle = "#64748b";
        ctx.font = "italic 10px Helvetica, Arial, sans-serif";
        ctx.fillText(wrapText(ctx, ev.tema, cellW - 34, 1)[0], x + 20, cy + 55);
      }
      cy += boxH + 6;
    }
  }

  // legenda
  const ly = top + weekH + rows * cellH + 34;
  let lx = marginX;
  Object.entries(STATUS_LABEL).forEach(([k, label]) => {
    ctx.fillStyle = STATUS_HEX[k];
    ctx.fillRect(lx, ly - 10, 12, 12);
    ctx.fillStyle = "#475569";
    ctx.font = "13px Helvetica, Arial, sans-serif";
    ctx.fillText(label, lx + 18, ly);
    lx += 30 + ctx.measureText(label).width;
  });
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px Helvetica, Arial, sans-serif";
  const gerado = `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  ctx.fillText(gerado, W - marginX - ctx.measureText(gerado).width, ly);

  return canvas;
}

export async function exportCalendarioPNG(
  cursor: Date,
  eventos: CalEvento[],
  bloqueios: CalBloqueio[],
  opts: CalOpts = {},
) {
  const canvas = await renderCalendarioCanvas(cursor, eventos, bloqueios, opts);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${opts.arquivo ?? "calendario-palestras"}-${format(cursor, "yyyy-MM")}.png`;
  a.click();
}

export async function exportCalendarioPDF(
  cursor: Date,
  eventos: CalEvento[],
  bloqueios: CalBloqueio[],
  opts: CalOpts = {},
) {
  const canvas = await renderCalendarioCanvas(cursor, eventos, bloqueios, opts);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pw / canvas.width, ph / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
  pdf.save(`${opts.arquivo ?? "calendario-palestras"}-${format(cursor, "yyyy-MM")}.pdf`);
}

