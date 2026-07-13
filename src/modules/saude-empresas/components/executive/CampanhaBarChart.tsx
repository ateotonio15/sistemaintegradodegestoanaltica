import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CampanhaDist } from "../../lib/exec-mock-julho-2026";

export function CampanhaBarChart({ data }: { data: CampanhaDist[] }) {
  return (
    <Card className="border-[hsl(var(--exec-border))] bg-[hsl(var(--exec-surface))]">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Distribuição por Campanha</CardTitle>
        <p className="text-xs text-muted-foreground">Ações executadas no mês</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 30, right: 24, top: 8, bottom: 8 }}>
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis dataKey="nome" type="category" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 12 }} />
            <Tooltip cursor={{ fill: "rgba(0,77,64,0.06)" }} />
            <Bar dataKey="valor" radius={[0, 8, 8, 0]} label={{ position: "right", fill: "#004d40", fontWeight: 600 }}>
              {data.map((d) => <Cell key={d.nome} fill={d.cor} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
