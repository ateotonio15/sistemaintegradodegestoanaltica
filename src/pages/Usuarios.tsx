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
import { Plus, Pencil, Search, Shield, User, Eye } from "lucide-react";
import { Navigate } from "react-router-dom";

type AppRole = "admin" | "comum" | "executivo";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  role: AppRole | null;
  empresas: { id: string; nome: string }[];
}

const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  comum: "Usuário Comum",
  executivo: "Executivo",
};

const roleIcon: Record<AppRole, typeof Shield> = {
  admin: Shield,
  comum: User,
  executivo: Eye,
};

export default function Usuarios() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("comum");
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("comum");
  const [newEmpresas, setNewEmpresas] = useState<string[]>([]);
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
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const { data: links, error: lErr } = await supabase
        .from("empresa_usuarios")
        .select("user_id, empresa_id, empresas(id, nome)");
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
        role: rolesMap.get(p.user_id) ?? "comum",
        empresas: linksMap.get(p.user_id) || [],
      })) as UserProfile[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

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
        body: { email: newEmail, password: newPassword, displayName: newName },
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
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("comum");
      setNewEmpresas([]);
      toast({ title: "Usuário criado com sucesso!" });
    },
    onError: (err: any) => {
      const raw = String(err?.context?.error || err?.message || "");
      const duplicated = raw.toLowerCase().includes("já existe um usuário") || raw.toLowerCase().includes("already been registered") || raw.toLowerCase().includes("email_exists");
      toast({
        title: duplicated ? "E-mail já cadastrado" : "Erro ao criar usuário",
        description: duplicated ? "Use outro e-mail para criar o usuário." : raw || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setSelectedRole(u.role ?? "comum");
    setSelectedEmpresas(u.empresas.map((e) => e.id));
    setDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateRoleMutation.mutate({ userId: editingUser.user_id, role: selectedRole });
    updateEmpresasMutation.mutate({ userId: editingUser.user_id, empresaIds: selectedEmpresas });
    setDialogOpen(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastro de Usuário</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil *</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="comum">Usuário Comum</SelectItem>
                        <SelectItem value="executivo">Executivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Empresas Vinculadas</Label>
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                      {empresas.map((emp) => (
                        <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={newEmpresas.includes(emp.id)}
                            onChange={() => toggleEmpresa(emp.id, newEmpresas, setNewEmpresas)}
                            className="rounded"
                          />
                          {emp.nome}
                        </label>
                      ))}
                      {empresas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon" />
          <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Empresas Vinculadas</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                ) : (
                  filtered.map((u) => {
                    const role = u.role ?? "comum";
                    const Icon = roleIcon[role];
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={role === "admin" ? "default" : "secondary"} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {roleLabel[role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {u.empresas.length === 0 ? "Nenhuma" : `${u.empresas.length} empresa(s)`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4 text-icon" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuário: {editingUser?.display_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="comum">Usuário Comum</SelectItem>
                    <SelectItem value="executivo">Executivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresas Vinculadas ({selectedEmpresas.length})</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                  {empresas.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedEmpresas.includes(emp.id)}
                        onChange={() => toggleEmpresa(emp.id, selectedEmpresas, setSelectedEmpresas)}
                        className="rounded"
                      />
                      {emp.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={updateRoleMutation.isPending}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
