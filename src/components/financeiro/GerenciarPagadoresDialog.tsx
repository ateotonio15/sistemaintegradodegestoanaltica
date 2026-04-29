import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Pagador {
  id: string;
  empresa_id: string;
  nome_pagador: string;
  cnpj: string | null;
  ativo: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome: string;
  readOnly?: boolean;
}

export function GerenciarPagadoresDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novoCnpj, setNovoCnpj] = useState("");

  const { data: pagadores = [], isLoading } = useQuery({
    queryKey: ["financeiro-pagadores", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("financeiro_pagadores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Pagador[];
    },
    enabled: !!empresaId && open,
  });

  useEffect(() => {
    if (!open) {
      setNovoNome("");
      setNovoCnpj("");
    }
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores", empresaId] });
    queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores-all"] });
  };

  const addMutation = useMutation({
    mutationFn: async (payload: { nome: string; cnpj: string | null }) => {
      if (!empresaId) throw new Error("Empresa inválida");
      const { error } = await supabase
        .from("financeiro_pagadores")
        .insert({
          empresa_id: empresaId,
          nome_pagador: payload.nome.trim(),
          cnpj: payload.cnpj,
          ativo: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagador adicionado");
      setNovoNome("");
      setNovoCnpj("");
      invalidate();
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("uq_financeiro_pagadores_empresa_nome")
        ? "Esse pagador já existe para esta empresa"
        : e?.message || "Erro ao adicionar pagador";
      toast.error(msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (p: Pagador) => {
      const { error } = await supabase
        .from("financeiro_pagadores")
        .update({ ativo: !p.ativo })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_pagadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagador removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const handleAdd = () => {
    const nome = novoNome.trim();
    if (!nome) {
      toast.error("Informe o nome do pagador");
      return;
    }
    addMutation.mutate({ nome, cnpj: novoCnpj.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagadores — {empresaNome}</DialogTitle>
          <DialogDescription>
            Gerencie os pagadores vinculados a esta empresa (apenas no contexto Financeiro).
            Sem pagadores cadastrados, o sistema assume o nome da própria empresa.
          </DialogDescription>
        </DialogHeader>

        {!readOnly && (
          <div className="flex gap-2">
            <Input
              placeholder="Nome do pagador"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : pagadores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum pagador cadastrado. O nome da empresa será usado como pagador padrão.
            </p>
          ) : (
            pagadores.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.nome_pagador}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.ativo ? "Ativo" : "Inativo"}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.ativo}
                      onCheckedChange={() => toggleMutation.mutate(p)}
                      disabled={toggleMutation.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remover o pagador "${p.nome_pagador}"?`)) {
                          removeMutation.mutate(p.id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
