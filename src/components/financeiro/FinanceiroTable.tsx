import { Fragment, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnexosViewerDialog } from "@/components/dashboard/AnexosViewerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Bell, Paperclip, ChevronDown, ChevronUp, History, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FinanceiroMovimentacao,
  type StatusFinanceiro,
  statusFinanceiroColor,
} from "@/lib/financeiro-utils";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { AnaliseExcelRow } from "./AnaliseExcelRow";
import type { AnaliseResultado, ComparacaoResultado } from "@/lib/excel-analysis-utils";

export type FinanceiroRow = FinanceiroMovimentacao & {
  empresa_nome: string;
  empresa_codigo: string | null;
  empresa_cnpj: string | null;
  periodo_corte: string;
  status: StatusFinanceiro;
  anexos_count: number;
  data_vencimento?: string | null;
  dia_emissao?: number | null;
  aguardando_nota_em?: string | null;
  enviado_por_nome?: string | null;
  /** Indica que existe ao menos um anexo originado de Reajuste/Cobrança Retroativa */
  retroativo?: boolean;
  /** Chave única por linha (id da movimentação + id do pagador, quando aplicável) */
  rowKey?: string;
  /** ID do pagador cadastrado (financeiro_pagadores.id) — quando a linha veio de expansão */
  pagador_id?: string | null;
  boleto_dda?: boolean | null;
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
  readOnly?: boolean;
}

const COL_COUNT = 13;

export function FinanceiroTable({
  rows,
  onEdit,
  onCobranca,
  isLoading,
  expandedRowId,
  onToggleExpand,
  onReanalisar,
  analiseResultados,
  analiseLoading,
  analiseComparacoes,
  readOnly = false,
}: Props) {
  const [anexosDialog, setAnexosDialog] = useState<{
    empresaId: string;
    empresaNome: string;
    mesReferencia: string;
    periodo: string;
  } | null>(null);


  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-center">Empresa</TableHead>
            <TableHead className="font-semibold text-center">Contrato</TableHead>
            <TableHead className="font-semibold text-center">CNPJ</TableHead>
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
                    )}
                  >
                    <TableCell className="font-medium">
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
                        {(row.status === "Nota emitida" || row.status === "Enviada") && (
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
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      {row.empresa_codigo || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      {row.empresa_cnpj || "—"}
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
                      <Badge className={cn("text-xs", statusFinanceiroColor(row.status))}>
                        {row.status}
                      </Badge>
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
      />

    </div>
  );
}
