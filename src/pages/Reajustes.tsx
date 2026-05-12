import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, History, Search, TrendingUp, AlertTriangle, CheckCircle2, Clock, Check, ChevronRight, ChevronDown, BedDouble, Hotel } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ReajusteDialog } from "@/components/reajustes/ReajusteDialog";
import { ReajusteHistoricoDialog } from "@/components/reajustes/ReajusteHistoricoDialog";
import { SolicitarReajusteDialog } from "@/components/reajustes/SolicitarReajusteDialog";
import {
  formatCentavosBRL, getStatusReajusteEmpresa, statusReajusteColor, type StatusReajuste,
  labelStatusReajusteFluxo, corStatusReajusteFluxo, getMesReajuste, nomeMes,
} from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/date-utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Reajustes() {
  const { user, isAdmin, isViewOnly, isComum } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canCriar = isAdmin || isComum;
  const podeSolicitar = isAdmin || isViewOnly;

  const anoAtual = new Date().getFullYear();
  const [filterAno, setFilterAno] = useState<string>(String(anoAtual));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [defaultEmpresaId, setDefaultEmpresaId] = useState<string | undefined>(undefined);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEmpresa, setHistoricoEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmLiberar, setConfirmLiberar] = useState<{ id: string; empresa: string; temRetro: boolean } | null>(null);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [solicitarEmpresa, setSolicitarEmpresa] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: empresas = [] } = useQuery({
    queryKey: ["reajustes-empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,codigo_contrato,status_empresa,data_implantacao,responsavel_user_id,responsavel_contrato")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: minhasEmpresas = [] } = useQuery({
    queryKey: ["minhas-empresas-comum", user?.id],
    enabled: !!user?.id && isComum,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_usuarios").select("empresa_id").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.empresa_id as string);
    },
  });
  const minhasEmpresasSet = useMemo(() => new Set(minhasEmpresas), [minhasEmpresas]);

  const { data: reajustes = [] } = useQuery({
    queryKey: ["reajustes-anuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reajustes_anuais")
        .select("*")
        .order("ano", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("reajustes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reajustes_anuais" }, () => {
        qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
        qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
        qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_reajuste" }, () => {
        qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const reajustesPorEmpresaAno = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of reajustes) map[`${r.empresa_id}|${r.ano}`] = r;
    return map;
  }, [reajustes]);

  const rows = useMemo(() => {
    const ano = parseInt(filterAno, 10);
    const list = empresas.map((e) => {
      const r = reajustesPorEmpresaAno[`${e.id}|${ano}`];
      const reajustesEmpresa = reajustes.filter((x) => x.empresa_id === e.id);
      const status: StatusReajuste = r ? "Reajustado" : getStatusReajusteEmpresa(e, reajustesEmpresa, ano);
      return { empresa: e, reajuste: r, status };
    });
    const q = search.trim().toLowerCase();
    return list.filter((row) => {
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (q && !`${row.empresa.nome} ${row.empresa.codigo_contrato || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [empresas, reajustes, reajustesPorEmpresaAno, filterAno, filterStatus, search]);

  const kpis = useMemo(() => {
    const ano = parseInt(filterAno, 10);
    const total = empresas.length;
    let reajustados = 0, pendentes = 0, atrasados = 0;
    for (const e of empresas) {
      const r = reajustesPorEmpresaAno[`${e.id}|${ano}`];
      if (r) { reajustados++; continue; }
      const status = getStatusReajusteEmpresa(e, reajustes.filter((x) => x.empresa_id === e.id), ano);
      if (status === "Atrasado") atrasados++; else pendentes++;
    }
    return { total, reajustados, pendentes, atrasados };
  }, [empresas, reajustes, reajustesPorEmpresaAno, filterAno]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([anoAtual, anoAtual - 1, anoAtual + 1]);
    for (const r of reajustes) set.add(r.ano);
    return Array.from(set).sort((a, b) => b - a);
  }, [reajustes, anoAtual]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reajustes_anuais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reajuste excluído" });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message || "Erro ao excluir", variant: "destructive" }),
  });

  const liberarMutation = useMutation({
    mutationFn: async ({ id, temRetro }: { id: string; temRetro: boolean }) => {
      let nome: string | null = null;
      if (user?.id) {
        const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        nome = data?.display_name || null;
      }
      const now = new Date();
      const competencia = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
      const { error } = await supabase
        .from("reajustes_anuais")
        .update({
          status_reajuste: temRetro ? "retroativo_aplicado" : "reajustado",
          data_liberacao: now.toISOString(),
          liberado_por: user?.id || null,
          liberado_por_nome: nome,
          confirmado_por: user?.id || null,
          confirmado_por_nome: nome,
          data_confirmacao: now.toISOString(),
          competencia,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reajuste liberado", description: "Status atualizado para Reajustado." });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      setConfirmLiberar(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message || "Erro ao liberar", variant: "destructive" }),
  });

  const podeLiberar = (empresa: any) =>
    isAdmin || (isComum && (empresa.responsavel_user_id === user?.id || minhasEmpresasSet.has(empresa.id)));

  const openNew = (empresaId?: string) => {
    setEditing(null);
    setDefaultEmpresaId(empresaId);
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setDefaultEmpresaId(undefined);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              Reajuste Contratual
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Controle anual de reajustes dos contratos</p>
          </div>
          {canCriar && (
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-2" /> Novo Reajuste
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Contratos Ativos</div>
            <div className="text-2xl font-bold mt-1">{kpis.total}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Reajustados</div>
            <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{kpis.reajustados}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-yellow-500" /> Pendentes</div>
            <div className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{kpis.pendentes}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Atrasados</div>
            <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{kpis.atrasados}</div>
          </CardContent></Card>
        </div>

        {/* Alerta */}
        {(kpis.pendentes + kpis.atrasados) > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-semibold">Contratos pendentes de reajuste anual.</span>
              <span className="ml-2 text-muted-foreground">{kpis.pendentes + kpis.atrasados} contratos sem reajuste em {filterAno}.</span>
            </div>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar empresa ou contrato..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="w-32">
              <Select value={filterAno} onValueChange={setFilterAno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Reajustado">Reajustado</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Implantação</TableHead>
                    <TableHead>Mês Reajuste</TableHead>
                    <TableHead>Valor Atual</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Valor Reajustado</TableHead>
                    <TableHead>Retroativo</TableHead>
                    <TableHead>Valor Final</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Nenhum contrato encontrado</TableCell></TableRow>
                  ) : rows.map(({ empresa, reajuste, status }) => {
                    const statusFluxo = reajuste?.status_reajuste as string | undefined;
                    const isPendenteConfirm = reajuste && statusFluxo === "pendente_confirmacao";
                    const isSolicitado = reajuste && statusFluxo === "solicitado";
                    const temValores = reajuste && !isSolicitado && (reajuste.valor_antigo_centavos || 0) > 0;
                    const mesReaj = getMesReajuste(empresa.data_implantacao);
                    const temRetro = (reajuste?.meses_retroativos || 0) > 0;
                    const isExpanded = expandedIds.has(empresa.id);
                    const pct = temValores ? Number(reajuste.percentual) : 0;
                    return (
                    <>
                    <TableRow key={empresa.id}>
                      <TableCell className="w-10 p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpand(empresa.id)} title={isExpanded ? "Recolher" : "Ver detalhes"}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{empresa.codigo_contrato || "—"}</TableCell>
                      <TableCell className="text-sm">{empresa.data_implantacao ? formatDateBR(empresa.data_implantacao) : "—"}</TableCell>
                      <TableCell className="text-sm">{nomeMes(mesReaj)}</TableCell>
                      <TableCell>{temValores ? formatCentavosBRL(reajuste.valor_antigo_centavos) : "—"}</TableCell>
                      <TableCell>{temValores ? `${Number(reajuste.percentual).toFixed(2).replace(".", ",")}%` : "—"}</TableCell>
                      <TableCell className="font-semibold">{temValores ? formatCentavosBRL(reajuste.valor_reajustado_centavos) : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {temValores ? (
                          <>
                            <div>{formatCentavosBRL(reajuste.valor_retroativo_centavos)}</div>
                            {temRetro && <div className="text-xs text-muted-foreground">{reajuste.meses_retroativos} {reajuste.meses_retroativos === 1 ? "mês" : "meses"}</div>}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-primary">{temValores ? formatCentavosBRL(reajuste.valor_final_centavos) : "—"}</TableCell>
                      <TableCell>
                        {reajuste ? (
                          <Badge variant="outline" className={corStatusReajusteFluxo(statusFluxo)}>
                            {labelStatusReajusteFluxo(statusFluxo)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={statusReajusteColor(status)}>{status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(isPendenteConfirm || isSolicitado) && podeLiberar(empresa) && !isSolicitado && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setConfirmLiberar({ id: reajuste.id, empresa: empresa.nome, temRetro })}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-3 w-3 mr-1" /> Liberar
                            </Button>
                          )}
                          {isSolicitado && (isAdmin || isComum) && (
                            <Button size="sm" variant="default" onClick={() => openEdit(reajuste)} className="bg-blue-600 hover:bg-blue-700">
                              <Pencil className="h-3 w-3 mr-1" /> Registrar Valores
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Histórico" onClick={() => { setHistoricoEmpresa({ id: empresa.id, nome: empresa.nome }); setHistoricoOpen(true); }}>
                            <History className="h-4 w-4" />
                          </Button>
                          {canCriar && reajuste && !isSolicitado && (
                            <>
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(reajuste)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => setConfirmDelete(reajuste.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {isAdmin && isSolicitado && (
                            <Button size="icon" variant="ghost" title="Excluir" onClick={() => setConfirmDelete(reajuste.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {canCriar && !reajuste && (
                            <Button size="sm" variant="outline" onClick={() => openNew(empresa.id)}>
                              <Plus className="h-3 w-3 mr-1" /> Registrar
                            </Button>
                          )}
                          {podeSolicitar && !reajuste && !isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSolicitarEmpresa(empresa); setSolicitarOpen(true); }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Solicitar Reajuste
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReajusteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        empresas={empresas.map((e) => ({ id: e.id, nome: e.nome, codigo_contrato: e.codigo_contrato, data_implantacao: e.data_implantacao }))}
        editing={editing}
        defaultEmpresaId={defaultEmpresaId}
      />

      <ReajusteHistoricoDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        empresaId={historicoEmpresa?.id || null}
        empresaNome={historicoEmpresa?.nome}
      />

      <SolicitarReajusteDialog
        open={solicitarOpen}
        onOpenChange={setSolicitarOpen}
        empresa={solicitarEmpresa}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reajuste?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!confirmLiberar} onOpenChange={(o) => !o && setConfirmLiberar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar reajuste?</AlertDialogTitle>
            <AlertDialogDescription>
              Liberar o reajuste de <strong>{confirmLiberar?.empresa}</strong>. Será gravada a data de liberação, o usuário responsável e a competência atual.
              {confirmLiberar?.temRetro && <> O status será marcado como <strong>Retroativo Aplicado</strong>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmLiberar && liberarMutation.mutate({ id: confirmLiberar.id, temRetro: confirmLiberar.temRetro })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
