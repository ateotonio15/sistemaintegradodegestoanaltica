import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, Users, TrendingUp, Search, Trophy,
  ChevronDown, ChevronRight, Mail, Phone, UserRound, Copy, MessageCircle,
  CheckCircle2, XCircle, Clock, Pencil
} from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { getCurrentPeriodo, periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface EmpresaData {
  id: string;
  nome: string;
  cnpj: string | null;
  codigo_contrato: string | null;
  operadora_plano: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  data_corte: number | null;
  data_implantacao: string | null;
  status_empresa: string | null;
  responsavel_user_id: string | null;
  executiva_user_id: string | null;
  responsavel_contrato: string | null;
  email_empresa: string | null;
  telefone_empresa: string | null;
  contato_empresa: string | null;
  data_vencimento_fatura: number | null;
  data_emissao_fatura: number | null;
}

interface ExecutivaGroup {
  userId: string | null;
  name: string;
  empresas: EmpresaData[];
}

interface ExecutivaDetail {
  userId: string;
  name: string;
  email: string | null;
  empresaCount: number;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado!`);
}

function openWhatsApp(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  window.open(`https://wa.me/${number}`, "_blank");
}

export default function Executivas() {
  const { isAdmin, isExecutivo, isViewOnly, user, role } = useAuth();
  const isComum = role === "comum";
  const [search, setSearch] = useState("");
  const [filterExecutiva, setFilterExecutiva] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [editExecutivaUserId, setEditExecutivaUserId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast: toastHook } = useToast();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["executivas-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, codigo_contrato, operadora_plano, tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao, status_empresa, responsavel_user_id, responsavel_contrato, executiva_user_id, email_empresa, telefone_empresa, contato_empresa")
        .order("nome");
      if (error) throw error;
      // Cast and add fatura fields (may not be in types yet)
      return (data as any[]).map(d => ({
        ...d,
        data_vencimento_fatura: d.data_vencimento_fatura ?? null,
        data_emissao_fatura: d.data_emissao_fatura ?? null,
      })) as EmpresaData[];
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["executivas-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["executivas-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const executivoUserIds = useMemo(() => new Set(userRoles.filter((r) => r.role === "executivo").map((r) => r.user_id)), [userRoles]);

  const { data: comunUsersEmpresas = [] } = useQuery({
    queryKey: ["comum-users-empresa-count-executivas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return data as { user_id: string; display_name: string; empresa_count: number }[];
    },
    enabled: !!user,
  });

  // Get auth.users emails via edge function or profiles - we use profiles for now
  // For emails, we need to look up from auth - but we don't have access
  // We'll use the empresa email data or display_name

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.user_id, p.display_name || "Sem nome"));
    return map;
  }, [profiles]);

  const executivoUsers = useMemo(() => {
    return profiles.filter(p => executivoUserIds.has(p.user_id));
  }, [profiles, executivoUserIds]);

  // Build executiva details for modal
  const executivaDetails: ExecutivaDetail[] = useMemo(() => {
    return Array.from(executivoUserIds).map(uid => {
      const profile = profiles.find(p => p.user_id === uid);
      const count = empresas.filter(e => e.executiva_user_id === uid).length;
      // Try to get contact info from one of their empresas
      const linkedEmpresa = empresas.find(e => e.executiva_user_id === uid);
      return {
        userId: uid,
        name: profile?.display_name || "Sem nome",
        email: linkedEmpresa?.email_empresa || null,
        empresaCount: count,
      };
    }).sort((a, b) => b.empresaCount - a.empresaCount);
  }, [executivoUserIds, profiles, empresas]);

  const updateExecutivaMutation = useMutation({
    mutationFn: async ({ empresaId, executivaUserId }: { empresaId: string; executivaUserId: string | null }) => {
      const { error } = await supabase.from("empresas").update({
        executiva_user_id: executivaUserId,
      } as any).eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executivas-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      setEditingEmpresaId(null);
      setEditExecutivaUserId("");
      toastHook({ title: "Executiva atualizada com sucesso!" });
    },
    onError: () => toastHook({ title: "Erro ao atualizar executiva", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return empresas.filter((e) => {
      if (filterStatus !== "all" && e.status_empresa !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !e.nome.toLowerCase().includes(s) &&
          !(e.cnpj || "").toLowerCase().includes(s) &&
          !(e.codigo_contrato || "").toLowerCase().includes(s) &&
          !(e.contato_empresa || "").toLowerCase().includes(s)
        ) return false;
      }
      if (filterExecutiva !== "all") {
        if (filterExecutiva === "none" && e.executiva_user_id) return false;
        if (filterExecutiva !== "none" && e.executiva_user_id !== filterExecutiva) return false;
      }
      return true;
    });
  }, [empresas, search, filterExecutiva, filterStatus]);

  const groups = useMemo(() => {
    const map = new Map<string, ExecutivaGroup>();
    filtered.forEach((e) => {
      const key = e.executiva_user_id || "none";
      if (!map.has(key)) {
        map.set(key, {
          userId: e.executiva_user_id,
          name: e.executiva_user_id ? (profileMap.get(e.executiva_user_id) || "Desconhecido") : "Sem executiva",
          empresas: [],
        });
      }
      map.get(key)!.empresas.push(e);
    });
    return Array.from(map.values()).sort((a, b) => b.empresas.length - a.empresas.length);
  }, [filtered, profileMap]);

  const totalEmpresas = filtered.length;
  const totalExecutivas = groups.filter((g) => g.userId !== null).length;
  const media = totalExecutivas > 0 ? (totalEmpresas / totalExecutivas).toFixed(1) : "0";
  const ativas = filtered.filter((e) => e.status_empresa === "Ativa").length;
  const inativas = filtered.filter((e) => e.status_empresa === "Inativa").length;

  const uniqueExecutivas = useMemo(() => {
    const execs: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    empresas.forEach((e) => {
      if (e.executiva_user_id && !seen.has(e.executiva_user_id)) {
        seen.add(e.executiva_user_id);
        execs.push({ id: e.executiva_user_id, name: profileMap.get(e.executiva_user_id) || "Desconhecido" });
      }
    });
    return execs.sort((a, b) => a.name.localeCompare(b.name));
  }, [empresas, profileMap]);

  // Allow admin, executivo, visualizacao AND comum
  const canChangeExecutiva = isAdmin || isExecutivo;

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatPeriodo = (e: EmpresaData) => {
    if (e.tipo_movimentacao === "Diária" || e.tipo_movimentacao === "Diario") {
      return `Corte: dia ${e.data_corte || "—"}`;
    }
    return e.periodo_movimentacao || "—";
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d + "T00:00:00"), "dd/MM/yyyy"); } catch { return d; }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executivas</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel de controle e distribuição de carga</p>
        </div>

        {/* Quick Summary Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-card border shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold">{totalEmpresas}</span>
            <span className="text-muted-foreground">empresas</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="font-semibold">{ativas}</span>
            <span className="text-muted-foreground">ativas</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="font-semibold">{inativas}</span>
            <span className="text-muted-foreground">inativas</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CNPJ, código ou contato..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg" />
          </div>
          <Select value={filterExecutiva} onValueChange={setFilterExecutiva}>
            <SelectTrigger className="w-[200px] rounded-lg"><SelectValue placeholder="Executiva" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as executivas</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {uniqueExecutivas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Inativa">Inativa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Empresas</p>
                <p className="text-2xl font-bold">{totalEmpresas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-info/10">
                <Users className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Executivas</p>
                <p className="text-2xl font-bold">{totalExecutivas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média por Executiva</p>
                <p className="text-2xl font-bold">{media}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowRankingModal(true)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Ranking de Executivas
                <Badge variant="outline" className="ml-auto text-xs">Clique para detalhes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
              ) : groups.filter((g) => g.userId && executivoUserIds.has(g.userId)).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma executiva encontrada</p>
              ) : (
                groups.filter((g) => g.userId && executivoUserIds.has(g.userId)).map((g, i) => (
                  <div
                    key={g.userId}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      i === 0 ? "bg-warning/10 border border-warning/30" : i < 3 ? "bg-accent/60" : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm font-medium">{g.name}</span>
                    </div>
                    <Badge variant="outline" className="rounded-md font-semibold">{g.empresas.length}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Ranking de Cadastro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {comunUsersEmpresas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum usuário Cadastro encontrado</p>
              ) : (
                comunUsersEmpresas
                  .sort((a, b) => Number(b.empresa_count) - Number(a.empresa_count))
                  .map((u, i) => (
                    <div
                      key={u.user_id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        i === 0 ? "bg-warning/10 border border-warning/30" : i < 3 ? "bg-accent/60" : "hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>
                          {i + 1}º
                        </span>
                        <span className="text-sm font-medium">{u.display_name || "Sem nome"}</span>
                      </div>
                      <Badge variant="outline" className="rounded-md font-semibold">{Number(u.empresa_count)}</Badge>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking de Executivas Modal */}
        <Dialog open={showRankingModal} onOpenChange={setShowRankingModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Ranking de Executivas — Detalhes
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {executivaDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma executiva encontrada</p>
              ) : (
                executivaDetails.map((exec, i) => {
                  // Find empresas for this exec to get phone/email
                  const execEmpresas = empresas.filter(e => e.executiva_user_id === exec.userId);
                  const phone = execEmpresas.find(e => e.telefone_empresa)?.telefone_empresa;

                  return (
                    <Card key={exec.userId} className={`rounded-xl overflow-hidden ${i === 0 ? "border-warning/40 bg-warning/5" : i < 3 ? "bg-accent/30" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                              i === 0 ? "bg-warning/20 text-warning" : i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {i + 1}º
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{exec.name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant="outline" className="rounded-md text-xs gap-1">
                                  <Building2 className="h-3 w-3" /> {exec.empresaCount} empresa(s)
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {phone && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(phone, "Telefone")} title="Copiar telefone">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                  title="Abrir WhatsApp"
                                  onClick={() => openWhatsApp(phone)}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {exec.email && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(exec.email!, "E-mail")} title="Copiar email">
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" title="Enviar e-mail" asChild>
                                  <a href={`mailto:${exec.email}`}><Mail className="h-4 w-4" /></a>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {phone && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {phone}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Executiva Modal */}
        <Dialog open={!!editingEmpresaId} onOpenChange={(open) => { if (!open) { setEditingEmpresaId(null); setEditExecutivaUserId(""); } }}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>Alterar Executiva Responsável</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-accent/30">
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="font-medium">{empresas.find(e => e.id === editingEmpresaId)?.nome || ""}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nova Executiva Responsável</Label>
                <Select value={editExecutivaUserId} onValueChange={setEditExecutivaUserId}>
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditingEmpresaId(null); setEditExecutivaUserId(""); }} className="rounded-lg">Cancelar</Button>
                <Button
                  disabled={!editExecutivaUserId || updateExecutivaMutation.isPending}
                  onClick={() => updateExecutivaMutation.mutate({ empresaId: editingEmpresaId!, executivaUserId: editExecutivaUserId || null })}
                  className="rounded-lg"
                >
                  {updateExecutivaMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Grouped Listing */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Listagem por Executiva</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada</p>
          ) : (
            groups.map((g) => {
              const key = g.userId || "none";
              const isOpen = openGroups.has(key);

              return (
                <Card key={key} className="rounded-xl shadow-sm overflow-hidden">
                  <Collapsible open={isOpen} onOpenChange={() => toggleGroup(key)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-accent/40 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-semibold text-sm">{g.name}</span>
                          <Badge variant="secondary" className="rounded-md text-xs">{g.empresas.length} empresa(s)</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-accent/30">
                                <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Código</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Contato</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Telefone</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Responsável Cadastro</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Ações</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Período / Corte</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.empresas.map((e) => (
                                  <tr key={e.id} className="border-t transition-colors hover:bg-accent/20">
                                    <td className="p-3 font-medium">{e.nome}</td>
                                    <td className="p-3 text-muted-foreground">{e.codigo_contrato || "—"}</td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">{e.contato_empresa || "—"}</span>
                                        {e.contato_empresa && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(e.contato_empresa!, "Contato")}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">{e.telefone_empresa || "—"}</span>
                                        {e.telefone_empresa && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(e.telefone_empresa!, "Telefone")}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1">
                                        {e.email_empresa ? (
                                          <a href={`mailto:${e.email_empresa}`} className="text-primary hover:underline text-xs">{e.email_empresa}</a>
                                        ) : <span className="text-muted-foreground">—</span>}
                                        {e.email_empresa && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(e.email_empresa!, "E-mail")}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 font-medium text-primary">
                                      {e.responsavel_user_id ? (profileMap.get(e.responsavel_user_id) || "—") : "—"}
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1">
                                        {e.telefone_empresa && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                            title="Abrir WhatsApp"
                                            onClick={() => openWhatsApp(e.telefone_empresa!)}
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {e.email_empresa && (
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10" title="Enviar e-mail" asChild>
                                            <a href={`mailto:${e.email_empresa}`}><Mail className="h-4 w-4" /></a>
                                          </Button>
                                        )}
                                        {canChangeExecutiva && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 hover:bg-primary/10"
                                            title="Alterar executiva"
                                            onClick={() => {
                                              setEditingEmpresaId(e.id);
                                              setEditExecutivaUserId(e.executiva_user_id || "");
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5 text-primary" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <Badge variant="outline" className="text-xs rounded-md">{e.tipo_movimentacao || "—"}</Badge>
                                    </td>
                                    <td className="p-3 text-muted-foreground">{formatPeriodo(e)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
