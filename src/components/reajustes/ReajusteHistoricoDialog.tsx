import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCentavosBRL, labelStatusReajusteFluxo } from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/date-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome?: string;
}

export function ReajusteHistoricoDialog({ open, onOpenChange, empresaId, empresaNome }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["reajustes-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("reajustes_anuais")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("ano", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!empresaId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Histórico de Reajustes {empresaNome ? `— ${empresaNome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border max-h-[65vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="align-bottom">Ano</TableHead>
                <TableHead rowSpan={2} className="align-bottom">%</TableHead>
                <TableHead colSpan={3} className="text-center bg-blue-500/10 text-blue-700 dark:text-blue-400">Enfermaria</TableHead>
                <TableHead colSpan={3} className="text-center bg-purple-500/10 text-purple-700 dark:text-purple-400">Apartamento</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Total Final</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Aplicação</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Status</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Liberado</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Compet.</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-xs bg-blue-500/5">Antigo</TableHead>
                <TableHead className="text-xs bg-blue-500/5">Reaj.</TableHead>
                <TableHead className="text-xs bg-blue-500/5">Final</TableHead>
                <TableHead className="text-xs bg-purple-500/5">Antigo</TableHead>
                <TableHead className="text-xs bg-purple-500/5">Reaj.</TableHead>
                <TableHead className="text-xs bg-purple-500/5">Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">Nenhum reajuste registrado</TableCell></TableRow>
              ) : (
                data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ano}</TableCell>
                    <TableCell>{Number(r.percentual || 0).toFixed(2).replace(".", ",")}%</TableCell>
                    <TableCell className="text-sm">{formatCentavosBRL(r.valor_antigo_enfermaria_centavos)}</TableCell>
                    <TableCell className="text-sm">{formatCentavosBRL(r.valor_reajustado_enfermaria_centavos)}</TableCell>
                    <TableCell className="font-semibold text-blue-700 dark:text-blue-400">{formatCentavosBRL(r.valor_final_enfermaria_centavos)}</TableCell>
                    <TableCell className="text-sm">{formatCentavosBRL(r.valor_antigo_apartamento_centavos)}</TableCell>
                    <TableCell className="text-sm">{formatCentavosBRL(r.valor_reajustado_apartamento_centavos)}</TableCell>
                    <TableCell className="font-semibold text-purple-700 dark:text-purple-400">{formatCentavosBRL(r.valor_final_apartamento_centavos)}</TableCell>
                    <TableCell className="font-bold text-primary">{formatCentavosBRL((r.valor_final_enfermaria_centavos || 0) + (r.valor_final_apartamento_centavos || 0) || r.valor_final_centavos)}</TableCell>
                    <TableCell className="text-sm">{r.data_aplicacao ? formatDateBR(r.data_aplicacao) : "—"}</TableCell>
                    <TableCell className="text-sm">{labelStatusReajusteFluxo(r.status_reajuste)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.liberado_por_nome ? (
                        <>
                          {r.liberado_por_nome}
                          {r.data_liberacao && <div className="text-xs">{formatDateBR(String(r.data_liberacao).slice(0, 10))}</div>}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.competencia || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
