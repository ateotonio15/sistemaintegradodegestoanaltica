import { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { CalendarRange } from "lucide-react";
import { ChartCard } from "./ChartCard";

interface Props {
  data: { periodo: string; empresas: number }[];
  filtros?: ReactNode;
}

export function EmpresasPorPeriodoChart({ data, filtros }: Props) {
  const temDados = data.some((d) => d.empresas > 0);
  const total = data.reduce((s, d) => s + d.empresas, 0);

  return (
    <ChartCard
      title="Empresas por período"
      subtitle={`${total.toLocaleString("pt-BR")} empresas com movimentação na competência`}
      icon={<CalendarRange className="h-4 w-4" />}
      actions={filtros}
      empty={!temDados}
      emptyLabel="Sem movimentações no período"
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="periodo"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "10px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar dataKey="empresas" name="Empresas" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={56}>
            <LabelList
              dataKey="empresas"
              position="top"
              style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
