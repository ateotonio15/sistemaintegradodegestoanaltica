import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Search, Shield, User, Eye, KeyRound, Trash2, HeartPulse, Wallet } from "lucide-react";
import { Navigate } from "react-router-dom";

type AppRole = "admin" | "comum" | "executivo" | "visualizacao" | "enfermeira" | "financeiro";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  role: AppRole | null;
  empresas: { id: string; nome: string }[];
}

const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  comum: "Cadastro",
  executivo: "Executivo",
  visualizacao: "Visualização",
  enfermeira: "Enfermeira",
  financeiro: "Financeiro",
};

const roleIcon: Record<AppRole, typeof Shield> = {
  admin: Shield,
  comum: User,
  executivo: Eye,
  visualizacao: Eye,
  enfermeira: HeartPulse,
  financeiro: Wallet,
};

function generatePassword(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function Usuarios() {
  const { isAdmin, isExecutivo } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("comum");
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("comum");
  const [newEmpresas, setNewEmpresas] = useState<string[]>([]);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!isAdmin) return <Navigate to="/" replace />;

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-management"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("user_id, display_name, username");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase.from("user_roles").select("user_id, role");
      if (rErr) throw rErr;

      const { data: links, error: lErr } = await supabase.from("empresa_usuarios").select("user_id, empresa_id, empresas(id, nome)");
      if (lErr) throw lErr;

      const rolesMap = new Map(roles.map((r) => [r.user_id, r.role as AppRole]));
      const linksMap = new Map<string, { id: string; nome: string }[]>();
      links.forEach((l: any) => {
        const list = linksMap.get(l.user_id) || [];
        if (l.empresas) list.push({ id: l.empresas.id, nome: l.empresas.nome });
        linksMap.set(l.user_id, list);
      });

      return (profiles || []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        username: (p as any).username ?? null,
        role: rolesMap.get(p.user_id) ?? "comum",
        empresas: linksMap.get(p.user_id) || [],
      })) as UserProfile[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "Perfil atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar perfil", variant: "destructive" }),
  });

  const updateEmpresasMutation = useMutation({
    mutationFn: async ({ userId, empresaIds }: { userId: string; empresaIds: string[] }) => {
      const { error: delErr } = await supabase.from("empresa_usuarios").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      if (empresaIds.length > 0) {
        const rows = empresaIds.map((empresa_id) => ({ user_id: userId, empresa_id }));
        const { error } = await supabase.from("empresa_usuarios").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "Empresas vinculadas atualizadas!" });
    },
    onError: () => toast({ title: "Erro ao atualizar vínculos", variant: "destructive" }),
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: newEmail, password: newPassword, displayName: newName, username: newUsername },
      });
      if (error) throw error;
      const userId = data?.user_id;
      if (!userId) throw new Error("Falha ao criar usuário");

      await supabase.from("user_roles").insert({ user_id: userId, role: newRole });

      if (newEmpresas.length > 0) {
        const rows = newEmpresas.map((empresa_id) => ({ user_id: userId, empresa_id }));
        await supabase.from("empresa_usuarios").insert(rows);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      setCreateDialogOpen(false);
      setNewEmail(""); setNewName(""); setNewUsername(""); setNewPassword(""); setNewRole("comum"); setNewEmpresas([]);
      toast({ title: "Usuário criado com sucesso!" });
    },
    onError: (err: any) => {
      const raw = String(err?.context?.error || err?.message || "");
      const duplicated = raw.toLowerCase().includes("já existe") || raw.toLowerCase().includes("already been registered") || raw.toLowerCase().includes("email_exists");
      toast({
        title: duplicated ? "E-mail já cadastrado" : "Erro ao criar usuário",
        description: duplicated ? "Use outro e-mail." : raw || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "delete-user", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "Usuário excluído com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir usuário", description: String(err?.message || ""), variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "reset-password", userId, newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setResetPassword("");
      toast({ title: "Senha redefinida com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao redefinir senha", description: String(err?.message || ""), variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, displayName, username }: { userId: string; displayName: string; username: string }) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "update-user", userId, displayName, username },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "Dados do usuário atualizados!" });
    },
    onError: (err: any) => toast({ title: "Erro ao atualizar usuário", description: String(err?.message || ""), variant: "destructive" }),
  });

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setSelectedRole(u.role ?? "comum");
    setSelectedEmpresas(u.empresas.map((e) => e.id));
    setEditDisplayName(u.display_name || "");
    setEditUsername(u.username || "");
    setDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateProfileMutation.mutate({ userId: editingUser.user_id, displayName: editDisplayName, username: editUsername });
    updateRoleMutation.mutate({ userId: editingUser.user_id, role: selectedRole });
    updateEmpresasMutation.mutate({ userId: editingUser.user_id, empresaIds: selectedEmpresas });
    setDialogOpen(false);
  };

  const openResetPassword = (u: UserProfile) => {
    setResetPasswordUser(u);
    setResetPassword("");
    setResetPasswordDialogOpen(true);
  };

  const toggleEmpresa = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((e) => e !== id) : [...list, id]);
  };

  const filtered = users.filter((u) =>
    (u.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} usuário(s) cadastrado(s)</p>
          </div>
          {isAdmin && <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
              <DialogHeader><DialogTitle>Cadastro de Usuário</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nome Completo *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Usuário (login) *</Label>
                  <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} required placeholder="ex: joao.silva" className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">E-mail *</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Senha *</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Perfil *</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="comum">Usuário Comum</SelectItem>
                      <SelectItem value="executivo">Executivo</SelectItem>
                      <SelectItem value="visualizacao">Visualização</SelectItem>
                      <SelectItem value="enfermeira">Enfermeira</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empresas Vinculadas</Label>
                  <div className="border rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1">
                    {empresas.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1 transition-colors">
                        <input type="checkbox" checked={newEmpresas.includes(emp.id)} onChange={() => toggleEmpresa(emp.id, newEmpresas, setNewEmpresas)} className="rounded" />
                        {emp.nome}
                      </label>
                    ))}
                    {empresas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-lg">Cancelar</Button>
                  <Button type="submit" disabled={createUserMutation.isPending} className="rounded-lg">{createUserMutation.isPending ? "Criando..." : "Criar Usuário"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg" />
        </div>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Usuário</TableHead>
                    <TableHead className="font-semibold">Perfil</TableHead>
                    <TableHead className="font-semibold">Empresas</TableHead>
                    {isAdmin && <TableHead className="w-40 font-semibold">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Nenhum usuário encontrado</TableCell></TableRow>
                  ) : (
                    filtered.map((u) => {
                      const role = u.role ?? "comum";
                      const Icon = roleIcon[role];
                      return (
                        <TableRow key={u.user_id} className="hover:bg-accent/50 transition-colors">
                          <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.username || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={role === "admin" ? "default" : "secondary"} className="gap-1 rounded-md">
                              <Icon className="h-3 w-3" />{roleLabel[role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {u.empresas.length === 0 ? "Nenhuma" : `${u.empresas.length} empresa(s)`}
                            </span>
                          </TableCell>
                          {isAdmin && <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar" className="rounded-lg hover:bg-primary/10">
                                <Pencil className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openResetPassword(u)} title="Redefinir Senha" className="rounded-lg hover:bg-warning/10">
                                <KeyRound className="h-4 w-4 text-warning" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir Usuário"
                                className="rounded-lg hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Excluir o usuário "${u.display_name}"? Esta ação não pode ser desfeita.`)) {
                                    deleteUserMutation.mutate(u.user_id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader><DialogTitle>Editar Usuário: {editingUser?.display_name}</DialogTitle></DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome Completo</Label>
                <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Usuário (login)</Label>
                <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Perfil</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="comum">Usuário Comum</SelectItem>
                    <SelectItem value="executivo">Executivo</SelectItem>
                    <SelectItem value="visualizacao">Visualização</SelectItem>
                    <SelectItem value="enfermeira">Enfermeira</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Empresas Vinculadas ({selectedEmpresas.length})</Label>
                <div className="border rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1">
                  {empresas.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1 transition-colors">
                      <input type="checkbox" checked={selectedEmpresas.includes(emp.id)} onChange={() => toggleEmpresa(emp.id, selectedEmpresas, setSelectedEmpresas)} className="rounded" />
                      {emp.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={updateRoleMutation.isPending} className="rounded-lg">Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={(open) => { setResetPasswordDialogOpen(open); if (!open) { setResetPasswordUser(null); setResetPassword(""); } }}>
          <DialogContent className="sm:max-w-sm rounded-xl">
            <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Usuário: <strong>{resetPasswordUser?.display_name}</strong></p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nova Senha *</Label>
                <Input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={6} placeholder="Mínimo 6 caracteres" className="rounded-lg" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setResetPassword(generatePassword())} className="rounded-lg">
                Gerar senha automática
              </Button>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)} className="rounded-lg">Cancelar</Button>
              <Button
                className="rounded-lg"
                disabled={resetPassword.length < 6 || resetPasswordMutation.isPending}
                onClick={() => {
                  if (resetPasswordUser) {
                    resetPasswordMutation.mutate({ userId: resetPasswordUser.user_id, newPassword: resetPassword });
                  }
                }}
              >
                {resetPasswordMutation.isPending ? "Redefinindo..." : "Redefinir"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
