import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  pendentes: number;
  empresa: number;
  financeiro: number;
  filtros?: ReactNode;
}

export function StatusMovChart({ pendentes, empresa, financeiro, filtros }: Props) {
  const data = [
    { name: "Pendentes", value: pendentes, color: "hsl(var(--destructive))" },
    { name: "Enviadas p/ Empresa", value: empresa, color: "hsl(var(--warning))" },
    { name: "Enviadas ao Financeiro", value: financeiro, color: "hsl(var(--success))" },
  ].filter((d) => d.value > 0);

  const total = pendentes + empresa + financeiro;

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">Movimentações por status</CardTitle>
        {filtros}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem dados no período</div>
        ) : (
          <div className="relative h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={2}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
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
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
              <span className="text-3xl font-bold">{total}</span>
              <span className="text-xs text-muted-foreground">movimentações</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
