import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Plus, Building2, Clock, ChevronLeft, ChevronRight, MapPin, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const TIPOS_PALESTRA = [
  "Palestra de Saúde",
  "Ação P.A + GLICEMIA + BIO",
];

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Agendamento {
  id: string;
  empresa_id: string;
  tipo_palestra: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  enfermeira_user_id: string;
  observacao: string | null;
  status: string;
  endereco_empresa: string | null;
  created_at: string;
}

interface EmpresaSaude {
  id: string;
  nome: string;
  endereco: string | null;
}

export default function SaudeEmpresas() {
  const { user, isAdmin, isEnfermeira, isExecutivo } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isExecutivo;
  const canCreate = isAdmin || isEnfermeira || isExecutivo;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ data: "", hora_inicio: "", hora_fim: "" });
  const [form, setForm] = useState({
    empresa_id: "",
    tipo_palestra: "",
    data: "",
    hora_inicio: "",
    hora_fim: "",
    enfermeira_user_id: "",
    observacao: "",
    endereco_empresa: "",
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, endereco")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return data as EmpresaSaude[];
    },
    enabled: !!user,
  });

  const { data: enfermeiras = [] } = useQuery({
    queryKey: ["enfermeiras-profiles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "enfermeira");
      if (!roles || roles.length === 0) return [];
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      return profiles || [];
    },
    enabled: !!user,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["saude-agendamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saude_agendamentos").select("*").order("data", { ascending: true });
      if (error) throw error;
      return data as Agendamento[];
    },
    enabled: !!user,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-saude"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel("saude-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "saude_agendamentos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["saude-agendamentos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    allProfiles.forEach((p) => m.set(p.user_id, p.display_name || "Sem nome"));
    return m;
  }, [allProfiles]);

  const empresaMap = useMemo(() => {
    const m = new Map<string, EmpresaSaude>();
    empresas.forEach((e) => m.set(e.id, e));
    return m;
  }, [empresas]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const agendamentosByDate = useMemo(() => {
    const map = new Map<string, Agendamento[]>();
    agendamentos.forEach((a) => {
      const existing = map.get(a.data) || [];
      existing.push(a);
      map.set(a.data, existing);
    });
    return map;
  }, [agendamentos]);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const today = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  const getEventColor = (a: Agendamento) => {
    if (a.status === "cancelado") return "bg-destructive/20 text-destructive border-destructive/30";
    if (a.status === "reagendado") return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmado":
        return <Badge className="rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">✅ Confirmado</Badge>;
      case "cancelado":
        return <Badge className="rounded-lg bg-destructive/10 text-destructive border-destructive/30">❌ Cancelado</Badge>;
      case "reagendado":
        return <Badge className="rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">🔄 Reagendado</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-lg">{status}</Badge>;
    }
  };

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
  };

  // Handle empresa selection - auto-fill address
  const handleEmpresaChange = (empresaId: string) => {
    const emp = empresaMap.get(empresaId);
    setForm({
      ...form,
      empresa_id: empresaId,
      endereco_empresa: emp?.endereco || "",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: conflicts } = await supabase
        .from("saude_agendamentos")
        .select("id")
        .eq("enfermeira_user_id", values.enfermeira_user_id)
        .eq("data", values.data)
        .neq("status", "cancelado")
        .or(`and(hora_inicio.lt.${values.hora_fim},hora_fim.gt.${values.hora_inicio})`);

      if (conflicts && conflicts.length > 0) {
        throw new Error("Conflito de horário: esta enfermeira já tem um agendamento nesse período.");
      }

      const { error } = await supabase.from("saude_agendamentos").insert({
        empresa_id: values.empresa_id,
        tipo_palestra: values.tipo_palestra,
        data: values.data,
        hora_inicio: values.hora_inicio,
        hora_fim: values.hora_fim,
        enfermeira_user_id: values.enfermeira_user_id,
        observacao: values.observacao || null,
        endereco_empresa: values.endereco_empresa || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saude-agendamentos"] });
      setShowNewDialog(false);
      resetForm();
      toast({ title: "Agendamento criado com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar agendamento", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, data, hora_inicio, hora_fim }: { id: string; status: string; data?: string; hora_inicio?: string; hora_fim?: string }) => {
      const updateObj: any = { status };
      if (data) updateObj.data = data;
      if (hora_inicio) updateObj.hora_inicio = hora_inicio;
      if (hora_fim) updateObj.hora_fim = hora_fim;
      const { error } = await supabase.from("saude_agendamentos").update(updateObj).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saude-agendamentos"] });
      setShowDetailDialog(false);
      setIsEditing(false);
      toast({ title: "Status atualizado!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({ empresa_id: "", tipo_palestra: "", data: "", hora_inicio: "", hora_fim: "", enfermeira_user_id: isEnfermeira ? (user?.id || "") : "", observacao: "", endereco_empresa: "" });
  };

  const handleCreate = () => {
    if (!form.empresa_id || !form.tipo_palestra || !form.data || !form.hora_inicio || !form.hora_fim || !form.enfermeira_user_id) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (form.hora_fim <= form.hora_inicio) {
      toast({ title: "Hora fim deve ser maior que hora início", variant: "destructive" });
      return;
    }
    createMutation.mutate(form);
  };

  const openDetail = (a: Agendamento) => {
    setSelectedAgendamento(a);
    setIsEditing(false);
    setEditForm({ data: a.data, hora_inicio: a.hora_inicio, hora_fim: a.hora_fim });
    setShowDetailDialog(true);
  };

  const handleReagendar = () => {
    if (!selectedAgendamento) return;
    if (isEditing) {
      if (editForm.hora_fim <= editForm.hora_inicio) {
        toast({ title: "Hora fim deve ser maior que hora início", variant: "destructive" });
        return;
      }
      updateStatusMutation.mutate({
        id: selectedAgendamento.id,
        status: "reagendado",
        data: editForm.data,
        hora_inicio: editForm.hora_inicio,
        hora_fim: editForm.hora_fim,
      });
    } else {
      setIsEditing(true);
    }
  };

  const totalMes = agendamentos.filter((a) => a.data.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;
  const totalHoje = agendamentos.filter((a) => a.data === today).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-primary" />
              Saúde nas Empresas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Agendamentos de palestras e ações de saúde</p>
          </div>
          {canCreate && (
            <Button onClick={() => { resetForm(); setShowNewDialog(true); }} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Novo Agendamento
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agendamentos.length}</p>
                <p className="text-xs text-muted-foreground">Total de Agendamentos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMes}</p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHoje}</p>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg">{MESES[month]} {year}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />;
                const dateStr = getDateStr(day);
                const events = agendamentosByDate.get(dateStr) || [];
                const isToday = dateStr === today;

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[80px] border rounded-xl p-1.5 transition-colors ${isToday ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, 2).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openDetail(a)}
                          className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded-md border truncate transition-colors hover:opacity-80 ${getEventColor(a)}`}
                        >
                          {a.hora_inicio.slice(0, 5)} {empresaMap.get(a.empresa_id)?.nome || "Empresa"}
                        </button>
                      ))}
                      {events.length > 2 && (
                        <span className="text-[10px] text-muted-foreground px-1">+{events.length - 2} mais</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500" /> Confirmado</div>
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-500" /> Reagendado</div>
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-destructive" /> Cancelado</div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming list */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Enfermeira</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendamentos
                    .filter((a) => a.data >= today)
                    .slice(0, 20)
                    .map((a) => (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openDetail(a)}>
                        <TableCell className="font-medium">{a.data.split("-").reverse().join("/")}</TableCell>
                        <TableCell>{a.hora_inicio.slice(0, 5)} - {a.hora_fim.slice(0, 5)}</TableCell>
                        <TableCell>{empresaMap.get(a.empresa_id)?.nome || "—"}</TableCell>
                        <TableCell>{a.tipo_palestra}</TableCell>
                        <TableCell>{profileMap.get(a.enfermeira_user_id) || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{a.endereco_empresa || "—"}</TableCell>
                        <TableCell>{getStatusBadge(a.status)}</TableCell>
                      </TableRow>
                    ))}
                  {agendamentos.filter((a) => a.data >= today).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum agendamento futuro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Novo Agendamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={handleEmpresaChange}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endereço da Empresa</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="rounded-xl pl-9"
                  placeholder="Endereço..."
                  value={form.endereco_empresa}
                  onChange={(e) => setForm({ ...form, endereco_empresa: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Tipo da Palestra *</Label>
              <Select value={form.tipo_palestra} onValueChange={(v) => setForm({ ...form, tipo_palestra: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PALESTRA.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" className="rounded-xl" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div>
                <Label>Hora Início *</Label>
                <Input type="time" className="rounded-xl" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Hora Fim *</Label>
                <Input type="time" className="rounded-xl" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Enfermeira Responsável *</Label>
              {isEnfermeira ? (
                <Input className="rounded-xl" disabled value={profileMap.get(user?.id || "") || "Você"} />
              ) : (
                <Select value={form.enfermeira_user_id} onValueChange={(v) => setForm({ ...form, enfermeira_user_id: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a enfermeira" /></SelectTrigger>
                  <SelectContent>
                    {enfermeiras.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.display_name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea className="rounded-xl" placeholder="Observações opcionais..." value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
              <Button className="rounded-xl" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(v) => { setShowDetailDialog(v); if (!v) setIsEditing(false); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
          </DialogHeader>
          {selectedAgendamento && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{empresaMap.get(selectedAgendamento.empresa_id)?.nome || "—"}</span>
              </div>
              {selectedAgendamento.endereco_empresa && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedAgendamento.endereco_empresa}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Tipo</p>
                  <p className="font-medium">{selectedAgendamento.tipo_palestra}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  {isEditing ? (
                    <Input type="date" className="rounded-lg h-8 text-sm" value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} />
                  ) : (
                    <p className="font-medium">{selectedAgendamento.data.split("-").reverse().join("/")}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Horário</p>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Input type="time" className="rounded-lg h-8 text-sm" value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })} />
                      <Input type="time" className="rounded-lg h-8 text-sm" value={editForm.hora_fim} onChange={(e) => setEditForm({ ...editForm, hora_fim: e.target.value })} />
                    </div>
                  ) : (
                    <p className="font-medium">{selectedAgendamento.hora_inicio.slice(0, 5)} - {selectedAgendamento.hora_fim.slice(0, 5)}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Enfermeira</p>
                  <p className="font-medium">{profileMap.get(selectedAgendamento.enfermeira_user_id) || "—"}</p>
                </div>
              </div>
              {selectedAgendamento.observacao && (
                <div>
                  <p className="text-muted-foreground text-xs">Observação</p>
                  <p className="text-sm">{selectedAgendamento.observacao}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                {getStatusBadge(selectedAgendamento.status)}
              </div>

              {/* Action buttons for admin/executivo */}
              {canManage && selectedAgendamento.status !== "cancelado" && (
                <div className="flex gap-2 pt-2 border-t">
                  {selectedAgendamento.status !== "confirmado" && (
                    <Button
                      size="sm"
                      className="rounded-xl gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateStatusMutation.mutate({ id: selectedAgendamento.id, status: "confirmado" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4" /> Confirmar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl gap-1.5"
                    onClick={() => updateStatusMutation.mutate({ id: selectedAgendamento.id, status: "cancelado" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" /> Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                    onClick={handleReagendar}
                    disabled={updateStatusMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4" /> {isEditing ? "Salvar Reagendamento" : "Reagendar"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
