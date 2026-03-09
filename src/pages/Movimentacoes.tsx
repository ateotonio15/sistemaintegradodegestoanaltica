import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { AppLayout } from "@/components/AppLayout";
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
import { Plus, Pencil, Trash2, Download } from "lucide-react";
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
  formatDateBR,
} from "@/lib/movimentacao-utils";
import * as XLSX from "xlsx";

type EmpresaOption = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  responsavel_contrato: string | null;
  data_corte: number | null;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [verSomenteSemEmpresa, setVerSomenteSemEmpresa] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isExecutivo, role } = useAuth();
  const canEdit = isAdmin; // admin can do full CRUD
  const canEditDates = isAdmin || role === "comum"; // common users can edit dates

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa, data_corte")
        .order("nome");
      if (error) throw error;
      return data as EmpresaOption[];
    },
  });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      console.log("[Movimentacoes] Supabase raw response:", { data, error });
      if (error) throw error;
      console.log("Movimentações carregadas:", data);
      return data as (Movimentacao & { empresas?: { responsavel_contrato: string | null } | null })[];
    },
  });

  const movimentacoesSemEmpresa = useMemo(() => {
    return movimentacoes.filter((m) => !m.empresa_id || !m.empresas);
  }, [movimentacoes]);

  console.log("Sem empresa:", movimentacoesSemEmpresa);

  const handleEmpresaChange = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    const tipo = empresa?.tipo_movimentacao ?? "Fechada";
    let periodo = form.periodo;
    if (tipo === "Fechada" && empresa?.periodo_movimentacao) {
      periodo = empresa.periodo_movimentacao;
    } else if (tipo === "Diária" && empresa?.data_corte) {
      periodo = periodoDaDataCorte(empresa.data_corte);
    }
    setForm({ ...form, empresa_id: empresaId, tipo_movimentacao: tipo, periodo });
  };

  const handleDataEnvioChange = (dateStr: string | null) => {
    const newForm = { ...form, data_envio_empresa: dateStr };
    if (form.tipo_movimentacao === "Diária" && dateStr) {
      newForm.periodo = calcularPeriodoPorData(dateStr);
    }
    setForm(newForm);
  };

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
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
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Movimentação atualizada!" : "Movimentação criada!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
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
    return movimentacoes.filter((m) => {
      // Ocultar empresas inativas
      if ((m.empresas as any)?.status_empresa === "Inativa") return false;
      if (verSomenteSemEmpresa) return !m.empresas;
      const status = calcularStatus(m);
      if (filterPeriodo !== "all" && m.periodo !== filterPeriodo) return false;
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterResponsavel && !(m.responsavel_movimentacao ?? "").toLowerCase().includes(filterResponsavel.toLowerCase())) return false;
      if (somentePendentes && status === "Enviado ao financeiro") return false;
      return true;
    });
  }, [movimentacoes, filterPeriodo, filterStatus, filterResponsavel, somentePendentes, verSomenteSemEmpresa]);

  const mesesOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const handleExportExcel = () => {
    const rows = filtered.map((m) => {
      const status = calcularStatus(m);
      const tipo = m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? "";
      return {
        Empresa: m.empresas?.nome ?? "",
        "Cód. Contrato": m.empresas?.codigo_contrato ?? "",
        "Resp. Contrato": (m.empresas as any)?.responsavel_contrato ?? "",
        "Tipo de Contrato": tipo === "Diária" ? "Diário" : "Período",
        Período: m.periodo,
        "Data Envio Empresa": m.data_envio_empresa ?? "",
        
        "Data Financeiro": m.data_envio_financeiro ?? "",
        Status: status,
        "Dentro do Prazo": m.dentro_prazo ? "Sim" : "Não",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `movimentacoes_${filterMes}.xlsx`);
  };

  const selectedEmpresa = empresas.find((e) => e.id === form.empresa_id);
  const isFechada = (form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao) === "Fechada";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="mr-2 h-4 w-4 text-icon" />Exportar Excel
            </Button>
            {canEditDates && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              {canEdit && <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Nova Movimentação</Button>
              </DialogTrigger>}
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Empresa *</Label>
                      <Select value={form.empresa_id} onValueChange={handleEmpresaChange} disabled={!canEdit && !!editingId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {empresas.filter((e) => (e as any).status_empresa === "Ativa").map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mês Referência *</Label>
                      <Input type="month" value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })} required disabled={!canEdit && !!editingId} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo Movimentação</Label>
                      <Input value={form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao ?? "—"} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Período {isFechada ? "(fixo)" : "(automático)"}</Label>
                      {isFechada ? (
                        <Input value={form.periodo} disabled className="bg-muted" />
                      ) : (
                        <Select value={form.periodo} onValueChange={(v) => setForm({ ...form, periodo: v })} disabled={!canEdit && !!editingId}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Input value={form.responsavel_movimentacao ?? ""} onChange={(e) => setForm({ ...form, responsavel_movimentacao: e.target.value })} disabled={!canEdit && !!editingId} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Envio p/ Empresa</Label>
                      <Input type="date" value={form.data_envio_empresa ?? ""} onChange={(e) => handleDataEnvioChange(e.target.value || null)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Envio Financeiro</Label>
                      <Input type="date" value={form.data_envio_financeiro ?? ""} onChange={(e) => setForm({ ...form, data_envio_financeiro: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} disabled={!canEdit && !!editingId} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                    <Button type="submit" disabled={upsert.isPending || !form.empresa_id}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mesesOptions.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Aguardando envio">Aguardando envio</SelectItem>
                    <SelectItem value="Enviado para empresa">Enviado p/ empresa</SelectItem>
                    
                    <SelectItem value="Enviado ao financeiro">Enviado ao financeiro</SelectItem>
                    <SelectItem value="Fora do prazo">Fora do prazo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Input placeholder="Filtrar..." value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-[160px]" />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Checkbox id="pendentes" checked={somentePendentes} onCheckedChange={(v) => setSomentePendentes(v === true)} />
                <Label htmlFor="pendentes" className="text-xs cursor-pointer">Somente pendentes</Label>
              </div>
              <Button
                variant={verSomenteSemEmpresa ? "destructive" : "outline"}
                size="sm"
                onClick={() => setVerSomenteSemEmpresa(!verSomenteSemEmpresa)}
              >
                {verSomenteSemEmpresa ? "Mostrar todas" : "Ver sem empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {movimentacoesSemEmpresa.length > 0 && (
          <Card className="border-destructive/40">
            <CardContent className="pt-4 text-sm text-destructive">
              ⚠️ Existem {movimentacoesSemEmpresa.length} movimentações sem empresa vinculada.
              Verifique o cadastro ou corrija o empresa_id no banco.
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cód. Contrato</TableHead>
                  <TableHead>Resp. Contrato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resp. Mov.</TableHead>
                  <TableHead>Envio Empresa</TableHead>
                  
                  <TableHead>Financeiro</TableHead>
                  {canEditDates && <TableHead className="w-24">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow><TableCell colSpan={canEditDates ? 10 : 9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                 ) : filtered.length === 0 ? (
                   <TableRow><TableCell colSpan={canEditDates ? 10 : 9} className="text-center text-muted-foreground py-8">Nenhuma movimentação encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((m) => {
                    const status = calcularStatus(m);
                    const tipo = m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? "—";
                    return (
                      <TableRow key={m.id} className={!m.empresas ? "bg-destructive/10" : status === "Fora do prazo" ? "bg-destructive/10" : ""}>
                        <TableCell className="font-medium">
                          {m.empresas?.nome ?? <span className="text-destructive">Sem empresa</span>}
                        </TableCell>
                        <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                        <TableCell>{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{tipo}</Badge></TableCell>
                        <TableCell>{m.periodo}</TableCell>
                        <TableCell>
                          <Badge className={statusColor(status)}>{status}</Badge>
                        </TableCell>
                        <TableCell>{m.responsavel_movimentacao || "—"}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                        
                        <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                        {canEditDates && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4 text-icon" /></Button>
                            {canEdit && <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
