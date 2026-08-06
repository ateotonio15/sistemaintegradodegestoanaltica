import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { ChartCard } from "./ChartCard";

interface Props {
  data: { mes: string; empresas: number }[];
}

function label(mes: string) {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
}

export function EmpresasMovMensalChart({ data }: Props) {
  const chart = data.map((d) => ({ ...d, label: label(d.mes) }));
  const temDados = chart.some((d) => d.empresas > 0);
  const ultimo = chart[chart.length - 1]?.empresas ?? 0;

  return (
    <ChartCard
      title="Empresas com movimentação por mês"
      subtitle={`Últimos 12 meses · ${ultimo.toLocaleString("pt-BR")} no mês atual`}
      icon={<TrendingUp className="h-4 w-4" />}
      empty={!temDados}
      emptyLabel="Sem movimentações registradas"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gradEmpresasMov" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
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
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "10px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Area
            type="monotone"
            dataKey="empresas"
            name="Empresas"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            fill="url(#gradEmpresasMov)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
