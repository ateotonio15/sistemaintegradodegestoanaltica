import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, Search, Settings2 } from "lucide-react";

type Row = {
  id: string;
  nome: string;
  cnpj: string | null;
  portal_ativo: boolean;
  portal_secoes: Record<string, boolean> | null;
  username: string | null;
};

const SECOES = [
  { key: "contrato", label: "Resumo do contrato" },
  { key: "vidas", label: "Vidas ativas" },
  { key: "movimentacoes", label: "Movimentações financeiras" },
  { key: "chat", label: "Chat de atendimento" },
] as const;

export default function EmpresasAcesso() {
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

      // busca usernames via empresa_usuarios -> profiles
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
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Acessos das Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie usuários, senhas e o que cada empresa consegue visualizar no portal.
        </p>
      </div>

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

      {/* Dialog: configurar dados + seções */}
      <ConfigDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["empresas-acesso"] });
        }}
      />

      {/* Dialog: nova senha */}
      <Dialog open={!!novaSenha} onOpenChange={(o) => !o && setNovaSenha(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
            <DialogDescription>
              Copie e envie para a empresa. Ela será obrigada a trocar no próximo login.
            </DialogDescription>
          </DialogHeader>
          {novaSenha && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Usuário</Label>
                <div className="rounded border bg-muted px-3 py-2 font-mono text-sm">
                  {novaSenha.user}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Senha temporária</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded border bg-muted px-3 py-2 font-mono text-sm">
                    {novaSenha.senha}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(novaSenha.senha);
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
            <Button onClick={() => setNovaSenha(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigDialog({
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

  // reset quando abre
  useMemo(() => {
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
                <label
                  key={s.key}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
