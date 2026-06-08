import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bike, ArrowRight } from "lucide-react";
import { useHondaExclusoes, getDiasRestantes } from "@/hooks/useHondaExclusoes";
import { useMemo } from "react";

export function HondaExclusoesCard() {
  const { data = [] } = useHondaExclusoes();

  const counts = useMemo(() => {
    let amanha = 0, hoje = 0, atrasadas = 0;
    for (const it of data) {
      if (it.concluido) continue;
      const d = getDiasRestantes(it);
      if (d === 0) hoje++;
      else if (d === 1) amanha++;
      else if (d < 0) atrasadas++;
    }
    return { amanha, hoje, atrasadas };
  }, [data]);

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bike className="h-4 w-4 text-primary" />
          Exclusões Honda
          <Link
            to="/honda-exclusoes"
            className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            abrir <ArrowRight className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{counts.amanha}</p>
            <p className="text-xs text-muted-foreground">Amanhã</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-primary">{counts.hoje}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-destructive">{counts.atrasadas}</p>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
