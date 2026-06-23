import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Download, Search, Plane, LayoutDashboard, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  calcularPeriodoPorData,
  periodoDaDataCorte,
  getCurrentMesReferencia,
  formatMesReferencia,
  formatPeriodoEmpresa,
  isPrioridadeAlertaIntenso,
} from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";
import { PrioridadeBadge } from "@/components/prioridade/PrioridadeBadge";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";
import DashboardAdministradoras from "@/pages/DashboardAdministradoras";

import ExcelJS from "exceljs";

type EmpresaOption = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  responsavel_contrato: string | null;
  data_corte: number | null;
  tipo_contrato?: string | null;
};

const emptyForm = {
  empresa_id: "",
  mes_referencia: getCurrentMesReferencia(),
  periodo: "01-05",
  data_envio_empresa: null as string | null,
  data_retorno_empresa: null as string | null,
  data_envio_financeiro: null as string | null,
  responsavel_movimentacao: "",
  observacoes: "",
  tipo_movimentacao: null as string | null,
};

export default function Movimentacoes() {
  const [activeTab, setActiveTab] = useState<"empresas" | "administradoras">("empresas");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [verSomenteSemEmpresa, setVerSomenteSemEmpresa] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin, isExecutivo, role, isViewOnly } = useAuth();
  const canEdit = !isViewOnly && isAdmin;
  const canEditDates = !isViewOnly && (isAdmin || role === "comum" || role === "administradoras");

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa, data_corte, tipo_contrato")
        .order("nome");
      if (error) throw error;
      const all = data as (EmpresaOption & { tipo_contrato?: string | null })[];
      return activeTab === "administradoras"
        ? all.filter((e) => (e.tipo_contrato ?? "") === "ADMINISTRADORA")
        : all.filter((e) => (e.tipo_contrato ?? "") !== "ADMINISTRADORA");
    },
    enabled: !!user,
  });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes", filterMes, activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano, tipo_contrato, status_implantacao, primeira_competencia_financeira, prioridade_maxima_id)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as (Movimentacao & { empresas?: { responsavel_contrato: string | null; tipo_contrato?: string | null } | null })[];
      return activeTab === "administradoras"
        ? rows.filter((m) => ((m.empresas as any)?.tipo_contrato ?? "") === "ADMINISTRADORA")
        : rows.filter((m) => ((m.empresas as any)?.tipo_contrato ?? "") !== "ADMINISTRADORA");
    },
    enabled: !!user,
  });


  // Mapa de "Nota Enviada" do módulo financeiro: (empresa_id|mes|periodo) -> data_envio_nota
  const { data: notasMap = new Map<string, string>() } = useQuery({
    queryKey: ["financeiro-notas-map", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, mes_referencia, periodo, data_envio_nota")
        .eq("mes_referencia", filterMes)
        .not("data_envio_nota", "is", null);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of data ?? []) {
        const key = `${r.empresa_id}|${r.mes_referencia}|${r.periodo}`;
        const prev = m.get(key);
        if (!prev || (r.data_envio_nota && r.data_envio_nota > prev)) {
          m.set(key, r.data_envio_nota as string);
        }
      }
      return m;
    },
    enabled: !!user,
  });

  const movimentacoesSemEmpresa = useMemo(() => {
    return movimentacoes.filter((m) => !m.empresa_id || !m.empresas);
  }, [movimentacoes]);

  const handleEmpresaChange = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    const tipo = empresa?.tipo_movimentacao ?? "Fechada";
    let periodo = form.periodo;
    if (empresa?.tipo_contrato === "ADMINISTRADORA" && empresa?.data_corte) {
      periodo = periodoDaDataCorte(empresa.data_corte);
    } else if (tipo === "Fechada" && empresa?.periodo_movimentacao) {
      periodo = empresa.periodo_movimentacao;
    } else if (tipo === "Diária" && empresa?.data_corte) {
      periodo = periodoDaDataCorte(empresa.data_corte);
    }
    setForm({ ...form, empresa_id: empresaId, tipo_movimentacao: tipo, periodo });
  };

  const handleDataEnvioChange = (dateStr: string | null) => {
    // IMPORTANTE: não recalcular o período a partir da Data de Envio Empresa.
    // O período da movimentação é definido pela data_corte/periodo_movimentacao
    // da empresa (em handleEmpresaChange) e deve permanecer fixo, senão o
    // contrato "pula" de coluna no Resumo Geral por Período ao preencher datas.
    setForm({ ...form, data_envio_empresa: dateStr });
  };

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      // Anexos não são mais obrigatórios para registrar a Data de Envio ao Financeiro.

      const payload: TablesInsert<"movimentacoes"> = {
        empresa_id: values.empresa_id,
        mes_referencia: values.mes_referencia,
        periodo: values.periodo,
        data_envio_empresa: values.data_envio_empresa,
        data_retorno_empresa: values.data_retorno_empresa,
        data_envio_financeiro: values.data_envio_financeiro,
        responsavel_movimentacao: values.responsavel_movimentacao || null,
        observacoes: values.observacoes || null,
        tipo_movimentacao: values.tipo_movimentacao,
      };
      if (editingId) {
        const { error } = await supabase.from("movimentacoes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("movimentacoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Movimentação atualizada!" : "Movimentação criada!" });
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      toast({ title: "Movimentação excluída!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openEdit = (m: Movimentacao & { empresas?: { responsavel_contrato: string | null } | null }) => {
    setEditingId(m.id);
    setForm({
      empresa_id: m.empresa_id,
      mes_referencia: m.mes_referencia,
      periodo: m.periodo,
      data_envio_empresa: m.data_envio_empresa,
      data_retorno_empresa: m.data_retorno_empresa,
      data_envio_financeiro: m.data_envio_financeiro,
      responsavel_movimentacao: m.responsavel_movimentacao ?? "",
      observacoes: m.observacoes ?? "",
      tipo_movimentacao: m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? null,
    });
    setDialogOpen(true);
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return movimentacoes.filter((m) => {
      if ((m.empresas as any)?.status_empresa === "Inativa") return false;
      // Esconde contratos recém implantados antes da primeira competência válida
      const statusImpl = (m.empresas as any)?.status_implantacao;
      const primComp = (m.empresas as any)?.primeira_competencia_financeira as string | null | undefined;
      if (statusImpl === "aguardando_primeiro_fechamento" && (!primComp || m.mes_referencia < primComp)) return false;
      if (verSomenteSemEmpresa) return !m.empresas;
      const status = calcularStatus(m);
      if (filterPeriodo !== "all" && m.periodo !== filterPeriodo) return false;
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterResponsavel && !(m.responsavel_movimentacao ?? "").toLowerCase().includes(filterResponsavel.toLowerCase())) return false;
      if (somentePendentes && status === "Enviado ao financeiro") return false;
      if (term) {
        const nome = (m.empresas?.nome ?? "").toLowerCase();
        const codigo = (m.empresas?.codigo_contrato ?? "").toLowerCase();
        const cnpj = ((m.empresas as any)?.cnpj ?? "").toLowerCase();
        if (!nome.includes(term) && !codigo.includes(term) && !cnpj.includes(term)) return false;
      }
      return true;
    });
  }, [movimentacoes, filterPeriodo, filterStatus, filterResponsavel, somentePendentes, verSomenteSemEmpresa, searchTerm]);

  const mesesOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const handleExportExcel = async () => {
    const rows = filtered.map((m) => {
      const status = calcularStatus(m);
      const tipo = (m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao) === "Diária" ? "Diário" : "Período";
      const notaKey = `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`;
      const dataNota = notasMap.get(notaKey) ?? "";
      return {
        "Contrato": m.empresas?.codigo_contrato ?? "",
        "CNPJ": m.empresas?.cnpj ?? "",
        "Empresa": m.empresas?.nome ?? "",
        "Resp. Contrato": m.empresas?.responsavel_contrato ?? "",
        "TIPO DE MOVIMENTAÇÃO": tipo,
        "PERÍODO DE MOVIMENTAÇÃO": formatPeriodoEmpresa(m.empresas as any),
        "Envio Empresa": m.data_envio_empresa ?? "",
        "Financeiro": m.data_envio_financeiro ?? "",
        "Nota Enviada": dataNota,
        "Status": status,
        "Implantação": m.empresas?.data_implantacao ?? "",
        "Corretora": m.empresas?.operadora_plano ?? "",
      };
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Movimentações");
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(headers.map((h) => (r as any)[h])));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_${filterMes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFerias = async () => {
    // Busca férias não encerradas (programada, em_andamento ou aguardando_retorno_contratos)
    const { data: ferias, error: fErr } = await supabase
      .from("ferias_cadastro")
      .select("id, responsavel_original_user_id, responsavel_original_nome, data_inicio, data_fim, status")
      .in("status", ["em_andamento", "programada", "aguardando_retorno_contratos"])
      .order("data_inicio", { ascending: false });
    if (fErr) {
      toast({ title: "Erro ao buscar férias: " + fErr.message, variant: "destructive" });
      return;
    }

    const feriasIds = (ferias ?? []).map((f) => f.id);
    let redistribuicoes: any[] = [];
    if (feriasIds.length) {
      const { data: emp, error: eErr } = await supabase
        .from("ferias_cadastro_empresas")
        .select("empresa_id, responsavel_temporario_nome, ferias_id")
        .in("ferias_id", feriasIds);
      if (eErr) {
        toast({ title: "Erro ao buscar redistribuição: " + eErr.message, variant: "destructive" });
        return;
      }
      redistribuicoes = emp ?? [];
    }
    // Mapa empresa_id -> { responsavel_temporario_nome, original_nome, periodo }
    const feriasMap = new Map<string, { temp: string; original: string; periodo: string }>();
    const feriasById = new Map((ferias ?? []).map((f) => [f.id, f]));
    for (const r of redistribuicoes) {
      const f = feriasById.get(r.ferias_id);
      if (!f) continue;
      feriasMap.set(r.empresa_id, {
        temp: r.responsavel_temporario_nome ?? "",
        original: f.responsavel_original_nome ?? "",
        periodo: `${formatDateBR(f.data_inicio)} a ${formatDateBR(f.data_fim)}`,
      });
    }

    // Filtra movimentações cuja empresa está em férias
    const rowsFerias = filtered.filter((m) => feriasMap.has(m.empresa_id));
    if (rowsFerias.length === 0) {
      toast({ title: "Nenhuma empresa em férias no período filtrado." });
      return;
    }

    const rows = rowsFerias.map((m) => {
      const status = calcularStatus(m);
      const tipo = (m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao) === "Diária" ? "Diário" : "Período";
      const info = feriasMap.get(m.empresa_id)!;
      return {
        "Contrato": m.empresas?.codigo_contrato ?? "",
        "CNPJ": m.empresas?.cnpj ?? "",
        "Empresa": m.empresas?.nome ?? "",
        "Resp. Original (Férias)": info.original,
        "Resp. Temporário": info.temp,
        "Período Férias": info.periodo,
        "Tipo": tipo,
        "Período Movimentação": ((m.empresas as any)?.tipo_movimentacao === "Diária" && (m.empresas as any)?.data_corte)
          ? `Dia ${String((m.empresas as any).data_corte).padStart(2, "0")}`
          : formatPeriodoEmpresa(m.empresas as any),
        "Envio Empresa": m.data_envio_empresa ?? "",
        "Envio Financeiro": m.data_envio_financeiro ?? "",
        "Status": status,
        "Corretora": m.empresas?.operadora_plano ?? "",
      };
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Férias");
    const headers = Object.keys(rows[0]);
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    rows.forEach((r) => ws.addRow(headers.map((h) => (r as any)[h])));
    ws.columns.forEach((c) => { c.width = 22; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_ferias_${filterMes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exportado: ${rows.length} movimentação(ões) em férias` });
  };

  const selectedEmpresa = empresas.find((e) => e.id === form.empresa_id);
  const isFechada = (form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao) === "Fechada";

  const tabs = (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("empresas")}
          className={
            activeTab === "empresas"
              ? "rounded-full bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground shadow"
              : "rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          Empresas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("administradoras")}
          className={
            activeTab === "administradoras"
              ? "rounded-full bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground shadow"
              : "rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          Administradoras
        </button>
      </div>
    </div>
  );



  if (activeTab === "administradoras") {
    return (
      <div className="space-y-6">
        {tabs}
        <DashboardAdministradoras />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {tabs}



        <div className="flex items-center justify-between">

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} movimentação(ões) encontrada(s)</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await queryClient.invalidateQueries();
                toast({ title: "Informações atualizadas" });
              }}
              className="rounded-lg"
              title="Atualizar informações"
            >
              <RefreshCw className="mr-2 h-4 w-4" />Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportExcel} className="rounded-lg">
              <Download className="mr-2 h-4 w-4" />Exportar Excel
            </Button>
            <Button variant="outline" onClick={handleExportFerias} className="rounded-lg">
              <Plane className="mr-2 h-4 w-4" />Exportar Férias
            </Button>
            {canEditDates && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              {canEdit && <DialogTrigger asChild>
                <Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" />Nova Movimentação</Button>
              </DialogTrigger>}
              <DialogContent className="sm:max-w-lg rounded-xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Empresa *</Label>
                      <Select value={form.empresa_id} onValueChange={handleEmpresaChange} disabled={!canEdit && !!editingId}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {empresas.filter((e) => (e as any).status_empresa === "Ativa").map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Mês Referência *</Label>
                      <Input type="month" value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })} required disabled={!canEdit && !!editingId} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipo Movimentação</Label>
                      <Input value={form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao ?? "—"} disabled className="bg-accent/50 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Período {isFechada ? "(fixo)" : "(automático)"}</Label>
                      {isFechada ? (
                        <Input value={form.periodo} disabled className="bg-accent/50 rounded-lg" />
                      ) : (
                        <Select value={form.periodo} onValueChange={(v) => setForm({ ...form, periodo: v })} disabled={!canEdit && !!editingId}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Responsável</Label>
                      <Input value={form.responsavel_movimentacao ?? ""} onChange={(e) => setForm({ ...form, responsavel_movimentacao: e.target.value })} disabled={!canEdit && !!editingId} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Envio p/ Empresa</Label>
                      <Input type="date" value={form.data_envio_empresa ?? ""} onChange={(e) => handleDataEnvioChange(e.target.value || null)} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Envio Financeiro</Label>
                      <div className="flex gap-2">
                        <Input type="date" value={form.data_envio_financeiro ?? ""} onChange={(e) => setForm({ ...form, data_envio_financeiro: e.target.value || null })} className="rounded-lg flex-1" />
                        {form.data_envio_financeiro && editingId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-lg shrink-0"
                            title="Limpar data de envio ao Financeiro"
                            onClick={() => {
                              if (confirm("Isso removerá o alerta enviado ao Financeiro. Deseja continuar?")) {
                                setForm({ ...form, data_envio_financeiro: null });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Observações</Label>
                    <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} disabled={!canEdit && !!editingId} className="rounded-lg" />
                  </div>

                  <AnexosMovimentacao
                    movimentacaoId={editingId}
                    empresaId={form.empresa_id || null}
                    required={!!form.data_envio_financeiro}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-lg">Cancelar</Button>
                    <Button type="submit" disabled={upsert.isPending || !form.empresa_id} className="rounded-lg">{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 flex-1 min-w-[240px]">
                <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Empresa, contrato ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-lg h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mês</Label>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[150px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mesesOptions.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Período</Label>
                <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                  <SelectTrigger className="w-[130px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[190px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Aguardando envio">Aguardando envio</SelectItem>
                    <SelectItem value="Enviado para empresa">Enviado p/ empresa</SelectItem>
                    <SelectItem value="Enviado ao financeiro">Enviado ao financeiro</SelectItem>
                    <SelectItem value="Fora do prazo">Fora do prazo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                <Input placeholder="Filtrar..." value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-[170px] rounded-lg h-9" />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Checkbox id="pendentes" checked={somentePendentes} onCheckedChange={(v) => setSomentePendentes(v === true)} />
                <Label htmlFor="pendentes" className="text-xs cursor-pointer">Somente pendentes</Label>
              </div>
              <Button
                variant={verSomenteSemEmpresa ? "destructive" : "outline"}
                size="sm"
                onClick={() => setVerSomenteSemEmpresa(!verSomenteSemEmpresa)}
                className="rounded-lg"
              >
                {verSomenteSemEmpresa ? "Mostrar todas" : "Ver sem empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Resumo Geral por Período</h2>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link to="/dashboard/geral">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Ir para Dashboard Geral
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = movimentacoes.filter((m) => {
                  if ((m.empresas as any)?.status_empresa === "Inativa") return false;
                  const statusImpl = (m.empresas as any)?.status_implantacao;
                  const primComp = (m.empresas as any)?.primeira_competencia_financeira as string | null | undefined;
                  if (statusImpl === "aguardando_primeiro_fechamento" && (!primComp || m.mes_referencia < primComp)) return false;
                  return m.periodo === p;
                });
                const done = items.filter((m) => calcularStatus(m) === "Enviado ao financeiro").length;
                const late = items.filter((m) => calcularStatus(m) === "Fora do prazo").length;
                const isActiveP = p === filterPeriodo;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFilterPeriodo(isActiveP ? "all" : p)}
                    className={`rounded-xl border p-4 text-center space-y-1.5 transition-all duration-200 ${isActiveP ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20" : "hover:bg-accent hover:shadow-sm border-border/60"}`}
                  >
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success font-medium">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive font-medium">{late} fora do prazo</div>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {movimentacoesSemEmpresa.length > 0 && (
          <Card className="border-destructive/40 rounded-xl">
            <CardContent className="pt-4 text-sm text-destructive">
              ⚠️ Existem {movimentacoesSemEmpresa.length} movimentações sem empresa vinculada.
              Verifique o cadastro ou corrija o empresa_id no banco.
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">TIPO DE MOVIMENTAÇÃO</TableHead>
                    <TableHead className="font-semibold">PERÍODO DE MOVIMENTAÇÃO</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Resp. Mov.</TableHead>
                    {activeTab !== "administradoras" && <TableHead className="font-semibold">Envio Empresa</TableHead>}
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Nota Enviada</TableHead>
                    {canEditDates && <TableHead className="w-24 font-semibold">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     <TableRow><TableCell colSpan={canEditDates ? (activeTab === "administradoras" ? 10 : 11) : (activeTab === "administradoras" ? 9 : 10)} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                   ) : filtered.length === 0 ? (
                     <TableRow><TableCell colSpan={canEditDates ? (activeTab === "administradoras" ? 10 : 11) : (activeTab === "administradoras" ? 9 : 10)} className="text-center text-muted-foreground py-12">Nenhuma movimentação encontrada</TableCell></TableRow>
                  ) : (
                    filtered.map((m) => {
                      const status = calcularStatus(m);
                      const tipo = m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? "—";
                      const notaKey = `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`;
                      const dataNota = notasMap.get(notaKey) ?? null;
                      const temPrio = !!(m.empresas as any)?.prioridade_maxima_id;
                      const prioAtiva = temPrio && !m.data_envio_financeiro;
                      const prioIntensa = prioAtiva && isPrioridadeAlertaIntenso(m.empresas as any);
                      return (
                        <TableRow key={m.id} className={`transition-colors ${!m.empresas ? "bg-destructive/5" : status === "Fora do prazo" ? "bg-destructive/5 hover:bg-destructive/10" : prioAtiva ? "bg-red-500/5 priority-row hover:bg-red-500/10" : "hover:bg-accent/50"}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              {m.empresas?.nome ?? <span className="text-destructive">Sem empresa</span>}
                              {temPrio && <PrioridadeBadge variant="compact" intense={prioIntensa} />}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="rounded-md">{tipo}</Badge></TableCell>
                          <TableCell>{m.periodo || formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                          <TableCell>
                            <Badge className={`${statusColor(status)} rounded-md`}>{status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.responsavel_movimentacao || "—"}</TableCell>
                          {activeTab !== "administradoras" && <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>}
                          <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                          <TableCell>
                            {dataNota ? (
                              <Badge className="rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                                {formatDateBR(dataNota)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          {canEditDates && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(m)} className="rounded-lg hover:bg-primary/10"><Pencil className="h-4 w-4 text-primary" /></Button>
                              {canEdit && <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)} className="rounded-lg hover:bg-destructive/10"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                            </div>
                          </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>

              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
