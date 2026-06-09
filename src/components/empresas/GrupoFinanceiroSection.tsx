import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, X, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useGrupoFinanceiro, useGruposFinanceirosAtivos } from "@/hooks/useGrupoFinanceiro";

interface Props {
  empresaId: string | null | undefined;
}

export function GrupoFinanceiroSection({ empresaId }: Props) {
  const { isAdmin, isFinanceiro } = useAuth();
  const podeGerenciar = isAdmin || isFinanceiro;
  const qc = useQueryClient();
  const { data, isLoading } = useGrupoFinanceiro(empresaId);
  const { data: gruposAtivos } = useGruposFinanceirosAtivos();
  const [pertence, setPertence] = useState<"sim" | "nao" | "">("");
  const [modo, setModo] = useState<"existente" | "novo">("existente");
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");
  const [editarOpen, setEditarOpen] = useState(false);

  const grupo = data?.grupo;
  const contratos = data?.contratos ?? [];
  const efetivoPertence = grupo ? "sim" : pertence;

  const vincular = useMutation({
    mutationFn: async ({ grupoId }: { grupoId: string }) => {
      if (!empresaId) throw new Error("Empresa inválida");
      const { error } = await supabase.rpc("adicionar_contrato_grupo" as any, {
        p_grupo_id: grupoId,
        p_empresa_id: empresaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Empresa vinculada ao grupo financeiro" });
      qc.invalidateQueries({ queryKey: ["grupo-financeiro"] });
      qc.invalidateQueries({ queryKey: ["grupos-financeiros"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const criarGrupo = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await (supabase as any)
        .from("grupos_financeiros")
        .insert({ nome_grupo: nome.trim(), status: "Ativo" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (grupoId) => {
      qc.invalidateQueries({ queryKey: ["grupos-financeiros"] });
      if (empresaId) await vincular.mutateAsync({ grupoId });
      setNovoNome("");
      setModo("existente");
    },
    onError: (e: any) => toast({ title: "Erro ao criar grupo", description: e.message, variant: "destructive" }),
  });

  const removerVinculo = useMutation({
    mutationFn: async (vinculoId: string) => {
      const { error } = await supabase.rpc("remover_contrato_grupo" as any, { p_vinculo_id: vinculoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contrato removido do grupo" });
      qc.invalidateQueries({ queryKey: ["grupo-financeiro"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!empresaId) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Salve a empresa antes de configurar o grupo financeiro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Grupo Financeiro</h3>
        <span className="text-xs text-muted-foreground">
          · Compartilha anexos, envio de nota, DDA/depósito e vencimento entre contratos
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : grupo ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  <Link2 className="h-3 w-3 mr-1" />
                  Grupo: {grupo.nome_grupo}
                </Badge>
                <Badge variant={grupo.status === "Ativo" ? "default" : "outline"} className="text-[10px]">
                  {grupo.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-x-3">
                {grupo.vencimento_compartilhado && (
                  <span>Vencimento compartilhado{grupo.dia_vencimento ? ` (dia ${grupo.dia_vencimento})` : ""}</span>
                )}
                {grupo.forma_pagamento_compartilhada && grupo.forma_pagamento && (
                  <span>Forma de pagamento: {grupo.forma_pagamento}</span>
                )}
              </div>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setEditarOpen(true)}>
                Gerenciar grupo
              </Button>
            )}
          </div>

          <div className="rounded-lg border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Contratos vinculados ({contratos.length})
            </div>
            <ul className="divide-y">
              {contratos.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.nome_empresa ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.codigo_contrato ?? "—"} · {c.cnpj ?? "—"}
                    </div>
                  </div>
                  {isAdmin && c.empresa_id !== empresaId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removerVinculo.mutate(c.id)}
                      title="Remover do grupo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                const vinc = contratos.find((c) => c.empresa_id === empresaId);
                if (vinc) removerVinculo.mutate(vinc.id);
              }}
            >
              Remover esta empresa do grupo
            </Button>
          )}

          <EditarGrupoDialog
            open={editarOpen}
            onOpenChange={setEditarOpen}
            grupoId={grupo.id}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Esta empresa pertence a um grupo financeiro?</Label>
            <Select value={efetivoPertence} onValueChange={(v) => setPertence(v as any)}>
              <SelectTrigger className="rounded-lg max-w-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {efetivoPertence === "sim" && isAdmin && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={modo === "existente" ? "default" : "outline"}
                  onClick={() => setModo("existente")}
                >
                  Vincular a grupo existente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={modo === "novo" ? "default" : "outline"}
                  onClick={() => setModo("novo")}
                >
                  Criar novo grupo
                </Button>
              </div>

              {modo === "existente" ? (
                <div className="flex gap-2">
                  <Select value={grupoSelecionado} onValueChange={setGrupoSelecionado}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                    <SelectContent>
                      {(gruposAtivos ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.nome_grupo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={!grupoSelecionado || vincular.isPending}
                    onClick={() => vincular.mutate({ grupoId: grupoSelecionado })}
                  >
                    Vincular
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do grupo (ex: FLEXTRONICS)"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={!novoNome.trim() || criarGrupo.isPending}
                    onClick={() => criarGrupo.mutate(novoNome)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Criar e vincular
                  </Button>
                </div>
              )}
            </div>
          )}

          {efetivoPertence === "sim" && !isAdmin && (
            <div className="text-xs text-muted-foreground rounded-lg border p-3">
              Apenas administradores podem criar ou vincular grupos financeiros.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditarGrupoDialog({
  open,
  onOpenChange,
  grupoId,
}: { open: boolean; onOpenChange: (v: boolean) => void; grupoId: string }) {
  const qc = useQueryClient();
  const { data: grupo } = useQuery({
    queryKey: ["grupo-financeiro", "detalhe", grupoId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("grupos_financeiros" as any).select("*").eq("id", grupoId).maybeSingle();
      return data as any;
    },
  });
  const [form, setForm] = useState<any>(null);
  // sincroniza form quando grupo carregar
  if (grupo && (!form || form.id !== grupo.id)) setForm(grupo);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("grupos_financeiros").update({
        nome_grupo: form.nome_grupo?.trim(),
        vencimento_compartilhado: !!form.vencimento_compartilhado,
        dia_vencimento: form.dia_vencimento || null,
        forma_pagamento_compartilhada: !!form.forma_pagamento_compartilhada,
        forma_pagamento: form.forma_pagamento || null,
        observacao: form.observacao || null,
        status: form.status,
      }).eq("id", grupoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Grupo atualizado" });
      qc.invalidateQueries({ queryKey: ["grupo-financeiro"] });
      qc.invalidateQueries({ queryKey: ["grupos-financeiros"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!form) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><div className="p-4 text-sm">Carregando...</div></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Grupo Financeiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do grupo *</Label>
            <Input value={form.nome_grupo ?? ""} onChange={(e) => setForm({ ...form, nome_grupo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vencimento compartilhado</Label>
              <div className="flex items-center gap-2 h-10 px-3 border rounded-lg">
                <Switch
                  checked={!!form.vencimento_compartilhado}
                  onCheckedChange={(v) => setForm({ ...form, vencimento_compartilhado: v })}
                />
                <span className="text-sm text-muted-foreground">{form.vencimento_compartilhado ? "Sim" : "Não"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dia do vencimento</Label>
              <Input
                type="number" min={1} max={31}
                disabled={!form.vencimento_compartilhado}
                value={form.dia_vencimento ?? ""}
                onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento compartilhada</Label>
              <div className="flex items-center gap-2 h-10 px-3 border rounded-lg">
                <Switch
                  checked={!!form.forma_pagamento_compartilhada}
                  onCheckedChange={(v) => setForm({ ...form, forma_pagamento_compartilhada: v })}
                />
                <span className="text-sm text-muted-foreground">{form.forma_pagamento_compartilhada ? "Sim" : "Não"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.forma_pagamento ?? ""}
                disabled={!form.forma_pagamento_compartilhada}
                onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DDA">DDA</SelectItem>
                  <SelectItem value="Depósito">Depósito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar grupo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
