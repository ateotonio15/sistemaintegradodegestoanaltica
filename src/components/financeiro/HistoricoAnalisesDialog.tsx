import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Eye, Search, Trash2 } from "lucide-react";
import {
  listarAnalisesDoMes,
  deletarAnalise,
  type FinanceiroAnaliseRow,
} from "@/lib/financeiro-analise-cache";
import { formatBRL } from "@/lib/excel-analysis-utils";
import { formatMesReferencia } from "@/lib/financeiro-utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnaliseCompetenciaPanel } from "./AnaliseCompetenciaPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mes: string;
  empresasMap: Record<string, { nome: string; codigo: string | null; cnpj: string | null }>;
  canManage: boolean;
  /** Pede ao Financeiro para reanalisar (ele já recarrega a linha apropriada). */
  onReanalisar?: (analise: FinanceiroAnaliseRow) => void;
}

function StatusBadge({ s }: { s: FinanceiroAnaliseRow["status_analise"] }) {
  if (s === "OK")
    return (
      <Badge className="bg-success/15 text-success border border-success/30">OK</Badge>
    );
  if (s === "ERRO")
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/30">
        Erro
      </Badge>
    );
  return (
    <Badge className="bg-warning/15 text-warning border border-warning/30">Pendente</Badge>
  );
}

export function HistoricoAnalisesDialog({
  open,
  onOpenChange,
  mes,
  empresasMap,
  canManage,
  onReanalisar,
}: Props) {
  const [linhas, setLinhas] = useState<FinanceiroAnaliseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"all" | "OK" | "ERRO" | "PENDENTE">("all");
  const [detalhe, setDetalhe] = useState<FinanceiroAnaliseRow | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const rows = await listarAnalisesDoMes(mes);
      setLinhas(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) carregar();
  }, [open, mes]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroStatus !== "all" && l.status_analise !== filtroStatus) return false;
      if (!q) return true;
      const emp = empresasMap[l.empresa_id];
      const hay = `${emp?.nome || ""} ${emp?.codigo || ""} ${emp?.cnpj || ""} ${l.pagador_nome || ""} ${l.pagador_cnpj || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [linhas, busca, filtroStatus, empresasMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de Análises — {formatMesReferencia(mes)}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="competencia" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="self-start">
            <TabsTrigger value="competencia">Análise por Competência</TabsTrigger>
            <TabsTrigger value="mes">Histórico do mês</TabsTrigger>
          </TabsList>

          <TabsContent value="competencia" className="flex-1 overflow-auto mt-3">
            <AnaliseCompetenciaPanel
              mesInicial={mes}
              canExecute={canManage}
              canDelete={canManage}
            />
          </TabsContent>

          <TabsContent value="mes" className="flex-1 flex flex-col overflow-hidden mt-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
          <div className="relative flex-1 min-w-[260px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa, contrato, pagador..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "OK", "ERRO", "PENDENTE"] as const).map((s) => (
              <Button
                key={s}
                variant={filtroStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroStatus(s)}
              >
                {s === "all" ? "Todos" : s === "OK" ? "OK" : s === "ERRO" ? "Erros" : "Pendentes"}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma análise encontrada para {formatMesReferencia(mes)}.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((l) => {
                  const emp = empresasMap[l.empresa_id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{emp?.nome || "—"}</TableCell>
                      <TableCell>{emp?.codigo || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {l.pagador_nome || emp?.nome || "—"}
                        {l.pagador_cnpj && (
                          <span className="block text-xs text-muted-foreground">{l.pagador_cnpj}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{l.periodo}</TableCell>
                      <TableCell>
                        <StatusBadge s={l.status_analise} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(l.data_analise).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs">{l.analisado_por_nome || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1"
                            onClick={() => setDetalhe(l)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Detalhes
                          </Button>
                          {canManage && onReanalisar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1"
                              onClick={() => onReanalisar(l)}
                              title="Forçar nova análise dos arquivos"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Reanalisar
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={async () => {
                                const ok = await deletarAnalise(l.id);
                                if (ok) {
                                  toast.success("Análise removida do histórico.");
                                  setLinhas((prev) => prev.filter((x) => x.id !== l.id));
                                } else {
                                  toast.error("Não foi possível remover.");
                                }
                              }}
                              title="Remover do histórico"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {detalhe && (
          <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
            <DialogContent className="max-w-[800px] max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>
                  Detalhes da análise — {empresasMap[detalhe.empresa_id]?.nome || ""}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground text-xs">Pagador</div>
                    <div>{detalhe.pagador_nome || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">CNPJ</div>
                    <div>{detalhe.pagador_cnpj || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Excel</div>
                    <div className="truncate">{detalhe.nome_arquivo_excel || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">PDF</div>
                    <div className="truncate">{detalhe.nome_arquivo_pdf || "—"}</div>
                  </div>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Categoria</th>
                        <th className="text-right px-3 py-2">Excel</th>
                        <th className="text-right px-3 py-2">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Enfermaria", e: detalhe.valor_excel_enfermaria, p: detalhe.valor_pdf_enfermaria },
                        { label: "Apartamento", e: detalhe.valor_excel_apartamento, p: detalhe.valor_pdf_apartamento },
                        { label: "Inclusões", e: detalhe.valor_excel_inclusoes, p: detalhe.valor_pdf_inclusoes },
                        { label: "Exclusões", e: detalhe.valor_excel_exclusoes, p: detalhe.valor_pdf_exclusoes },
                      ]
                        .filter((r) => r.e !== null || r.p !== null)
                        .map((r) => (
                          <tr key={r.label} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{r.label}</td>
                            <td className="px-3 py-2 text-right">{r.e === null ? "—" : formatBRL(Number(r.e))}</td>
                            <td className="px-3 py-2 text-right">{r.p === null ? "—" : formatBRL(Number(r.p))}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {detalhe.divergencias && detalhe.divergencias.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <div className="font-semibold text-destructive mb-2">
                      Divergências ({detalhe.divergencias.length})
                    </div>
                    <ul className="space-y-1 text-xs">
                      {detalhe.divergencias.map((d, i) => (
                        <li key={i}>
                          <strong>{d.campo}:</strong> Excel {d.valor_excel ?? "—"} × PDF {d.valor_pdf ?? "—"}{" "}
                          {d.diferenca !== null && <span className="text-muted-foreground">(Δ {d.diferenca})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-md border border-success/40 bg-success/5 p-3 text-success text-sm">
                    {detalhe.mensagem_final || "Sem divergências."}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Analisado em {new Date(detalhe.data_analise).toLocaleString("pt-BR")} por{" "}
                  {detalhe.analisado_por_nome || "—"}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
