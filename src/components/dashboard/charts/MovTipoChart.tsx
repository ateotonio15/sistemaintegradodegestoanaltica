import { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Layers } from "lucide-react";
import { ChartCard } from "./ChartCard";

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
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
    <ChartCard
      title="Empresas por tipo de movimentação"
      subtitle={`${total.toLocaleString("pt-BR")} empresas no recorte`}
      icon={<Layers className="h-4 w-4" />}
      actions={filtros}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="tipo"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            interval={0}
            tickLine={false}
            axisLine={false}
            height={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
          <Bar dataKey="total" name="Empresas" radius={[8, 8, 0, 0]} maxBarSize={64}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 700 }}
            />
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
