import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RelatorioPendentesPrintData {
  itens: Array<{
    cd_pessoa_fisica: string;
    cd_procedimento: number;
    ds_procedimento: string;
    nm_paciente: string;
    nm_social?: string;
    dt_agenda: string;
    dt_agendamento: string;
    ie_autorizacao: string;
    ie_status_agenda: string;
    nr_atendimento: number | null;
    dias_para_execucao: number;
    empresa: string;
    cd_cgc_estipulante: string;
  }>;
  filtros: {
    dt_inicio: string;
    dt_final: string;
    empresa?: string;
    cd_cgc?: string;
    cd_procedimento?: string;
    status_label?: string;
    paciente?: string;
  };
  kpis: {
    total: number;
    media_dias: string;
    proximo_vencer: string | number;
    em_risco: number;
  };
  usuario?: string;
}

function formatCNPJ(cnpj?: string | null): string {
  if (!cnpj) return "—";
  const c = cnpj.replace(/\D/g, "").padStart(14, "0");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function fmtDateTime(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function diasColor(dias: number): { bg: string; color: string } {
  if (dias <= 2) return { bg: "#DC2626", color: "#fff" };
  if (dias <= 7) return { bg: "#F59E0B", color: "#fff" };
  return { bg: "#0F5C3A", color: "#fff" };
}

export function printRelatorioPendentes(data: RelatorioPendentesPrintData) {
  const sectionTitle =
    "background: #0F5C3A; color: white; padding: 5px 10px; font-size: 11px; font-weight: bold; margin: 0; letter-spacing: 0.5px;";
  const labelStyle =
    "font-size: 9px; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 0.3px;";
  const valueStyle = "font-size: 11px; color: #111; padding: 1px 0;";
  const kpiCardStyle =
    "border: 1px solid #0F5C3A; border-radius: 4px; padding: 8px; text-align: center; background: #F4F8F6;";
  const kpiLabel =
    "font-size: 9px; color: #0F5C3A; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;";
  const kpiValue = "font-size: 18px; font-weight: bold; color: #0F5C3A; margin-top: 2px;";

  const f = data.filtros;
  const filtrosResumo: { label: string; value: string }[] = [
    { label: "Período", value: `${f.dt_inicio} até ${f.dt_final}` },
    { label: "Empresa", value: f.empresa || "Todas" },
    { label: "Procedimento", value: f.cd_procedimento && f.cd_procedimento !== "0" ? f.cd_procedimento : "Todos" },
    { label: "Status", value: f.status_label || "Todos" },
  ];
  if (f.paciente) {
    filtrosResumo.push({ label: "Filtro paciente", value: f.paciente });
  }

  const rows = data.itens
    .map((it, idx) => {
      const c = diasColor(it.dias_para_execucao);
      const zebra = idx % 2 === 0 ? "#fff" : "#F4F8F6";
      const nomePaciente = it.nm_social
        ? `<b>${it.nm_social}</b> <span style="font-size:9px;color:#666;">(Civil: ${it.nm_paciente})</span>`
        : (it.nm_paciente || "—");

      return `
      <tr style="background:${zebra};">
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px;">${nomePaciente}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px;"><b>${it.cd_procedimento}</b> — ${it.ds_procedimento || ""}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px;">${it.empresa || "—"}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:9px; font-family:monospace;">${formatCNPJ(it.cd_cgc_estipulante)}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px;">${fmtDateTime(it.dt_agenda)}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px;">${fmtDate(it.dt_agendamento)}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; text-align:center;">
          <span style="display:inline-block; padding:2px 6px; border-radius:8px; font-size:9px; font-weight:bold; background:${c.bg}; color:${c.color};">
            ${it.dias_para_execucao}d
          </span>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #E5E7EB; font-size:10px; text-align:center;">${it.nr_atendimento ?? "—"}</td>
      </tr>
    `;
    })
    .join("");

  const emptyState =
    data.itens.length === 0
      ? `
    <tr><td colspan="8" style="padding:30px; text-align:center; color:#888; font-size:11px;">
      Nenhum procedimento pendente para os filtros selecionados.
    </td></tr>
  `
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 1100px; margin: 0 auto; padding: 10px; color:#222;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #0F5C3A;">
        <tr>
          <td style="width: 120px; text-align: center; padding: 8px; border-right: 1px solid #0F5C3A; vertical-align: middle;">
            <div style="font-weight:bold; font-size:20px; color:#0F5C3A; letter-spacing:1px;">SAMEL</div>
          </td>
          <td style="text-align: center; padding: 8px; vertical-align: middle;">
            <div style="font-size: 16px; font-weight: bold; color: #0F5C3A; letter-spacing: 1px;">RELATÓRIO DE PROCEDIMENTOS PENDENTES</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">AGENDA CORPORATIVA — POR EMPRESA</div>
          </td>
          <td style="width: 160px; border-left: 1px solid #0F5C3A; padding: 6px; font-size: 9px; vertical-align: middle; text-align: center; color: #666;">
            <div><b>Emitido em:</b></div>
            <div>${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
            ${data.usuario ? `<div style="margin-top:2px;"><b>Usuário:</b> ${data.usuario}</div>` : ""}
          </td>
        </tr>
      </table>

      <!-- Filtros -->
      <div style="border: 2px solid #0F5C3A; border-top: none;">
        <div style="${sectionTitle}">FILTROS APLICADOS</div>
        <div style="padding: 8px 10px;">
          <table style="width:100%; border-collapse: collapse;">
            <tr>
              ${filtrosResumo
                .map(
                  (item) => `
                <td style="padding: 2px 8px; vertical-align: top; width: ${100 / filtrosResumo.length}%;">
                  <div style="${labelStyle}">${item.label}</div>
                  <div style="${valueStyle}">${item.value || "—"}</div>
                </td>
              `
                )
                .join("")}
            </tr>
          </table>
        </div>
      </div>

      <!-- KPIs -->
      <div style="border: 2px solid #0F5C3A; border-top: none;">
        <div style="${sectionTitle}">INDICADORES</div>
        <div style="padding: 8px 10px;">
          <table style="width:100%; border-collapse: separate; border-spacing: 6px;">
            <tr>
              <td style="${kpiCardStyle}">
                <div style="${kpiLabel}">Total Pendentes</div>
                <div style="${kpiValue}">${data.kpis.total}</div>
              </td>
              <td style="${kpiCardStyle}">
                <div style="${kpiLabel}">Média Histórica</div>
                <div style="${kpiValue}">${data.kpis.media_dias}</div>
              </td>
              <td style="${kpiCardStyle}">
                <div style="${kpiLabel}">Próximo a Vencer</div>
                <div style="${kpiValue}">${data.kpis.proximo_vencer === "—" ? "—" : `${data.kpis.proximo_vencer} dias`}</div>
              </td>
              <td style="${kpiCardStyle.replace("#F4F8F6", data.kpis.em_risco > 0 ? "#FEE2E2" : "#F4F8F6").replace("#0F5C3A", data.kpis.em_risco > 0 ? "#DC2626" : "#0F5C3A")}">
                <div style="${kpiLabel.replace("#0F5C3A", data.kpis.em_risco > 0 ? "#DC2626" : "#0F5C3A")}">Em Risco (≤ 2d)</div>
                <div style="${kpiValue.replace("#0F5C3A", data.kpis.em_risco > 0 ? "#DC2626" : "#0F5C3A")}">${data.kpis.em_risco}</div>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Tabela -->
      <div style="border: 2px solid #0F5C3A; border-top: none;">
        <div style="${sectionTitle}">DETALHAMENTO (${data.itens.length} ${data.itens.length === 1 ? "registro" : "registros"})</div>
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background:#0F5C3A; color:#fff;">
              <th style="padding:6px; text-align:left; font-size:10px;">Paciente</th>
              <th style="padding:6px; text-align:left; font-size:10px;">Procedimento</th>
              <th style="padding:6px; text-align:left; font-size:10px;">Empresa</th>
              <th style="padding:6px; text-align:left; font-size:10px;">CNPJ</th>
              <th style="padding:6px; text-align:left; font-size:10px;">Data Agendada</th>
              <th style="padding:6px; text-align:left; font-size:10px;">Agendado em</th>
              <th style="padding:6px; text-align:center; font-size:10px;">Dias</th>
              <th style="padding:6px; text-align:center; font-size:10px;">Atend.</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${emptyState}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top: 8px; display:flex; justify-content:space-between; font-size:9px; color:#888;">
        <div>SAMEL — Relatório gerado eletronicamente</div>
        <div>Total exibido: ${data.itens.length}</div>
      </div>
    </div>
  `;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Relatório de Procedimentos Pendentes</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; color: #000 !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  w.document.close();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 400);
}
