import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EmpresaTop } from "../../lib/exec-mock-julho-2026";

export function TopEmpresasChart({ data }: { data: EmpresaTop[] }) {
  return (
    <Card className="border-[hsl(var(--exec-border))] bg-[hsl(var(--exec-surface))]">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Top Empresas Atendidas</CardTitle>
        <p className="text-xs text-muted-foreground">Ranking por número de ações</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 30, right: 24 }}>
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis dataKey="nome" type="category" width={140} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "rgba(27,153,139,0.08)" }} />
            <Bar dataKey="acoes" fill="#1b998b" radius={[0, 8, 8, 0]} label={{ position: "right", fill: "#004d40", fontWeight: 600 }} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
