import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Entradas e saídas de vidas por mês</CardTitle>
      </CardHeader>
      <CardContent>
        {!temDados ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem histórico de vidas</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="vidas_ativas"
                  name="Vidas ativas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
