import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, Search, Settings2, Plus, Trash2, Building2, Briefcase, Link2, X } from "lucide-react";

type Row = {
  id: string;
  nome: string;
  cnpj: string | null;
  portal_ativo: boolean;
  portal_secoes: Record<string, boolean> | null;
  username: string | null;
};

type Corretora = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  portal_ativo: boolean;
  portal_secoes: Record<string, boolean> | null;
  username: string | null;
  empresas: { id: string; nome: string }[];
};

const SECOES = [
  { key: "contrato", label: "Resumo do contrato" },
  { key: "vidas", label: "Vidas ativas" },
  { key: "movimentacoes", label: "Movimentações financeiras" },
  { key: "chat", label: "Chat de atendimento" },
] as const;

export default function EmpresasAcesso() {
  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Acessos das Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie usuários, senhas e o que cada empresa ou corretora consegue visualizar no portal.
        </p>
      </div>

      <Tabs defaultValue="empresas" className="w-full">
        <TabsList>
          <TabsTrigger value="empresas" className="gap-2">
            <Building2 className="h-4 w-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="corretoras" className="gap-2">
            <Briefcase className="h-4 w-4" /> Corretoras
          </TabsTrigger>
        </TabsList>
        <TabsContent value="empresas" className="mt-4">
          <EmpresasTab />
        </TabsContent>
        <TabsContent value="corretoras" className="mt-4">
          <CorretorasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Empresas Tab (existing behaviour)
// ============================================================================
function EmpresasTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [novaSenha, setNovaSenha] = useState<{ user: string; senha: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["empresas-acesso"],
    queryFn: async (): Promise<Row[]> => {
      const { data: empresas, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, portal_ativo, portal_secoes")
        .order("nome");
      if (error) throw error;

      const { data: vinc } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id, user_id, papel")
        .eq("papel", "admin_empresa");
      const userIds = (vinc ?? []).map((v: any) => v.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds)
        : { data: [] as any[] };
      const usernameByUser = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p.username]),
      );
      const usernameByEmpresa = new Map<string, string | null>();
      (vinc ?? []).forEach((v: any) =>
        usernameByEmpresa.set(v.empresa_id, usernameByUser.get(v.user_id) ?? null),
      );

      return (empresas ?? []).map((e: any) => ({
        ...e,
        username: usernameByEmpresa.get(e.id) ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter(
      (r) =>
        r.nome.toLowerCase().includes(s) ||
        (r.username ?? "").toLowerCase().includes(s) ||
        (r.cnpj ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  async function toggleAtivo(row: Row, val: boolean) {
    const { error } = await supabase.functions.invoke("admin-empresa-acesso", {
      body: { action: "update_portal", empresa_id: row.id, portal_ativo: val },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: val ? "Acesso liberado" : "Acesso bloqueado" });
    qc.invalidateQueries({ queryKey: ["empresas-acesso"] });
  }

  async function resetSenha(row: Row) {
    if (!row.username) {
      return toast({
        title: "Sem usuário",
        description: "Esta empresa não tem usuário vinculado.",
        variant: "destructive",
      });
    }
    if (!confirm(`Gerar uma nova senha para ${row.username}?`)) return;
    const { data: res, error } = await supabase.functions.invoke("admin-empresa-acesso", {
      body: { action: "reset_password", empresa_id: row.id },
    });
    if (error || (res as any)?.error) {
      return toast({
        title: "Erro",
        description: error?.message || (res as any)?.error,
        variant: "destructive",
      });
    }
    setNovaSenha({ user: row.username, senha: (res as any).senha });
  }

  async function gerarUsuario(row: Row) {
    if (!confirm(`Gerar usuário de acesso para "${row.nome}"?`)) return;
    const { data: res, error } = await supabase.functions.invoke("admin-empresa-acesso", {
      body: { action: "gerar_usuario", empresa_id: row.id },
    });
    if (error || (res as any)?.error) {
      return toast({
        title: "Erro",
        description: error?.message || (res as any)?.error,
        variant: "destructive",
      });
    }
    qc.invalidateQueries({ queryKey: ["empresas-acesso"] });
    setNovaSenha({ user: (res as any).username, senha: (res as any).senha });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Empresas</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, usuário ou CNPJ"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Empresa</th>
                    <th className="py-2 pr-4">CNPJ</th>
                    <th className="py-2 pr-4">Usuário</th>
                    <th className="py-2 pr-4">Portal</th>
                    <th className="py-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.nome}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.cnpj ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {row.username ? (
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {row.username}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(row.username!);
                                toast({ title: "Usuário copiado" });
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copiar"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => gerarUsuario(row)}>
                            Gerar usuário
                          </Button>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.portal_ativo}
                            onCheckedChange={(v) => toggleAtivo(row, v)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {row.portal_ativo ? "Ativo" : "Bloqueado"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => resetSenha(row)}>
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            Redefinir senha
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            Configurar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhuma empresa encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfigEmpresaDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["empresas-acesso"] });
        }}
      />

      <NovaSenhaDialog value={novaSenha} onClose={() => setNovaSenha(null)} />
    </>
  );
}

// ============================================================================
// Corretoras Tab (new)
// ============================================================================
function CorretorasTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Corretora | null>(null);
  const [criando, setCriando] = useState(false);
  const [novaSenha, setNovaSenha] = useState<{ user: string; senha: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["corretoras-acesso"],
    queryFn: async (): Promise<Corretora[]> => {
      const { data: corretoras, error } = await supabase
        .from("corretoras" as any)
        .select("id, nome, cnpj, email, telefone, responsavel, portal_ativo, portal_secoes")
        .order("nome");
      if (error) throw error;

      const ids = (corretoras ?? []).map((c: any) => c.id);
      if (!ids.length) return [];

      const [{ data: vinc }, { data: emp }] = await Promise.all([
        supabase
          .from("corretora_usuarios" as any)
          .select("corretora_id, user_id")
          .in("corretora_id", ids),
        supabase
          .from("corretora_empresas" as any)
          .select("corretora_id, empresa_id, empresas(id, nome)")
          .in("corretora_id", ids),
      ]);
      const userIds = ((vinc ?? []) as any[]).map((v) => v.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds)
        : { data: [] as any[] };
      const usernameByUser = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p.username]),
      );
      const usernameByCorretora = new Map<string, string | null>();
      ((vinc ?? []) as any[]).forEach((v) =>
        usernameByCorretora.set(v.corretora_id, usernameByUser.get(v.user_id) ?? null),
      );
      const empresasByCorretora = new Map<string, { id: string; nome: string }[]>();
      ((emp ?? []) as any[]).forEach((v) => {
        if (!v.empresas?.id) return;
        const arr = empresasByCorretora.get(v.corretora_id) ?? [];
        arr.push({ id: v.empresas.id, nome: v.empresas.nome });
        empresasByCorretora.set(v.corretora_id, arr);
      });

      return ((corretoras ?? []) as any[]).map((c) => ({
        ...c,
        username: usernameByCorretora.get(c.id) ?? null,
        empresas: (empresasByCorretora.get(c.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
      }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter(
      (c) =>
        c.nome.toLowerCase().includes(s) ||
        (c.username ?? "").toLowerCase().includes(s) ||
        (c.cnpj ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  async function toggleAtivo(row: Corretora, val: boolean) {
    const { error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "update_portal", corretora_id: row.id, portal_ativo: val },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: val ? "Acesso liberado" : "Acesso bloqueado" });
    qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
  }

  async function resetSenha(row: Corretora) {
    if (!row.username) {
      return toast({
        title: "Sem usuário",
        description: "Gere um usuário para a corretora primeiro.",
        variant: "destructive",
      });
    }
    if (!confirm(`Gerar uma nova senha para ${row.username}?`)) return;
    const { data: res, error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "reset_password", corretora_id: row.id },
    });
    if (error || (res as any)?.error) {
      return toast({
        title: "Erro",
        description: error?.message || (res as any)?.error,
        variant: "destructive",
      });
    }
    setNovaSenha({ user: row.username, senha: (res as any).senha });
  }

  async function gerarUsuario(row: Corretora) {
    if (!confirm(`Gerar usuário de acesso para "${row.nome}"?`)) return;
    const { data: res, error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "gerar_usuario", corretora_id: row.id },
    });
    if (error || (res as any)?.error) {
      return toast({
        title: "Erro",
        description: error?.message || (res as any)?.error,
        variant: "destructive",
      });
    }
    qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
    setNovaSenha({ user: (res as any).username, senha: (res as any).senha });
  }

  async function excluir(row: Corretora) {
    if (!confirm(`Excluir a corretora "${row.nome}" e o acesso vinculado? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "delete", corretora_id: row.id },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Corretora excluída" });
    qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Corretoras</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, usuário ou CNPJ"
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova corretora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Corretora</th>
                    <th className="py-2 pr-4">Responsável</th>
                    <th className="py-2 pr-4">Empresas</th>
                    <th className="py-2 pr-4">Usuário</th>
                    <th className="py-2 pr-4">Portal</th>
                    <th className="py-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 align-middle">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{row.nome}</div>
                        <div className="text-xs text-muted-foreground">{row.cnpj ?? "—"}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <div>{row.responsavel ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.email ?? row.telefone ?? ""}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs">
                          <Link2 className="h-3 w-3" /> {row.empresas.length}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {row.username ? (
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {row.username}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(row.username!);
                                toast({ title: "Usuário copiado" });
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copiar"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => gerarUsuario(row)}>
                            Gerar usuário
                          </Button>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.portal_ativo}
                            onCheckedChange={(v) => toggleAtivo(row, v)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {row.portal_ativo ? "Ativo" : "Bloqueado"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => resetSenha(row)}>
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            Senha
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            Configurar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => excluir(row)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        Nenhuma corretora cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CorretoraCriarDialog
        open={criando}
        onClose={() => setCriando(false)}
        onSaved={() => {
          setCriando(false);
          qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
        }}
      />

      <ConfigCorretoraDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
        }}
      />

      <NovaSenhaDialog value={novaSenha} onClose={() => setNovaSenha(null)} />
    </>
  );
}

// ============================================================================
// Dialogs
// ============================================================================
function NovaSenhaDialog({ value, onClose }: { value: { user: string; senha: string } | null; onClose: () => void }) {
  const { toast } = useToast();
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova senha gerada</DialogTitle>
          <DialogDescription>
            Copie e envie para o usuário. Ele será obrigado a trocar no próximo login.
          </DialogDescription>
        </DialogHeader>
        {value && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Usuário</Label>
              <div className="rounded border bg-muted px-3 py-2 font-mono text-sm">{value.user}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Senha temporária</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded border bg-muted px-3 py-2 font-mono text-sm">
                  {value.senha}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(value.senha);
                    toast({ title: "Senha copiada" });
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigEmpresaDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [secoes, setSecoes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setNome(row.nome ?? "");
      setCnpj(row.cnpj ?? "");
      setSecoes({
        contrato: row.portal_secoes?.contrato ?? true,
        vidas: row.portal_secoes?.vidas ?? true,
        movimentacoes: row.portal_secoes?.movimentacoes ?? true,
        chat: row.portal_secoes?.chat ?? true,
      });
    }
  }, [row?.id]);

  async function salvar() {
    if (!row) return;
    setSaving(true);
    try {
      const r1 = await supabase.functions.invoke("admin-empresa-acesso", {
        body: { action: "update_empresa", empresa_id: row.id, nome, cnpj },
      });
      if (r1.error || (r1.data as any)?.error) {
        throw new Error(r1.error?.message || (r1.data as any)?.error);
      }
      const r2 = await supabase.functions.invoke("admin-empresa-acesso", {
        body: { action: "update_portal", empresa_id: row.id, portal_secoes: secoes },
      });
      if (r2.error || (r2.data as any)?.error) {
        throw new Error(r2.error?.message || (r2.data as any)?.error);
      }
      toast({ title: "Alterações salvas" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar empresa</DialogTitle>
          <DialogDescription>
            Edite os dados cadastrais e escolha o que a empresa enxerga no portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Seções visíveis no portal</Label>
            <div className="rounded border divide-y">
              {SECOES.map((s) => (
                <label key={s.key} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{s.label}</span>
                  <Switch
                    checked={!!secoes[s.key]}
                    onCheckedChange={(v) => setSecoes((prev) => ({ ...prev, [s.key]: v }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorretoraCriarDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    email: "",
    telefone: "",
    responsavel: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ nome: "", cnpj: "", email: "", telefone: "", responsavel: "" });
  }, [open]);

  async function salvar() {
    if (!form.nome.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-corretora-acesso", {
        body: { action: "create", ...form },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      toast({ title: "Corretora criada" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova corretora</DialogTitle>
          <DialogDescription>
            Cadastre a corretora e depois vincule as empresas que ela vai enxergar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigCorretoraDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Corretora | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dados" | "empresas" | "portal">("dados");
  const [dados, setDados] = useState({
    nome: "",
    cnpj: "",
    email: "",
    telefone: "",
    responsavel: "",
  });
  const [secoes, setSecoes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [buscaEmp, setBuscaEmp] = useState("");

  useEffect(() => {
    if (row) {
      setTab("dados");
      setDados({
        nome: row.nome ?? "",
        cnpj: row.cnpj ?? "",
        email: row.email ?? "",
        telefone: row.telefone ?? "",
        responsavel: row.responsavel ?? "",
      });
      setSecoes({
        contrato: row.portal_secoes?.contrato ?? true,
        vidas: row.portal_secoes?.vidas ?? true,
        movimentacoes: row.portal_secoes?.movimentacoes ?? true,
        chat: row.portal_secoes?.chat ?? true,
      });
    }
  }, [row?.id]);

  const { data: empresasDb } = useQuery({
    queryKey: ["empresas-para-corretora"],
    enabled: !!row,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vinculadasIds = useMemo(() => new Set((row?.empresas ?? []).map((e) => e.id)), [row?.empresas]);
  const disponiveis = useMemo(() => {
    const s = buscaEmp.trim().toLowerCase();
    return (empresasDb ?? [])
      .filter((e: any) => !vinculadasIds.has(e.id))
      .filter((e: any) => !s || e.nome.toLowerCase().includes(s) || (e.cnpj ?? "").toLowerCase().includes(s))
      .slice(0, 50);
  }, [empresasDb, vinculadasIds, buscaEmp]);

  async function salvarDados() {
    if (!row) return;
    setSaving(true);
    try {
      const r1 = await supabase.functions.invoke("admin-corretora-acesso", {
        body: { action: "update", corretora_id: row.id, ...dados },
      });
      if (r1.error || (r1.data as any)?.error) {
        throw new Error(r1.error?.message || (r1.data as any)?.error);
      }
      const r2 = await supabase.functions.invoke("admin-corretora-acesso", {
        body: { action: "update_portal", corretora_id: row.id, portal_secoes: secoes },
      });
      if (r2.error || (r2.data as any)?.error) {
        throw new Error(r2.error?.message || (r2.data as any)?.error);
      }
      toast({ title: "Alterações salvas" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function vincular(empresaId: string) {
    if (!row) return;
    const { error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "link_empresa", corretora_id: row.id, empresa_id: empresaId },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
  }

  async function desvincular(empresaId: string) {
    if (!row) return;
    const { error } = await supabase.functions.invoke("admin-corretora-acesso", {
      body: { action: "unlink_empresa", corretora_id: row.id, empresa_id: empresaId },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["corretoras-acesso"] });
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar corretora</DialogTitle>
          <DialogDescription>
            Edite os dados, vincule empresas que a corretora acessa e defina o que ela enxerga no portal.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="empresas">
              Empresas vinculadas ({row?.empresas.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Nome</Label>
              <Input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={dados.cnpj} onChange={(e) => setDados({ ...dados, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>E-mail</Label>
              <Input value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Responsável</Label>
              <Input
                value={dados.responsavel}
                onChange={(e) => setDados({ ...dados, responsavel: e.target.value })}
              />
            </div>
          </TabsContent>

          <TabsContent value="empresas" className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Empresas já vinculadas</Label>
              <div className="mt-1 flex flex-wrap gap-1.5 min-h-8">
                {(row?.empresas ?? []).map((e) => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 pl-2.5 pr-1 py-0.5 text-xs"
                  >
                    {e.nome}
                    <button
                      onClick={() => desvincular(e.id)}
                      className="rounded-full p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Desvincular"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {row?.empresas.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</span>
                )}
              </div>
            </div>

            <div>
              <Label>Adicionar empresa</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={buscaEmp}
                  onChange={(e) => setBuscaEmp(e.target.value)}
                  placeholder="Buscar empresa por nome ou CNPJ"
                  className="pl-9"
                />
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto rounded border divide-y">
                {disponiveis.map((e: any) => (
                  <button
                    key={e.id}
                    onClick={() => vincular(e.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{e.nome}</div>
                      <div className="text-xs text-muted-foreground">{e.cnpj ?? "—"}</div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {disponiveis.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="portal" className="mt-4 space-y-3">
            <Label>Seções visíveis no portal da corretora</Label>
            <div className="rounded border divide-y">
              {SECOES.map((s) => (
                <label key={s.key} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{s.label}</span>
                  <Switch
                    checked={!!secoes[s.key]}
                    onCheckedChange={(v) => setSecoes((prev) => ({ ...prev, [s.key]: v }))}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              A corretora vê apenas as seções aqui habilitadas, cruzadas com o que cada empresa vinculada permite.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={salvarDados} disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
