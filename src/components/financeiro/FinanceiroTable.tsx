import { Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Bell, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FinanceiroMovimentacao,
  type StatusFinanceiro,
  statusFinanceiroColor,
} from "@/lib/financeiro-utils";
import { formatDateBR } from "@/lib/date-utils";
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
  enviado_por_nome?: string | null;
};

interface Props {
  rows: FinanceiroRow[];
  onEdit: (row: FinanceiroRow) => void;
  onCobranca: (row: FinanceiroRow) => void;
  isLoading: boolean;
  expandedRowId: string | null;
  onToggleExpand: (row: FinanceiroRow) => void;
  analiseResultados: Record<string, AnaliseResultado[]>;
  analiseLoading: Record<string, boolean>;
}

const COL_COUNT = 12;

export function FinanceiroTable({
  rows,
  onEdit,
  onCobranca,
  isLoading,
  expandedRowId,
  onToggleExpand,
  analiseResultados,
  analiseLoading,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Empresa</TableHead>
            <TableHead className="font-semibold">Contrato</TableHead>
            <TableHead className="font-semibold">CNPJ</TableHead>
            <TableHead className="font-semibold">Período / Corte</TableHead>
            <TableHead className="font-semibold">Responsável</TableHead>
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Usuário</TableHead>
            <TableHead className="font-semibold">Envio nota</TableHead>
            <TableHead className="font-semibold">Vencimento</TableHead>
            <TableHead className="font-semibold text-center">Anexos</TableHead>
            <TableHead className="font-semibold text-right">Ações</TableHead>
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
              const isExpanded = expandedRowId === row.id;
              return (
                <Fragment key={row.id}>
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
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.empresa_codigo || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.empresa_cnpj || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {row.periodo_corte}
                    </TableCell>
                    <TableCell className="text-sm">{row.responsavel || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {row.tipo_cobranca || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", statusFinanceiroColor(row.status))}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.enviado_por_nome || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateBR(row.data_envio_nota)}</TableCell>
                    <TableCell className="text-sm">{formatDateBR(row.data_vencimento)}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {row.anexos_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(row)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-warning hover:text-warning"
                          onClick={() => onCobranca(row)}
                          title="Registrar cobrança"
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <AnaliseExcelRow
                      colSpan={COL_COUNT}
                      isLoading={!!analiseLoading[row.id]}
                      resultados={analiseResultados[row.id] ?? null}
                    />
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
