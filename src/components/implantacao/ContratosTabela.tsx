import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GitBranch } from "lucide-react";
import { setorLabel, statusBadge, statusLabel } from "@/lib/contrato-processo";
import { RISCO_BADGE, RISCO_DOT, RISCO_LABEL } from "@/lib/contrato-risco";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import type { LinhaContrato } from "@/components/implantacao/ContratosFiltros";

interface Props {
  linhas: LinhaContrato[];
  onOpen: (id: string) => void;
  onFluxo: (item: any) => void;
}

export function ContratosTabela({ linhas, onOpen, onFluxo }: Props) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">ID</th>
                <th className="text-left font-medium px-3 py-2">Empresa</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">CNPJ</th>
                <th className="text-left font-medium px-3 py-2">Contratado</th>
                <th className="text-left font-medium px-3 py-2">Vínculo</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Setor</th>
                <th className="text-left font-medium px-3 py-2">Responsável</th>
                <th className="text-center font-medium px-3 py-2">Pend.</th>
                <th className="text-center font-medium px-3 py-2">Diverg.</th>
                <th className="text-left font-medium px-3 py-2">Risco</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Vigência</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Implantação</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Últ. mov.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum contrato encontrado com esses filtros.
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <tr
                    key={l.implantacao.id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => onOpen(l.implantacao.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{l.codigo}</td>
                    <td className="px-3 py-2 font-medium max-w-[15rem] truncate" title={l.empresa}>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${RISCO_DOT[l.risco]}`} />
                        {l.empresa}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{l.cnpj}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[12rem] truncate" title={l.contratado}>
                      {l.contratado}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[10rem] truncate" title={l.tipoVinculo}>
                      {l.tipoVinculo}
                    </td>
                    <td className="px-3 py-2">
                      {l.status ? (
                        <Badge variant="outline" className={`${statusBadge(l.status)} whitespace-nowrap`}>
                          {statusLabel(l.status)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.setor ? setorLabel(l.setor) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[10rem] truncate" title={l.responsavel}>
                      {l.responsavel}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.panorama.pendenciasAbertas > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                                {l.panorama.pendenciasAbertas}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                {l.panorama.titulosPendencia.join(" · ") || "Pendências em aberto"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.panorama.divergencias > 0 ? (
                        <Badge
                          variant="outline"
                          className={
                            l.panorama.divergenciasCriticas > 0
                              ? "bg-red-500/15 text-red-600 border-red-500/30"
                              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          }
                        >
                          {l.panorama.divergencias}
                          {l.panorama.divergenciasCriticas > 0 ? " crít." : ""}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`${RISCO_BADGE[l.risco]} whitespace-nowrap`}>
                        {RISCO_LABEL[l.risco]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.vigencia ? formatDateBR(l.vigencia) : "—"}
                      {l.implantacao.data_vencimento ? (
                        <span className="text-xs"> · venc. {formatDay(l.implantacao.data_vencimento)}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.dataImplantacao ? formatDateBR(l.dataImplantacao) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.ultimaMovimentacao ? formatDateBR(l.ultimaMovimentacao) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onFluxo(l.implantacao); }}
                        title="Fluxo entre setores"
                      >
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Regular / aprovado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Pendência / revisar</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Divergência crítica / reprovado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Aguardando análise</span>
      </div>
    </div>
  );
}
