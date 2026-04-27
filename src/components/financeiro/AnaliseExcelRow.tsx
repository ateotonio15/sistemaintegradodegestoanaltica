import { TableCell, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileX, Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { formatBRL, type AnaliseResultado } from "@/lib/excel-analysis-utils";

interface Props {
  colSpan: number;
  isLoading: boolean;
  resultados: AnaliseResultado[] | null;
}

export function AnaliseExcelRow({ colSpan, isLoading, resultados }: Props) {
  return (
    <TableRow className="bg-muted/30 border-l-2 border-l-primary hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando planilha(s)...
            </div>
          ) : !resultados || resultados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <FileX className="h-5 w-5" />
              Nenhum Excel anexado para análise.
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((r, idx) => (
                <div
                  key={`${r.pagador}-${idx}`}
                  className={idx > 0 ? "pt-4 border-t border-border" : ""}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="h-4 w-4 text-info" />
                    <span className="text-sm font-semibold text-foreground">
                      Pagador: <span className="font-normal">{r.pagador}</span>
                    </span>
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

                  {(() => {
                    const linhas: Array<{
                      label: string;
                      beneficiarios: number;
                      mensalidade: number | null;
                      total: number;
                    }> = [];

                    if (r.enfermaria.beneficiarios > 0 || r.enfermaria.total > 0) {
                      linhas.push({
                        label: "Enfermaria",
                        beneficiarios: r.enfermaria.beneficiarios,
                        mensalidade: r.enfermaria.mensalidade,
                        total: r.enfermaria.total,
                      });
                    }
                    if (r.apartamento.beneficiarios > 0 || r.apartamento.total > 0) {
                      linhas.push({
                        label: "Apartamento",
                        beneficiarios: r.apartamento.beneficiarios,
                        mensalidade: r.apartamento.mensalidade,
                        total: r.apartamento.total,
                      });
                    }
                    if (r.inclusoes.quantidade > 0 || r.inclusoes.total > 0) {
                      linhas.push({
                        label: "Inclusões",
                        beneficiarios: r.inclusoes.quantidade,
                        mensalidade: null,
                        total: r.inclusoes.total,
                      });
                    }

                    if (linhas.length === 0) {
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-4 text-sm text-muted-foreground text-center">
                          Nenhuma categoria identificada nesta planilha.
                        </div>
                      );
                    }

                    const totalGeral = linhas.reduce((s, l) => s + l.total, 0);

                    return (
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
                            {linhas.map((l) => (
                              <tr key={l.label} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{l.label}</td>
                                <td className="px-3 py-2 text-right">{l.beneficiarios}</td>
                                <td className="px-3 py-2 text-right">
                                  {l.mensalidade === null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    formatBRL(l.mensalidade)
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold">
                                  {formatBRL(l.total)}
                                </td>
                              </tr>
                            ))}
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
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
