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
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  getCurrentMesReferencia,
  formatMesReferencia,
} from "@/lib/movimentacao-utils";

const emptyForm: Omit<TablesInsert<"movimentacoes">, "empresa_id" | "mes_referencia" | "periodo"> & {
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
} = {
  empresa_id: "",
  mes_referencia: getCurrentMesReferencia(),
  periodo: "01-05",
  data_envio_empresa: null,
  data_retorno_empresa: null,
  data_envio_financeiro: null,
  responsavel_movimentacao: "",
  observacoes: "",
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome, codigo_contrato").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas(nome, codigo_contrato)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: TablesInsert<"movimentacoes">) => {
      if (editingId) {
        const { error } = await supabase.from("movimentacoes").update(values).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("movimentacoes").insert(values);
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

  const openEdit = (m: Movimentacao) => {
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
    });
    setDialogOpen(true);
  };

  const filtered = useMemo(() => {
    return movimentacoes.filter((m) => {
      const status = calcularStatus(m);
      if (filterPeriodo !== "all" && m.periodo !== filterPeriodo) return false;
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterResponsavel && !(m.responsavel_movimentacao ?? "").toLowerCase().includes(filterResponsavel.toLowerCase())) return false;
      if (somentePendentes && status === "Enviado ao financeiro") return false;
      return true;
    });
  }, [movimentacoes, filterPeriodo, filterStatus, filterResponsavel, somentePendentes]);

  // Generate month options (current + 11 previous)
  const mesesOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const responsaveis = useMemo(() => {
    const set = new Set(movimentacoes.map((m) => m.responsavel_movimentacao).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [movimentacoes]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova Movimentação</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mês Referência *</Label>
                    <Input type="month" value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Período *</Label>
                    <Select value={form.periodo} onValueChange={(v) => setForm({ ...form, periodo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Input value={form.responsavel_movimentacao ?? ""} onChange={(e) => setForm({ ...form, responsavel_movimentacao: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Envio p/ Empresa</Label>
                    <Input type="date" value={form.data_envio_empresa ?? ""} onChange={(e) => setForm({ ...form, data_envio_empresa: e.target.value || null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Retorno Empresa</Label>
                    <Input type="date" value={form.data_retorno_empresa ?? ""} onChange={(e) => setForm({ ...form, data_retorno_empresa: e.target.value || null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Envio Financeiro</Label>
                    <Input type="date" value={form.data_envio_financeiro ?? ""} onChange={(e) => setForm({ ...form, data_envio_financeiro: e.target.value || null })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button type="submit" disabled={upsert.isPending || !form.empresa_id}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
                    <SelectItem value="Retornado pela empresa">Retornado</SelectItem>
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
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cód. Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Envio Empresa</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma movimentação encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((m) => {
                    const status = calcularStatus(m);
                    return (
                      <TableRow key={m.id} className={status === "Fora do prazo" ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                        <TableCell>{m.empresas?.codigo_contrato || "—"}</TableCell>
                        <TableCell>{m.periodo}</TableCell>
                        <TableCell>
                          <Badge className={statusColor(status)}>{status}</Badge>
                        </TableCell>
                        <TableCell>{m.responsavel_movimentacao || "—"}</TableCell>
                        <TableCell>{m.data_envio_empresa || "—"}</TableCell>
                        <TableCell>{m.data_retorno_empresa || "—"}</TableCell>
                        <TableCell>{m.data_envio_financeiro || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
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
