import { useMemo } from "react";
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
    const map = new Map<string, { nome: string; portal: number; sem: number }>();
    empresas
      .filter((e) => e.status_empresa === "Ativa")
      .forEach((e) => {
        const id = e.responsavel_user_id ?? "__sem__";
        const nome = e.responsavel_user_id ? profilesMap.get(e.responsavel_user_id) ?? "Usuário" : "Sem responsável";
        const l = map.get(id) ?? { nome, portal: 0, sem: 0 };
        if (e.contrato_via_portal === true) l.portal++;
        else l.sem++;
        map.set(id, l);
      });
    return Array.from(map.values()).sort((a, b) => b.portal + b.sem - (a.portal + a.sem));
  }, [empresas, profilesMap]);

  const tot = linhas.reduce((s, l) => ({ portal: s.portal + l.portal, sem: s.sem + l.sem }), { portal: 0, sem: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <TableCell className="text-right tabular-nums text-primary font-semibold">{l.portal}</TableCell>
                <TableCell className="text-right tabular-nums">{l.sem}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{l.portal + l.sem}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{tot.portal}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{tot.sem}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{tot.portal + tot.sem}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
