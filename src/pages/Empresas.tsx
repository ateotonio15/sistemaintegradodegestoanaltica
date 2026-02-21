import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PERIODOS } from "@/lib/movimentacao-utils";

type Empresa = Tables<"empresas">;

const emptyForm: TablesInsert<"empresas"> = {
  nome: "",
  cnpj: "",
  codigo_contrato: "",
  responsavel_contrato: "",
  operadora_plano: "",
  data_corte: null,
  dia_movimentacao: null,
  tipo_movimentacao: "Fechada",
  periodo_movimentacao: null,
  email_empresa: "",
  status_empresa: "Ativa",
  observacoes: "",
};

export default function Empresas() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TablesInsert<"empresas">>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: TablesInsert<"empresas">) => {
      // If Diária, clear periodo_movimentacao
      const payload = { ...values };
      if (payload.tipo_movimentacao === "Diária") {
        payload.periodo_movimentacao = null;
      }
      if (editingId) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Empresa atualizada!" : "Empresa cadastrada!" });
    },
    onError: () => toast({ title: "Erro ao salvar empresa", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast({ title: "Empresa excluída!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openEdit = (e: Empresa) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      cnpj: e.cnpj ?? "",
      codigo_contrato: e.codigo_contrato ?? "",
      responsavel_contrato: e.responsavel_contrato ?? "",
      operadora_plano: e.operadora_plano ?? "",
      data_corte: e.data_corte,
      dia_movimentacao: e.dia_movimentacao,
      tipo_movimentacao: e.tipo_movimentacao ?? "Fechada",
      periodo_movimentacao: e.periodo_movimentacao,
      email_empresa: e.email_empresa ?? "",
      status_empresa: e.status_empresa ?? "Ativa",
      observacoes: e.observacoes ?? "",
    });
    setDialogOpen(true);
  };

  const filtered = empresas.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova Empresa</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Código do Contrato</Label>
                    <Input value={form.codigo_contrato ?? ""} onChange={(e) => setForm({ ...form, codigo_contrato: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Operadora / Plano</Label>
                    <Input value={form.operadora_plano ?? ""} onChange={(e) => setForm({ ...form, operadora_plano: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável pelo Contrato</Label>
                    <Input value={form.responsavel_contrato ?? ""} onChange={(e) => setForm({ ...form, responsavel_contrato: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Movimentação</Label>
                    <Select value={form.tipo_movimentacao ?? "Fechada"} onValueChange={(v) => setForm({ ...form, tipo_movimentacao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Diária">Diária</SelectItem>
                        <SelectItem value="Fechada">Fechada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.tipo_movimentacao === "Fechada" && (
                    <div className="space-y-2">
                      <Label>Período de Movimentação *</Label>
                      <Select value={form.periodo_movimentacao ?? ""} onValueChange={(v) => setForm({ ...form, periodo_movimentacao: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Data de Corte (dia)</Label>
                    <Input type="number" min={1} max={31} value={form.data_corte ?? ""} onChange={(e) => setForm({ ...form, data_corte: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail da Empresa</Label>
                    <Input type="email" value={form.email_empresa ?? ""} onChange={(e) => setForm({ ...form, email_empresa: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status da Empresa</Label>
                    <Select value={form.status_empresa ?? "Ativa"} onValueChange={(v) => setForm({ ...form, status_empresa: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativa">Ativa</SelectItem>
                        <SelectItem value="Inativa">Inativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cód. Contrato</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo Mov.</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Operadora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                 <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell>{e.codigo_contrato || "—"}</TableCell>
                      <TableCell>{e.cnpj || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.tipo_movimentacao ?? "Fechada"}</Badge>
                      </TableCell>
                      <TableCell>{e.periodo_movimentacao || "—"}</TableCell>
                      <TableCell>{e.operadora_plano || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.status_empresa === "Ativa" ? "default" : "secondary"}>
                          {e.status_empresa ?? "Ativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
