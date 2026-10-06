import ExcelJS from "exceljs";
import type { MailingBrinde } from "@/components/mailing/MailingBrindeDialog";

const STATUS_LABEL: Record<MailingBrinde["status"], string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  entregue: "Entregue",
  devolvido: "Devolvido",
};

const fmtData = (v: string | null) => {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

const cmp = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base" });

export async function exportMailingBrindesExcel(rows: MailingBrinde[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGA";
  wb.created = new Date();

  const grupos: { nome: string; itens: MailingBrinde[] }[] = [
    { nome: "Cesta Tipo A", itens: rows.filter((r) => r.tipo_cesta === "A") },
    { nome: "Cesta Tipo B", itens: rows.filter((r) => r.tipo_cesta === "B") },
    { nome: "Cesta Tipo C", itens: rows.filter((r) => r.tipo_cesta === "C") },
    { nome: "Sem tipo de cesta", itens: rows.filter((r) => !r.tipo_cesta) },
  ].filter((g) => g.itens.length > 0);

  // Resumo
  const ws0 = wb.addWorksheet("Resumo");
  ws0.columns = [
    { header: "Cesta", key: "cesta", width: 24 },
    { header: "Total", key: "total", width: 10 },
    { header: "Pendente", key: "pendente", width: 12 },
    { header: "Enviado", key: "enviado", width: 12 },
    { header: "Entregue", key: "entregue", width: 12 },
    { header: "Devolvido", key: "devolvido", width: 12 },
  ];
  ws0.getRow(1).font = { bold: true };
  const soma = { total: 0, pendente: 0, enviado: 0, entregue: 0, devolvido: 0 };
  grupos.forEach((g) => {
    const c = { total: g.itens.length, pendente: 0, enviado: 0, entregue: 0, devolvido: 0 };
    g.itens.forEach((r) => {
      c[r.status]++;
    });
    (Object.keys(soma) as (keyof typeof soma)[]).forEach((k) => (soma[k] += c[k]));
    ws0.addRow({ cesta: g.nome, ...c });
  });
  ws0.addRow({ cesta: "Total geral", ...soma }).font = { bold: true };

  // Uma aba por tipo de cesta, organizada por executiva e empresa
  grupos.forEach((g) => {
    const ws = wb.addWorksheet(g.nome);
    ws.columns = [
      { header: "Executiva", key: "executiva", width: 18 },
      { header: "Empresa", key: "empresa_nome", width: 40 },
      { header: "Contato", key: "contato_nome", width: 28 },
      { header: "Cargo", key: "cargo", width: 22 },
      { header: "E-mail", key: "email", width: 28 },
      { header: "Telefone", key: "telefone", width: 16 },
      { header: "Data de nascimento", key: "data_nascimento", width: 18 },
      { header: "Endereço", key: "endereco", width: 44 },
      { header: "Cidade", key: "cidade", width: 18 },
      { header: "UF", key: "uf", width: 6 },
      { header: "CEP", key: "cep", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Transportadora", key: "transportadora", width: 18 },
      { header: "Rastreio", key: "rastreio_codigo", width: 20 },
      { header: "Enviado em", key: "enviado_em", width: 13 },
      { header: "Entregue em", key: "entregue_em", width: 13 },
      { header: "Observações", key: "observacoes", width: 36 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    [...g.itens]
      .sort((a, b) => cmp(a.executiva, b.executiva) || cmp(a.empresa_nome, b.empresa_nome) || cmp(a.contato_nome, b.contato_nome))
      .forEach((r) =>
        ws.addRow({
          ...r,
          executiva: r.executiva ?? "",
          status: STATUS_LABEL[r.status],
          data_nascimento: fmtData(r.data_nascimento),
          enviado_em: fmtData(r.enviado_em),
          entregue_em: fmtData(r.entregue_em),
        }),
      );
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mailing-brindes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
