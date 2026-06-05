import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClockAlert, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function formatCompetencia(c?: string | null) {
  if (!c) return "—";
  const m = c.match(/^(\d{4})-(\d{2})$/);
  if (!m) return c;
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(m[2]) - 1]}/${m[1]}`;
}

export function ImplantacoesAguardandoFechamentoCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: rows = [] } = useQuery({
    queryKey: ["contratos-recem-implantados", "summary"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, vidas, primeira_competencia_financeira")
        .eq("status_implantacao", "aguardando_primeiro_fechamento");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalVidas = useMemo(() => rows.reduce((a, r: any) => a + (r.vidas ?? 0), 0), [rows]);
  const proximo = useMemo(() => {
    const comps = rows
      .map((r: any) => r.primeira_competencia_financeira)
      .filter((c: any): c is string => !!c)
      .sort();
    return comps[0] ?? null;
  }, [rows]);

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClockAlert className="h-5 w-5 text-amber-500" />
          Implantações Aguardando Fechamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Contratos</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vidas</p>
            <p className="text-2xl font-bold">{totalVidas}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Próximo fech.</p>
            <p className="text-lg font-bold">{formatCompetencia(proximo)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => navigate("/contratos-recem-implantados")}
        >
          Ver contratos <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
