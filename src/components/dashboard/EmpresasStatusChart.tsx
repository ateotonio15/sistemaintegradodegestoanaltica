import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { calcularStatus, type Movimentacao } from "@/lib/movimentacao-utils";

interface Props {
  empresas: Tables<"empresas">[];
  movimentacoes: Movimentacao[];
  notaEnviadaEmpresaIds: Set<string>;
}

export function EmpresasStatusChart({ empresas, movimentacoes, notaEnviadaEmpresaIds }: Props) {
  const data = useMemo(() => {
    const ativas = empresas.filter((e) => e.status_empresa === "Ativa");
    const suspensas = ativas.filter((e) => e.contrato_suspenso).length;
    const notEnviada = ativas.filter(
      (e) => !e.contrato_suspenso && notaEnviadaEmpresaIds.has(e.id),
    ).length;

    // status por empresa via movimentações (apenas ativas não-suspensas e sem nota enviada)
    let emDia = 0;
    let pendente = 0;
    ativas.forEach((e) => {
      if (e.contrato_suspenso || notaEnviadaEmpresaIds.has(e.id)) return;
      const movs = movimentacoes.filter((m) => m.empresa_id === e.id);
      if (movs.length === 0) {
        pendente += 1;
        return;
      }
      const statuses = movs.map((m) => calcularStatus(m));
      const temAtraso = statuses.some((s) => s === "Fora do prazo");
      const todasConcluidas = statuses.every((s) => s === "Enviado ao financeiro");
      if (temAtraso) pendente += 1;
      else if (todasConcluidas) emDia += 1;
      else pendente += 1;
    });

    return [
      { name: "Em dia", value: emDia, color: "hsl(var(--success))" },
      { name: "Pendente", value: pendente, color: "hsl(var(--warning))" },
      { name: "Nota enviada", value: notEnviada, color: "hsl(var(--primary))" },
      { name: "Contratos Suspensos", value: suspensas, color: "hsl(var(--muted-foreground))" },
    ].filter((d) => d.value > 0);
  }, [empresas, movimentacoes, notaEnviadaEmpresaIds]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Empresas por Status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sem dados para exibir</div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
