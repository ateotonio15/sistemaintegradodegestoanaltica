import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

interface Props {
  data: { periodo: string; empresas: number }[];
  filtros?: ReactNode;
}

export function EmpresasPorPeriodoChart({ data, filtros }: Props) {
  const temDados = data.some((d) => d.empresas > 0);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">Empresas por período</CardTitle>
        {filtros}
      </CardHeader>
      <CardContent>
        {!temDados ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem movimentações no período</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Bar dataKey="empresas" name="Empresas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  <LabelList
                    dataKey="empresas"
                    position="top"
                    style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
