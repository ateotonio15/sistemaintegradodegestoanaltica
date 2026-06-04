import { Fragment, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnexosViewerDialog } from "@/components/dashboard/AnexosViewerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Bell, Paperclip, ChevronDown, ChevronUp, History, Receipt, Loader2 } from "lucide-react";
import { GrupoTag } from "./GrupoTag";
import { cn } from "@/lib/utils";
import {
  type FinanceiroMovimentacao,
  type StatusFinanceiro,
  statusFinanceiroColor,
} from "@/lib/financeiro-utils";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { AnaliseExcelRow } from "./AnaliseExcelRow";
import type { AnaliseResultado, ComparacaoResultado, NotaOrfa } from "@/lib/excel-analysis-utils";

export type FinanceiroRow = FinanceiroMovimentacao & {
  empresa_nome: string;
  empresa_codigo: string | null;
  empresa_cnpj: string | null;
  empresa_vidas?: number | null;
  periodo_corte: string;
  status: StatusFinanceiro;
  anexos_count: number;
  data_vencimento?: string | null;
  dia_emissao?: number | null;
  aguardando_nota_em?: string | null;
  enviado_por_nome?: string | null;
  faturamento_iniciado_por?: string | null;
  faturamento_iniciado_por_nome?: string | null;
  faturamento_iniciado_em?: string | null;
  /** Indica que existe ao menos um anexo originado de Reajuste/Cobrança Retroativa */
  retroativo?: boolean;
  /** Chave única por linha (id da movimentação + id do pagador, quando aplicável) */
  rowKey?: string;
  /** ID do pagador cadastrado (financeiro_pagadores.id) — quando a linha veio de expansão */
  pagador_id?: string | null;
  boleto_dda?: boolean | null;
  pagamento_via_deposito?: boolean;
  grupo_nome?: string | null;
  grupo_id?: string | null;
};


export interface PagadorCadastrado {
  id: string;
  empresa_id: string;
  nome_pagador: string;
  ativo: boolean;
}

interface Props {
  rows: FinanceiroRow[];
  onEdit: (row: FinanceiroRow) => void;
  onCobranca: (row: FinanceiroRow) => void;
  isLoading: boolean;
  expandedRowId: string | null;
  onToggleExpand: (row: FinanceiroRow) => void;
  onReanalisar?: (row: FinanceiroRow) => void;
  onGerarHistorico?: (row: FinanceiroRow) => void;
  analiseResultados: Record<string, AnaliseResultado[]>;
  analiseLoading: Record<string, boolean>;
  analiseComparacoes?: Record<string, ComparacaoResultado[]>;
  analiseNotasOrfas?: Record<string, NotaOrfa[]>;
  readOnly?: boolean;
  onVisualizarGrupo?: (grupoId: string) => void;
}

const COL_COUNT = 14;

export function FinanceiroTable({
  rows,
  onEdit,
  onCobranca,
  isLoading,
  expandedRowId,
  onToggleExpand,
  onReanalisar,
  onGerarHistorico,
  analiseResultados,
  analiseLoading,
  analiseComparacoes,
  analiseNotasOrfas,
  readOnly = false,
  onVisualizarGrupo,
}: Props) {
  const [anexosDialog, setAnexosDialog] = useState<{
    empresaId: string;
    empresaNome: string;
    mesReferencia: string;
    periodo: string;
    movimentacaoId: string;
    faturamentoIniciadoEm: string | null;
    faturamentoIniciadoPorNome: string | null;
  } | null>(null);



  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-center">Empresa</TableHead>
            
            <TableHead className="font-semibold text-center">Contrato</TableHead>
            <TableHead className="font-semibold text-center">CNPJ</TableHead>
            <TableHead className="font-semibold text-center">Número de vidas</TableHead>
            <TableHead className="font-semibold text-center">Período / Corte</TableHead>
            <TableHead className="font-semibold text-center">Responsável</TableHead>
            <TableHead className="font-semibold text-center">Tipo</TableHead>
            <TableHead className="font-semibold text-center">Emissão</TableHead>
            <TableHead className="font-semibold text-center">Status</TableHead>
            <TableHead className="font-semibold text-center">Usuário</TableHead>
            <TableHead className="font-semibold text-center">Envio nota</TableHead>
            <TableHead className="font-semibold text-center">Vencimento</TableHead>
            <TableHead className="font-semibold text-center">Anexos</TableHead>
            <TableHead className="font-semibold text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COL_COUNT} className="text-center text-muted-foreground py-12">
                Carregando...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COL_COUNT} className="text-center text-muted-foreground py-12">
                Nenhuma movimentação encontrada para os filtros atuais.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isOverdue = !row.dentro_prazo && !row.data_envio_nota;
              const rowKey = row.rowKey ?? row.id;
              const isExpanded = expandedRowId === rowKey;
              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className={cn(
                      isOverdue && "bg-destructive/5 border-l-2 border-l-destructive",
                      row.status === "Em faturamento" &&
                        "bg-blue-50/70 dark:bg-blue-500/10 border-l-4 border-l-blue-500",
                    )}
                  >

                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{row.empresa_nome}</span>
                          {row.cobranca_registrada && (
                            <Badge variant="outline" className="text-warning border-warning/50 text-[10px] px-1.5 py-0 h-5">
                              <Bell className="h-2.5 w-2.5 mr-1" />
                              Cobrança
                            </Badge>
                          )}
                          {row.retroativo && (
                            <Badge variant="outline" className="text-info border-info/50 text-[10px] px-1.5 py-0 h-5">
                              <History className="h-2.5 w-2.5 mr-1" />
                              Retroativo
                            </Badge>
                          )}
                          {(row.status === "Nota emitida" || row.status === "Enviada") && !row.pagamento_via_deposito && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-5",
                                row.boleto_dda
                                  ? "text-success border-success/50"
                                  : "text-warning border-warning/50",
                              )}
                              title={row.boleto_dda ? "Boleto disponível no DDA" : "Boleto pendente"}
                            >
                              <Receipt className="h-2.5 w-2.5 mr-1" />
                              {row.boleto_dda ? "DDA OK" : "DDA"}
                            </Badge>
                          )}
                        </div>
                        {row.grupo_nome && (
                          <GrupoTag empresaId={row.empresa_id} grupoNome={row.grupo_nome} onVisualizarGrupo={onVisualizarGrupo} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      {row.empresa_codigo || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      {row.empresa_cnpj || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {row.empresa_vidas != null ? row.empresa_vidas.toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap text-center">
                      {row.periodo_corte}
                    </TableCell>
                    <TableCell className="text-sm text-center">{row.responsavel || "—"}</TableCell>
                    <TableCell className="text-sm text-center">
                      {row.tipo_cobranca || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-center">
                      {row.dia_emissao
                        ? `Emissão dia ${String(row.dia_emissao).padStart(2, "0")}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge className={cn("text-xs gap-1", statusFinanceiroColor(row.status))}>
                          {row.status === "Em faturamento" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {row.status}
                        </Badge>
                        {row.status === "Em faturamento" && row.faturamento_iniciado_por_nome && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-300 leading-tight">
                            por {row.faturamento_iniciado_por_nome}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-center">
                      {row.enviado_por_nome || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">{formatDateBR(row.data_envio_nota)}</TableCell>
                    <TableCell className="text-sm text-center" title={formatDateBR(row.data_vencimento)}>
                      {formatDay(row.data_vencimento)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-sm text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setAnexosDialog({
                            empresaId: row.empresa_id,
                            empresaNome: row.empresa_nome,
                            mesReferencia: row.mes_referencia,
                            periodo: row.periodo,
                            movimentacaoId: row.id,
                            faturamentoIniciadoEm: row.faturamento_iniciado_em ?? null,
                            faturamentoIniciadoPorNome: row.faturamento_iniciado_por_nome ?? null,
                          })
                        }

                        title="Ver anexos"
                      >
                        <Paperclip className="h-3 w-3" />
                        {row.anexos_count}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(row)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onToggleExpand(row)}
                          title="Analisar Excel"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-warning hover:text-warning"
                            onClick={() => onCobranca(row)}
                            title="Registrar cobrança"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <AnaliseExcelRow
                      colSpan={COL_COUNT}
                      isLoading={!!(analiseLoading[rowKey] || analiseLoading[row.id])}
                      resultados={analiseResultados[rowKey] ?? analiseResultados[row.id] ?? null}
                      comparacoes={analiseComparacoes?.[rowKey] ?? analiseComparacoes?.[row.id] ?? null}
                      onReanalisar={onReanalisar ? () => onReanalisar(row) : undefined}
                      onGerarHistorico={onGerarHistorico ? () => onGerarHistorico(row) : undefined}
                      contexto={{
                        empresaNome: row.empresa_nome,
                        empresaCnpj: row.empresa_cnpj,
                        competencia: row.mes_referencia,
                        periodo: row.periodo,
                        nomeExcel: (analiseResultados[rowKey] ?? analiseResultados[row.id] ?? [])[0]?.pagador ? "Excel anexado" : null,
                        temPdf: !!(analiseComparacoes?.[rowKey] ?? analiseComparacoes?.[row.id] ?? [])?.some((c: any) => c?.arquivoPdf),
                      }}
                    />
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      <AnexosViewerDialog
        open={!!anexosDialog}
        onOpenChange={(v) => !v && setAnexosDialog(null)}
        empresaId={anexosDialog?.empresaId ?? null}
        empresaNome={anexosDialog?.empresaNome ?? ""}
        mesReferencia={anexosDialog?.mesReferencia ?? ""}
        periodo={anexosDialog?.periodo ?? ""}
        movimentacaoId={anexosDialog?.movimentacaoId ?? null}
        faturamentoIniciadoEm={anexosDialog?.faturamentoIniciadoEm ?? null}
        faturamentoIniciadoPorNome={anexosDialog?.faturamentoIniciadoPorNome ?? null}

      />

    </div>
  );
}
