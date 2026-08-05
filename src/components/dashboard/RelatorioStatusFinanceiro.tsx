import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, ClipboardList, Activity, Send, Receipt, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelectFiltro } from "./MultiSelectFiltro";
import {
  calcularStatusFinanceiro,
  labelStatusFinanceiro,
  statusFinanceiroColor,
  formatMesReferencia,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";

const TODOS_STATUS: StatusFinanceiro[] = [
  "Enviada",
  "Nota emitida",
  "Aguardando validação",
  "Faturado",
  "Em faturamento",
  "Aguardando nota",
  "Fora do prazo",
  "Pendente",
];

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoInicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDia(iso: string | null | undefined) {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

interface LinhaRelatorio {
  id: string;
  empresa_nome: string;
  codigo_contrato: string;
  mes_referencia: string | null;
  periodo: string | null;
  tipo_cobranca: string | null;
  tipo_analise: string | null;
  status: StatusFinanceiro;
  statusLabel: string;
  data_envio_nota: string | null;
  data_vencimento: string | null;
  dia_emissao: number | null;
  aguardando_nota_em: string | null;
  faturamento_iniciado_em: string | null;
  dentro_prazo: boolean | null;
  usuario_envio: string;
  usuario_faturamento: string;
  atualizado_em: string | null;
  qtd_anexos: number;
  ultimo_anexo_em: string | null;
  ultimo_anexo_por: string;
}

export function RelatorioStatusFinanceiro() {
  const [dataIni, setDataIni] = useState(isoInicioMes());
  const [dataFim, setDataFim] = useState(isoHoje());
  const [statusSel, setStatusSel] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["fin-relatorio-status", dataIni, dataFim],
    queryFn: async (): Promise<LinhaRelatorio[]> => {
      const { data: fins, error } = await supabase
        .from("financeiro_movimentacoes")
        .select(
          "id, empresa_id, mes_referencia, periodo, tipo_cobranca, tipo_analise, data_envio_nota, data_vencimento, dia_emissao, aguardando_nota_em, faturamento_iniciado_em, faturamento_iniciado_por, faturamento_iniciado_por_nome, enviado_por_user_id, dentro_prazo, updated_at",
        )
        .limit(20000);
      if (error) throw error;
      const rows = fins ?? [];

      const ids = rows.map((r: any) => r.id);
      const anexosPorMov = new Map<
        string,
        { mime_type: string | null; nome_arquivo: string | null; origem: string | null; created_at: string; uploaded_by: string | null }[]
      >();
      for (let i = 0; i < ids.length; i += 500) {
        const { data: anx } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id, mime_type, nome_arquivo, origem, created_at, uploaded_by")
          .in("financeiro_movimentacao_id", ids.slice(i, i + 500));
        (anx ?? []).forEach((a: any) => {
          const list = anexosPorMov.get(a.financeiro_movimentacao_id) ?? [];
          list.push(a);
          anexosPorMov.set(a.financeiro_movimentacao_id, list);
        });
      }

      const { data: emps } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, exige_po_pc");
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e]));

      const { data: ops } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
        .not("data_envio_financeiro", "is", null)
        .limit(20000);
      const envioSet = new Set(
        (ops ?? []).map((m: any) => `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`),
      );

      const userIds = Array.from(
        new Set(
          [
            ...rows.map((r: any) => r.enviado_por_user_id),
            ...rows.map((r: any) => r.faturamento_iniciado_por),
            ...Array.from(anexosPorMov.values()).flat().map((a) => a.uploaded_by),
          ].filter(Boolean),
        ),
      ) as string[];
      const nomeMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: nomes } = await supabase.rpc("get_user_display_names", { _ids: userIds });
        (nomes ?? []).forEach((n: any) => nomeMap.set(n.user_id, n.display_name));
      }

      return rows.map((r: any) => {
        const emp: any = empMap.get(r.empresa_id);
        const anexos = anexosPorMov.get(r.id) ?? [];
        const status = calcularStatusFinanceiro(
          r,
          envioSet.has(`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`),
          anexos,
          !!emp?.exige_po_pc,
        );
        const ultimo = anexos
          .slice()
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        return {
          id: r.id,
          empresa_nome: emp?.nome ?? "—",
          codigo_contrato: emp?.codigo_contrato ?? "",
          mes_referencia: r.mes_referencia,
          periodo: r.periodo,
          tipo_cobranca: r.tipo_cobranca,
          tipo_analise: r.tipo_analise,
          status,
          statusLabel: labelStatusFinanceiro(status),
          data_envio_nota: r.data_envio_nota,
          data_vencimento: r.data_vencimento,
          dia_emissao: r.dia_emissao,
          aguardando_nota_em: r.aguardando_nota_em,
          faturamento_iniciado_em: r.faturamento_iniciado_em,
          dentro_prazo: r.dentro_prazo,
          usuario_envio: nomeMap.get(r.enviado_por_user_id) ?? "",
          usuario_faturamento:
            r.faturamento_iniciado_por_nome ?? nomeMap.get(r.faturamento_iniciado_por) ?? "",
          atualizado_em: r.updated_at,
          qtd_anexos: anexos.length,
          ultimo_anexo_em: ultimo?.created_at ?? null,
          ultimo_anexo_por: ultimo?.uploaded_by ? nomeMap.get(ultimo.uploaded_by) ?? "" : "",
        };
      });
    },
  });

  const linhas = data ?? [];

  /** Data de referência do movimento no relatório: envio da nota → anexo → faturamento → atualização */
  function dataRef(l: LinhaRelatorio) {
    return (
      l.data_envio_nota ??
      l.ultimo_anexo_em?.slice(0, 10) ??
      l.faturamento_iniciado_em?.slice(0, 10) ??
      l.aguardando_nota_em?.slice(0, 10) ??
      l.atualizado_em?.slice(0, 10) ??
      null
    );
  }

  const filtradas = useMemo(
    () =>
      linhas
        .filter((l) => {
          const d = dataRef(l);
          if (!d) return false;
          if (dataIni && d < dataIni) return false;
          if (dataFim && d > dataFim) return false;
          if (statusSel.length > 0 && !statusSel.includes(l.status)) return false;
          return true;
        })
        .sort((a, b) => (dataRef(b) ?? "").localeCompare(dataRef(a) ?? "")),
    [linhas, dataIni, dataFim, statusSel],
  );

  const resumoStatus = useMemo(() => {
    const m = new Map<StatusFinanceiro, number>();
    filtradas.forEach((l) => m.set(l.status, (m.get(l.status) ?? 0) + 1));
    return TODOS_STATUS.filter((s) => (m.get(s) ?? 0) > 0).map((s) => ({ status: s, total: m.get(s)! }));
  }, [filtradas]);

  /** Notas efetivamente enviadas no período, por dia e por usuário */
  const porDia = useMemo(() => {
    const m = new Map<string, { total: number; enviadas: number }>();
    filtradas.forEach((l) => {
      const d = dataRef(l)!;
      const cur = m.get(d) ?? { total: 0, enviadas: 0 };
      cur.total += 1;
      if (l.data_envio_nota && l.data_envio_nota >= dataIni && l.data_envio_nota <= dataFim) cur.enviadas += 1;
      m.set(d, cur);
    });
    return Array.from(m.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => b.dia.localeCompare(a.dia));
  }, [filtradas, dataIni, dataFim]);

  const porUsuario = useMemo(() => {
    const m = new Map<string, { enviadas: number; faturamentos: number; anexos: number }>();
    const get = (k: string) => {
      const v = m.get(k) ?? { enviadas: 0, faturamentos: 0, anexos: 0 };
      m.set(k, v);
      return v;
    };
    filtradas.forEach((l) => {
      if (l.data_envio_nota) get(l.usuario_envio || "Não identificado").enviadas += 1;
      if (l.faturamento_iniciado_em) get(l.usuario_faturamento || "Não identificado").faturamentos += 1;
      if (l.ultimo_anexo_por) get(l.ultimo_anexo_por).anexos += 1;
    });
    return Array.from(m.entries())
      .map(([usuario, v]) => ({ usuario, ...v }))
      .sort((a, b) => b.enviadas - a.enviadas || a.usuario.localeCompare(b.usuario));
  }, [filtradas]);

  const totalEnviadas = filtradas.filter((l) => !!l.data_envio_nota).length;

  const cabecalho = [
    "Empresa",
    "Contrato",
    "Competência",
    "Período",
    "Status",
    "Tipo de cobrança",
    "Tipo de análise",
    "Data da nota",
    "Vencimento",
    "Dia de emissão",
    "Aguardando emissão desde",
    "Faturamento iniciado em",
    "Dentro do prazo",
    "Usuário do envio",
    "Usuário do faturamento",
    "Anexos",
    "Último anexo em",
    "Último anexo por",
    "Data de referência",
  ];

  function linhaValores(l: LinhaRelatorio): (string | number)[] {
    return [
      l.empresa_nome,
      l.codigo_contrato,
      l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "",
      l.periodo ?? "",
      l.statusLabel,
      l.tipo_cobranca ?? "",
      l.tipo_analise ?? "",
      fmtDia(l.data_envio_nota),
      fmtDia(l.data_vencimento),
      l.dia_emissao ?? "",
      fmtDia(l.aguardando_nota_em),
      fmtDia(l.faturamento_iniciado_em),
      l.dentro_prazo === false ? "Não" : l.dentro_prazo === true ? "Sim" : "",
      l.usuario_envio,
      l.usuario_faturamento,
      l.qtd_anexos,
      fmtDia(l.ultimo_anexo_em),
      l.ultimo_anexo_por,
      fmtDia(dataRef(l)),
    ];
  }

  async function exportarExcel() {
    if (filtradas.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet("Detalhado");
    ws.addRow(cabecalho);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } } as any;
    filtradas.forEach((l) => ws.addRow(linhaValores(l)));
    ws.columns.forEach((c, i) => (c.width = i === 0 ? 40 : 20));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cabecalho.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const wsStatus = wb.addWorksheet("Resumo por status");
    wsStatus.addRow(["Status", "Quantidade"]);
    wsStatus.getRow(1).font = { bold: true };
    resumoStatus.forEach((r) => wsStatus.addRow([labelStatusFinanceiro(r.status), r.total]));
    wsStatus.columns.forEach((c) => (c.width = 28));

    const wsDia = wb.addWorksheet("Por dia");
    wsDia.addRow(["Dia", "Movimentações", "Notas enviadas"]);
    wsDia.getRow(1).font = { bold: true };
    porDia.forEach((d) => wsDia.addRow([fmtDia(d.dia), d.total, d.enviadas]));
    wsDia.columns.forEach((c) => (c.width = 22));

    const wsUser = wb.addWorksheet("Por usuário");
    wsUser.addRow(["Usuário", "Faturamentos iniciados", "Anexos enviados"]);
    wsUser.getRow(1).font = { bold: true };
    porUsuario.forEach((u) => wsUser.addRow([u.usuario, u.faturamentos, u.anexos]));
    wsUser.columns.forEach((c, i) => (c.width = i === 0 ? 34 : 22));

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${dataIni}_a_${dataFim}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarPDF() {
    if (filtradas.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório de status do Financeiro", 40, 40);
    doc.setFontSize(9);
    doc.text(
      `Período: ${fmtDia(dataIni)} a ${fmtDia(dataFim)}  |  Registros: ${filtradas.length}  |  Notas enviadas: ${totalEnviadas}  |  Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
      40,
      58,
    );

    autoTable(doc, {
      startY: 74,
      head: [["Status", "Quantidade"]],
      body: resumoStatus.map((r) => [labelStatusFinanceiro(r.status), String(r.total)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      margin: { left: 40, right: 40 },
      tableWidth: 240,
    });

    let y = (doc as any).lastAutoTable.finalY + 16;
    autoTable(doc, {
      startY: y,
      head: [["Dia", "Movimentações", "Notas enviadas"]],
      body: porDia.map((d) => [fmtDia(d.dia), String(d.total), String(d.enviadas)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      margin: { left: 40, right: 40 },
      tableWidth: 300,
    });

    y = (doc as any).lastAutoTable.finalY + 16;
    autoTable(doc, {
      startY: y,
      head: [["Usuário", "Notas enviadas", "Faturamentos iniciados", "Anexos"]],
      body: porUsuario.map((u) => [u.usuario, String(u.enviadas), String(u.faturamentos), String(u.anexos)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      margin: { left: 40, right: 40 },
      tableWidth: 420,
    });

    doc.addPage("a4", "landscape");
    autoTable(doc, {
      startY: 40,
      head: [
        [
          "Empresa",
          "Contrato",
          "Competência",
          "Período",
          "Status",
          "Data da nota",
          "Vencimento",
          "Usuário do envio",
          "Usuário do faturamento",
          "Data de referência",
        ],
      ],
      body: filtradas.map((l) => [
        l.empresa_nome,
        l.codigo_contrato || "—",
        l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—",
        l.periodo ?? "—",
        l.statusLabel,
        fmtDia(l.data_envio_nota),
        fmtDia(l.data_vencimento),
        l.usuario_envio || "—",
        l.usuario_faturamento || "—",
        fmtDia(dataRef(l)),
      ]),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      columnStyles: { 0: { cellWidth: 150 } },
      margin: { left: 40, right: 40 },
    });

    doc.save(`relatorio-financeiro-${dataIni}_a_${dataFim}.pdf`);
  }

  const totalFaturamentos = filtradas.filter((l) => !!l.faturamento_iniciado_em).length;
  const totalAnexos = filtradas.reduce((s, l) => s + l.qtd_anexos, 0);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Relatório diário por status
              <Badge variant="outline" className="ml-1">{filtradas.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Acompanhe, dia a dia, o que o Financeiro movimentou: quantos contratos tiveram alguma
              atualização e quantas notas fiscais foram efetivamente enviadas — por período e por usuário.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">De</Label>
              <Input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <MultiSelectFiltro
              label="Status"
              width="w-[190px]"
              options={TODOS_STATUS.map((s) => ({ value: s, label: labelStatusFinanceiro(s) }))}
              selected={statusSel}
              onChange={setStatusSel}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={exportarExcel}
              disabled={filtradas.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={exportarPDF}
              disabled={filtradas.length === 0}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Activity,
              label: "Movimentações",
              value: filtradas.length,
              hint: "Contratos com alguma atualização do Financeiro no período (envio, anexo, início de faturamento ou mudança de status).",
            },
            {
              icon: Send,
              label: "Notas enviadas",
              value: totalEnviadas,
              hint: "Notas fiscais efetivamente enviadas ao cliente — contratos com data da nota preenchida.",
            },
            {
              icon: Receipt,
              label: "Faturamentos iniciados",
              value: totalFaturamentos,
              hint: "Contratos em que o Financeiro deu início ao faturamento (antes da emissão da nota).",
            },
            {
              icon: Paperclip,
              label: "Anexos enviados",
              value: totalAnexos,
              hint: "Arquivos anexados às movimentações no período (relatórios, notas, comprovantes).",
            },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <k.icon className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <div className="text-xl font-semibold mt-0.5">{k.value}</div>
              <p className="text-[10px] leading-snug text-muted-foreground mt-1">{k.hint}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {resumoStatus.map((r) => (
            <Badge key={r.status} className={cn("text-[11px] font-medium", statusFinanceiroColor(r.status))}>
              {labelStatusFinanceiro(r.status)}: {r.total}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma movimentação financeira no período selecionado.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <p className="text-xs font-semibold">Notas por dia</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  <strong>Movimentações</strong> = contratos tocados pelo Financeiro naquele dia.{" "}
                  <strong>Notas enviadas</strong> = quantas dessas viraram nota fiscal emitida no mesmo dia.
                </p>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr className="border-b">
                      <th className="text-left px-3 py-1.5 font-medium">Dia</th>
                      <th className="text-right px-3 py-1.5 font-medium">Movimentações</th>
                      <th className="text-right px-3 py-1.5 font-medium">Notas enviadas</th>
                      <th className="text-right px-3 py-1.5 font-medium">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDia.map((d) => (
                      <tr key={d.dia} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-1.5">{fmtDia(d.dia)}</td>
                        <td className="px-3 py-1.5 text-right">{d.total}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{d.enviadas}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {d.total > 0 ? `${Math.round((d.enviadas / d.total) * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <p className="text-xs font-semibold">Produção por usuário</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  <strong>Notas</strong> = notas enviadas pelo usuário · <strong>Faturamentos</strong> = faturamentos
                  que ele iniciou · <strong>Anexos</strong> = arquivos que ele subiu.
                </p>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr className="border-b">
                      <th className="text-left px-3 py-1.5 font-medium">Usuário</th>
                      <th className="text-right px-3 py-1.5 font-medium">Notas</th>
                      <th className="text-right px-3 py-1.5 font-medium">Faturamentos</th>
                      <th className="text-right px-3 py-1.5 font-medium">Anexos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porUsuario.map((u) => (
                      <tr key={u.usuario} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-1.5 truncate max-w-[180px]">{u.usuario}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{u.enviadas}</td>
                        <td className="px-3 py-1.5 text-right">{u.faturamentos}</td>
                        <td className="px-3 py-1.5 text-right">{u.anexos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

