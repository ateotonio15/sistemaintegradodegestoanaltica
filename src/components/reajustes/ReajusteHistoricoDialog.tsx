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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Histórico de Reajustes {empresaNome ? `— ${empresaNome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Antigo</TableHead>
                <TableHead>Reajustado</TableHead>
                <TableHead>Retro.</TableHead>
                <TableHead>Final</TableHead>
                <TableHead>Aplicação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Liberado</TableHead>
                <TableHead>Competência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum reajuste registrado</TableCell></TableRow>
              ) : (
                data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ano}</TableCell>
                    <TableCell>{Number(r.percentual).toFixed(2).replace(".", ",")}%</TableCell>
                    <TableCell>{formatCentavosBRL(r.valor_antigo_centavos)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCentavosBRL(r.valor_reajustado_centavos)}</TableCell>
                    <TableCell className="text-sm">
                      {formatCentavosBRL(r.valor_retroativo_centavos)}
                      {(r.meses_retroativos || 0) > 0 && <div className="text-xs text-muted-foreground">{r.meses_retroativos}m</div>}
                    </TableCell>
                    <TableCell className="font-bold">{formatCentavosBRL(r.valor_final_centavos)}</TableCell>
                    <TableCell>{formatDateBR(r.data_aplicacao)}</TableCell>
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
