import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2,
  HelpCircle,
} from "lucide-react";
import {
  formatBRL,
  type AnaliseResultado,
  type ComparacaoResultado,
  type ComparacaoSimplificada,
} from "@/lib/excel-analysis-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportarAnaliseExcel,
  exportarAnalisePDF,
  type AnaliseCompletaExport,
  type CategoriaComparada,
  type ConferenciaServico,
} from "@/lib/financeiro-analise-export";

type Status = "OK" | "Divergente" | "Atenção" | "Não analisado" | "Erro" | "Pendente";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaNome: string;
  empresaCnpj: string | null;
  competencia: string;
  periodo: string;
  isLoading?: boolean;
  resultados: AnaliseResultado[] | null;
  comparacoes: Array<ComparacaoResultado | ComparacaoSimplificada> | null;
  nomeExcel?: string | null;
  onReanalisar?: () => void;
  onGerarHistorico?: () => void;
  onVerPdf?: () => void;
  onVerExcel?: () => void;
  usuarioNome?: string | null;
}

function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { cls: string; icon: any }> = {
    OK: { cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
    Divergente: { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
    Atenção: { cls: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
    "Não analisado": { cls: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
    Erro: { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
    Pendente: { cls: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
  };
  const C = cfg[status];
  const Icon = C.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${C.cls}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function isSimplificada(c: any): c is ComparacaoSimplificada {
  return !!c && "beneficiarios" in c && !("enfermaria" in c);
}

function StepHeader({
  numero,
  titulo,
  status,
  open,
  onToggle,
}: {
  numero: number;
  titulo: string;
  status: Status;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
        {numero}
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-semibold">{titulo}</div>
      </div>
      <StatusBadge status={status} />
      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

export function AnaliseCompletaDialog({
  open,
  onOpenChange,
  empresaNome,
  empresaCnpj,
  competencia,
  periodo,
  isLoading,
  resultados,
  comparacoes,
  nomeExcel,
  onReanalisar,
  onGerarHistorico,
  onVerPdf,
  onVerExcel,
  usuarioNome,
}: Props) {
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true, 5: true });
  const toggle = (n: number) => setOpenSteps((p) => ({ ...p, [n]: !p[n] }));

  const dados = useMemo(() => {
    const res = resultados ?? [];
    const cmps = comparacoes ?? [];
    const primeiroCmp: any = cmps[0];

    const nfNumero = primeiroCmp?.nfNumero ?? null;
    const tomador = primeiroCmp?.tomadorNome ?? null;
    const cnpjTomador = primeiroCmp?.tomadorCnpj ?? empresaCnpj ?? null;
    const arquivoPdf = primeiroCmp?.arquivoPdf ?? null;
    const valorLiquido = primeiroCmp?.valorLiquido ?? null;
    const tributos = primeiroCmp?.tributos ?? null;

    // Soma por categoria — agrega todos os pagadores/blocos
    let totalEnfExcel = 0,
      totalEnfPdf = 0,
      temEnfPdf = false,
      temEnfExcel = false;
    let totalAptExcel = 0,
      totalAptPdf = 0,
      temAptPdf = false,
      temAptExcel = false;
    let totalIncExcel = 0,
      totalIncPdf = 0,
      temIncPdf = false,
      temIncExcel = false;
    let totalExcExcel = 0,
      totalExcPdf = 0,
      temExcExcel = false,
      temExcPdf = false;

    res.forEach((r, idx) => {
      const c: any = cmps[idx];
      if (r.enfermaria.total) {
        totalEnfExcel += r.enfermaria.total;
        temEnfExcel = true;
      }
      if (r.apartamento.total) {
        totalAptExcel += r.apartamento.total;
        temAptExcel = true;
      }
      if (r.inclusoes.total) {
        totalIncExcel += r.inclusoes.total;
        temIncExcel = true;
      }
      if (r.exclusoes && r.exclusoes.total) {
        totalExcExcel += r.exclusoes.total;
        temExcExcel = true;
      }
      if (c && !isSimplificada(c)) {
        if (c.enfermaria?.total.pdf != null) {
          totalEnfPdf += Number(c.enfermaria.total.pdf);
          temEnfPdf = true;
        }
        if (c.apartamento?.total.pdf != null) {
          totalAptPdf += Number(c.apartamento.total.pdf);
          temAptPdf = true;
        }
        if (c.inclusoes?.total.pdf != null) {
          totalIncPdf += Number(c.inclusoes.total.pdf);
          temIncPdf = true;
        }
        if (c.exclusoes?.total.pdf != null) {
          totalExcPdf += Number(c.exclusoes.total.pdf);
          temExcPdf = true;
        }
      }
    });

    const linha = (
      categoria: string,
      excel: number | null,
      pdf: number | null,
    ): CategoriaComparada => {
      const dif = excel != null && pdf != null ? Number((excel - pdf).toFixed(2)) : null;
      let status: Status = "Não analisado";
      let obs = "";
      if (pdf == null && excel == null) status = "Não analisado";
      else if (pdf == null) {
        status = "Atenção";
        obs = "Categoria não localizada no histórico da NFS-e.";
      } else if (excel == null) {
        status = "Atenção";
        obs = "Categoria não localizada no Excel.";
      } else if (Math.abs(dif!) < 0.01) status = "OK";
      else status = "Divergente";
      return { categoria, excel, pdf, diferenca: dif, status, observacao: obs };
    };

    const categorias: CategoriaComparada[] = [];
    if (temEnfExcel || temEnfPdf)
      categorias.push(linha("Enfermaria", temEnfExcel ? totalEnfExcel : null, temEnfPdf ? totalEnfPdf : null));
    if (temAptExcel || temAptPdf)
      categorias.push(linha("Apartamento", temAptExcel ? totalAptExcel : null, temAptPdf ? totalAptPdf : null));
    if (temIncExcel || temIncPdf)
      categorias.push(linha("Inclusões", temIncExcel ? totalIncExcel : null, temIncPdf ? totalIncPdf : null));
    if (temExcExcel || temExcPdf) {
      categorias.push(
        linha("Exclusões", temExcExcel ? totalExcExcel : null, temExcPdf ? totalExcPdf : null),
      );
    }

    const totalExcelGeral =
      (temEnfExcel ? totalEnfExcel : 0) +
      (temAptExcel ? totalAptExcel : 0) +
      (temIncExcel ? totalIncExcel : 0) +
      (temExcExcel ? totalExcExcel : 0);
    const totalPdfGeral =
      (temEnfPdf ? totalEnfPdf : 0) +
      (temAptPdf ? totalAptPdf : 0) +
      (temIncPdf ? totalIncPdf : 0) +
      (temExcPdf ? totalExcPdf : 0);

    categorias.push(
      linha(
        "Total geral",
        temEnfExcel || temAptExcel || temIncExcel || temExcExcel ? totalExcelGeral : null,
        temEnfPdf || temAptPdf || temIncPdf || temExcPdf ? totalPdfGeral : null,
      ),
    );

    // Etapa 1 status
    let docStatus: Status = "OK";
    if (!nomeExcel) docStatus = "Pendente";
    else if (!arquivoPdf) docStatus = "Pendente";

    // Etapa 2 status (sem PDF => pendente)
    const cmpsValidas = categorias.filter((c) => c.categoria !== "Total geral");
    let cmpStatus: Status = "Não analisado";
    if (!arquivoPdf) cmpStatus = "Pendente";
    else if (cmpsValidas.some((c) => c.status === "Divergente")) cmpStatus = "Divergente";
    else if (cmpsValidas.every((c) => c.status === "OK") && cmpsValidas.length > 0) cmpStatus = "OK";
    else cmpStatus = "Atenção";

    // Etapa 3 — valor do serviço (usa valor líquido como proxy enquanto não há valor do serviço)
    const servico: ConferenciaServico[] = [
      {
        origem: "Total do Excel",
        valor: totalExcelGeral || null,
        status: totalExcelGeral ? "OK" : "Não analisado",
      },
      {
        origem: "Total do histórico da NFS-e",
        valor: arquivoPdf && totalPdfGeral ? totalPdfGeral : null,
        status: arquivoPdf ? (totalPdfGeral ? "OK" : "Atenção") : "Pendente",
      },
      {
        origem: "Valor líquido da NFS-e",
        valor: valorLiquido,
        status: valorLiquido != null ? "OK" : "Pendente",
      },
    ];

    let servStatus: Status = "Não analisado";
    if (!arquivoPdf) servStatus = "Pendente";
    else {
      const valores = [totalExcelGeral, totalPdfGeral, valorLiquido].filter(
        (v): v is number => v != null && v > 0,
      );
      if (valores.length < 2) servStatus = "Atenção";
      else {
        const max = Math.max(...valores);
        const min = Math.min(...valores);
        servStatus = max - min < 0.01 ? "OK" : "Divergente";
      }
    }

    // Etapa 4 — Tributária (parcial)
    const tribLinhas: ConferenciaServico[] = [];
    if (tributos) {
      const push = (
        origem: string,
        valor: number | null,
        unidade: "BRL" | "%" = "BRL",
      ) =>
        tribLinhas.push({
          origem,
          valor,
          unidade,
          status: valor != null ? "OK" : "Pendente",
        });
      push("Base de cálculo", tributos.baseCalculo);
      push("Alíquota ISSQN (%)", tributos.aliquotaIssqn, "%");
      push("ISSQN devido", tributos.issqn);
      push("ISSQN retido", tributos.issqnRetido);
      push("IBS", tributos.ibs);
      push("CBS", tributos.cbs);
      push("Outras retenções", tributos.outrasRetencoes);
    }
    let tribStatus: Status = "Não analisado";
    if (!arquivoPdf) tribStatus = "Pendente";
    else if (tribLinhas.every((l) => l.valor != null)) tribStatus = "OK";
    else if (tribLinhas.some((l) => l.valor != null)) tribStatus = "Atenção";
    else tribStatus = "Pendente";

    // Etapa 5 — Resultado
    const okCount = [docStatus, cmpStatus, servStatus, tribStatus].filter((s) => s === "OK").length;
    const divCount = [cmpStatus, servStatus, tribStatus].filter((s) => s === "Divergente").length;
    const alertaCount = [docStatus, cmpStatus, servStatus, tribStatus].filter(
      (s) => s === "Atenção" || s === "Pendente",
    ).length;

    let statusGeral: Status;
    const allStatus: Status[] = [docStatus, cmpStatus, servStatus, tribStatus];
    if (allStatus.some((s) => s === "Erro")) statusGeral = "Erro";
    else if (divCount > 0) statusGeral = "Divergente";
    else if (alertaCount > 0) statusGeral = "Atenção";
    else if (okCount === 4) statusGeral = "OK";
    else statusGeral = "Pendente";

    const divergList: string[] = [];
    if (cmpStatus === "Divergente") {
      cmpsValidas
        .filter((c) => c.status === "Divergente")
        .forEach((c) =>
          divergList.push(
            `Categoria ${c.categoria}: Excel ${formatBRL(c.excel || 0)} × NFS-e ${formatBRL(c.pdf || 0)}.`,
          ),
        );
    }
    if (servStatus === "Divergente") {
      divergList.push("Valor do Serviço da NFS-e não confere com o total do Excel/histórico.");
    }

    const mensagem =
      statusGeral === "OK"
        ? "Análise concluída com sucesso. O Excel, o histórico da NFS-e e as informações tributárias conferem."
        : statusGeral === "Divergente"
          ? "Análise concluída com divergências. Verifique os itens destacados antes de prosseguir."
          : statusGeral === "Atenção"
            ? "Análise concluída com pontos de atenção. Conferência manual recomendada."
            : "Análise pendente — anexos ou dados ainda não disponíveis.";

    return {
      nfNumero,
      tomador,
      cnpjTomador,
      arquivoPdf,
      valorLiquido,
      categorias,
      servico,
      tribLinhas,
      tribStatus,
      docStatus,
      cmpStatus,
      servStatus,
      statusGeral,
      okCount,
      divCount,
      alertaCount,
      divergList,
      mensagem,
      totalExcelGeral,
      totalPdfGeral,
    };
  }, [resultados, comparacoes, nomeExcel, empresaCnpj]);

  const handleExport = (formato: "pdf" | "excel") => {
    const payload: AnaliseCompletaExport = {
      titulo: "Análise Completa do Faturamento",
      empresa: empresaNome,
      cnpj: empresaCnpj,
      competencia,
      periodo,
      statusGeral: dados.statusGeral,
      geradoEm: new Date().toLocaleString("pt-BR"),
      geradoPor: usuarioNome ?? null,
      documentos: {
        excelEncontrado: !!nomeExcel,
        pdfEncontrado: !!dados.arquivoPdf,
        nomeExcel: nomeExcel ?? null,
        nomePdf: dados.arquivoPdf,
        nfNumero: dados.nfNumero,
        tomador: dados.tomador,
        cnpj: dados.cnpjTomador,
        status: dados.docStatus,
      },
      categorias: dados.categorias,
      servico: dados.servico,
      resumo: {
        totalItens: dados.categorias.length + dados.servico.length,
        ok: dados.categorias.filter((c) => c.status === "OK").length + dados.servico.filter((s) => s.status === "OK").length,
        divergencias: dados.divCount,
        alertas: dados.alertaCount,
        mensagem: dados.mensagem,
      },
      divergenciasLista: dados.divergList,
    };
    if (formato === "pdf") exportarAnalisePDF(payload);
    else exportarAnaliseExcel(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 rounded-none border-0 sm:rounded-none overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Financeiro
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">Análise Completa do Faturamento</h2>
            <p className="text-xs text-muted-foreground truncate">
              Conferência entre Excel, histórico da NFS-e e informações tributárias da nota fiscal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onVerExcel && (
              <Button variant="outline" size="sm" onClick={onVerExcel} className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Ver Excel
              </Button>
            )}
            {onVerPdf && (
              <Button variant="outline" size="sm" onClick={onVerPdf} className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Ver PDF
              </Button>
            )}
            {onGerarHistorico && (
              <Button variant="outline" size="sm" onClick={onGerarHistorico} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Gerar Histórico
              </Button>
            )}
            {onReanalisar && (
              <Button variant="outline" size="sm" onClick={onReanalisar} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Reanalisar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>Exportar como PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>Exportar como Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando análise...
            </div>
          ) : (
            <div className="max-w-7xl mx-auto p-6 space-y-6">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Empresa/Tomador" value={dados.tomador || empresaNome} />
                <SummaryCard label="CNPJ" value={dados.cnpjTomador || empresaCnpj || "—"} />
                <SummaryCard label="Número da NFS-e" value={dados.nfNumero || "—"} />
                <SummaryCard label="Competência / Período" value={`${competencia} • ${periodo}`} />
                <SummaryCard label="Valor total do Excel" value={dados.totalExcelGeral ? formatBRL(dados.totalExcelGeral) : "—"} />
                <SummaryCard label="Valor do Serviço (NFS-e)" value={dados.totalPdfGeral ? formatBRL(dados.totalPdfGeral) : "—"} />
                <SummaryCard label="Valor líquido (NFS-e)" value={dados.valorLiquido != null ? formatBRL(dados.valorLiquido) : "—"} />
                <SummaryCard label="Status geral" value={<StatusBadge status={dados.statusGeral} />} />
              </div>

              {/* Stepper visual */}
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {[
                    { n: 1, t: "Documentos", s: dados.docStatus },
                    { n: 2, t: "Conferência Excel x Histórico da Nota", s: dados.cmpStatus },
                    { n: 3, t: "Conferência Valor do Serviço", s: dados.servStatus },
                    { n: 4, t: "Conferência Tributária", s: dados.tribStatus },
                    { n: 5, t: "Resultado Final", s: dados.statusGeral },
                  ].map((step) => (
                    <div key={step.n}>
                      <StepHeader
                        numero={step.n}
                        titulo={step.t}
                        status={step.s}
                        open={!!openSteps[step.n]}
                        onToggle={() => toggle(step.n)}
                      />
                      {openSteps[step.n] && (
                        <div className="px-6 pb-5 pt-1 border-t border-border bg-muted/10">
                          {step.n === 1 && (
                            <EtapaDocumentos
                              excelEncontrado={!!nomeExcel}
                              pdfEncontrado={!!dados.arquivoPdf}
                              nomeExcel={nomeExcel ?? null}
                              nomePdf={dados.arquivoPdf}
                              nfNumero={dados.nfNumero}
                              tomador={dados.tomador}
                              cnpj={dados.cnpjTomador}
                            />
                          )}
                          {step.n === 2 && <EtapaCategorias linhas={dados.categorias} />}
                          {step.n === 3 && <EtapaServico linhas={dados.servico} />}
                          {step.n === 4 && (
                            dados.tribLinhas.length === 0 ? (
                              <div className="text-sm text-muted-foreground py-4">
                                Nenhum dado tributário extraído do PDF. Verifique se o anexo contém as informações de
                                ISSQN, IBS, CBS e base de cálculo.
                              </div>
                            ) : (
                              <EtapaServico linhas={dados.tribLinhas} />
                            )
                          )}
                          {step.n === 5 && (
                            <EtapaResultado
                              statusGeral={dados.statusGeral}
                              mensagem={dados.mensagem}
                              totalItens={dados.categorias.length + dados.servico.length}
                              ok={
                                dados.categorias.filter((c) => c.status === "OK").length +
                                dados.servico.filter((s) => s.status === "OK").length
                              }
                              divergencias={dados.divCount}
                              alertas={dados.alertaCount}
                              divergList={dados.divergList}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-semibold mt-1 truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function EtapaDocumentos(props: {
  excelEncontrado: boolean;
  pdfEncontrado: boolean;
  nomeExcel: string | null;
  nomePdf: string | null;
  nfNumero: string | null;
  tomador: string | null;
  cnpj: string | null;
}) {
  const rows: Array<{ k: string; v: React.ReactNode }> = [
    { k: "Excel encontrado?", v: props.excelEncontrado ? <span className="text-success">Sim</span> : <span className="text-destructive">Não</span> },
    { k: "PDF encontrado?", v: props.pdfEncontrado ? <span className="text-success">Sim</span> : <span className="text-destructive">Não</span> },
    { k: "Nome do arquivo Excel", v: props.nomeExcel || "—" },
    { k: "Nome do arquivo PDF", v: props.nomePdf || "—" },
    { k: "Número da NFS-e identificado", v: props.nfNumero || "—" },
    { k: "Tomador identificado", v: props.tomador || "—" },
    { k: "CNPJ identificado", v: props.cnpj || "—" },
  ];
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden mt-2">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i > 0 ? "border-t border-border" : ""}>
              <td className="px-3 py-2 font-medium text-muted-foreground w-1/3">{r.k}</td>
              <td className="px-3 py-2">{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EtapaCategorias({ linhas }: { linhas: CategoriaComparada[] }) {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left font-medium px-3 py-2">Categoria</th>
            <th className="text-right font-medium px-3 py-2">Valor no Excel</th>
            <th className="text-right font-medium px-3 py-2">Valor no histórico da NFS-e</th>
            <th className="text-right font-medium px-3 py-2">Diferença</th>
            <th className="text-center font-medium px-3 py-2">Status</th>
            <th className="text-left font-medium px-3 py-2">Observação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const isTotal = l.categoria === "Total geral";
            const dvg = l.status === "Divergente";
            return (
              <tr key={i} className={`border-t border-border ${isTotal ? "bg-muted/40 font-semibold" : ""} ${dvg ? "bg-destructive/5" : ""}`}>
                <td className="px-3 py-2">{l.categoria}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.excel == null ? "—" : formatBRL(l.excel)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.pdf == null ? "—" : formatBRL(l.pdf)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${dvg ? "text-destructive font-semibold" : ""}`}>
                  {l.diferenca == null ? "—" : formatBRL(l.diferenca)}
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge status={l.status as Status} />
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{l.observacao || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EtapaServico({ linhas }: { linhas: ConferenciaServico[] }) {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left font-medium px-3 py-2">Origem</th>
            <th className="text-right font-medium px-3 py-2">Valor encontrado</th>
            <th className="text-center font-medium px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{l.origem}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.valor == null ? "—" : formatBRL(l.valor)}</td>
              <td className="px-3 py-2 text-center">
                <StatusBadge status={l.status as Status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EtapaResultado(props: {
  statusGeral: Status;
  mensagem: string;
  totalItens: number;
  ok: number;
  divergencias: number;
  alertas: number;
  divergList: string[];
}) {
  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-2">
          <StatusBadge status={props.statusGeral} />
          <span className="text-sm font-semibold">{props.mensagem}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Metric label="Itens analisados" value={props.totalItens} />
          <Metric label="OK" value={props.ok} tone="success" />
          <Metric label="Divergências" value={props.divergencias} tone="destructive" />
          <Metric label="Alertas" value={props.alertas} tone="warning" />
        </div>
      </div>
      {props.divergList.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="font-semibold text-destructive text-sm mb-2">Divergências encontradas</div>
          <ul className="list-disc ml-5 text-sm space-y-1">
            {props.divergList.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "warning" }) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-bold ${cls} mt-1`}>{value}</div>
    </div>
  );
}
