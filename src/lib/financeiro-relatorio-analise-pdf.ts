import {
  labelStatusFinanceiro,
  formatMesReferencia,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";
import { formatDateBR } from "@/lib/date-utils";
import type { DadosRelatorio, LinhaRelatorio } from "@/lib/financeiro-relatorio-analise-data";
import samelIcon from "@/assets/samel-icon.png.asset.json";

const VERDE: [number, number, number] = [50, 169, 118];

const ORDEM_STATUS: StatusFinanceiro[] = [
  "Enviada",
  "Nota emitida",
  "Aguardando validação",
  "Aguardando faturamento",
  "Faturado",
  "Em faturamento",
  "Fora do prazo",
  "Aguardando nota",
  "Pendente",
];

const pct = (n: number, total: number) =>
  total > 0 ? `${((n / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

async function carregarLogo(): Promise<string | null> {
  try {
    const resp = await fetch(samelIcon.url);
    const blob = await resp.blob();
    // Se o conteúdo não for um PNG válido (ex.: erro do CDN), segue sem logo
    // em vez de quebrar a geração do PDF inteiro.
    if (!blob.type.startsWith("image/png")) return null;
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const url = String(fr.result);
        resolve(url.startsWith("data:image/png") ? url : null as unknown as string);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const rotuloDia = (d: number | null) => (d && d > 0 ? `Dia ${String(d).padStart(2, "0")}` : "Sem dia definido");

function agrupar(
  linhas: LinhaRelatorio[],
  key: (l: LinhaRelatorio) => string,
): Array<{ chave: string; qtd: number; emitidas: number; enviadas: number; valor: number }> {
  const map = new Map<string, { chave: string; qtd: number; emitidas: number; enviadas: number; valor: number }>();
  linhas.forEach((l) => {
    const k = key(l);
    const cur = map.get(k) ?? { chave: k, qtd: 0, emitidas: 0, enviadas: 0, valor: 0 };
    cur.qtd += 1;
    if (l.status === "Enviada" || l.status === "Nota emitida") cur.emitidas += 1;
    if (l.status === "Enviada") cur.enviadas += 1;
    cur.valor += l.valor;
    map.set(k, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
}

/**
 * Relatório analítico completo de faturamento (PDF), com filtros de
 * competência, dia de emissão, tipo de movimentação, período e status.
 */
export async function gerarRelatorioAnaliseFaturamento(dados: DadosRelatorio) {
  const { linhas, filtros } = dados;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const hoje = new Date().toLocaleString("pt-BR");
  const logoData = await carregarLogo();
  const total = linhas.length;
  const comValores = filtros.incluirValores;

  const contagem = new Map<StatusFinanceiro, number>();
  const valores = new Map<StatusFinanceiro, number>();
  linhas.forEach((r) => {
    contagem.set(r.status, (contagem.get(r.status) ?? 0) + 1);
    valores.set(r.status, (valores.get(r.status) ?? 0) + r.valor);
  });

  const emitidas = (contagem.get("Enviada") ?? 0) + (contagem.get("Nota emitida") ?? 0);
  const enviadas = contagem.get("Enviada") ?? 0;
  const emAndamento =
    (contagem.get("Em faturamento") ?? 0) +
    (contagem.get("Faturado") ?? 0) +
    (contagem.get("Aguardando validação") ?? 0) +
    (contagem.get("Aguardando faturamento") ?? 0);
  const semAcao =
    (contagem.get("Pendente") ?? 0) +
    (contagem.get("Aguardando nota") ?? 0) +
    (contagem.get("Fora do prazo") ?? 0);
  const valorTotal = linhas.reduce((s, l) => s + l.valor, 0);
  const vidasTotal = linhas.reduce((s, l) => s + (l.vidas || 0), 0);
  const foraPrazo = linhas.filter((l) => l.prazo === "Fora do prazo").length;
  const dentroPrazo = linhas.filter((l) => l.prazo === "Dentro do prazo").length;

  const compsLabel = filtros.competencias.map(formatMesReferencia).join(", ");
  const partesFiltro: string[] = [];
  if (filtros.diasEmissao.length > 0)
    partesFiltro.push(`Emissão: ${filtros.diasEmissao.map((d) => rotuloDia(d)).join(", ")}`);
  if (filtros.tiposMovimentacao.length > 0)
    partesFiltro.push(`Tipo: ${filtros.tiposMovimentacao.join(", ")}`);
  if (filtros.periodos.length > 0) partesFiltro.push(`Período: ${filtros.periodos.join(", ")}`);
  if (filtros.status.length > 0)
    partesFiltro.push(`Status: ${filtros.status.map(labelStatusFinanceiro).join(", ")}`);
  if (filtros.responsaveis.length > 0)
    partesFiltro.push(`Responsável: ${filtros.responsaveis.join(", ")}`);
  const subtitulo = partesFiltro.length > 0 ? partesFiltro.join("  ·  ") : "Sem filtros adicionais (todos os contratos)";

  function drawHeader() {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, pageW, 64, "F");
    const textX = logoData ? 108 : 40;
    if (logoData) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(32, 12, 56, 40, 6, 6, "F");
      doc.addImage(logoData, "PNG", 44, 17, 32, 30, undefined, "FAST");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Análise completa de faturamento", textX, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 244, 236);
    doc.text(`Competência ${compsLabel} · SIGA · Emitido em ${hoje}`, textX, 48);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(String(total), pageW - 40, 32, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("contratos", pageW - 40, 46, { align: "right" });
  }

  const tabelaBase = {
    theme: "plain" as const,
    styles: { fontSize: 8.5, cellPadding: 6, textColor: [17, 24, 39] as [number, number, number] },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold" as const, fontSize: 9 },
    alternateRowStyles: { fillColor: [234, 246, 240] as [number, number, number] },
    margin: { left: 40, right: 40, top: 80, bottom: 40 },
  };

  drawHeader();
  doc.setTextColor(75, 85, 99);
  doc.setFontSize(9);
  const subLines = doc.splitTextToSize(subtitulo, pageW - 80);
  doc.text(subLines, 40, 84);
  let y = 84 + subLines.length * 12 + 6;

  // 1) Resumo executivo
  const resumo: string[][] = [
    ["Contratos analisados", String(total), "100,0%"],
    ["Notas emitidas (emitida + enviada)", String(emitidas), pct(emitidas, total)],
    ["Notas enviadas ao cliente", String(enviadas), pct(enviadas, total)],
    ["Em andamento (faturando/faturado/validação)", String(emAndamento), pct(emAndamento, total)],
    ["Sem ação (pendente/aguardando/fora do prazo)", String(semAcao), pct(semAcao, total)],
    ["Vidas somadas", vidasTotal.toLocaleString("pt-BR"), "—"],
  ];
  if (comValores) {
    resumo.push(["Valor total analisado", brl(valorTotal), "—"]);
    const cons = dados.consolidado;
    if (cons) {
      // Nunca apresentar a soma como integralmente validada: decompõe.
      resumo.push([
        `Valor validado — ${cons.completas} análise(s) completa(s)`,
        brl(cons.valorValidado),
        "—",
      ]);
      resumo.push([
        `Valor com limitação — ${cons.parciais} parcial(is), ${cons.legadas} legada(s)`,
        brl(cons.valorComLimitacao),
        "—",
      ]);
      if (cons.duplicadosIgnorados > 0)
        resumo.push([
          "Registros duplicados ignorados (mesmo arquivo)",
          String(cons.duplicadosIgnorados),
          "—",
        ]);
    }
  }

  autoTable(doc, {
    ...tabelaBase,
    startY: y,
    head: [["Indicador", "Qtde", "% do total"]],
    body: resumo,
    columnStyles: {
      0: { cellWidth: 280, fontStyle: "bold" },
      1: { cellWidth: 90, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
    },
    tableWidth: 450,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // 2) Distribuição por status
  autoTable(doc, {
    ...tabelaBase,
    startY: y,
    head: [comValores ? ["Status", "Contratos", "% do total", "Valor analisado"] : ["Status", "Contratos", "% do total"]],
    body: ORDEM_STATUS.map((s) => {
      const qtd = contagem.get(s) ?? 0;
      const base = [labelStatusFinanceiro(s), String(qtd), pct(qtd, total)];
      return comValores ? [...base, brl(valores.get(s) ?? 0)] : base;
    }),
    foot: [
      comValores
        ? ["Total", String(total), "100,0%", brl(valorTotal)]
        : ["Total", String(total), "100,0%"],
    ],
    footStyles: { fillColor: [226, 240, 234], textColor: [17, 24, 39], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 180, fontStyle: "bold" },
      1: { cellWidth: 80, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
      3: { cellWidth: 120, halign: "right" },
    },
    tableWidth: comValores ? 460 : 340,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // 3) Prazo
  autoTable(doc, {
    ...tabelaBase,
    startY: y,
    head: [["Prazo (regra 24h/48h)", "Contratos", "% do total"]],
    body: [
      ["Dentro do prazo", String(dentroPrazo), pct(dentroPrazo, total)],
      ["Fora do prazo", String(foraPrazo), pct(foraPrazo, total)],
      [
        "Em andamento / sem base",
        String(total - dentroPrazo - foraPrazo),
        pct(total - dentroPrazo - foraPrazo, total),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 180, fontStyle: "bold" },
      1: { cellWidth: 80, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
    },
    tableWidth: 340,
  });

  // 4) Quebras analíticas
  const quebras: Array<{ titulo: string; rotulo: string; dados: ReturnType<typeof agrupar> }> = [];
  if (filtros.competencias.length > 1)
    quebras.push({
      titulo: "Por competência",
      rotulo: "Competência",
      dados: agrupar(linhas, (l) => formatMesReferencia(l.competencia)),
    });
  quebras.push({ titulo: "Por dia de emissão", rotulo: "Dia", dados: agrupar(linhas, (l) => rotuloDia(l.dia_emissao)) });
  quebras.push({
    titulo: "Por tipo de movimentação",
    rotulo: "Tipo",
    dados: agrupar(linhas, (l) => l.tipo_movimentacao || "—"),
  });
  quebras.push({ titulo: "Por período de corte", rotulo: "Período", dados: agrupar(linhas, (l) => l.periodo || "—") });
  quebras.push({
    titulo: "Por responsável do faturamento",
    rotulo: "Responsável",
    dados: agrupar(linhas, (l) => l.faturamento_iniciado_por_nome || l.responsavel || "Não iniciado"),
  });

  quebras.forEach((q) => {
    doc.addPage("a4", "landscape");
    drawHeader();
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(q.titulo, 40, 86);
    autoTable(doc, {
      ...tabelaBase,
      startY: 96,
      head: [
        comValores
          ? [q.rotulo, "Contratos", "Emitidas", "% emitidas", "Enviadas", "Valor analisado"]
          : [q.rotulo, "Contratos", "Emitidas", "% emitidas", "Enviadas"],
      ],
      body: q.dados.map((d) => {
        const base = [d.chave, String(d.qtd), String(d.emitidas), pct(d.emitidas, d.qtd), String(d.enviadas)];
        return comValores ? [...base, brl(d.valor)] : base;
      }),
      columnStyles: {
        0: { cellWidth: 240, fontStyle: "bold" },
        1: { cellWidth: 80, halign: "center" },
        2: { cellWidth: 80, halign: "center" },
        3: { cellWidth: 80, halign: "center" },
        4: { cellWidth: 80, halign: "center" },
        5: { cellWidth: 120, halign: "right" },
      },
      tableWidth: comValores ? 680 : 560,
    });
  });

  // 5) O que falta emitir
  const faltantes = linhas.filter((r) => r.status !== "Enviada" && r.status !== "Nota emitida");
  if (filtros.incluirFaltantes && faltantes.length > 0) {
    const emCurso = faltantes.filter((r) => !!r.faturamento_iniciado_em);
    const naoIniciados = faltantes.filter((r) => !r.faturamento_iniciado_em);

    [
      { titulo: "Falta emitir — já em faturamento", rows: emCurso },
      { titulo: "Falta emitir — não iniciado", rows: naoIniciados },
    ].forEach((bloco) => {
      if (bloco.rows.length === 0) return;
      doc.addPage("a4", "landscape");
      drawHeader();
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${bloco.titulo} — ${bloco.rows.length} contrato(s)`, 40, 86);
      autoTable(doc, {
        ...tabelaBase,
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 4, textColor: [17, 24, 39] },
        headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 8 },
        startY: 96,
        head: [
          [
            "Empresa",
            "Contrato",
            "Comp.",
            "Emissão",
            "Período",
            "Status",
            "Responsável",
            "Liberado cadastro",
            "Iniciado em",
            "Vencimento",
          ],
        ],
        body: bloco.rows.map((r) => [
          r.empresa_nome,
          r.empresa_codigo || "—",
          formatMesReferencia(r.competencia),
          rotuloDia(r.dia_emissao),
          r.periodo || "—",
          labelStatusFinanceiro(r.status),
          r.faturamento_iniciado_por_nome || r.responsavel || "—",
          formatDateBR(r.aguardando_nota_em) || "—",
          formatDateBR(r.faturamento_iniciado_em) || "—",
          formatDateBR(r.data_vencimento) || "—",
        ]),
        columnStyles: {
          0: { cellWidth: 190 },
          1: { cellWidth: 52 },
          2: { cellWidth: 52 },
          3: { cellWidth: 60 },
          4: { cellWidth: 60 },
          5: { cellWidth: 85 },
          6: { cellWidth: 110 },
          7: { cellWidth: 68, halign: "center" },
          8: { cellWidth: 68, halign: "center" },
          9: { cellWidth: 68, halign: "center" },
        },
      });
    });
  }

  // 6) Detalhamento
  if (filtros.incluirDetalhamento && total > 0) {
    doc.addPage("a4", "landscape");
    drawHeader();
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Detalhamento — ${total} contrato(s)`, 40, 86);

    const head = [
      "#",
      "Empresa",
      "Contrato",
      "Comp.",
      "Emissão",
      "Tipo",
      "Período",
      "Status",
      "Liberado",
      "Iniciado",
      "Envio nota",
      "Venc.",
      "Anx",
      "Prazo",
    ];
    if (comValores) head.splice(12, 0, "Valor");

    autoTable(doc, {
      ...tabelaBase,
      theme: "striped",
      styles: { fontSize: 6.8, cellPadding: 3, textColor: [17, 24, 39] },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", fontSize: 7 },
      startY: 96,
      head: [head],
      body: linhas.map((r, i) => {
        const base = [
          String(i + 1),
          r.empresa_nome,
          r.empresa_codigo || "—",
          formatMesReferencia(r.competencia),
          rotuloDia(r.dia_emissao),
          r.tipo_movimentacao || "—",
          r.periodo || "—",
          labelStatusFinanceiro(r.status),
          formatDateBR(r.aguardando_nota_em) || "—",
          formatDateBR(r.faturamento_iniciado_em) || "—",
          formatDateBR(r.data_envio_nota) || "—",
          formatDateBR(r.data_vencimento) || "—",
          String(r.anexos_count ?? 0),
          r.prazo,
        ];
        if (comValores) {
          // Selo de completude: legada/parcial marcadas com * (ver nota ao
          // fim do relatório); completo e sem análise sem marca.
          const selo =
            r.valor_situacao === "parcial" || r.valor_situacao === "legado" ? " *" : "";
          base.splice(12, 0, r.valor ? brl(r.valor) + selo : "—");
        }
        return base;
      }),
      columnStyles: comValores
        ? {
            0: { cellWidth: 22, halign: "center" },
            1: { cellWidth: 150 },
            2: { cellWidth: 44 },
            3: { cellWidth: 42 },
            4: { cellWidth: 52 },
            5: { cellWidth: 46 },
            6: { cellWidth: 46 },
            7: { cellWidth: 72 },
            8: { cellWidth: 50, halign: "center" },
            9: { cellWidth: 50, halign: "center" },
            10: { cellWidth: 50, halign: "center" },
            11: { cellWidth: 50, halign: "center" },
            12: { cellWidth: 74, halign: "right" },
            13: { cellWidth: 26, halign: "center" },
            14: { cellWidth: 62 },
          }
        : {
            0: { cellWidth: 24, halign: "center" },
            1: { cellWidth: 180 },
            2: { cellWidth: 50 },
            3: { cellWidth: 46 },
            4: { cellWidth: 58 },
            5: { cellWidth: 52 },
            6: { cellWidth: 52 },
            7: { cellWidth: 80 },
            8: { cellWidth: 56, halign: "center" },
            9: { cellWidth: 56, halign: "center" },
            10: { cellWidth: 56, halign: "center" },
            11: { cellWidth: 56, halign: "center" },
            12: { cellWidth: 30, halign: "center" },
            13: { cellWidth: 68 },
          },
    });
  }

  // Nota de completude dos valores (itens 1 e 3 do pacote financeiro)
  if (comValores && dados.consolidado) {
    const pageCount = doc.getNumberOfPages();
    doc.setPage(pageCount);
    doc.setFontSize(7.5);
    doc.setTextColor(90, 100, 110);
    doc.text(
      "* Valor com limitação: análise parcial (categoria com lançamentos sem valor) ou " +
        "análise legada — completude não verificada. O valor validado cobre apenas as " +
        "análises completas; a soma dos dois não é um total integralmente validado.",
      40,
      pageH - 34,
      { maxWidth: pageW - 80 },
    );
  }

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 140);
    doc.text(`Página ${p} de ${pages}`, pageW - 40, pageH - 20, { align: "right" });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`analise_faturamento_${filtros.competencias.join("_")}_${stamp}.pdf`);
}
