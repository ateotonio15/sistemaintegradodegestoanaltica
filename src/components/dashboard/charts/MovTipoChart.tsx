import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

interface Props {
  data: { tipo: string; total: number }[];
  filtros?: ReactNode;
}

export function MovTipoChart({ data, filtros }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Empresas por tipo de movimentação</CardTitle>
          <p className="text-xs text-muted-foreground">Total de empresas ativas: {total}</p>
        </div>
        {filtros}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem dados no período</div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar dataKey="total" name="Empresas" radius={[6, 6, 0, 0]} maxBarSize={80}>
                  <LabelList dataKey="total" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
