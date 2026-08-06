import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularStatus } from "@/lib/movimentacao-utils";

export interface MovRow {
  empresa_id: string;
  data_envio_empresa?: string | null;
  data_envio_financeiro?: string | null;
  empresas?: {
    id?: string;
    nome?: string | null;
    responsavel_contrato?: string | null;
    responsavel_user_id?: string | null;
  } | null;
  [k: string]: any;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movs: MovRow[];
  profilesMap: Map<string, string>;
  mes: string;
  periodo: string;
}

interface Linha {
  usuario: string;
  aguardando: Set<string>;
  foraDoPrazo: Set<string>;
  empresa: Set<string>;
  financeiro: Set<string>;
  total: Set<string>;
}

export function StatusPorUsuarioDialog({ open, onOpenChange, movs, profilesMap, mes, periodo }: Props) {
  const linhas = useMemo(() => {
    const map = new Map<string, Linha>();
    movs.forEach((m) => {
      const emp = m.empresas ?? null;
      const uid = emp?.responsavel_user_id ?? null;
      const nome =
        (uid ? profilesMap.get(uid) : "") || emp?.responsavel_contrato || "Sem responsável";
      let l = map.get(nome);
      if (!l) {
        l = {
          usuario: nome,
          aguardando: new Set(),
          foraDoPrazo: new Set(),
          empresa: new Set(),
          financeiro: new Set(),
          total: new Set(),
        };
        map.set(nome, l);
      }
      const s = calcularStatus(m as any);
      const id = m.empresa_id;
      l.total.add(id);
      if (s === "Enviado ao financeiro") l.financeiro.add(id);
      else if (s === "Enviado para empresa") l.empresa.add(id);
      else if (s === "Fora do prazo") l.foraDoPrazo.add(id);
      else l.aguardando.add(id);
    });
    return Array.from(map.values()).sort((a, b) => b.total.size - a.total.size);
  }, [movs, profilesMap]);

  const totais = useMemo(() => {
    const acc = { aguardando: 0, foraDoPrazo: 0, empresa: 0, financeiro: 0, total: 0 };
    linhas.forEach((l) => {
      acc.aguardando += l.aguardando.size;
      acc.foraDoPrazo += l.foraDoPrazo.size;
      acc.empresa += l.empresa.size;
      acc.financeiro += l.financeiro.size;
      acc.total += l.total.size;
    });
    return acc;
  }, [linhas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Empresas por status e usuário do Cadastro</DialogTitle>
          <DialogDescription>
            Competência {mes} · Período {periodo === "all" ? "todos" : periodo}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Aguardando</TableHead>
                <TableHead className="text-right">Fora do prazo</TableHead>
                <TableHead className="text-right">Empresa</TableHead>
                <TableHead className="text-right">Financeiro</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l) => (
                <TableRow key={l.usuario}>
                  <TableCell className="font-medium">{l.usuario}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.aguardando.size}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {l.foraDoPrazo.size}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-warning">{l.empresa.size}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{l.financeiro.size}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{l.total.size}</TableCell>
                </TableRow>
              ))}
              {linhas.length > 0 && (
                <TableRow className="bg-muted/40">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{totais.aguardando}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{totais.foraDoPrazo}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{totais.empresa}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{totais.financeiro}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{totais.total}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
