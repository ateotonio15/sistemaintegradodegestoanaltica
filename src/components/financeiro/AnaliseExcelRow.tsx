import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FileX,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Maximize2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatBRL,
  obterDivergenciasNotaFiscal,
  type AnaliseResultado,
  type ComparacaoResultado,
  type ComparacaoSimplificada,
  type CampoValidacao,
} from "@/lib/excel-analysis-utils";
import { AnaliseCompletaDialog } from "./AnaliseCompletaDialog";
import { useToast } from "@/hooks/use-toast";

type ComparacaoQualquer = ComparacaoResultado | ComparacaoSimplificada;

function isSimplificada(c: ComparacaoQualquer | null | undefined): c is ComparacaoSimplificada {
  return !!c && "beneficiarios" in c && !("enfermaria" in c);
}

export interface ContextoAnalise {
  empresaNome: string;
  empresaCnpj: string | null;
  competencia: string;
  periodo: string;
  nomeExcel: string | null;
  temPdf: boolean;
  usuarioNome?: string | null;
  tipoAnalise?: string | null;
}

interface Props {
  colSpan: number;
  isLoading: boolean;
  resultados: AnaliseResultado[] | null;
  comparacoes?: ComparacaoQualquer[] | null;
  onReanalisar?: () => void;
  onGerarHistorico?: () => void;
  onGerarHistoricoCoparticipacao?: () => void;
  contexto?: ContextoAnalise;
}

function ValorComCheck({
  text,
  validacao,
  formatPdf,
}: {
  text: string;
  validacao?: CampoValidacao | null;
  formatPdf?: (n: number) => string;
}) {
  if (!validacao) return <>{text}</>;
  // Sem PDF correspondente, não é divergência — apenas informativo neutro.
  const semPdf = validacao.pdf === null;
  const icon = validacao.ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-success inline-block ml-1" />
  ) : semPdf ? (
    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground inline-block ml-1" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-destructive inline-block ml-1" />
  );
  const tipText =
    validacao.pdf === null
      ? "Valor não encontrado no PDF"
      : `PDF: ${formatPdf ? formatPdf(validacao.pdf) : validacao.pdf}`;
  return (
    <span className={validacao.ok || semPdf ? "" : "text-destructive font-medium"}>
      {text}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{icon}</span>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-xs">{tipText}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

export function AnaliseExcelRow({ colSpan, isLoading, resultados, comparacoes, onReanalisar, onGerarHistorico, onGerarHistoricoCoparticipacao, contexto }: Props) {
  const { toast } = useToast();
  const [analiseCompletaOpen, setAnaliseCompletaOpen] = useState(false);

  const temResultados =
    !!resultados &&
    resultados.length > 0 &&
    resultados.some(
      (r) =>
        r.enfermaria.beneficiarios > 0 ||
        r.enfermaria.total > 0 ||
        r.apartamento.beneficiarios > 0 ||
        r.apartamento.total > 0 ||
        r.inclusoes.quantidade > 0 ||
        (r.inclusoes.total ?? 0) > 0 ||
        (r.exclusoes && (r.exclusoes.quantidade > 0 || r.exclusoes.total !== 0)) ||
        (r.devolucoes && (r.devolucoes.quantidade > 0 || r.devolucoes.total !== 0)) ||
        (r.taxaAdesao && ((r.taxaAdesao.quantidade ?? 0) > 0 || (r.taxaAdesao.total ?? 0) > 0)),
    );

  const temCoparticipacao =
    !!resultados && resultados.some((r) => (r.coparticipacao?.total ?? 0) > 0);

  const handleAnaliseCompleta = () => {
    if (!contexto?.nomeExcel) {
      toast({
        title: "Excel não anexado",
        description: "Não é possível realizar a análise completa. Anexe o Excel do faturamento.",
        variant: "destructive",
      });
      return;
    }
    if (!contexto.temPdf) {
      toast({
        title: "PDF da NFS-e não anexado",
        description: "Não é possível realizar a análise completa. Anexe o PDF da NFS-e.",
        variant: "destructive",
      });
      return;
    }
    setAnaliseCompletaOpen(true);
  };

  return (
    <TableRow className="bg-muted/30 border-l-2 border-l-primary hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="px-6 py-4 relative">
          {!isLoading && (onReanalisar || (onGerarHistorico && temResultados) || (onGerarHistoricoCoparticipacao && temCoparticipacao) || contexto) && (
            <div className="absolute top-3 right-4 flex gap-2">
              {contexto && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAnaliseCompleta}
                  className="h-7 gap-1.5 text-xs"
                  title="Abrir análise completa em tela cheia"
                >
                  <Maximize2 className="h-3 w-3" />
                  Análise Completa
                </Button>
              )}
              {onGerarHistorico && temResultados && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGerarHistorico}
                  className="h-7 gap-1.5 text-xs"
                  title="Gerar histórico financeiro a partir da análise"
                >
                  <FileText className="h-3 w-3" />
                  Gerar Histórico
                </Button>
              )}
              {onGerarHistoricoCoparticipacao && temCoparticipacao && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGerarHistoricoCoparticipacao}
                  className="h-7 gap-1.5 text-xs"
                  title="Gerar histórico dedicado para os valores de coparticipação"
                >
                  <FileText className="h-3 w-3" />
                  Gerar Histórico Coparticipação
                </Button>
              )}
              {onReanalisar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReanalisar}
                  className="h-7 gap-1.5 text-xs"
                  title="Forçar nova análise dos anexos (ignora cache)"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reanalisar
                </Button>
              )}
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando anexos...
            </div>
          ) : !resultados || resultados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <FileX className="h-5 w-5" />
              Nenhum Excel anexado para análise.
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((r, idx) => {
                const cmpRaw = comparacoes?.[idx] ?? null;
                const simplificada = isSimplificada(cmpRaw);
                const cmp = !simplificada ? (cmpRaw as ComparacaoResultado | null) : null;
                const cmpSimples = simplificada ? (cmpRaw as ComparacaoSimplificada) : null;
                const divergenciasPreview = Array.from(
                  new Set([
                    ...(cmpRaw?.divergencias ?? []),
                    ...(!simplificada
                      ? obterDivergenciasNotaFiscal({
                          valorLiquido: (cmpRaw as any)?.valorLiquido ?? null,
                          tributos: (cmpRaw as any)?.tributos ?? null,
                        })
                      : []),
                  ]),
                );

                const linhas: Array<{
                  label: string;
                  beneficiarios: number;
                  mensalidade: number | null;
                  total: number;
                  validacao?: {
                    beneficiarios: CampoValidacao | null;
                    mensalidade: CampoValidacao | null;
                    total: CampoValidacao;
                  } | null;
                  destaqueNegativo?: boolean;
                  mesesRetro?: string[];
                  mesesRetroDetalhe?: Array<{ mes: string; quantidade: number; total: number }>;
                }> = [];


                if (r.enfermaria.beneficiarios > 0 || r.enfermaria.total > 0) {
                  linhas.push({
                    label: "Enfermaria",
                    beneficiarios: r.enfermaria.beneficiarios,
                    mensalidade: r.enfermaria.mensalidade,
                    total: r.enfermaria.total,
                    validacao: cmp?.enfermaria ?? null,
                  });
                }
                if (r.apartamento.beneficiarios > 0 || r.apartamento.total > 0) {
                  linhas.push({
                    label: "Apartamento",
                    beneficiarios: r.apartamento.beneficiarios,
                    mensalidade: r.apartamento.mensalidade,
                    total: r.apartamento.total,
                    validacao: cmp?.apartamento ?? null,
                  });
                }
                if (r.inclusoes.quantidade > 0 || r.inclusoes.total > 0) {
                  // Subtrai retroativas (que aparecem em linha própria) para
                  // não duplicar os valores no Total Geral.
                  const retroQtd = r.retroativas?.quantidade ?? 0;
                  const retroTot = r.retroativas?.total ?? 0;
                  const incQtd = r.inclusoes.quantidade - retroQtd;
                  const incTot = r.inclusoes.total - retroTot;
                  if (incQtd > 0 || Math.abs(incTot) > 0.001) {
                    linhas.push({
                      label: "Inclusões",
                      beneficiarios: incQtd,
                      mensalidade: null,
                      total: incTot,
                      // Validação cruzada com PDF usa o total agregado (inclusoes),
                      // então só exibimos o check quando não há retroativas separadas.
                      validacao:
                        retroQtd === 0 && retroTot === 0 && cmp?.inclusoes
                          ? {
                              beneficiarios: null,
                              mensalidade: null,
                              total: cmp.inclusoes.total,
                            }
                          : null,
                    });
                  }
                }
                if (r.retroativas && (r.retroativas.quantidade > 0 || r.retroativas.total !== 0)) {
                  linhas.push({
                    label: "Cobrança Retroativa",
                    beneficiarios: r.retroativas.quantidade,
                    mensalidade: null,
                    total: r.retroativas.total,
                    mesesRetro: r.retroativas.meses,
                    mesesRetroDetalhe: r.retroativas.mesesDetalhe,
                  });
                }


                if (r.exclusoes && (r.exclusoes.quantidade > 0 || r.exclusoes.total !== 0)) {
                  linhas.push({
                    label: "Exclusões",
                    beneficiarios: r.exclusoes.quantidade,
                    mensalidade: null,
                    total: r.exclusoes.total,
                    destaqueNegativo: true,
                  });
                }
                if (r.devolucoes && (r.devolucoes.quantidade > 0 || r.devolucoes.total !== 0)) {
                  linhas.push({
                    label: "Devolução",
                    beneficiarios: r.devolucoes.quantidade,
                    mensalidade: null,
                    total: r.devolucoes.total,
                    destaqueNegativo: true,
                  });
                }
                if (r.taxaAdesao && (r.taxaAdesao.quantidade > 0 || r.taxaAdesao.total !== 0)) {
                  const qtd = r.taxaAdesao.quantidade;
                  const tot = r.taxaAdesao.total;
                  linhas.push({
                    label: "Taxa de Adesão",
                    beneficiarios: qtd,
                    mensalidade: qtd > 0 ? tot / qtd : null,
                    total: tot,
                  });
                }



                const totalGeral = linhas.reduce((s, l) => s + l.total, 0);

                return (
                  <div
                    key={`${r.pagador}-${idx}`}
                    className={idx > 0 ? "pt-4 border-t border-border" : ""}
                  >
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-info" />
                        <span className="text-sm font-semibold text-foreground">
                          Pagador: <span className="font-normal">{r.pagador}</span>
                        </span>
                      </div>
                      {cmpRaw?.arquivoPdf && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          Validado contra: <span className="font-medium">{cmpRaw.arquivoPdf}</span>
                          {simplificada && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-warning/20 text-warning text-[10px] font-semibold">
                              Validação simplificada (Moto Honda)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {r.avisos.length > 0 && (
                      <Alert className="mb-3 border-warning/50 bg-warning/10 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        <AlertDescription className="text-xs text-foreground/80">
                          {r.avisos.map((a, i) => (
                            <div key={i}>{a}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}

                    {linhas.length === 0 ? (
                      <div className="rounded-lg border border-border bg-card px-3 py-4 text-sm text-muted-foreground text-center">
                        Nenhuma categoria identificada nesta planilha.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left font-medium text-muted-foreground px-3 py-2">
                                Categoria
                              </th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">
                                Beneficiários
                              </th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">
                                Mensalidade
                              </th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {linhas.map((l) => {
                              return (
                                <tr key={l.label} className="border-t border-border">
                                  <td className="px-3 py-2 font-medium">
                                    <span className="inline-flex items-center gap-2">
                                      {l.label}
                                      {l.mesesRetro && l.mesesRetro.length > 0 && (() => {
                                        const detalhe = (l.mesesRetroDetalhe && l.mesesRetroDetalhe.length > 0)
                                          ? l.mesesRetroDetalhe
                                          : l.mesesRetro!.map((m) => ({ mes: m, quantidade: 0, total: 0 }));
                                        const somaDet = detalhe.reduce((s, d) => s + d.total, 0);
                                        return (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-100/60 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 hover:bg-amber-200/70 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                                aria-label="Ver detalhes de cobrança retroativa"
                                              >
                                                <span aria-hidden>↩</span>
                                                {detalhe.length} {detalhe.length === 1 ? "mês" : "meses"}
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent side="top" align="start" className="w-72 p-0">
                                              <div className="px-3 py-2 border-b border-border bg-muted/40">
                                                <div className="text-xs font-semibold text-foreground">Cobrança retroativa por mês</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                  {detalhe.length} {detalhe.length === 1 ? "competência" : "competências"} identificadas
                                                </div>
                                              </div>
                                              <div className="max-h-56 overflow-auto">
                                                <table className="w-full text-xs">
                                                  <thead className="bg-muted/30">
                                                    <tr>
                                                      <th className="text-left font-medium text-muted-foreground px-3 py-1.5">Mês</th>
                                                      <th className="text-right font-medium text-muted-foreground px-3 py-1.5">Valor</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {detalhe
                                                      .slice()
                                                      .sort((a, b) => a.mes.localeCompare(b.mes))
                                                      .map((d) => (
                                                        <tr key={d.mes} className="border-t border-border/60">
                                                          <td className="px-3 py-1.5 font-medium">{d.mes}</td>
                                                          <td className="px-3 py-1.5 text-right tabular-nums">
                                                            {d.total ? formatBRL(d.total) : <span className="text-muted-foreground">—</span>}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                  </tbody>
                                                  {somaDet > 0 && (
                                                    <tfoot>
                                                      <tr className="border-t border-border bg-muted/30">
                                                        <td className="px-3 py-1.5 font-semibold">Total</td>
                                                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatBRL(somaDet)}</td>
                                                      </tr>
                                                    </tfoot>
                                                  )}
                                                </table>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        );
                                      })()}

                                    </span>
                                  </td>

                                  <td className="px-3 py-2 text-right">
                                    <ValorComCheck
                                      text={String(l.beneficiarios)}
                                      validacao={l.validacao?.beneficiarios}
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {l.mensalidade === null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <ValorComCheck
                                        text={formatBRL(l.mensalidade)}
                                        validacao={l.validacao?.mensalidade}
                                        formatPdf={formatBRL}
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold">
                                    <ValorComCheck
                                      text={formatBRL(l.total)}
                                      validacao={l.validacao?.total}
                                      formatPdf={formatBRL}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border bg-muted/40">
                              <td
                                className="px-3 py-2 font-semibold text-foreground"
                                colSpan={3}
                              >
                                Total Geral
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-primary">
                                {formatBRL(totalGeral)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {contexto?.tipoAnalise === "faixa_etaria" && r.faixasEtarias && r.faixasEtarias.length > 0 && (
                      <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
                        <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Detalhamento por Faixa Etária
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="text-left font-medium text-muted-foreground px-3 py-2">Faixa</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Beneficiários</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Mensalidade Média</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.faixasEtarias.map((f) => {
                              const media = f.quantidade > 0 ? f.total / f.quantidade : 0;
                              return (
                                <tr key={f.label} className="border-t border-border">
                                  <td className="px-3 py-2 font-medium">{f.label}</td>
                                  <td className="px-3 py-2 text-right">{f.quantidade}</td>
                                  <td className="px-3 py-2 text-right">{formatBRL(media)}</td>
                                  <td className="px-3 py-2 text-right font-semibold">{formatBRL(f.total)}</td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border bg-muted/40">
                              <td className="px-3 py-2 font-semibold">Total</td>
                              <td className="px-3 py-2 text-right font-bold">
                                {r.faixasEtarias.reduce((s, f) => s + f.quantidade, 0)}
                              </td>
                              <td className="px-3 py-2 text-right">—</td>
                              <td className="px-3 py-2 text-right font-bold text-primary">
                                {formatBRL(r.faixasEtarias.reduce((s, f) => s + f.total, 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {r.coparticipacao && (r.coparticipacao.quantidade !== 0 || r.coparticipacao.total !== 0) && (
                      <div className="mt-3 rounded-lg border border-emerald-300/50 dark:border-emerald-700/40 bg-card overflow-hidden">
                        <div className="bg-emerald-100/60 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                          Coparticipação — Empresarial
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="text-left font-medium text-muted-foreground px-3 py-2">Categoria</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Beneficiários</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(r.coparticipacao.substipulantes && r.coparticipacao.substipulantes.length > 0
                              ? r.coparticipacao.substipulantes
                              : [{ nome: "Coparticipação", quantidade: r.coparticipacao.quantidade, total: r.coparticipacao.total }]
                            ).map((s, i) => (
                              <tr key={`${s.nome}-${i}`} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{s.nome}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.quantidade}</td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBRL(s.total)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-border bg-muted/40">
                              <td className="px-3 py-2 font-semibold">Total Geral</td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums">{r.coparticipacao.quantidade}</td>
                              <td className="px-3 py-2 text-right font-bold text-primary tabular-nums">{formatBRL(r.coparticipacao.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {cmpSimples && (
                      <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left font-medium text-muted-foreground px-3 py-2">Validação simplificada</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">Excel</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">PDF</th>
                              <th className="text-right font-medium text-muted-foreground px-3 py-2">OK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: "Total beneficiários", c: cmpSimples.beneficiarios, money: false },
                              { label: "Inclusões (valor)", c: cmpSimples.inclusoes, money: true },
                              { label: "Exclusões (valor)", c: cmpSimples.exclusoes, money: true },
                            ].filter((x) => x.c).map((x) => (
                              <tr key={x.label} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{x.label}</td>
                                <td className="px-3 py-2 text-right">{x.money ? formatBRL(x.c!.excel) : x.c!.excel}</td>
                                <td className="px-3 py-2 text-right">
                                  {x.c!.pdf === null ? "—" : x.money ? formatBRL(x.c!.pdf) : x.c!.pdf}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {x.c!.ok ? <CheckCircle2 className="h-4 w-4 text-success inline" /> : <XCircle className="h-4 w-4 text-destructive inline" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {cmpRaw && divergenciasPreview.length > 0 && (
                      <Alert className="mt-3 border-destructive/50 bg-destructive/10 py-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <AlertTitle className="text-xs font-semibold text-destructive">
                          Divergências identificadas
                        </AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc ml-4 text-xs text-foreground/80 space-y-0.5 mt-1">
                            {divergenciasPreview.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {cmpRaw && divergenciasPreview.length === 0 && cmpRaw.arquivoPdf && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Todos os valores conferem com o PDF.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TableCell>
      {contexto && (
        <AnaliseCompletaDialog
          open={analiseCompletaOpen}
          onOpenChange={setAnaliseCompletaOpen}
          empresaNome={contexto.empresaNome}
          empresaCnpj={contexto.empresaCnpj}
          competencia={contexto.competencia}
          periodo={contexto.periodo}
          isLoading={isLoading}
          resultados={resultados}
          comparacoes={comparacoes ?? null}
          nomeExcel={contexto.nomeExcel}
          onReanalisar={onReanalisar}
          onGerarHistorico={onGerarHistorico}
          usuarioNome={contexto.usuarioNome ?? null}
        />
      )}
    </TableRow>
  );
}
