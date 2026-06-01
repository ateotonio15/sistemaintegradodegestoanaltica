import ExcelJS from "exceljs";
import type { EmpresaVidas, HistoricoMes } from "@/hooks/useGestaoVidas";

export async function exportGestaoVidasExcel(
  empresas: EmpresaVidas[],
  historico: HistoricoMes[],
  mesRef: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CS Control";
  wb.created = new Date();

  const wsEmp = wb.addWorksheet("Empresas");
  wsEmp.columns = [
    { header: "Empresa", key: "nome", width: 40 },
    { header: "Contrato", key: "codigo_contrato", width: 16 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Tipo", key: "tipo_contrato", width: 16 },
    { header: "Status", key: "status_empresa", width: 14 },
    { header: "Vidas Ativas", key: "total_atual", width: 14 },
    { header: "Entradas", key: "entradas", width: 12 },
    { header: "Saídas", key: "saidas", width: 12 },
    { header: "Saldo", key: "saldo", width: 12 },
    { header: "Última Atualização", key: "ultima_atualizacao", width: 22 },
  ];
  wsEmp.getRow(1).font = { bold: true };
  empresas.forEach((e) =>
    wsEmp.addRow({
      ...e,
      ultima_atualizacao: e.ultima_atualizacao
        ? new Date(e.ultima_atualizacao).toLocaleString("pt-BR")
        : "—",
    }),
  );

  const wsHist = wb.addWorksheet("Evolução Mensal");
  wsHist.columns = [
    { header: "Mês", key: "mes", width: 12 },
    { header: "Entradas", key: "entradas", width: 12 },
    { header: "Saídas", key: "saidas", width: 12 },
    { header: "Vidas Ativas", key: "vidas_ativas", width: 14 },
  ];
  wsHist.getRow(1).font = { bold: true };
  historico.forEach((h) => wsHist.addRow(h));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gestao-vidas-${mesRef}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
