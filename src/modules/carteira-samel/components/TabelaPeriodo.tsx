import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { LinhaPeriodo } from "../lib/analiseContrato";

interface Props {
  titulo: string;
  linhas: LinhaPeriodo[];
  onChange: (l: LinhaPeriodo[]) => void;
  breakEvenPadrao: number;
}

function novaLinha(breakEven: number): LinhaPeriodo {
  return { mes: "", premioEmpresa: 0, premioDemissionario: 0, premioTotal: 0, sinistro: 0, sinPct: 0, breakEvenPct: breakEven, distorcaoPct: 0 };
}

function recomputeLinha(l: LinhaPeriodo): LinhaPeriodo {
  const premioTotal = l.premioEmpresa + l.premioDemissionario;
  const sinPct = premioTotal > 0 ? (l.sinistro / premioTotal) * 100 : 0;
  const distorcaoPct = Math.max(0, sinPct - l.breakEvenPct);
  return { ...l, premioTotal, sinPct, distorcaoPct };
}

export function TabelaPeriodo({ titulo, linhas, onChange, breakEvenPadrao }: Props) {
  const update = (i: number, patch: Partial<LinhaPeriodo>) => {
    const next = linhas.map((l, idx) => (idx === i ? recomputeLinha({ ...l, ...patch }) : l));
    onChange(next);
  };
  const totalPremio = linhas.reduce((s, l) => s + l.premioTotal, 0);
  const totalSin = linhas.reduce((s, l) => s + l.sinistro, 0);
  const mediaSinPct = linhas.length ? linhas.reduce((s, l) => s + l.sinPct, 0) / linhas.length : 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="font-semibold text-sm">{titulo}</h4>
        <Button size="sm" variant="outline" onClick={() => onChange([...linhas, novaLinha(breakEvenPadrao)])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Linha
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {["Mês", "Prêmio Empresa", "Prêmio Demiss.", "Prêmio Total", "Sinistro", "Sin %", "Break-even %", "Distorção %", ""].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="px-1"><Input className="h-7 text-xs" value={l.mes} onChange={(e) => update(i, { mes: e.target.value })} placeholder="Jan/25" /></td>
                <td className="px-1"><Input className="h-7 text-xs" type="number" value={l.premioEmpresa || ""} onChange={(e) => update(i, { premioEmpresa: Number(e.target.value) || 0 })} /></td>
                <td className="px-1"><Input className="h-7 text-xs" type="number" value={l.premioDemissionario || ""} onChange={(e) => update(i, { premioDemissionario: Number(e.target.value) || 0 })} /></td>
                <td className="px-2 py-1 tabular-nums">{l.premioTotal.toFixed(2)}</td>
                <td className="px-1"><Input className="h-7 text-xs" type="number" value={l.sinistro || ""} onChange={(e) => update(i, { sinistro: Number(e.target.value) || 0 })} /></td>
                <td className="px-2 py-1 tabular-nums">{l.sinPct.toFixed(1)}%</td>
                <td className="px-1"><Input className="h-7 text-xs" type="number" value={l.breakEvenPct} onChange={(e) => update(i, { breakEvenPct: Number(e.target.value) || 0 })} /></td>
                <td className="px-2 py-1 tabular-nums">{l.distorcaoPct.toFixed(1)}%</td>
                <td className="px-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange(linhas.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-4">Sem linhas. Adicione uma para começar.</td></tr>
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="bg-muted/30 font-medium">
              <tr>
                <td className="px-2 py-1.5">Totais</td>
                <td />
                <td />
                <td className="px-2 tabular-nums">{totalPremio.toFixed(2)}</td>
                <td />
                <td className="px-2 tabular-nums">média {mediaSinPct.toFixed(1)}%</td>
                <td />
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
