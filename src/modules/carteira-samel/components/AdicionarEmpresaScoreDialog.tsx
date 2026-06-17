import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import { useScoreEmpresas } from "../hooks/useScoreEmpresas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AdicionarEmpresaScoreDialog({ open, onOpenChange }: Props) {
  const { empresas } = useEmpresasCarteira();
  const { idsSet, addMany } = useScoreEmpresas();
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const disponiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas
      .filter((e) => !idsSet.has(e.id))
      .filter((e) =>
        !q || e.nome.toLowerCase().includes(q) || (e.contrato || "").includes(q),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [empresas, idsSet, busca]);

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onConfirm = async () => {
    await addMany.mutateAsync(Array.from(selecionadas));
    setSelecionadas(new Set());
    setBusca("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar empresa ao Score de Risco</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Buscar por nome ou contrato..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <ScrollArea className="h-80 rounded border">
          {disponiveis.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma empresa disponível.
            </div>
          ) : (
            <ul className="divide-y">
              {disponiveis.map((e) => (
                <li key={e.id} className="flex items-center gap-3 p-2.5 hover:bg-muted/50">
                  <Checkbox
                    id={`emp-${e.id}`}
                    checked={selecionadas.has(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                  />
                  <label htmlFor={`emp-${e.id}`} className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">{e.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      Contrato {e.contrato || "—"} · {e.vidas} vidas
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={selecionadas.size === 0 || addMany.isPending}>
            Adicionar {selecionadas.size > 0 ? `(${selecionadas.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
