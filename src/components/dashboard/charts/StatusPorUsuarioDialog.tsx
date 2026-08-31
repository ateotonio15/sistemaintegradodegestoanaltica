import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calcularStatus } from "@/lib/movimentacao-utils";

export interface MovRow {
  empresa_id: string;
  data_envio_empresa?: string | null;
  data_envio_financeiro?: string | null;
  empresas?: {
    id?: string;
    nome?: string | null;
    codigo_contrato?: string | null;
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

interface Contrato {
  id: string;
  nome: string;
  codigo: string | null;
  responsavel: string;
}

type Bucket = Map<string, Contrato>;

interface Linha {
  usuario: string;
  aguardando: Bucket;
  foraDoPrazo: Bucket;
  empresa: Bucket;
  financeiro: Bucket;
  total: Bucket;
}

/** Célula numérica: ao clicar, abre a janela com os contratos e o responsável. */
function CelulaStatus({
  bucket,
  titulo,
  className,
}: {
  bucket: Bucket;
  titulo: string;
  className?: string;
}) {
  const itens = Array.from(bucket.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  if (itens.length === 0) {
    return <TableCell className={`text-right tabular-nums ${className ?? ""}`}>0</TableCell>;
  }

  return (
    <TableCell className={`text-right tabular-nums ${className ?? ""}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="underline decoration-dotted underline-offset-4 hover:opacity-80 cursor-pointer"
          >
            {itens.length}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-semibold">{titulo}</p>
            <p className="text-[11px] text-muted-foreground">{itens.length} contrato(s)</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y">
            {itens.map((c) => (
              <div key={c.id} className="px-3 py-2">
                <p className="text-xs font-medium leading-tight">
                  {c.nome}
                  {c.codigo ? <span className="text-muted-foreground"> · {c.codigo}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">Responsável: {c.responsavel}</p>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </TableCell>
  );
}

export function StatusPorUsuarioDialog({ open, onOpenChange, movs, profilesMap, mes, periodo }: Props) {
  const linhas = useMemo(() => {
    const map = new Map<string, Linha>();
    movs.forEach((m) => {
      const emp = m.empresas ?? null;
      const uid = emp?.responsavel_user_id ?? null;
      // Somente usuários do Cadastro (empresarial) presentes no mapa de perfis
      if (!uid || !profilesMap.has(uid)) return;
      const nome = profilesMap.get(uid) || emp?.responsavel_contrato || "Sem responsável";

      let l = map.get(nome);
      if (!l) {
        l = {
          usuario: nome,
          aguardando: new Map(),
          foraDoPrazo: new Map(),
          empresa: new Map(),
          financeiro: new Map(),
          total: new Map(),
        };
        map.set(nome, l);
      }
      const s = calcularStatus(m as any);
      const id = m.empresa_id;
      const contrato: Contrato = {
        id,
        nome: emp?.nome || "Empresa sem nome",
        codigo: emp?.codigo_contrato ?? null,
        responsavel: nome,
      };
      l.total.set(id, contrato);
      if (s === "Enviado ao financeiro") l.financeiro.set(id, contrato);
      else if (s === "Enviado para empresa") l.empresa.set(id, contrato);
      else if (s === "Fora do prazo") l.foraDoPrazo.set(id, contrato);
      else l.aguardando.set(id, contrato);
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
            Competência {mes} · Período {periodo === "all" ? "todos" : periodo} · passe o mouse sobre os
            números para ver os contratos
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
                  <CelulaStatus
                    bucket={l.aguardando}
                    titulo={`Aguardando — ${l.usuario}`}
                    className="text-muted-foreground"
                  />
                  <CelulaStatus
                    bucket={l.foraDoPrazo}
                    titulo={`Fora do prazo — ${l.usuario}`}
                    className="text-destructive"
                  />
                  <CelulaStatus
                    bucket={l.empresa}
                    titulo={`Enviado para empresa — ${l.usuario}`}
                    className="text-warning"
                  />
                  <CelulaStatus
                    bucket={l.financeiro}
                    titulo={`Enviado ao financeiro — ${l.usuario}`}
                    className="text-success"
                  />
                  <CelulaStatus
                    bucket={l.total}
                    titulo={`Todos os contratos — ${l.usuario}`}
                    className="font-semibold"
                  />
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
