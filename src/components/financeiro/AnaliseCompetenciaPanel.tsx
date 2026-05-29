import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Play, Download, Search, Trash2, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  executarAnaliseCompetencia,
  listarExecucoes,
  listarItensExecucao,
  deletarExecucao,
  exportarExecucaoExcel,
  type ExecucaoLoteRow,
  type ItemLoteRow,
  type StatusItem,
} from "@/lib/financeiro-analise-lote";
import { PERIODOS_FIN, getMesesOptions, formatMesReferencia } from "@/lib/financeiro-utils";
import { formatBRL } from "@/lib/excel-analysis-utils";
import { AnaliseCompetenciaItemDialog } from "./AnaliseCompetenciaItemDialog";

interface Props {
  mesInicial: string;
  canExecute: boolean;
  canDelete: boolean;
}

function statusBadgeClass(s: StatusItem): string {
  if (s === "OK") return "bg-success/15 text-success border border-success/30";
  if (s === "Divergente" || s === "Erro ao ler Excel" || s === "Erro ao ler PDF")
    return "bg-destructive/15 text-destructive border border-destructive/30";
  return "bg-warning/15 text-warning border border-warning/30";
}

const STATUS_FILTROS: ("Todos" | StatusItem)[] = [
  "Todos", "OK", "Divergente", "Sem Excel", "Sem PDF", "Sem Excel e sem PDF",
  "Erro ao ler Excel", "Erro ao ler PDF", "Contrato sem movimentação", "Aguardando faturamento",
];

export function AnaliseCompetenciaPanel({ mesInicial, canExecute, canDelete }: Props) {
  const meses = useMemo(() => getMesesOptions(), []);
  const [mes, setMes] = useState(mesInicial);
  const [periodo, setPeriodo] = useState<string>(PERIODOS_FIN[0]);
  const [running, setRunning] = useState(false);
  const [progresso, setProgresso] = useState<{ done: number; total: number; current?: string } | null>(null);

  const [execucoes, setExecucoes] = useState<ExecucaoLoteRow[]>([]);
  const [execAtual, setExecAtual] = useState<ExecucaoLoteRow | null>(null);
  const [itens, setItens] = useState<ItemLoteRow[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"Todos" | StatusItem>("Todos");
  const [detalhe, setDetalhe] = useState<ItemLoteRow | null>(null);

  async function recarregarExecucoes(selecionarPrimeira = false) {
    const rows = await listarExecucoes({ limit: 50 });
    setExecucoes(rows);
    if (selecionarPrimeira && rows.length > 0) {
      setExecAtual(rows[0]);
    }
  }

  useEffect(() => { recarregarExecucoes(); }, []);

  useEffect(() => {
    if (!execAtual) { setItens([]); return; }
    setLoadingItens(true);
    listarItensExecucao(execAtual.id)
      .then(setItens)
      .finally(() => setLoadingItens(false));
  }, [execAtual?.id]);

  async function rodar() {
    if (running) return;
    setRunning(true);
    setProgresso({ done: 0, total: 0 });
    try {
      const res = await executarAnaliseCompetencia(mes, periodo, (p) => setProgresso(p));
      if (res) {
        toast.success(`Análise concluída: ${res.total} contratos.`);
        await recarregarExecucoes();
        setExecAtual(res);
      } else {
        toast.error("Falha ao executar análise.");
      }
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setRunning(false);
      setProgresso(null);
    }
  }

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (filtroStatus !== "Todos" && i.status !== filtroStatus) return false;
      if (!q) return true;
      const hay = `${i.empresa_nome || ""} ${i.empresa_cnpj || ""} ${i.empresa_codigo || ""} ${i.pagador_nome || ""} ${i.pagador_cnpj || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [itens, busca, filtroStatus]);

  const pct = (n: number) => execAtual && execAtual.total > 0 ? Math.round((n / execAtual.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Filtros + ação */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <div className="text-base font-semibold">Análise por Competência</div>
            <div className="text-xs text-muted-foreground">
              Selecione a competência e o período para analisar todos os contratos vinculados e
              identificar divergências, pendências documentais ou erros de leitura.
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Competência</label>
              <Select value={mes} onValueChange={setMes} disabled={running}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={periodo} onValueChange={setPeriodo} disabled={running}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODOS_FIN.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={rodar} disabled={running || !canExecute} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Analisar competência
            </Button>

            <div className="ml-auto flex items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Histórico de execuções</label>
                <Select
                  value={execAtual?.id || ""}
                  onValueChange={(id) => setExecAtual(execucoes.find((e) => e.id === id) || null)}
                >
                  <SelectTrigger className="w-[360px]"><SelectValue placeholder="Selecione uma execução" /></SelectTrigger>
                  <SelectContent>
                    {execucoes.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatMesReferencia(e.mes_referencia)} · {e.periodo} · {new Date(e.iniciada_em).toLocaleString("pt-BR")} · {e.executado_por_nome || "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={() => recarregarExecucoes()} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canDelete && execAtual && (
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  title="Excluir execução"
                  onClick={async () => {
                    if (!confirm("Excluir esta execução do histórico?")) return;
                    const ok = await deletarExecucao(execAtual.id);
                    if (ok) {
                      toast.success("Execução removida.");
                      setExecAtual(null);
                      recarregarExecucoes();
                    } else toast.error("Falha ao remover.");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                disabled={!execAtual || itens.length === 0}
                onClick={() => execAtual && exportarExecucaoExcel(execAtual, itens)}
              >
                <Download className="h-4 w-4" /> Exportar Excel
              </Button>
            </div>
          </div>

          {running && progresso && (
            <div className="space-y-1">
              <Progress value={progresso.total ? (progresso.done / progresso.total) * 100 : 0} />
              <div className="text-xs text-muted-foreground">
                {progresso.done}/{progresso.total} · {progresso.current || ""}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      {execAtual && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Kpi label="Total" value={execAtual.total} />
          <Kpi label="OK" value={execAtual.ok} accent="success" suffix={`${pct(execAtual.ok)}%`} />
          <Kpi label="Divergentes" value={execAtual.divergentes} accent="destructive" />
          <Kpi label="Sem Excel" value={execAtual.sem_excel} accent="warning" />
          <Kpi label="Sem PDF" value={execAtual.sem_pdf} accent="warning" />
          <Kpi label="Sem ambos" value={execAtual.sem_ambos} accent="warning" />
          <Kpi label="Erros de leitura" value={execAtual.erro_leitura} accent="destructive" />
          <Kpi label="Aguardando fat." value={execAtual.aguardando_faturamento} accent="warning" />
          <Kpi label="Sem movimentação" value={execAtual.sem_movimentacao} accent="warning" />
          <Kpi label="Valor analisado" value={formatBRL(Number(execAtual.valor_total_analisado || 0))} />
        </div>
      )}

      {/* Tabela */}
      {execAtual && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, contrato, pagador..." className="pl-8" />
              </div>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTROS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-border overflow-auto max-h-[55vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Excel</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                    <TableHead className="text-right">Valor Excel</TableHead>
                    <TableHead className="text-right">Valor NF</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Próxima ação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingItens ? (
                    <TableRow><TableCell colSpan={13} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />Carregando...</TableCell></TableRow>
                  ) : itensFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={13} className="text-center py-6 text-muted-foreground">Nenhum item.</TableCell></TableRow>
                  ) : itensFiltrados.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.empresa_nome}</TableCell>
                      <TableCell className="text-xs">{i.empresa_cnpj || "—"}</TableCell>
                      <TableCell>{i.empresa_codigo || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {i.pagador_nome || "—"}
                        {i.pagador_cnpj && <span className="block text-xs text-muted-foreground">{i.pagador_cnpj}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{i.periodo}</TableCell>
                      <TableCell><Badge className={statusBadgeClass(i.status)}>{i.status}</Badge></TableCell>
                      <TableCell className="text-center text-xs">{i.excel_encontrado ? "Sim" : "—"}</TableCell>
                      <TableCell className="text-center text-xs">{i.pdf_encontrado ? "Sim" : "—"}</TableCell>
                      <TableCell className="text-right text-sm">{i.valor_excel == null ? "—" : formatBRL(i.valor_excel)}</TableCell>
                      <TableCell className="text-right text-sm">{i.valor_pdf == null ? "—" : formatBRL(i.valor_pdf)}</TableCell>
                      <TableCell className={`text-right text-sm ${i.diferenca && Math.abs(i.diferenca) > 0.01 ? "text-destructive font-semibold" : ""}`}>
                        {i.diferenca == null ? "—" : formatBRL(i.diferenca)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.proxima_acao}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDetalhe(i)}>
                          <Eye className="h-3.5 w-3.5" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AnaliseCompetenciaItemDialog
        open={!!detalhe}
        onOpenChange={(v) => !v && setDetalhe(null)}
        item={detalhe}
        competencia={execAtual ? formatMesReferencia(execAtual.mes_referencia) : ""}
        usuario={execAtual?.executado_por_nome ?? null}
        data={execAtual?.iniciada_em ?? null}
      />
    </div>
  );
}

function Kpi({ label, value, accent, suffix }: { label: string; value: string | number; accent?: "success" | "warning" | "destructive"; suffix?: string }) {
  const cls = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold ${cls}`}>{value}{suffix && <span className="text-xs text-muted-foreground ml-1">({suffix})</span>}</div>
      </CardContent>
    </Card>
  );
}
