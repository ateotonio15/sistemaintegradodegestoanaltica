import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpDown } from "lucide-react";
import { ChartCard } from "./ChartCard";

export interface VidasMes {
  mes: string;
  entradas: number;
  saidas: number;
  vidas_ativas: number;
}

interface Props {
  data: VidasMes[];
}

function label(mes: string) {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
}

export function VidasMensalChart({ data }: Props) {
  const chart = data.map((d) => ({ ...d, label: label(d.mes) }));
  const temDados = chart.some((d) => d.entradas || d.saidas || d.vidas_ativas);
  const entradas = chart.reduce((s, d) => s + (d.entradas ?? 0), 0);
  const saidas = chart.reduce((s, d) => s + (d.saidas ?? 0), 0);

  return (
    <ChartCard
      title="Entradas e saídas de vidas por mês"
      subtitle={`${entradas.toLocaleString("pt-BR")} entradas · ${saidas.toLocaleString("pt-BR")} saídas nos últimos 12 meses`}
      icon={<ArrowUpDown className="h-4 w-4" />}
      empty={!temDados}
      emptyLabel="Sem histórico de vidas"
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "10px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
            cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
          <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Line
            type="monotone"
            dataKey="vidas_ativas"
            name="Vidas ativas"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
