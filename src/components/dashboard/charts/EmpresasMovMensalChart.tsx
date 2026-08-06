import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Empresas com movimentação por mês</CardTitle>
      </CardHeader>
      <CardContent>
        {!temDados ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem movimentações registradas</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEmpresasMov" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
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
                />
                <Area
                  type="monotone"
                  dataKey="empresas"
                  name="Empresas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#gradEmpresasMov)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
