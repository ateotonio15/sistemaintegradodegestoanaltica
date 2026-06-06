import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";

export function ResponsaveisEmFeriasCard() {
  const { data: ferias = [] } = useQuery({
    queryKey: ["ferias-em-andamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_cadastro" as any)
        .select("*, ferias_cadastro_empresas(status)")
        .in("status", ["em_andamento", "aguardando_retorno_contratos", "programada"])
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  if (ferias.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plane className="h-5 w-5 text-primary" />Responsáveis em Férias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ferias.map((f) => {
          const emps = (f.ferias_cadastro_empresas ?? []) as { status: string }[];
          const redistribuidas = emps.filter((e) => e.status === "redistribuida" || e.status === "aguardando_fechamento").length;
          const pendentes = emps.filter((e) => e.status === "aguardando_fechamento").length;
          return (
            <div key={f.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{f.responsavel_original_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(f.data_inicio)} → {formatDateBR(f.data_fim)}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{redistribuidas} redistribuídas</Badge>
                {pendentes > 0 && (
                  <Badge variant="outline" className="border-yellow-500/30 text-yellow-700">
                    {pendentes} pendentes
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
