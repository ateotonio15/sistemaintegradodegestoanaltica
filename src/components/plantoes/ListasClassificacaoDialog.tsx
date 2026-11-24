import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROTEGIDOS = ["Outros", "Outras especialidades", "Consulta com especialista", "Dificuldade com o app Samel"];

export function useListasClassificacao() {
  return useQuery({
    queryKey: ["atendimento-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("atendimento_classificacao_listas").select("*").order("ordem");
      if (error) throw error;
      const ativos = (data ?? []).filter((d) => d.ativo);
      return {
        todos: data ?? [],
        motivos: ativos.filter((d) => d.lista === "motivo").map((d) => d.valor),
        especialidades: ativos.filter((d) => d.lista === "especialidade").map((d) => d.valor),
      };
    },
  });
}

export function ListasClassificacaoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data } = useListasClassificacao();
  const [novo, setNovo] = useState<Record<string, string>>({});
  const inv = () => qc.invalidateQueries({ queryKey: ["atendimento-listas"] });
  const add = useMutation({
    mutationFn: async (lista: string) => {
      const valor = (novo[lista] ?? "").trim();
      if (!valor) return;
      const { error } = await supabase.from("atendimento_classificacao_listas").upsert({ lista, valor, ordem: 50, ativo: true }, { onConflict: "lista,valor" });
      if (error) throw error;
      setNovo((n) => ({ ...n, [lista]: "" }));
    },
    onSuccess: inv, onError: () => toast.error("Não foi possível adicionar."),
  });
  const desativar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atendimento_classificacao_listas").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv, onError: () => toast.error("Não foi possível remover."),
  });
  const bloco = (lista: "motivo" | "especialidade", titulo: string) => (
    <div className="space-y-2">
      <div className="font-semibold text-sm">{titulo}</div>
      {(data?.todos ?? []).filter((d) => d.lista === lista && d.ativo).map((d) => (
        <div key={d.id} className="flex items-center justify-between text-sm border-b border-border py-1">
          <span>{d.valor}</span>
          {!PROTEGIDOS.includes(d.valor) && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => desativar.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Novo item" value={novo[lista] ?? ""} onChange={(e) => setNovo((n) => ({ ...n, [lista]: e.target.value }))} />
        <Button size="sm" onClick={() => add.mutate(lista)}>Adicionar</Button>
      </div>
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Listas de classificação</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Itens removidos deixam de ser sugeridos; atendimentos já classificados mantêm o valor gravado.</p>
        <div className="grid sm:grid-cols-2 gap-6">{bloco("motivo", "Motivos")}{bloco("especialidade", "Especialidades")}</div>
      </DialogContent>
    </Dialog>
  );
}
