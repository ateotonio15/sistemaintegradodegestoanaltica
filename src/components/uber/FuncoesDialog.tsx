import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useUberFuncoes, useSalvarFuncao } from "@/hooks/useUberFuncoes";

export function FuncoesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: funcoes = [] } = useUberFuncoes();
  const salvar = useSalvarFuncao();
  const [nova, setNova] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const adicionar = async () => {
    await salvar.mutateAsync({ nome: nova });
    setNova("");
  };
  const renomear = async () => {
    if (!editId) return;
    await salvar.mutateAsync({ id: editId, nome: editNome });
    setEditId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Funções dos passageiros</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Nova função" value={nova} onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && nova.trim()) adicionar().catch(() => {}); }} />
          <Button onClick={() => adicionar().catch(() => {})} disabled={!nova.trim() || salvar.isPending}>
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
        </div>
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {funcoes.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma função cadastrada.</p>}
          {funcoes.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
              {editId === f.id ? (
                <>
                  <Input className="h-8" value={editNome} onChange={(e) => setEditNome(e.target.value)} autoFocus />
                  <Button size="icon" variant="ghost" aria-label="Salvar nome" onClick={() => renomear().catch(() => {})}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${f.ativo ? "" : "text-muted-foreground line-through"}`}>{f.nome}</span>
                  <Button size="icon" variant="ghost" aria-label={`Renomear ${f.nome}`} onClick={() => { setEditId(f.id); setEditNome(f.nome); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Switch checked={f.ativo} aria-label={f.ativo ? "Desativar" : "Ativar"}
                    onCheckedChange={(v) => salvar.mutate({ id: f.id, ativo: v })} />
                </>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Funções desativadas não aparecem para novos cadastros, mas continuam nos passageiros que já as usam.</p>
      </DialogContent>
    </Dialog>
  );
}
