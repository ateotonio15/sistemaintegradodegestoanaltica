import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2 } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface Props {
  totalGeral: number;
  totalEmpresarial: number;
  empresasAtivas: number;
}

export function VidasTempoRealCard({ totalGeral, totalEmpresarial, empresasAtivas }: Props) {
  const pct = totalGeral > 0 ? Math.round((totalEmpresarial / totalGeral) * 100) : 0;
  const chartData = [{ name: "Empresarial", value: pct, fill: "hsl(var(--primary))" }];

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Vidas em tempo real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={12} />
                <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
                  {pct}%
                </text>
                <text x="50%" y="60%" textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  empresarial
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total de vidas</p>
              <p className="text-3xl font-bold">{totalGeral.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Somente empresarial</p>
              <p className="text-2xl font-semibold text-primary">{totalEmpresarial.toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {empresasAtivas.toLocaleString("pt-BR")} empresas ativas
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
