import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Search } from "lucide-react";
import { toast } from "sonner";

export type OrbitEmpresa = {
  id: string;
  nome: string;
  responsavel?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: OrbitEmpresa[];
}

export function EnviarOrbitDialog({ open, onOpenChange, empresas }: Props) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [perfis, setPerfis] = useState<Array<{ display_name: string | null; username: string | null }>>([]);

  useEffect(() => {
    if (!open) return;
    setSel(new Set());
    setBusca("");
    supabase
      .from("profiles")
      .select("display_name, username")
      .then(({ data }) => setPerfis((data ?? []) as any));
  }, [open]);

  // Empresas únicas por nome (o Financeiro repete a empresa por período/pagador)
  const lista = useMemo(() => {
    const map = new Map<string, OrbitEmpresa>();
    empresas.forEach((e) => {
      if (!map.has(e.nome)) map.set(e.nome, e);
    });
    const q = busca.trim().toLowerCase();
    return Array.from(map.values())
      .filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.responsavel ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [empresas, busca]);

  const orbitUser = (resp?: string | null) => {
    const nome = (resp ?? "").trim();
    if (!nome) return "";
    const p = perfis.find((u) => (u.display_name ?? "").trim().toLowerCase() === nome.toLowerCase());
    return (p?.username || nome).trim();
  };

  const toggle = (nome: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });

  const todasMarcadas = lista.length > 0 && lista.every((e) => sel.has(e.nome));

  async function enviar() {
    const selecionadas = lista.filter((e) => sel.has(e.nome));
    if (!selecionadas.length) return;

    const porUsuario = new Map<string, string[]>();
    const semResponsavel: string[] = [];
    selecionadas.forEach((e) => {
      const u = orbitUser(e.responsavel);
      if (!u) {
        semResponsavel.push(e.nome);
        return;
      }
      const arr = porUsuario.get(u) ?? [];
      if (!arr.includes(e.nome)) arr.push(e.nome);
      porUsuario.set(u, arr);
    });

    if (porUsuario.size === 0) {
      toast.error("As empresas selecionadas não possuem responsável definido.");
      return;
    }

    const entries = Array.from(porUsuario.entries()).map(([user, companies]) => ({ user, companies }));

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("orbit-daily-companies", { body: { entries } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const results = ((data as any)?.results ?? []) as Array<{ username: string; resolved: boolean; added?: number }>;
      const totalAdded = results.reduce((s, r) => s + (r.added ?? 0), 0);
      const naoEncontrados = results.filter((r) => !r.resolved).map((r) => r.username);

      const detalhes = [
        naoEncontrados.length ? `Usuários não encontrados no Orbit: ${naoEncontrados.join(", ")}.` : "",
        semResponsavel.length ? `Sem responsável: ${semResponsavel.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (naoEncontrados.length) {
        toast.warning(`${totalAdded} empresa(s) criada(s) no Orbit`, { description: detalhes });
      } else {
        toast.success(`${totalAdded} empresa(s) criada(s) no Orbit`, {
          description: detalhes || `Enviadas para ${entries.length} analista(s).`,
        });
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error("Erro ao enviar para o Orbit", { description: err.message ?? String(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Enviar empresas para o Orbit</DialogTitle>
          <DialogDescription>
            Selecione as empresas do período atual. Elas são agrupadas pelo analista responsável. Reenvios no mesmo dia não duplicam.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar empresa ou responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={todasMarcadas}
              onCheckedChange={(v) => setSel(v ? new Set(lista.map((e) => e.nome)) : new Set())}
            />
            <span className="text-muted-foreground">Selecionar todas ({lista.length})</span>
          </label>
          <Badge variant="secondary">{sel.size} selecionada(s)</Badge>
        </div>

        <ScrollArea className="h-[380px] rounded-md border">
          {lista.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {lista.map((e) => (
                <li key={e.nome} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                  <Checkbox id={`orb-${e.id}`} checked={sel.has(e.nome)} onCheckedChange={() => toggle(e.nome)} />
                  <label htmlFor={`orb-${e.id}`} className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">{e.nome}</div>
                    <div className="text-xs text-muted-foreground">{e.responsavel || "Sem responsável"}</div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={sel.size === 0 || enviando} className="gap-1.5">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar {sel.size > 0 ? `(${sel.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
