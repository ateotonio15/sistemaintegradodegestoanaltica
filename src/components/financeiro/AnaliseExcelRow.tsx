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
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatBRL,
  type AnaliseResultado,
  type ComparacaoResultado,
  type ComparacaoSimplificada,
  type CampoValidacao,
} from "@/lib/excel-analysis-utils";

type ComparacaoQualquer = ComparacaoResultado | ComparacaoSimplificada;

function isSimplificada(c: ComparacaoQualquer | null | undefined): c is ComparacaoSimplificada {
  return !!c && "beneficiarios" in c && !("enfermaria" in c);
}

interface Props {
  colSpan: number;
  isLoading: boolean;
  resultados: AnaliseResultado[] | null;
  comparacoes?: ComparacaoQualquer[] | null;
  onReanalisar?: () => void;
  onGerarHistorico?: () => void;
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

export function AnaliseExcelRow({ colSpan, isLoading, resultados, comparacoes, onReanalisar, onGerarHistorico }: Props) {
  const temResultados =
    !!resultados &&
    resultados.length > 0 &&
    resultados.some(
      (r) =>
        r.enfermaria.beneficiarios > 0 ||
        r.enfermaria.total > 0 ||
        r.apartamento.beneficiarios > 0 ||
        r.apartamento.total > 0 ||
        r.inclusoes.quantidade > 0,
    );
  return (
    <TableRow className="bg-muted/30 border-l-2 border-l-primary hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="px-6 py-4 relative">
          {!isLoading && (onReanalisar || (onGerarHistorico && temResultados)) && (
            <div className="absolute top-3 right-4 flex gap-2">
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
                  linhas.push({
                    label: "Inclusões",
                    beneficiarios: r.inclusoes.quantidade,
                    mensalidade: null,
                    total: r.inclusoes.total,
                    validacao: cmp?.inclusoes
                      ? {
                          beneficiarios: null,
                          mensalidade: null,
                          total: cmp.inclusoes.total,
                        }
                      : null,
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
                                  <td className="px-3 py-2 font-medium">{l.label}</td>
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

                    {cmpRaw && cmpRaw.divergencias.length > 0 && (
                      <Alert className="mt-3 border-destructive/50 bg-destructive/10 py-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <AlertTitle className="text-xs font-semibold text-destructive">
                          Divergências identificadas
                        </AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc ml-4 text-xs text-foreground/80 space-y-0.5 mt-1">
                            {cmpRaw.divergencias.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {cmpRaw && cmpRaw.divergencias.length === 0 && cmpRaw.arquivoPdf && (
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
    </TableRow>
  );
}
