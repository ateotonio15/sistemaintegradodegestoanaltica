import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from "recharts";
import { Search } from "lucide-react";
import type { TriagemMock } from "../../lib/exec-mock-julho-2026";

export function TriagemPanel({ data }: { data: TriagemMock[] }) {
  const [busca, setBusca] = useState("");
  const filtered = useMemo(() =>
    data.filter((d) => d.empresa.toLowerCase().includes(busca.toLowerCase())), [data, busca]);

  const radarData = useMemo(() => {
    const alvo = filtered.slice(0, 4);
    const eixos = ["pa_alta", "gli_alta", "imc_alto", "tabagismo"] as const;
    const labels: Record<string, string> = {
      pa_alta: "PA Alta", gli_alta: "Glicemia Alta", imc_alto: "IMC Alto", tabagismo: "Tabagismo",
    };
    return eixos.map((k) => {
      const r: any = { indicador: labels[k] };
      alvo.forEach((e) => { r[e.empresa] = e[k]; });
      return r;
    });
  }, [filtered]);

  const cores = ["#004d40", "#1b998b", "#eab308", "#0ea5e9"];

  return (
    <Card className="border-[hsl(var(--exec-border))] bg-[hsl(var(--exec-surface))]">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Sinais Vitais & Triagem por Empresa</CardTitle>
        <p className="text-xs text-muted-foreground">Alterações clínicas detectadas no período</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="indicador" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              {filtered.slice(0, 4).map((e, i) => (
                <Radar key={e.empresa} name={e.empresa} dataKey={e.empresa}
                       stroke={cores[i]} fill={cores[i]} fillOpacity={0.18} />
              ))}
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                     placeholder="Buscar empresa (Elgin, PST, TPV…)" className="pl-9" />
            </div>
            <div className="rounded-lg border border-[hsl(var(--exec-border))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Atend.</TableHead>
                    <TableHead className="text-right">PA↑</TableHead>
                    <TableHead className="text-right">Gli↑</TableHead>
                    <TableHead className="text-right">IMC↑</TableHead>
                    <TableHead className="text-right">Tab.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.empresa}>
                      <TableCell className="font-medium">{r.empresa}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.atendidos}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{r.pa_alta}</TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600">{r.gli_alta}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.imc_alto}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.tabagismo}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
