import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Users, PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";

interface Props {
  aguardando: number;
  foraDoPrazo: number;
  empresa: number;
  financeiro: number;
  filtros?: ReactNode;
  onVerPorUsuario?: () => void;
}

export function StatusMovChart({
  aguardando,
  foraDoPrazo,
  empresa,
  financeiro,
  filtros,
  onVerPorUsuario,
}: Props) {
  const itens = [
    { name: "Aguardando envio", value: aguardando, color: "hsl(var(--muted-foreground))" },
    { name: "Fora do prazo", value: foraDoPrazo, color: "hsl(var(--destructive))" },
    { name: "Enviadas p/ Empresa", value: empresa, color: "hsl(var(--warning))" },
    { name: "Enviadas ao Financeiro", value: financeiro, color: "hsl(var(--success))" },
  ];
  const data = itens.filter((d) => d.value > 0);
  const total = aguardando + foraDoPrazo + empresa + financeiro;

  return (
    <ChartCard
      title="Movimentações por status"
      subtitle={`${total.toLocaleString("pt-BR")} movimentações no recorte`}
      icon={<PieIcon className="h-4 w-4" />}
      actions={
        <>
          {filtros}
          {onVerPorUsuario && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onVerPorUsuario}>
              <Users className="h-3.5 w-3.5" />
              Por usuário
            </Button>
          )}
        </>
      }
      empty={total === 0}
    >
      <div className="grid h-full grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative h-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={2} stroke="none">
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "hsl(var(--popover-foreground))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold leading-none">{total}</span>
            <span className="text-[11px] text-muted-foreground">movimentações</span>
          </div>
        </div>
        <ul className="space-y-1.5">
          {itens.map((d) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <li
                key={d.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="truncate text-xs text-muted-foreground">{d.name}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">
                  {d.value} <span className="text-[10px] font-normal text-muted-foreground">({pct}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
