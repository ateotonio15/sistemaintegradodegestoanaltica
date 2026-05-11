import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCentavosBRL } from "@/lib/reajuste-utils";
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de Reajustes {empresaNome ? `— ${empresaNome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Valor Antigo</TableHead>
                <TableHead>Valor Reajustado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum reajuste registrado</TableCell></TableRow>
              ) : (
                data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ano}</TableCell>
                    <TableCell>{Number(r.percentual).toFixed(2).replace(".", ",")}%</TableCell>
                    <TableCell>{formatCentavosBRL(r.valor_antigo_centavos)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCentavosBRL(r.valor_reajustado_centavos)}</TableCell>
                    <TableCell>{formatDateBR(r.data_aplicacao)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.usuario_nome || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.status_reajuste === "reajustado" ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">Reajustado</span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">Aguardando Cadastro</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.confirmado_por_nome ? (
                        <>
                          {r.confirmado_por_nome}
                          {r.data_confirmacao && (
                            <div className="text-xs">{formatDateBR(String(r.data_confirmacao).slice(0, 10))}</div>
                          )}
                        </>
                      ) : "—"}
                    </TableCell>
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
