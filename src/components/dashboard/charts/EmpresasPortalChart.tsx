import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Globe } from "lucide-react";
import { ChartCard } from "./ChartCard";

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

interface Props {
  data: { categoria: string; total: number }[];
}

export function EmpresasPortalChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0);
  const viaPortal = data.find((d) => d.categoria === "Via portal")?.total ?? 0;
  const pct = total > 0 ? Math.round((viaPortal / total) * 100) : 0;

  return (
    <ChartCard
      title="Empresas por canal de movimentação"
      subtitle={`${total.toLocaleString("pt-BR")} empresas ativas · ${pct}% via portal`}
      icon={<Globe className="h-4 w-4" />}
      empty={total === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="categoria"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
          <Bar dataKey="total" name="Empresas" radius={[0, 8, 8, 0]} barSize={38}>
            <LabelList
              dataKey="total"
              position="right"
              style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
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
