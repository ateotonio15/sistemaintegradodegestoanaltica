import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Item { nome: string; valor: number; pct: number; cor: string }

export function EngajamentoDonut({ data }: { data: Item[] }) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <Card className="border-[hsl(var(--exec-border))] bg-[hsl(var(--exec-surface))]">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Engajamento do Mês</CardTitle>
        <p className="text-xs text-muted-foreground">Sinais Vitais vs Palestras</p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data} dataKey="valor" nameKey="nome" innerRadius={72} outerRadius={110} paddingAngle={2}>
                {data.map((d) => <Cell key={d.nome} fill={d.cor} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-4xl font-semibold text-[hsl(var(--exec-primary))]">{total}</span>
            <span className="text-xs text-muted-foreground">ações</span>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-6">
          {data.map((d) => (
            <div key={d.nome} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: d.cor }} />
              <span className="text-sm font-medium">{d.nome}</span>
              <span className="text-sm text-muted-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
