import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
  labelStatusFinanceiro,
} from "@/lib/financeiro-utils";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { AnaliseExcelRow } from "./AnaliseExcelRow";
import type { AnaliseResultado, ComparacaoResultado, NotaOrfa } from "@/lib/excel-analysis-utils";
import { PrioridadeBadge } from "@/components/prioridade/PrioridadeBadge";
import { useOrbitEnvios, useOrbitEnviosRefresh, orbitEnvioKey } from "@/hooks/useOrbitEnvios";
import { Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  prioridade_maxima?: boolean;
  prioridade_intensa?: boolean;
  nao_reajustado?: boolean;
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
  onGerarHistoricoCoparticipacao?: (row: FinanceiroRow) => void;
  onGerarHistoricoComplemento?: (row: FinanceiroRow) => void;
  analiseResultados: Record<string, AnaliseResultado[]>;
  analiseLoading: Record<string, boolean>;
  analiseComparacoes?: Record<string, ComparacaoResultado[]>;
  analiseNotasOrfas?: Record<string, NotaOrfa[]>;
  readOnly?: boolean;
  onVisualizarGrupo?: (grupoId: string) => void;
}

const COL_COUNT = 14;

/**
 * Barra de rolagem horizontal espelhada, fixa no pé da tela (sticky).
 * Clique ou arraste o pino para mover a tabela para o lado sem precisar
 * descer até o fim dela. Espelha o scrollLeft do container em ambos os sentidos.
 */
function StickyHorizontalScrollbar({ getTarget }: { getTarget: () => HTMLElement | null }) {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!bar || !thumb) return;
    const target = getTarget();
    if (!target) return;

    const PAD = 8;
    const metrics = () => {
      const trackW = Math.max(0, bar.clientWidth - PAD * 2);
      const overflow = Math.max(1, target.scrollWidth - target.clientWidth);
      const ratio = Math.min(1, target.clientWidth / Math.max(1, target.scrollWidth));
      const thumbW = Math.max(36, trackW * ratio);
      return { trackW, overflow, thumbW };
    };

    const update = () => {
      const semOverflow = target.scrollWidth <= target.clientWidth + 2;
      bar.style.display = semOverflow ? "none" : "block";
      if (semOverflow) return;
      const { trackW, overflow, thumbW } = metrics();
      const maxScroll = overflow;
      const x = (target.scrollLeft / maxScroll) * (trackW - thumbW);
      thumb.style.width = `${thumbW}px`;
      thumb.style.transform = `translateX(${Math.max(0, x)}px)`;
    };

    let raf = 0;
    const onTargetScroll = () => {
      if (draggingRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      const rect = bar.getBoundingClientRect();
      const { trackW, overflow, thumbW } = metrics();
      const thumbRect = thumb.getBoundingClientRect();
      const onThumb = e.clientX >= thumbRect.left && e.clientX <= thumbRect.right;
      const grab = onThumb ? e.clientX - thumbRect.left : thumbW / 2;
      const setFromX = (clientX: number) => {
        const x = Math.max(0, Math.min(trackW - thumbW, clientX - rect.left - PAD - grab));
        thumb.style.transform = `translateX(${x}px)`;
        pendingScroll = (x / Math.max(1, trackW - thumbW)) * overflow;
        if (!moveRaf) moveRaf = requestAnimationFrame(() => {
          moveRaf = 0;
          target.scrollLeft = pendingScroll;
        });
      };
      let pendingScroll = target.scrollLeft;
      let moveRaf = 0;
      setFromX(e.clientX);
      const onMove = (ev: PointerEvent) => setFromX(ev.clientX);
      const onUp = () => {
        draggingRef.current = false;
        update();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };

    update();
    target.addEventListener("scroll", onTargetScroll, { passive: true });
    bar.addEventListener("pointerdown", onPointerDown);

    const ro = new ResizeObserver(update);
    ro.observe(target);
    const table = target.querySelector("table");
    if (table) ro.observe(table);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("scroll", onTargetScroll);
      bar.removeEventListener("pointerdown", onPointerDown);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [getTarget]);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="sticky bottom-0 z-20 h-5 px-2 bg-card border-t border-border/60 cursor-pointer touch-none select-none"
    >
      <div className="relative top-0.5 h-2 rounded-full bg-muted/80">
        <div
          ref={thumbRef}
          className="absolute inset-y-0 left-0 rounded-full bg-primary/70 hover:bg-primary will-change-transform"
          style={{ width: 36 }}
        />
      </div>
    </div>
  );
}

export function FinanceiroTable({
  rows,
  onEdit,
  onCobranca,
  isLoading,
  expandedRowId,
  onToggleExpand,
  onReanalisar,
  onGerarHistorico,
  onGerarHistoricoCoparticipacao,
  onGerarHistoricoComplemento,
  analiseResultados,
  analiseLoading,
  analiseComparacoes,
  analiseNotasOrfas,
  readOnly = false,
  onVisualizarGrupo,
}: Props) {
  const navigate = useNavigate();
  const abrirEditarEmpresa = (empresaId?: string | null) => {
    if (!empresaId || readOnly) return;
    navigate(`/empresas?editar=${empresaId}`);
  };
  const [anexosDialog, setAnexosDialog] = useState<{
    empresaId: string;
    empresaNome: string;
    mesReferencia: string;
    periodo: string;
    movimentacaoId: string;
    faturamentoIniciadoEm: string | null;
    faturamentoIniciadoPorNome: string | null;
    faturamentoIniciadoPorId: string | null;
    permitirAnexosContrato: boolean;
  } | null>(null);

  // Empresas/competências que possuem linha de "Primeira mensalidade":
  // nesses casos os anexos de implantação (Contrato) aparecem SÓ nessa linha.
  const empresasComPrimeiraMensalidade = new Set(
    rows
      .filter((r: any) => r.tipo_lancamento === "primeira_mensalidade")
      .map((r: any) => `${r.empresa_id}|${r.mes_referencia}`),
  );

  const { data: orbitMap } = useOrbitEnvios();
  useOrbitEnviosRefresh();





  const tableCardRef = useRef<HTMLDivElement>(null);
  const getScrollTarget = useCallback(
    () => (tableCardRef.current?.firstElementChild as HTMLElement | null) ?? null,
    [],
  );

  return (
    <>
      <div ref={tableCardRef} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
        <TableHeader>
          <TableRow className="bg-accent/20 hover:bg-accent/20">
            <TableHead className="font-semibold">Empresa</TableHead>
            
            <TableHead className="font-semibold">Contrato</TableHead>
            <TableHead className="font-semibold">CNPJ</TableHead>
            <TableHead className="font-semibold">Número de vidas</TableHead>
            <TableHead className="font-semibold">PERÍODO DE MOVIMENTAÇÃO</TableHead>
            <TableHead className="font-semibold">Responsável</TableHead>
            <TableHead className="font-semibold">TIPO DE MOVIMENTAÇÃO</TableHead>
            <TableHead className="font-semibold">Emissão</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Usuário</TableHead>
            <TableHead className="font-semibold">Envio nota</TableHead>
            <TableHead className="font-semibold">Vencimento</TableHead>
            <TableHead className="font-semibold">Anexos</TableHead>
            <TableHead className="font-semibold">Ações</TableHead>
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
              const orbitComp = String(row.mes_referencia ?? "").slice(0, 7);
              const orbit =
                orbitMap?.get(orbitEnvioKey(orbitComp, row.empresa_nome, row.empresa_codigo)) ??
                orbitMap?.get(orbitEnvioKey(orbitComp, row.empresa_nome, null));
              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className={cn(
                      isOverdue && "bg-destructive/5 border-l-2 border-l-destructive",
                      row.status === "Em faturamento" &&
                        "bg-blue-50/70 dark:bg-blue-500/10 border-l-4 border-l-blue-500",
                      row.nao_reajustado &&
                        "!bg-stone-200/60 hover:!bg-stone-200/80 dark:!bg-stone-100/10 dark:hover:!bg-stone-100/15 border-l-[3px] !border-l-stone-500 dark:!border-l-stone-300",
                    )}
                  >

                    <TableCell
                      className={cn("font-medium", !readOnly && "cursor-pointer select-none")}
                      onDoubleClick={() => abrirEditarEmpresa(row.empresa_id)}
                      title={!readOnly ? "Clique duas vezes para editar a empresa" : undefined}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-start gap-1">
                            {row.prioridade_maxima && <PrioridadeBadge variant="compact" intense={!!row.prioridade_intensa} />}
                            {row.nao_reajustado && (
                              <span
                                title="Empresa com 'Não reajustado' ativo"
                                className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-stone-400/60 bg-stone-200 text-stone-700 dark:bg-stone-100/15 dark:text-stone-300 dark:border-stone-400/40"
                              >
                                NÃO REAJUSTA.
                              </span>
                            )}
                          </div>
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
                          {(row as any).tipo_lancamento === "primeira_mensalidade" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/50 text-primary">
                              Primeira Mensalidade
                            </Badge>
                          )}
                          {((row as any).tipo_lancamento === "normal" || !(row as any).tipo_lancamento) &&
                            empresasComPrimeiraMensalidade.has(`${row.empresa_id}|${row.mes_referencia}`) && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-info/50 text-info">
                                Primeira Movimentação
                              </Badge>
                            )}
                          {(row as any).tipo_lancamento === "fechamento_periodo" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-info/50 text-info">
                              Fechamento do Período
                            </Badge>
                          )}
                        </div>
                        {(row.grupo_nome || orbit) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.grupo_nome && (
                              <GrupoTag empresaId={row.empresa_id} grupoNome={row.grupo_nome} onVisualizarGrupo={onVisualizarGrupo} />
                            )}
                            {orbit && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-primary/90 w-fit"
                                title={`Enviado ao Orbit para ${orbit.orbit_user} em ${formatDateBR(orbit.enviado_em)}`}
                              >
                                <Send className="h-2.5 w-2.5" />
                                <span className="font-medium">Orbit:</span>
                                <span className="truncate max-w-[140px]">{orbit.orbit_user}</span>
                              </span>
                            )}
                          </div>
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
                          {labelStatusFinanceiro(row.status)}
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
                            faturamentoIniciadoPorId: row.faturamento_iniciado_por ?? null,
                            permitirAnexosContrato:
                              (row as any).tipo_lancamento === "primeira_mensalidade" ||
                              !empresasComPrimeiraMensalidade.has(
                                `${row.empresa_id}|${row.mes_referencia}`,
                              ),
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
                      onGerarHistoricoCoparticipacao={onGerarHistoricoCoparticipacao ? () => onGerarHistoricoCoparticipacao(row) : undefined}
                      onGerarHistoricoComplemento={onGerarHistoricoComplemento ? () => onGerarHistoricoComplemento(row) : undefined}
                      contexto={{
                        empresaNome: row.empresa_nome,
                        empresaCnpj: row.empresa_cnpj,
                        competencia: row.mes_referencia,
                        periodo: row.periodo,
                        nomeExcel: (analiseResultados[rowKey] ?? analiseResultados[row.id] ?? [])[0]?.pagador ? "Excel anexado" : null,
                        temPdf: !!(analiseComparacoes?.[rowKey] ?? analiseComparacoes?.[row.id] ?? [])?.some((c: any) => c?.arquivoPdf),
                        tipoAnalise: (row as any).tipo_analise ?? "normal",
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
        faturamentoIniciadoPorId={anexosDialog?.faturamentoIniciadoPorId ?? null}
        permitirAnexosContrato={anexosDialog?.permitirAnexosContrato ?? true}

      />

      </div>
      <StickyHorizontalScrollbar getTarget={getScrollTarget} />
    </>
  );
}
