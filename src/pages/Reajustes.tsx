import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, History, Search, TrendingUp, AlertTriangle, CheckCircle2, Clock, Check, ChevronRight, ChevronDown, BedDouble, Hotel, Send, Gavel, DollarSign, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ReajusteDialog } from "@/components/reajustes/ReajusteDialog";
import { ImportarReajustesOperadoraDialog } from "@/components/reajustes/ImportarReajustesOperadoraDialog";
import { RefreshCw } from "lucide-react";
import { ReajusteHistoricoDialog } from "@/components/reajustes/ReajusteHistoricoDialog";
import { SolicitarReajusteDialog } from "@/components/reajustes/SolicitarReajusteDialog";
import { AprovarReajusteDialog } from "@/components/reajustes/AprovarReajusteDialog";
import { AplicarRetroativoDialog } from "@/components/reajustes/AplicarRetroativoDialog";
import {
  formatCentavosBRL, getStatusReajusteEmpresa, statusReajusteColor, type StatusReajuste,
  labelStatusReajusteFluxo, corStatusReajusteFluxo, getMesReajuste, nomeMes,
} from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/date-utils";
import { valoresModalidadeReajuste } from "@/lib/reajuste-apresentacao";
import { exportReajustesExcel, exportReajustesPDF } from "@/lib/reajustes-export";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Reajustes() {
  const { user, isAdmin, isComum, isDiretora, isFinanceiro } = useAuth();
  const [syncOpen, setSyncOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const canCriar = isAdmin || isDiretora;
  const podeSolicitar = isAdmin || isDiretora;


  const anoAtual = new Date().getFullYear();
  const [filterAno, setFilterAno] = useState<string>(String(anoAtual));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMes, setFilterMes] = useState<string>("all");
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
  const [solicitarExistingId, setSolicitarExistingId] = useState<string | null>(null);
  const [aprovarOpen, setAprovarOpen] = useState(false);
  const [aprovarTarget, setAprovarTarget] = useState<{ reajuste: any; empresaNome: string } | null>(null);
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroTarget, setRetroTarget] = useState<{ reajuste: any; empresaNome: string } | null>(null);
  const [confirmEnviar, setConfirmEnviar] = useState<{ id: string; empresa: string } | null>(null);

  const openSolicitar = (empresa: any, reajuste?: any | null) => {
    setSolicitarEmpresa(empresa);
    setSolicitarExistingId(reajuste?.id || null);
    setEditing(reajuste || null);
    setSolicitarOpen(true);
  };

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const focusEmpresaId = searchParams.get("empresa");
  const focusFluxo = searchParams.get("fluxo");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const didFocusRef = useRef<string | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["reajustes-empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,codigo_contrato,status_empresa,data_implantacao,responsavel_user_id,responsavel_contrato,valor_enfermaria_centavos,valor_apartamento_centavos,faixas_etarias,contrato_faixa_etaria")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  // Foca um contrato específico vindo de alerta (?empresa=ID) ou filtra por fluxo (?fluxo=...)
  useEffect(() => {
    if (focusFluxo && didFocusRef.current !== `f:${focusFluxo}`) {
      setFilterStatus("all");
      setFilterMes("all");
      setSearch("");
      didFocusRef.current = `f:${focusFluxo}`;
    }
    if (!focusEmpresaId) return;
    if (didFocusRef.current === focusEmpresaId) return;
    if (!empresas.length) return;
    const emp = empresas.find((e: any) => e.id === focusEmpresaId);
    if (!emp) return;
    didFocusRef.current = focusEmpresaId;
    setFilterStatus("all");
    setFilterMes("all");
    setSearch(emp.codigo_contrato || emp.nome);
    setExpandedIds((prev) => new Set(prev).add(emp.id));
    setHighlightId(emp.id);
    setTimeout(() => {
      rowRefs.current[emp.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    setTimeout(() => setHighlightId(null), 3500);
    // Limpa query params para não refocar em navegações futuras
    const next = new URLSearchParams(searchParams);
    next.delete("empresa");
    next.delete("fluxo");
    setSearchParams(next, { replace: true });
  }, [focusEmpresaId, focusFluxo, empresas, searchParams, setSearchParams]);

  const { data: implantacoesValores = [] } = useQuery({
    queryKey: ["reajustes-implantacoes-valores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos")
        .select("empresa_id,valor_enfermaria_centavos,valor_apartamento_centavos,faixas_etarias");
      if (error) throw error;
      return data as any[];
    },
  });
  const implantacaoPorEmpresa = useMemo(() => {
    const map: Record<string, any> = {};
    for (const i of implantacoesValores) if (i.empresa_id) map[i.empresa_id] = i;
    return map;
  }, [implantacoesValores]);



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

  const { data: faixasReajuste = [] } = useQuery({
    queryKey: ["reajustes-faixas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reajuste_faixas" as any)
        .select("reajuste_id,modalidade,idade_inicial,idade_final,valor_atual_centavos,percentual,valor_reajustado_centavos,valor_retroativo_centavos,valor_final_centavos");
      if (error) throw error;
      return data as any[];
    },
  });
  const faixasPorReajuste = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of faixasReajuste) (map[f.reajuste_id] ||= []).push(f);
    for (const k in map) map[k].sort((a, b) => (Number(a.idade_inicial) || 0) - (Number(b.idade_inicial) || 0));
    return map;
  }, [faixasReajuste]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("reajustes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reajustes_anuais" }, () => {
        qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
        qc.invalidateQueries({ queryKey: ["reajustes-faixas"] });
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

  // Cadastro (comum) passa a visualizar todos os contratos; a permissão de
  // edição continua restrita aos contratos sob sua responsabilidade (linha 343).
  const empresasVisiveis = useMemo(() => empresas, [empresas]);

  const rows = useMemo(() => {
    const ano = parseInt(filterAno, 10);
    const mesFiltro = filterMes === "all" ? null : parseInt(filterMes, 10);
    const list = empresasVisiveis.map((e) => {
      const r = reajustesPorEmpresaAno[`${e.id}|${ano}`];
      const reajustesEmpresa = reajustes.filter((x) => x.empresa_id === e.id);
      const status: StatusReajuste = r ? "Reajustado" : getStatusReajusteEmpresa(e, reajustesEmpresa, ano);
      return { empresa: e, reajuste: r, status };
    });
    const q = search.trim().toLowerCase();
    return list.filter((row) => {
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (mesFiltro !== null && getMesReajuste(row.empresa.data_implantacao) !== mesFiltro) return false;
      if (q && !`${row.empresa.nome} ${row.empresa.codigo_contrato || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [empresasVisiveis, reajustes, reajustesPorEmpresaAno, filterAno, filterStatus, filterMes, search]);

  const kpis = useMemo(() => {
    const ano = parseInt(filterAno, 10);
    const mesFiltro = filterMes === "all" ? null : parseInt(filterMes, 10);
    const base = mesFiltro === null
      ? empresasVisiveis
      : empresasVisiveis.filter((e) => getMesReajuste(e.data_implantacao) === mesFiltro);
    const total = base.length;
    let reajustados = 0, pendentes = 0, atrasados = 0;
    for (const e of base) {
      const r = reajustesPorEmpresaAno[`${e.id}|${ano}`];
      if (r) { reajustados++; continue; }
      const status = getStatusReajusteEmpresa(e, reajustes.filter((x) => x.empresa_id === e.id), ano);
      if (status === "Atrasado") atrasados++; else pendentes++;
    }
    return { total, reajustados, pendentes, atrasados };
  }, [empresasVisiveis, reajustes, reajustesPorEmpresaAno, filterAno, filterMes]);

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

  const enviarDiretoraMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirmar_reajuste_cadastro" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Enviado ao Cadastro", description: "Cadastro foi notificado para análise e aprovação." });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-aprovar-count"] });
      setConfirmEnviar(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  function handleExportExcel() {
    const data = rows.map(({ empresa, reajuste, status }) => ({
      empresa: empresa.nome,
      contrato: empresa.codigo_contrato,
      cnpj: (empresa as any).cnpj,
      responsavel: empresa.responsavel_contrato,
      ano: parseInt(filterAno, 10),
      mesReajuste: getMesReajuste(empresa.data_implantacao),
      dataAplicacao: reajuste?.data_aplicacao,
      percentual: reajuste?.percentual,
      valorAtual: reajuste?.valor_antigo_centavos,
      valorReajustado: reajuste?.valor_reajustado_centavos,
      retroativo: reajuste?.valor_retroativo_centavos,
      mesesRetro: reajuste?.meses_retroativos,
      valorFinal: reajuste?.valor_final_centavos,
      status: reajuste?.status_reajuste || status,
    }));
    exportReajustesExcel(data, `reajustes-${filterAno}.xlsx`);
  }

  function handleExportPDF() {
    const data = rows.map(({ empresa, reajuste, status }) => ({
      empresa: empresa.nome,
      contrato: empresa.codigo_contrato,
      cnpj: (empresa as any).cnpj,
      responsavel: empresa.responsavel_contrato,
      ano: parseInt(filterAno, 10),
      mesReajuste: getMesReajuste(empresa.data_implantacao),
      dataAplicacao: reajuste?.data_aplicacao,
      percentual: reajuste?.percentual,
      valorAtual: reajuste?.valor_antigo_centavos,
      valorReajustado: reajuste?.valor_reajustado_centavos,
      retroativo: reajuste?.valor_retroativo_centavos,
      mesesRetro: reajuste?.meses_retroativos,
      valorFinal: reajuste?.valor_final_centavos,
      status: reajuste?.status_reajuste || status,
    }));
    exportReajustesPDF(data, `Reajustes ${filterAno}`);
  }


  const podeLiberar = (empresa: any) =>
    isAdmin || isDiretora || (isComum && (empresa.responsavel_user_id === user?.id || minhasEmpresasSet.has(empresa.id)));

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
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              Reajuste Contratual
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Controle anual de reajustes dos contratos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
            {(isAdmin || isDiretora || isComum) && (
              <Button variant="outline" onClick={() => setSyncOpen(true)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar reajustes da operadora
              </Button>
            )}
            {canCriar && (
              <Button onClick={() => openNew()}>
                <Plus className="h-4 w-4 mr-2" /> Novo Reajuste
              </Button>
            )}
          </div>
          <ImportarReajustesOperadoraDialog open={syncOpen} onOpenChange={setSyncOpen} />

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
            <div className="w-48">
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger><SelectValue placeholder="Mês de Reajuste" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{nomeMes(m)}</SelectItem>
                  ))}
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
                    const fxSalvas = reajuste ? faixasPorReajuste[reajuste.id] || [] : [];
                    const enfResumo = valoresModalidadeReajuste(reajuste || {}, "enfermaria", fxSalvas);
                    const aptResumo = valoresModalidadeReajuste(reajuste || {}, "apartamento", fxSalvas);
                    const temValores = reajuste && !isSolicitado && ((reajuste.valor_antigo_centavos || 0) > 0 || enfResumo.primeira || aptResumo.primeira);
                    const mesReaj = getMesReajuste(empresa.data_implantacao);
                    const temRetro = (reajuste?.meses_retroativos || 0) > 0;
                    const isExpanded = expandedIds.has(empresa.id);
                    const pct = reajuste && !isSolicitado ? Number(reajuste.percentual) : 0;
                    // Resumo da tabela: prioriza ENFERMARIA. Se empresa só possui apartamento, usa apartamento. Fallback legado: totais.
                    const enfAtual = enfResumo.antigo ?? 0;
                    const enfReaj = enfResumo.reajustado ?? 0;
                    const enfRetroV = enfResumo.retro ?? 0;
                    const enfFinalV = enfResumo.final ?? 0;
                    const aptAtual = aptResumo.antigo ?? 0;
                    const aptReaj = aptResumo.reajustado ?? 0;
                    const aptRetroV = aptResumo.retro ?? 0;
                    const aptFinalV = aptResumo.final ?? 0;
                    const possuiEnfFlag = (reajuste as any)?.possui_enfermaria;
                    const possuiAptFlag = (reajuste as any)?.possui_apartamento;
                    const usarEnf = enfAtual > 0 || enfFinalV > 0 || possuiEnfFlag === true;
                    const usarApt = !usarEnf && (aptAtual > 0 || aptFinalV > 0 || possuiAptFlag === true);
                    const resumoAtual = usarEnf ? enfAtual : usarApt ? aptAtual : (reajuste?.valor_antigo_centavos || 0);
                    const resumoReaj = usarEnf ? enfReaj : usarApt ? aptReaj : (reajuste?.valor_reajustado_centavos || 0);
                    const resumoRetro = usarEnf ? enfRetroV : usarApt ? aptRetroV : (reajuste?.valor_retroativo_centavos || 0);
                    const resumoFinal = usarEnf ? enfFinalV : usarApt ? aptFinalV : (reajuste?.valor_final_centavos || 0);
                    const resumoLabel = usarEnf ? "Enfermaria" : usarApt ? "Apartamento" : null;
                    const usaFaixaReaj = !!(reajuste && ((reajuste as any).usa_faixa_etaria_enfermaria || (reajuste as any).usa_faixa_etaria_apartamento));
                    // 1ª faixa etária (menor idade) da modalidade em uso no resumo da linha
                    const primeiraFaixaDb = (() => {
                      if (!reajuste || !usaFaixaReaj) return null;
                      const fx = faixasPorReajuste[reajuste.id] || [];
                      const mod = usarEnf ? "enfermaria" : usarApt ? "apartamento" : (fx.some((f: any) => f.modalidade === "enfermaria") ? "enfermaria" : "apartamento");
                      const lista = fx.filter((f: any) => f.modalidade === mod);
                      if (!lista.length) return null;
                      return lista[0];
                    })();
                    return (
                    <>
                    <TableRow
                      key={empresa.id}
                      ref={(el) => { rowRefs.current[empresa.id] = el; }}
                      className={highlightId === empresa.id ? "ring-2 ring-orange-500 bg-orange-500/10 animate-pulse" : undefined}
                    >
                      <TableCell className="w-10 p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpand(empresa.id)} title={isExpanded ? "Recolher" : "Ver detalhes"}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{empresa.codigo_contrato || "—"}</TableCell>
                      <TableCell className="text-sm">{empresa.data_implantacao ? formatDateBR(empresa.data_implantacao) : "—"}</TableCell>
                      <TableCell className="text-sm">{nomeMes(mesReaj)}</TableCell>
                      <TableCell>
                        {temValores ? (
                          <div className="flex items-center gap-2">
                            <span>{formatCentavosBRL(resumoAtual)}</span>
                            {resumoLabel && <Badge variant="outline" className="text-[10px] px-1 py-0">{resumoLabel}{primeiraFaixaDb ? ` · 1ª Faixa ${primeiraFaixaDb.idade_inicial}–${primeiraFaixaDb.idade_final >= 999 ? "+" : primeiraFaixaDb.idade_final}` : ""}</Badge>}
                          </div>
                         ) : (() => {
                           const impl = implantacaoPorEmpresa[empresa.id] || {};
                           const ve = (empresa as any).valor_enfermaria_centavos || impl.valor_enfermaria_centavos || 0;
                           const va = (empresa as any).valor_apartamento_centavos || impl.valor_apartamento_centavos || 0;
                           const fe = (empresa as any).faixas_etarias || impl.faixas_etarias;
                           const sumFaixa = (arr: any[]) => Array.isArray(arr) ? arr.reduce((s, f) => s + (Number(f?.centavos) || 0), 0) : 0;
                           const feEnf = fe && typeof fe === "object" ? sumFaixa(fe.enfermaria) : 0;
                           const feApt = fe && typeof fe === "object" ? sumFaixa(fe.apartamento) : 0;
                           const enfTot = ve || feEnf;
                           const aptTot = va || feApt;
                           const useEnf = enfTot > 0;
                           const useApt = !useEnf && aptTot > 0;
                           if (!useEnf && !useApt) return "—";
                           // Contrato por faixa etária: mostra apenas a 1ª faixa com valor (não o total somado)
                           const isFaixa = !!(empresa as any).contrato_faixa_etaria || usaFaixaReaj;
                           const arrFx = fe && typeof fe === "object" ? (useEnf ? fe.enfermaria : fe.apartamento) : null;
                           const listaFx = Array.isArray(arrFx) ? arrFx.filter((f: any) => (Number(f?.centavos) || 0) > 0) : [];
                           if (isFaixa && listaFx.length > 0) {
                             const fx = listaFx[0];
                             const ini = Number(fx.ini ?? fx.idade_inicial ?? 0);
                             const fim = Number(fx.fim ?? fx.idade_final ?? 0);
                             return (
                               <div className="flex items-center gap-2">
                                 <span className="text-muted-foreground">{formatCentavosBRL(Number(fx.centavos) || 0)}</span>
                                 <Badge variant="outline" className="text-[10px] px-1 py-0">{useEnf ? "Enfermaria" : "Apartamento"} · 1ª Faixa {fim >= 999 ? `${ini}+` : `${ini}–${fim}`}</Badge>
                               </div>
                             );
                           }
                           return (
                             <div className="flex items-center gap-2">
                               <span className="text-muted-foreground">{formatCentavosBRL(useEnf ? enfTot : aptTot)}</span>
                               <Badge variant="outline" className="text-[10px] px-1 py-0">{useEnf ? "Enfermaria" : "Apartamento"}</Badge>
                             </div>
                           );
                         })()}

                      </TableCell>
                      <TableCell>{reajuste && !isSolicitado && Number(reajuste.percentual) > 0 ? `${Number(reajuste.percentual).toFixed(2).replace(".", ",")}%` : "—"}</TableCell>
                      <TableCell className="font-semibold">
                        {temValores
                          ? formatCentavosBRL(resumoReaj)
                          : reajuste && !isSolicitado && usaFaixaReaj
                            ? (primeiraFaixaDb
                                ? (
                                  <div className="flex items-center gap-2">
                                    <span>{formatCentavosBRL(Number(primeiraFaixaDb.valor_reajustado_centavos) || 0)}</span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">1ª Faixa {Number(primeiraFaixaDb.idade_final) >= 999 ? `${primeiraFaixaDb.idade_inicial}+` : `${primeiraFaixaDb.idade_inicial}–${primeiraFaixaDb.idade_final}`}</Badge>
                                  </div>
                                )
                                : <span className="text-xs font-normal text-muted-foreground">Por faixa etária</span>)
                            : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {temValores ? (
                          <>
                            <div>{formatCentavosBRL(resumoRetro)}</div>
                            {temRetro && <div className="text-xs text-muted-foreground">{reajuste.meses_retroativos} {reajuste.meses_retroativos === 1 ? "mês" : "meses"}</div>}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-primary">{temValores ? formatCentavosBRL(resumoFinal) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {reajuste ? (
                            <Badge variant="outline" className={corStatusReajusteFluxo(statusFluxo)}>
                              {labelStatusReajusteFluxo(statusFluxo)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={statusReajusteColor(status)}>{status}</Badge>
                          )}
                          {reajuste && ((reajuste as any).usa_faixa_etaria_enfermaria || (reajuste as any).usa_faixa_etaria_apartamento) && (
                            <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">
                              Faixa Etária
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* Diretora: registrou valores → enviar ao Cadastro */}
                          {statusFluxo === "pendente_confirmacao" && (isAdmin || isDiretora) && (
                            <Button
                              size="sm"
                              onClick={() => setConfirmEnviar({ id: reajuste.id, empresa: empresa.nome })}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Send className="h-3 w-3 mr-1" /> Enviar ao Cadastro
                            </Button>
                          )}
                          {/* Cadastro: analisar / aprovar */}
                          {(statusFluxo === "aguardando_aprovacao" || statusFluxo === "aprovado") && (isComum || isAdmin) && (
                            <Button
                              size="sm"
                              onClick={() => { setAprovarTarget({ reajuste, empresaNome: empresa.nome }); setAprovarOpen(true); }}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              <Gavel className="h-3 w-3 mr-1" /> {statusFluxo === "aprovado" ? "Liberar" : "Analisar"}
                            </Button>
                          )}
                          {/* Financeiro: aplicar retroativo */}
                          {statusFluxo === "liberado_financeiro" && (isFinanceiro || isAdmin) && (
                            <Button
                              size="sm"
                              onClick={() => { setRetroTarget({ reajuste, empresaNome: empresa.nome }); setRetroOpen(true); }}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <DollarSign className="h-3 w-3 mr-1" /> Aplicar Retroativo
                            </Button>
                          )}
                          {isSolicitado && (isAdmin || isDiretora) && (
                            <Button size="sm" variant="default" onClick={() => openSolicitar(empresa, reajuste)} className="bg-blue-600 hover:bg-blue-700">
                              <Pencil className="h-3 w-3 mr-1" /> Registrar Valores
                            </Button>
                          )}
                          {/* Diretora: rejeitado → corrigir */}
                          {statusFluxo === "rejeitado" && (isAdmin || isDiretora) && (
                            <Button size="sm" variant="default" onClick={() => openSolicitar(empresa, reajuste)} className="bg-yellow-600 hover:bg-yellow-700">
                              <Pencil className="h-3 w-3 mr-1" /> Corrigir
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Histórico" onClick={() => { setHistoricoEmpresa({ id: empresa.id, nome: empresa.nome }); setHistoricoOpen(true); }}>
                            <History className="h-4 w-4" />
                          </Button>

                          {(() => {
                            const bloqueado = ["liberado_financeiro", "retroativo_aplicado", "reajustado"].includes(statusFluxo || "");
                            if (bloqueado) return null;
                            return (
                              <>
                                {canCriar && reajuste && !isSolicitado && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Editar"
                                      onClick={() => statusFluxo === "pendente_confirmacao" || statusFluxo === "aguardando_aprovacao" ? openSolicitar(empresa, reajuste) : openEdit(reajuste)}
                                    >
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
                              </>
                            );
                          })()}

                          {podeSolicitar && !reajuste && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSolicitar(empresa, null)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Solicitar Reajuste
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (() => {
                      // Fallback Valor Atual: Reajuste -> Empresa -> Implantação (inclusive faixas etárias somadas)
                      const impl = implantacaoPorEmpresa[empresa.id] || {};
                      const sumFaixa = (arr: any) => Array.isArray(arr) ? arr.reduce((s: number, f: any) => s + (Number(f?.centavos) || 0), 0) : 0;
                      const feEmp = (empresa as any).faixas_etarias;
                      const feImpl = impl.faixas_etarias;
                      const enfFallback =
                        (empresa as any).valor_enfermaria_centavos ||
                        (feEmp && typeof feEmp === "object" ? sumFaixa(feEmp.enfermaria) : 0) ||
                        impl.valor_enfermaria_centavos ||
                        (feImpl && typeof feImpl === "object" ? sumFaixa(feImpl.enfermaria) : 0) ||
                        0;
                      const aptFallback =
                        (empresa as any).valor_apartamento_centavos ||
                        (feEmp && typeof feEmp === "object" ? sumFaixa(feEmp.apartamento) : 0) ||
                        impl.valor_apartamento_centavos ||
                        (feImpl && typeof feImpl === "object" ? sumFaixa(feImpl.apartamento) : 0) ||
                        0;
                      const enfDados = {
                        valorAtual: (reajuste?.valor_antigo_enfermaria_centavos || 0) || enfFallback,
                        valorReajustado: reajuste?.valor_reajustado_enfermaria_centavos || 0,
                        retroativo: reajuste?.valor_retroativo_enfermaria_centavos || 0,
                        valorFinal: reajuste?.valor_final_enfermaria_centavos || 0,
                      };
                      const aptDados = {
                        valorAtual: (reajuste?.valor_antigo_apartamento_centavos || 0) || aptFallback,
                        valorReajustado: reajuste?.valor_reajustado_apartamento_centavos || 0,
                        retroativo: reajuste?.valor_retroativo_apartamento_centavos || 0,
                        valorFinal: reajuste?.valor_final_apartamento_centavos || 0,
                      };
                      // Modalidades selecionadas: usa flags se existirem; fallback = qualquer valor > 0; default = ambas
                      const hasEnfFlag = typeof (reajuste as any)?.possui_enfermaria === "boolean";
                      const hasAptFlag = typeof (reajuste as any)?.possui_apartamento === "boolean";
                      let mostraEnf = hasEnfFlag ? !!(reajuste as any).possui_enfermaria : enfDados.valorAtual > 0 || enfDados.valorFinal > 0;
                      let mostraApt = hasAptFlag ? !!(reajuste as any).possui_apartamento : aptDados.valorAtual > 0 || aptDados.valorFinal > 0;
                      if (!mostraEnf && !mostraApt) { mostraEnf = true; mostraApt = true; }
                      const colsClass = mostraEnf && mostraApt ? "md:grid-cols-2" : "md:grid-cols-1";
                      return (
                        <TableRow key={`${empresa.id}-exp`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={12} className="p-0">
                            <div className="animate-accordion-down overflow-hidden">
                              <div className={`grid grid-cols-1 ${colsClass} gap-4 p-4`}>
                                {mostraEnf && (
                                  <DetalheCard
                                    titulo={enfResumo.primeira ? "Modalidade Enfermaria · 1ª Faixa" : "Modalidade Enfermaria"}
                                    Icone={BedDouble}
                                    tipo="enfermaria"
                                    percentual={pct}
                                    {...enfDados}
                                    {...(enfResumo.porFaixa ? { valorAtual: enfResumo.antigo, valorReajustado: enfResumo.reajustado, retroativo: enfResumo.retro, valorFinal: enfResumo.final } : {})}
                                  />
                                )}
                                {mostraApt && (
                                  <DetalheCard
                                    titulo={aptResumo.primeira ? "Modalidade Apartamento · 1ª Faixa" : "Modalidade Apartamento"}
                                    Icone={Hotel}
                                    tipo="apartamento"
                                    percentual={pct}
                                    {...aptDados}
                                    {...(aptResumo.porFaixa ? { valorAtual: aptResumo.antigo, valorReajustado: aptResumo.reajustado, retroativo: aptResumo.retro, valorFinal: aptResumo.final } : {})}
                                  />
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                    </>
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
        onOpenChange={(v) => { setSolicitarOpen(v); if (!v) { setSolicitarExistingId(null); setEditing(null); } }}
        empresa={solicitarEmpresa}
        existingReajusteId={solicitarExistingId}
        existingReajuste={editing}
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


      <AprovarReajusteDialog
        open={aprovarOpen}
        onOpenChange={setAprovarOpen}
        reajuste={aprovarTarget?.reajuste || null}
        empresaNome={aprovarTarget?.empresaNome}
      />

      <AplicarRetroativoDialog
        open={retroOpen}
        onOpenChange={setRetroOpen}
        reajuste={retroTarget?.reajuste || null}
        empresaNome={retroTarget?.empresaNome}
      />

      <AlertDialog open={!!confirmEnviar} onOpenChange={(o) => !o && setConfirmEnviar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar à Diretoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os valores de <strong>{confirmEnviar?.empresa}</strong> serão enviados para análise e aprovação da Diretoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmEnviar && enviarDiretoraMutation.mutate(confirmEnviar.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Enviar
            </AlertDialogAction>
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
    </>
  );
}

type DetalheCardProps = {
  titulo: string;
  Icone: React.ComponentType<{ className?: string }>;
  percentual: number;
  tipo: "enfermaria" | "apartamento";
  valorAtual?: number | null;
  valorReajustado?: number | null;
  retroativo?: number | null;
  valorFinal?: number | null;
};

function DetalheCard({ titulo, Icone, percentual, tipo, valorAtual, valorReajustado, retroativo, valorFinal }: DetalheCardProps) {
  const temDados = (valorAtual || 0) > 0 || (valorReajustado || 0) > 0 || (valorFinal || 0) > 0;
  const fmt = (v?: number | null) => formatCentavosBRL(v || 0);

  const tipoStyle =
    tipo === "enfermaria"
      ? { card: "border-emerald-500/40 bg-emerald-500/5", icon: "text-emerald-600", badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15", label: "Enfermaria", final: "text-emerald-600" }
      : { card: "border-blue-500/40 bg-blue-500/5", icon: "text-blue-600", badge: "bg-blue-500/15 text-blue-700 border-blue-500/30 hover:bg-blue-500/15", label: "Apartamento", final: "text-blue-600" };

  return (
    <Card className={`shadow-sm ${tipoStyle.card}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Icone className={`h-4 w-4 ${tipoStyle.icon}`} />
            <h4 className="font-semibold text-sm">{titulo}</h4>
            {temDados && (
              <Badge variant="outline" className={`text-[10px] font-medium ${tipoStyle.badge}`}>
                {tipoStyle.label}
              </Badge>
            )}
          </div>
          {temDados && (
            <Badge variant="outline" className="text-xs">
              {percentual.toFixed(2).replace(".", ",")}%
            </Badge>
          )}
        </div>
        {!temDados ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Sem valores registrados</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Valor Atual</div>
              <div className="font-medium">{fmt(valorAtual)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor Reajustado</div>
              <div className="font-medium">{fmt(valorReajustado)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Retroativo</div>
              <div className="font-medium">{fmt(retroativo)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor Final</div>
              <div className={`font-bold text-base ${tipoStyle.final}`}>{fmt(valorFinal)}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

