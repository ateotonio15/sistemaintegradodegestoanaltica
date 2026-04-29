import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { calcularPrazoFinanceiro, type StatusFinanceiro } from "@/lib/financeiro-utils";

type Mode = "tipo" | "status" | "prazo";

interface ChartItem {
  status: StatusFinanceiro;
  tipo_cobranca: string | null;
  dentro_prazo: boolean;
  aguardando_nota_em?: string | null;
  data_envio_nota?: string | null;
  dia_emissao?: number | null;
}

interface StatusChartProps {
  data: ChartItem[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function StatusChart({ data }: StatusChartProps) {
  const [mode, setMode] = useState<Mode>("status");

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (mode === "tipo") {
      data.forEach((d) => {
        const key = d.tipo_cobranca?.trim() || "Sem tipo";
        counts[key] = (counts[key] || 0) + 1;
      });
    } else if (mode === "status") {
      data.forEach((d) => {
        counts[d.status] = (counts[d.status] || 0) + 1;
      });
    } else {
      // Modo "prazo": usa cálculo do Financeiro (24h/48h, regra dia 01)
      data.forEach((d) => {
        const r = calcularPrazoFinanceiro({
          aguardando_nota_em: d.aguardando_nota_em,
          data_envio_nota: d.data_envio_nota,
          dia_emissao: d.dia_emissao,
        });
        if (r.categoria === "Sem base") return;
        counts[r.categoria] = (counts[r.categoria] || 0) + 1;
      });
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data, mode]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">Distribuição</h3>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["status", "tipo", "prazo"] as Mode[]).map((m) => (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 text-xs capitalize px-3",
                  mode === m && "bg-background shadow-sm text-foreground",
                )}
                onClick={() => setMode(m)}
              >
                {m === "tipo" ? "Tipo" : m === "status" ? "Status" : "Prazo"}
              </Button>
            ))}
          </div>
        </div>

        {total === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-12">
            Sem dados para exibir
          </div>
        ) : (
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
