import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Building2, Users, TrendingUp, Search, AlertTriangle, Trophy, ChevronDown, ChevronRight, Mail, Phone, UserRound } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}

interface ExecutivaGroup {
  userId: string | null;
  name: string;
  empresas: EmpresaData[];
}

export default function Executivas() {
  const { isAdmin, isExecutivo, isViewOnly, user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterExecutiva, setFilterExecutiva] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["executivas-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, codigo_contrato, operadora_plano, tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao, status_empresa, responsavel_user_id, responsavel_contrato, executiva_user_id, email_empresa, telefone_empresa, contato_empresa")
        .order("nome");
      if (error) throw error;
      return data as EmpresaData[];
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

  


  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.user_id, p.display_name || "Sem nome"));
    return map;
  }, [profiles]);

  const filtered = useMemo(() => {
    return empresas.filter((e) => {
      if (filterStatus !== "all" && e.status_empresa !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!e.nome.toLowerCase().includes(s) && !(e.cnpj || "").toLowerCase().includes(s) && !(e.codigo_contrato || "").toLowerCase().includes(s)) return false;
      }
      if (filterExecutiva !== "all") {
        if (filterExecutiva === "none" && e.responsavel_user_id) return false;
        if (filterExecutiva !== "none" && e.responsavel_user_id !== filterExecutiva) return false;
      }
      return true;
    });
  }, [empresas, search, filterExecutiva, filterStatus]);

  const groups = useMemo(() => {
    const map = new Map<string, ExecutivaGroup>();
    filtered.forEach((e) => {
      const key = e.responsavel_user_id || "none";
      if (!map.has(key)) {
        map.set(key, {
          userId: e.responsavel_user_id,
          name: e.responsavel_user_id ? (profileMap.get(e.responsavel_user_id) || e.responsavel_contrato || "Desconhecido") : "Sem responsável",
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

  const uniqueExecutivas = useMemo(() => {
    const execs: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    empresas.forEach((e) => {
      if (e.responsavel_user_id && !seen.has(e.responsavel_user_id)) {
        seen.add(e.responsavel_user_id);
        execs.push({
          id: e.responsavel_user_id,
          name: profileMap.get(e.responsavel_user_id) || e.responsavel_contrato || "Desconhecido",
        });
      }
    });
    return execs.sort((a, b) => a.name.localeCompare(b.name));
  }, [empresas, profileMap]);


  if (!isAdmin && !isExecutivo && !isViewOnly) return <Navigate to="/" replace />;

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

  const HIGH_THRESHOLD = 20;
  const LOW_THRESHOLD = 5;

  const getLoadBadge = (count: number) => {
    if (count >= HIGH_THRESHOLD) return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Carga alta</Badge>;
    if (count < LOW_THRESHOLD) return <Badge variant="secondary" className="text-[10px]">Carga baixa</Badge>;
    return null;
  };


  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executivas</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel de controle e distribuição de carga</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg" />
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

        {/* Ranking + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Ranking de Executivas
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
                      i === 0
                        ? "bg-warning/10 border border-warning/30"
                        : i < 3
                        ? "bg-accent/60"
                        : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm font-medium">{g.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getLoadBadge(g.empresas.length)}
                      <Badge variant="outline" className="rounded-md font-semibold">
                        {g.empresas.length}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Ranking de Cadastro (Usuário Comum) */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Ranking de Cadastro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {comunUsersEmpresas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum usuário comum encontrado</p>
              ) : (
                comunUsersEmpresas
                  .sort((a, b) => Number(b.empresa_count) - Number(a.empresa_count))
                  .map((u, i) => (
                  <div
                    key={u.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      i === 0
                        ? "bg-warning/10 border border-warning/30"
                        : i < 3
                        ? "bg-accent/60"
                        : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm font-medium">{u.display_name || "Sem nome"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getLoadBadge(Number(u.empresa_count))}
                      <Badge variant="outline" className="rounded-md font-semibold">
                        {Number(u.empresa_count)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

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
                          {g.userId && getLoadBadge(g.empresas.length)}
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
                                <th className="text-left p-3 font-medium text-muted-foreground">CNPJ</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />Contato</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Telefone</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">
                                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email</span>
                                </th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Corretora</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Período / Corte</th>
                                <th className="text-left p-3 font-medium text-muted-foreground">Implantação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.empresas.map((e) => (
                                <tr key={e.id} className="border-t hover:bg-accent/20 transition-colors">
                                  <td className="p-3 font-medium">{e.nome}</td>
                                  <td className="p-3 text-muted-foreground">{e.codigo_contrato || "—"}</td>
                                  <td className="p-3 text-muted-foreground">{e.cnpj || "—"}</td>
                                  <td className="p-3 text-muted-foreground">{e.contato_empresa || "—"}</td>
                                  <td className="p-3 text-muted-foreground">{e.telefone_empresa || "—"}</td>
                                  <td className="p-3 text-muted-foreground">
                                    {e.email_empresa ? (
                                      <a href={`mailto:${e.email_empresa}`} className="text-primary hover:underline">{e.email_empresa}</a>
                                    ) : "—"}
                                  </td>
                                  <td className="p-3 text-muted-foreground">{e.operadora_plano || "—"}</td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="text-xs rounded-md">{e.tipo_movimentacao || "—"}</Badge>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{formatPeriodo(e)}</td>
                                  <td className="p-3 text-muted-foreground">{formatDate(e.data_implantacao)}</td>
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
    </AppLayout>
  );
}
