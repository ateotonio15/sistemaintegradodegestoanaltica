import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: any[];
  profilesMap: Map<string, string>;
}

export function PortalPorUsuarioDialog({ open, onOpenChange, empresas, profilesMap }: Props) {
  const linhas = useMemo(() => {
    const map = new Map<string, { nome: string; portal: number; sem: number; listaPortal: string[]; listaSem: string[] }>();
    empresas
      .filter((e) => e.status_empresa === "Ativa")
      .forEach((e) => {
        const id = e.responsavel_user_id ?? "__sem__";
        const nome = e.responsavel_user_id ? profilesMap.get(e.responsavel_user_id) ?? "Usuário" : "Sem responsável";
        const l = map.get(id) ?? { nome, portal: 0, sem: 0, listaPortal: [] as string[], listaSem: [] as string[] };
        if (e.contrato_via_portal === true) { l.portal++; l.listaPortal.push(e.nome); }
        else { l.sem++; l.listaSem.push(e.nome); }
        map.set(id, l);
      });
    return Array.from(map.values()).sort((a, b) => b.portal + b.sem - (a.portal + a.sem));
  }, [empresas, profilesMap]);

  const [sel, setSel] = useState<{ titulo: string; nomes: string[] } | null>(null);
  const abrir = (titulo: string, nomes: string[]) =>
    setSel({ titulo, nomes: [...nomes].sort((a, b) => (a ?? "").localeCompare(b ?? "", "pt-BR")) });
  const Num = ({ v, titulo, nomes, cls = "" }: { v: number; titulo: string; nomes: string[]; cls?: string }) => (
    <button type="button" disabled={!v} onClick={() => abrir(titulo, nomes)}
      className={`tabular-nums underline-offset-4 hover:underline disabled:no-underline disabled:cursor-default ${cls}`}>{v}</button>
  );
  const todosPortal = linhas.flatMap((l) => l.listaPortal);
  const todosSem = linhas.flatMap((l) => l.listaSem);
  const tot = linhas.reduce((s, l) => ({ portal: s.portal + l.portal, sem: s.sem + l.sem }), { portal: 0, sem: 0 });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSel(null); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratos por portal — por usuário</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Via portal</TableHead>
              <TableHead className="text-right">Sem portal</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.nome}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell className="text-right"><Num v={l.portal} titulo={`${l.nome} — Via portal`} nomes={l.listaPortal} cls="text-primary font-semibold" /></TableCell>
                <TableCell className="text-right"><Num v={l.sem} titulo={`${l.nome} — Sem portal`} nomes={l.listaSem} /></TableCell>
                <TableCell className="text-right"><Num v={l.portal + l.sem} titulo={`${l.nome} — Todos`} nomes={[...l.listaPortal, ...l.listaSem]} cls="font-semibold" /></TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-right"><Num v={tot.portal} titulo="Todos — Via portal" nomes={todosPortal} cls="font-bold" /></TableCell>
              <TableCell className="text-right"><Num v={tot.sem} titulo="Todos — Sem portal" nomes={todosSem} cls="font-bold" /></TableCell>
              <TableCell className="text-right"><Num v={tot.portal + tot.sem} titulo="Todos os contratos" nomes={[...todosPortal, ...todosSem]} cls="font-bold" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">Clique em um número para ver as empresas.</p>
        {sel && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{sel.titulo} ({sel.nomes.length})</span>
              <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSel(null)}>Fechar lista</button>
            </div>
            <ol className="max-h-64 list-decimal space-y-1 overflow-y-auto pl-6 text-sm">
              {sel.nomes.map((n, i) => <li key={i}>{n}</li>)}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
