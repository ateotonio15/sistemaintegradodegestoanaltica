import { useState, useRef, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, Search, Upload, Building2 } from "lucide-react";
import { PERIODOS, formatDateBR } from "@/lib/movimentacao-utils";
import * as XLSX from "xlsx";

type Empresa = Tables<"empresas">;

const GRUPO_CONTRATO_OPTIONS = [
  "Compulsória - Sem Dependentes",
  "Adesão - Titular / Dependente",
  "Compulsória - Titular / Adesão - Dependente",
  "Compulsória - Todos",
];

const emptyForm: TablesInsert<"empresas"> & { responsavel_user_id?: string | null } = {
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
  responsavel_user_id: null,
  telefone_empresa: "",
  contato_empresa: "",
};

export default function Empresas() {
  const [search, setSearch] = useState("");
  const [showInativas, setShowInativas] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEmpresa, setDetailEmpresa] = useState<Empresa | null>(null);
  const [rescisaoDate, setRescisaoDate] = useState("");
  const [showRescisaoInput, setShowRescisaoInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [dataImplantacao, setDataImplantacao] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, role, isViewOnly, isExecutivo, user } = useAuth();
  const canEdit = !isViewOnly && (isAdmin || role === "comum");
  const isComum = role === "comum";

  const { data: usuarios = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: canEdit,
  });

  const { data: userRolesList = [] } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: canEdit,
  });

  const executivoUsers = usuarios.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "executivo"));
  const comunUsers = usuarios.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "comum"));

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      const payload: any = { ...values };
      if (payload.tipo_movimentacao === "Diária") {
        payload.periodo_movimentacao = null;
      }
      if (dataImplantacao) {
        payload.data_implantacao = dataImplantacao;
      }
      if (payload.responsavel_user_id) {
        const selectedUser = comunUsers.find((u) => u.user_id === payload.responsavel_user_id)
          || usuarios.find((u) => u.user_id === payload.responsavel_user_id);
        payload.responsavel_contrato = selectedUser?.display_name || payload.responsavel_contrato;
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
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Empresa atualizada!" : "Empresa cadastrada!" });
    },
    onError: () => toast({ title: "Erro ao salvar empresa", variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, dataRescisao }: { id: string; newStatus: string; dataRescisao: string | null }) => {
      const { error } = await supabase.from("empresas").update({
        status_empresa: newStatus,
        data_rescisao: dataRescisao,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: "Status da empresa atualizado!" });
      setDetailEmpresa(null);
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: "Empresa excluída!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: TablesInsert<"empresas">[]) => {
      const { error } = await supabase.from("empresas").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: `${vars.length} empresa(s) importada(s) com sucesso!` });
    },
    onError: () => toast({ title: "Erro ao importar empresas", variant: "destructive" }),
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const rows: TablesInsert<"empresas">[] = jsonData.map((row) => ({
          nome: String(row["NOME_EMPRESA"] || row["nome"] || row["Nome"] || ""),
          codigo_contrato: String(row["CODIGO_CONTRATO"] || row["codigo_contrato"] || row["Código do Contrato"] || ""),
          responsavel_contrato: String(row["RESPONSAVEL_CONTRATO"] || row["responsavel_contrato"] || row["Responsável"] || ""),
        })).filter((r) => r.nome);
        if (rows.length === 0) {
          toast({ title: "Nenhuma empresa encontrada na planilha", variant: "destructive" });
          return;
        }
        importMutation.mutate(rows);
      } catch {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDataImplantacao("");
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
      responsavel_user_id: (e as any).responsavel_user_id ?? null,
      executiva_user_id: (e as any).executiva_user_id ?? null,
      prazo: (e as any).prazo ?? "",
      grupo_contrato: (e as any).grupo_contrato ?? "",
      telefone_empresa: (e as any).telefone_empresa ?? "",
      contato_empresa: (e as any).contato_empresa ?? "",
    } as any);
    setDataImplantacao((e as any).data_implantacao ?? "");
    setDialogOpen(true);
  };

  const getResponsavelName = (empresa: Empresa) => {
    const userId = (empresa as any).responsavel_user_id;
    if (userId) {
      const user = usuarios.find((u) => u.user_id === userId);
      if (user) return user.display_name || "—";
    }
    return empresa.responsavel_contrato || "—";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = empresas;

    // Executivo: show only their linked companies
    if (isExecutivo && user) {
      list = list.filter((e) => (e as any).responsavel_user_id === user.id);
    }

    return list
      .filter((e) => showInativas ? e.status_empresa === "Inativa" : e.status_empresa !== "Inativa")
      .filter((e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.codigo_contrato ?? "").toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q)
      );
  }, [empresas, search, showInativas, isExecutivo, user]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Executivo summary */}
        {isExecutivo && (
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suas empresas vinculadas</p>
                <p className="text-2xl font-bold">{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isExecutivo ? `Você possui ${filtered.length} empresa(s) vinculada(s)` : `${filtered.length} empresa(s) ${showInativas ? "inativas" : "ativas"}`}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} className="rounded-lg">
                <Upload className="mr-2 h-4 w-4" />{importMutation.isPending ? "Importando..." : "Importar Excel"}
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" />Nova Empresa</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
                  <DialogHeader><DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Nome *</Label>
                        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">CNPJ</Label>
                        <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Código do Contrato *</Label>
                        <Input value={form.codigo_contrato ?? ""} onChange={(e) => setForm({ ...form, codigo_contrato: e.target.value })} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Executiva Responsável *</Label>
                        <Select
                          value={form.responsavel_user_id ?? ""}
                          onValueChange={(v) => setForm({ ...form, responsavel_user_id: v || null })}
                        >
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione a executiva" /></SelectTrigger>
                          <SelectContent>
                            {executivoUsers.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.display_name || u.user_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Data de Implantação *</Label>
                        <Input type="date" value={dataImplantacao} onChange={(e) => setDataImplantacao(e.target.value)} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Corretora</Label>
                        <Input value={form.operadora_plano ?? ""} onChange={(e) => setForm({ ...form, operadora_plano: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo de Contrato *</Label>
                        <Select value={form.tipo_movimentacao ?? "Fechada"} onValueChange={(v) => setForm({ ...form, tipo_movimentacao: v })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Diária">Diário</SelectItem>
                            <SelectItem value="Fechada">Período</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.tipo_movimentacao === "Fechada" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Período de Movimentação *</Label>
                          <Select value={form.periodo_movimentacao ?? ""} onValueChange={(v) => setForm({ ...form, periodo_movimentacao: v })}>
                            <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {form.tipo_movimentacao === "Diária" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Data de Corte (dia) *</Label>
                          <Input type="number" min={1} max={31} value={form.data_corte ?? ""} onChange={(e) => setForm({ ...form, data_corte: e.target.value ? Number(e.target.value) : null })} required className="rounded-lg" />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">E-mail da Empresa</Label>
                        <Input type="email" value={form.email_empresa ?? ""} onChange={(e) => setForm({ ...form, email_empresa: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Telefone da Empresa</Label>
                        <Input value={(form as any).telefone_empresa ?? ""} onChange={(e) => setForm({ ...form, telefone_empresa: e.target.value } as any)} placeholder="(92) 99999-9999" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Contato da Empresa</Label>
                        <Input value={(form as any).contato_empresa ?? ""} onChange={(e) => setForm({ ...form, contato_empresa: e.target.value } as any)} placeholder="Nome do contato" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Prazo (Entrada sem carência)</Label>
                        <Input value={(form as any).prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value } as any)} placeholder="Ex: 30 dias" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Grupo de Contrato</Label>
                        <Select value={(form as any).grupo_contrato ?? ""} onValueChange={(v) => setForm({ ...form, grupo_contrato: v } as any)}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                          <SelectContent>
                            {GRUPO_CONTRATO_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status da Empresa</Label>
                        <Select value={form.status_empresa ?? "Ativa"} onValueChange={(v) => setForm({ ...form, status_empresa: v })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ativa">Ativa</SelectItem>
                            <SelectItem value="Inativa">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Observações</Label>
                      <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-lg">Cancelar</Button>
                      <Button type="submit" disabled={upsert.isPending} className="rounded-lg">{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg" />
          </div>
          <Button
            variant={showInativas ? "default" : "outline"}
            onClick={() => setShowInativas(!showInativas)}
            className="rounded-lg"
          >
            {showInativas ? "Ver Ativas" : "Ver Inativas"}
          </Button>
        </div>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold">Corretora</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Período / Corte</TableHead>
                    <TableHead className="font-semibold">Implantação</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {canEdit && <TableHead className="w-24 font-semibold">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground py-12">{isExecutivo ? "Você não possui empresas vinculadas." : "Nenhuma empresa encontrada"}</TableCell></TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setDetailEmpresa(e)}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{e.codigo_contrato || "—"}</TableCell>
                        <TableCell>{getResponsavelName(e)}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{e.cnpj || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.operadora_plano || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-md">{e.tipo_movimentacao === "Diária" ? "Diário" : "Período"}</Badge>
                        </TableCell>
                        <TableCell>
                          {e.tipo_movimentacao === "Diária"
                            ? `Corte: dia ${e.data_corte ?? "—"}`
                            : e.periodo_movimentacao || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateBR(e.data_implantacao)}</TableCell>
                        <TableCell>
                          <Badge variant={e.status_empresa === "Ativa" ? "default" : "secondary"} className="rounded-md">
                            {e.status_empresa ?? "Ativa"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(e)} className="rounded-lg hover:bg-primary/10"><Pencil className="h-4 w-4 text-primary" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)} className="rounded-lg hover:bg-destructive/10"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={!!detailEmpresa} onOpenChange={(open) => { if (!open) { setDetailEmpresa(null); setShowRescisaoInput(false); setRescisaoDate(""); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Empresa</DialogTitle>
              <DialogDescription>Informações completas da empresa cadastrada.</DialogDescription>
            </DialogHeader>
            {detailEmpresa && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Dados do Contrato</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Empresa</p><p className="font-medium mt-0.5">{detailEmpresa.nome || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Código do Contrato</p><p className="font-medium mt-0.5">{detailEmpresa.codigo_contrato || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">CNPJ</p><p className="font-medium mt-0.5 font-mono text-sm">{detailEmpresa.cnpj || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Operadora / Corretora</p><p className="font-medium mt-0.5">{detailEmpresa.operadora_plano || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Tipo de Movimentação</p><p className="font-medium mt-0.5">{detailEmpresa.tipo_movimentacao === "Diária" ? "Diário" : "Período"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Período de Movimentação</p><p className="font-medium mt-0.5">{detailEmpresa.periodo_movimentacao || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Data de Implantação</p><p className="font-medium mt-0.5">{formatDateBR(detailEmpresa.data_implantacao) || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Data de Corte</p><p className="font-medium mt-0.5">{detailEmpresa.data_corte ? `Dia ${detailEmpresa.data_corte}` : "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">E-mail da Empresa</p><p className="font-medium mt-0.5">{detailEmpresa.email_empresa || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Telefone da Empresa</p><p className="font-medium mt-0.5">{(detailEmpresa as any).telefone_empresa || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Contato da Empresa</p><p className="font-medium mt-0.5">{(detailEmpresa as any).contato_empresa || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Prazo (Entrada sem carência)</p><p className="font-medium mt-0.5">{(detailEmpresa as any).prazo || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Grupo de Contrato</p><p className="font-medium mt-0.5">{(detailEmpresa as any).grupo_contrato || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Status da Empresa</p>
                      <Badge variant={detailEmpresa.status_empresa === "Ativa" ? "default" : "secondary"} className="mt-1 rounded-md">
                        {detailEmpresa.status_empresa ?? "Ativa"}
                      </Badge>
                    </div>
                    {detailEmpresa.status_empresa === "Inativa" && (
                      <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Data de Rescisão do Contrato</p><p className="font-medium mt-0.5">{formatDateBR((detailEmpresa as any).data_rescisao) || "—"}</p></div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Responsável</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Responsável pelo Contrato</p><p className="font-medium mt-0.5">{detailEmpresa.responsavel_contrato || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Usuário Responsável</p><p className="font-medium mt-0.5">{getResponsavelName(detailEmpresa)}</p></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Informações Operacionais</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Observações</p><p className="font-medium mt-0.5">{detailEmpresa.observacoes || "—"}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Data de Criação</p><p className="font-medium mt-0.5">{formatDateBR(detailEmpresa.created_at)}</p></div>
                    <div className="p-3 rounded-lg bg-accent/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Última Atualização</p><p className="font-medium mt-0.5">{formatDateBR(detailEmpresa.updated_at)}</p></div>
                  </div>
                </div>
              </div>
            )}
            {(isComum || isAdmin) && detailEmpresa && detailEmpresa.status_empresa === "Ativa" && showRescisaoInput && (
              <div className="border rounded-xl p-4 space-y-3 bg-accent/30">
                <Label className="text-sm font-medium">Data de Rescisão do Contrato *</Label>
                <Input
                  type="date"
                  value={rescisaoDate}
                  onChange={(e) => setRescisaoDate(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {(isComum || isAdmin) && detailEmpresa && (
                <>
                  {detailEmpresa.status_empresa === "Ativa" ? (
                    showRescisaoInput ? (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowRescisaoInput(false); setRescisaoDate(""); }} className="rounded-lg">Cancelar</Button>
                        <Button
                          variant="destructive"
                          className="rounded-lg"
                          disabled={toggleStatusMutation.isPending || !rescisaoDate}
                          onClick={() => {
                            if (!rescisaoDate) {
                              toast({ title: "Informe a data de rescisão", variant: "destructive" });
                              return;
                            }
                            toggleStatusMutation.mutate({ id: detailEmpresa.id, newStatus: "Inativa", dataRescisao: rescisaoDate });
                            setShowRescisaoInput(false);
                            setRescisaoDate("");
                          }}
                        >
                          {toggleStatusMutation.isPending ? "Atualizando..." : "Confirmar Inativação"}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="destructive" onClick={() => setShowRescisaoInput(true)} className="rounded-lg">Inativar Contrato</Button>
                    )
                  ) : (
                    <Button
                      variant="default"
                      className="rounded-lg"
                      disabled={toggleStatusMutation.isPending}
                      onClick={() => toggleStatusMutation.mutate({ id: detailEmpresa.id, newStatus: "Ativa", dataRescisao: null })}
                    >
                      {toggleStatusMutation.isPending ? "Atualizando..." : "Reativar Contrato"}
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" onClick={() => { setDetailEmpresa(null); setShowRescisaoInput(false); setRescisaoDate(""); }} className="rounded-lg">Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
