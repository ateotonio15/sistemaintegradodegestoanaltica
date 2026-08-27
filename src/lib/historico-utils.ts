import type { AnaliseResultado } from "./excel-analysis-utils";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_MAP: Record<string, number> = {
  JANEIRO: 0, FEVEREIRO: 1, MARCO: 2, MARÇO: 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
  JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11,
};

const fmtNum = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata número estilo brasileiro sem símbolo de moeda. */
export function fmtBR(n: number): string {
  if (!isFinite(n)) return "0,00";
  return fmtNum.format(n);
}

/** Detecta mês/ano priorizando o nome do arquivo de faturamento. */
export function detectarCompetencia(
  mesReferencia?: string | null,
  nomeArquivo?: string | null,
): { label: string; mes: number; ano: number } | null {
  // 1) Nome do arquivo de faturamento (prioridade — é o mês da cobrança/vencimento)
  if (nomeArquivo) {
    const upper = nomeArquivo
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    // Ano de 4 dígitos precisa vir ANTES do de 2 dígitos na alternância,
    // caso contrário "2025" seria lido como "20" → 2020.
    const re = new RegExp(`(${Object.keys(MESES_MAP).join("|")})\\s*[/_-]?\\s*(\\d{4}|\\d{2})(?!\\d)`);
    const r = re.exec(upper);
    if (r) {
      const mes = MESES_MAP[r[1]];
      const anoRaw = parseInt(r[2], 10);
      const ano = r[2].length === 2 ? 2000 + anoRaw : anoRaw;
      return { label: `${MESES_PT[mes]}/${ano}`, mes, ano };
    }
  }
  // 2) Fallback: mes_referencia (YYYY-MM)
  if (mesReferencia) {
    const m = /^(\d{4})-(\d{2})$/.exec(mesReferencia);
    if (m) {
      const ano = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10) - 1;
      if (mes >= 0 && mes < 12) {
        return { label: `${MESES_PT[mes]}/${ano}`, mes, ano };
      }
    }
  }
  return null;
}

export interface HistoricoOpts {
  competenciaLabel: string;
  /** Data já formatada DD/MM/AAAA */
  dataVencimento: string;
  incluirDda: boolean;
  /** Quando true, substitui o bloco DDA pelos dados bancários de depósito. */
  pagamentoViaDeposito?: boolean;
  /** Número fixo de PO da empresa (ex.: PST = 4600004172). Quando preenchido, adiciona linha "PO:XXX" após o vencimento. */
  poFixo?: string | null;
  /** Rótulo da linha do número fixo (padrão "PO"). Ex.: CONVER usa "PC". */
  poRotulo?: string | null;
  /**
   * Quando a empresa possuir período específico de cobrança (intervalo de 30 dias),
   * substitui a primeira linha do histórico por "Período de: 13/05/2026 à 12/06/2026".
   */
  periodoCobrancaLabel?: string | null;
  /** Tipo de análise da movimentação. Quando "faixa_etaria", gera histórico detalhado por faixas. */
  tipoAnalise?: string | null;
  /** Rótulo do período de coparticipação (geralmente mês anterior à mensalidade). Ex.: "Junho/2026". */
  coparticipacaoPeriodoLabel?: string | null;
}

/** Retorna o rótulo "Mes/AAAA" do mês anterior a um label "Mes/AAAA". */
export function mesAnteriorLabel(label: string): string | null {
  const m = /^([A-Za-zÇç]+)\/(\d{4})$/.exec(label.trim());
  if (!m) return null;
  const key = m[1].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mes = MESES_MAP[key];
  const ano = parseInt(m[2], 10);
  if (mes === undefined || !Number.isFinite(ano)) return null;
  const novoMes = mes === 0 ? 11 : mes - 1;
  const novoAno = mes === 0 ? ano - 1 : ano;
  return `${MESES_PT[novoMes]}/${novoAno}`;
}


/** Gera o texto do histórico no padrão fixo da empresa. */
export function gerarHistoricoTexto(
  resultados: AnaliseResultado[],
  opts: HistoricoOpts,
): string {
  const linhas: string[] = [];
  const cabecalho = opts.periodoCobrancaLabel && opts.periodoCobrancaLabel.trim()
    ? opts.periodoCobrancaLabel.trim()
    : opts.competenciaLabel;

  // Agrega categorias somando todos os pagadores
  let benefEnf = 0, totalEnf = 0, mensEnf = 0;
  let benefApt = 0, totalApt = 0, mensApt = 0;
  let totalInc = 0;
  let totalExc = 0;
  let totalDev = 0;
  let totalPermuta = 0;
  let totalAdesao = 0;
  let totalRetro = 0;

  resultados.forEach((r) => {
    if (r.enfermaria.beneficiarios > 0 || r.enfermaria.total > 0) {
      benefEnf += r.enfermaria.beneficiarios;
      totalEnf += r.enfermaria.total;
      if (r.enfermaria.mensalidade) mensEnf = r.enfermaria.mensalidade;
    }
    if (r.apartamento.beneficiarios > 0 || r.apartamento.total > 0) {
      benefApt += r.apartamento.beneficiarios;
      totalApt += r.apartamento.total;
      if (r.apartamento.mensalidade) mensApt = r.apartamento.mensalidade;
    }
    if (r.inclusoes?.total) totalInc += r.inclusoes.total;
    if (r.exclusoes?.total) totalExc += r.exclusoes.total;
    if ((r as any).devolucoes?.total) totalDev += (r as any).devolucoes.total;
    if ((r as any).permuta?.total) totalPermuta += (r as any).permuta.total;
    if (r.taxaAdesao?.total) totalAdesao += r.taxaAdesao.total;
    if ((r as any).retroativas?.total) totalRetro += (r as any).retroativas.total;
  });

  // Inclusão agregada já contém as retroativas — separar para exibir cada uma
  const totalIncSemRetro = totalInc - totalRetro;


  const ehFaixaEtaria = (opts.tipoAnalise || "").toLowerCase() === "faixa_etaria";

  if (ehFaixaEtaria) {
    const resumoProdutos: string[] = [];
    if (benefEnf > 0 || totalEnf > 0) {
      resumoProdutos.push(`Enfermaria (${benefEnf} beneficiários): R$ ${fmtBR(totalEnf)}`);
    }
    if (benefApt > 0 || totalApt > 0) {
      resumoProdutos.push(`Apartamento (${benefApt} beneficiários): R$ ${fmtBR(totalApt)}`);
    }

    linhas.push(`Período de ${cabecalho}${resumoProdutos.length ? ` ${resumoProdutos.join(" / ")}` : ""}.`);


    if (totalIncSemRetro > 0) {
      linhas.push("");
      linhas.push(`Inclusão= ${fmtBR(totalIncSemRetro)}`);
    }
    if (totalAdesao > 0) {
      linhas.push(`Taxa de Adesão= ${fmtBR(totalAdesao)}`);
    }
    if (totalExc !== 0) {
      const v = Math.abs(totalExc);
      linhas.push(`Exclusão: (${fmtBR(v)}).`);
    }
    if (totalDev !== 0) {
      linhas.push(`Devolução: (${fmtBR(Math.abs(totalDev))}).`);
    }
    if (totalPermuta !== 0) {
      linhas.push(`Permuta: (${fmtBR(Math.abs(totalPermuta))}).`);
    }
    if (totalRetro > 0) {
      linhas.push(`C.Retroativa: ${fmtBR(totalRetro)}`);
    }
  } else {
    linhas.push(`Período de: ${cabecalho}.`);
    linhas.push("");

    if (benefEnf > 0 || totalEnf > 0) {
      linhas.push(`Enfermaria: ${benefEnf}x${fmtBR(mensEnf)}= ${fmtBR(totalEnf)} /`);
    }
    if (benefApt > 0 || totalApt > 0) {
      linhas.push(`Apartamento: ${benefApt}x${fmtBR(mensApt)}= ${fmtBR(totalApt)} /`);
    }
    if (totalIncSemRetro > 0) {
      linhas.push(`Inclusão= ${fmtBR(totalIncSemRetro)} /`);
    }
    if (totalAdesao > 0) {
      linhas.push(`Taxa de Adesão= ${fmtBR(totalAdesao)} /`);
    }
    if (totalExc !== 0) {
      const v = Math.abs(totalExc);
      linhas.push(`Exclusão: (${fmtBR(v)})`);
    }
    if (totalDev !== 0) {
      linhas.push(`Devolução: (${fmtBR(Math.abs(totalDev))})`);
    }
    if (totalPermuta !== 0) {
      linhas.push(`Permuta: (${fmtBR(Math.abs(totalPermuta))})`);
    }
    if (totalRetro > 0) {
      linhas.push(`C.Retroativa: ${fmtBR(totalRetro)}`);
    }
  }


  linhas.push("");
  linhas.push(`Data de Vencimento: ${opts.dataVencimento}.`);
  if (opts.poFixo && opts.poFixo.trim()) {
    linhas.push("");
    linhas.push(`${(opts.poRotulo || "PO").trim()}:${opts.poFixo.trim()}`);
  }
  linhas.push("");

  if (opts.pagamentoViaDeposito) {


    linhas.push(
      "OBS.: Dados bancários para depósito: Banco Itaú, Agência: 0071, Conta Corrente: 11663-6.",
    );
    linhas.push("");
    linhas.push(
      "Dedução de base de cálculo conforme PARECER Nº02/2018 CJUR/PGM(Processo nº2018/2287/2908/00191 PGM).",
    );
    linhas.push(
      "Decisão judicial conforme Processo n° 0655998-44.2022.8.04.0001 TJAM",
    );
  } else {
    linhas.push("OBS.: O boleto está disponível no sistema de DDA.");
    linhas.push("");
    linhas.push(
      "Dedução de base de cálculo conforme PARECER Nº02/2018 CJUR/PGM(Processo nº2018/2287/2908/00191 PGM).",
    );
    linhas.push(
      "Suspensão de PIS e COFINS, trânsito em julgado conforme Processo n° 0655998-44.2022.8.04.0001 TJAM",
    );
  }

  return linhas.join("\n");
}

/** Gera histórico dedicado para valores de coparticipação. */
export function gerarHistoricoCoparticipacaoTexto(
  resultados: AnaliseResultado[],
  opts: HistoricoOpts,
): string {
  const totalCopartic = resultados.reduce(
    (acc, r) => acc + (r.coparticipacao?.total ?? 0),
    0,
  );
  if (totalCopartic <= 0) return "";

  const periodoCop =
    (opts.coparticipacaoPeriodoLabel && opts.coparticipacaoPeriodoLabel.trim()) ||
    mesAnteriorLabel(opts.competenciaLabel) ||
    opts.competenciaLabel;

  const linhas: string[] = [];
  linhas.push(`Período de: ${periodoCop}.`);
  linhas.push(`Coparticipação: ${fmtBR(totalCopartic)}`);
  linhas.push("");
  linhas.push(`Data de Vencimento: ${opts.dataVencimento}.`);
  linhas.push("");

  if (opts.pagamentoViaDeposito) {
    linhas.push(
      "OBS.: Dados bancários para depósito: Banco Itaú, Agência: 0071, Conta Corrente: 11663-6.",
    );
    linhas.push("");
    linhas.push(
      "Dedução de base de cálculo conforme PARECER Nº02/2018 CJUR/PGM(Processo nº2018/2287/2908/00191 PGM).",
    );
    linhas.push(
      "Decisão judicial conforme Processo n° 0655998-44.2022.8.04.0001 TJAM",
    );
  } else {
    linhas.push("OBS.: O boleto está disponível no sistema de DDA.");
    linhas.push("");
    linhas.push(
      "Dedução de base de cálculo conforme PARECER Nº02/2018 CJUR/PGM(Processo nº2018/2287/2908/00191 PGM).",
    );
    linhas.push(
      "Suspensão de PIS e COFINS, trânsito em julgado conforme Processo n° 0655998-44.2022.8.04.0001 TJAM",
    );
  }

  return linhas.join("\n");
}

/** Constrói data de vencimento DD/MM/AAAA a partir de dia + competência. */
export function calcularVencimentoPadrao(
  diaVencimento: number | null | undefined,
  mes0: number,
  ano: number,
): string {
  const dia = Math.max(1, Math.min(31, diaVencimento ?? 1));
  // Ajusta se o mês não tiver esse dia
  const ultimoDia = new Date(ano, mes0 + 1, 0).getDate();
  const d = Math.min(dia, ultimoDia);
  return `${String(d).padStart(2, "0")}/${String(mes0 + 1).padStart(2, "0")}/${ano}`;
}

/** Formata uma data ISO YYYY-MM-DD em DD/MM/AAAA sem deslocamento de timezone. */
export function isoToBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
