import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { PrioridadeBadge } from "@/components/prioridade/PrioridadeBadge";
import { Badge } from "@/components/ui/badge";
import { isPrioridadeAlertaIntenso } from "@/lib/movimentacao-utils";

interface EmpresaPrio {
  id: string;
  nome: string;
  responsavel_contrato: string | null;
  periodo_movimentacao: string | null;
  tipo_movimentacao: string | null;
  data_corte: number | null;
  status_empresa: string | null;
  prioridade_maxima_id: string | null;
}

function diasRestantes(periodo: string | null, dataCorte: number | null): number | null {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  let diaFim: number | null = null;
  if (dataCorte) {
    diaFim = dataCorte;
  } else if (periodo) {
    const m = periodo.match(/-(\d+)$/);
    if (m) diaFim = parseInt(m[1], 10);
  }
  if (!diaFim) return null;
  const fim = new Date(ano, mes, diaFim);
  if (fim < hoje) fim.setMonth(fim.getMonth() + 1);
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function PrioridadeMaximaDashboardCard() {
  const { data = [] } = useQuery({
    queryKey: ["dashboard", "prioridade-maxima"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,responsavel_contrato,periodo_movimentacao,tipo_movimentacao,data_corte,status_empresa,prioridade_maxima_id")
        .not("prioridade_maxima_id", "is", null)
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EmpresaPrio[];
    },
  });

  if (!data.length) return null;

  return (
    <Card className="border-2 border-red-500/60 bg-red-500/5 animate-pulse-priority">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-600">
          <Star className="h-5 w-5 fill-current" />
          Empresas com Prioridade Máxima
          <Badge variant="destructive" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left px-2 py-2">Empresa</th>
                <th className="text-left px-2 py-2">Responsável</th>
                <th className="text-left px-2 py-2">Período</th>
                <th className="text-left px-2 py-2">Status</th>
                <th className="text-right px-2 py-2">Dias restantes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => {
                const dias = diasRestantes(e.periodo_movimentacao, e.data_corte);
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-red-500/5">
                    <td className="px-2 py-2 font-medium flex items-center gap-2">
                      <PrioridadeBadge variant="compact" intense={isPrioridadeAlertaIntenso(e as any)} />
                      {e.nome}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{e.responsavel_contrato ?? "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {e.tipo_movimentacao === "Diária"
                        ? `Corte dia ${e.data_corte ?? "—"}`
                        : e.periodo_movimentacao ?? "—"}
                    </td>
                    <td className="px-2 py-2">{e.status_empresa ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {dias != null ? `${dias}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
