import { useEffect, useMemo } from "react";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Hotel, Users } from "lucide-react";
import {
  FAIXAS_ETARIAS,
  labelFaixa,
  type FaixaEtariaItem,
  centavosToReais,
  calcularValorReajustadoCentavos,
  calcularRetroativoCentavos,
  calcularValorFinalCentavos,
  formatCentavosBRL,
  somarFaixas,
} from "@/lib/reajuste-utils";

type Modalidade = "enfermaria" | "apartamento";

interface Props {
  modalidade: Modalidade;
  faixas: FaixaEtariaItem[];
  onChange: (faixas: FaixaEtariaItem[]) => void;
  percentualGlobal: number;
  percentualUnico: boolean;
  onPercentualUnicoChange: (v: boolean) => void;
  mesesRetro: number;
}

export function ReajusteFaixaEtariaTable({
  modalidade,
  faixas,
  onChange,
  percentualGlobal,
  percentualUnico,
  onPercentualUnicoChange,
  mesesRetro,
}: Props) {
  // Garante 10 faixas alinhadas
  useEffect(() => {
    if (faixas.length !== FAIXAS_ETARIAS.length) {
      const base = FAIXAS_ETARIAS.map((f) => {
        const existing = faixas.find(
          (x) => x.idade_inicial === f.idade_inicial && x.idade_final === f.idade_final,
        );
        return (
          existing || {
            idade_inicial: f.idade_inicial,
            idade_final: f.idade_final,
            valor_atual_centavos: 0,
            percentual: 0,
            valor_reajustado_centavos: 0,
            valor_retroativo_centavos: 0,
            valor_final_centavos: 0,
          }
        );
      });
      onChange(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalcula sempre que percentual global / mesesRetro / percentualUnico mudam
  useEffect(() => {
    const recalc = faixas.map((f) => {
      const pct = percentualUnico ? percentualGlobal : f.percentual;
      const reaj = calcularValorReajustadoCentavos(f.valor_atual_centavos, pct);
      const retro = calcularRetroativoCentavos(f.valor_atual_centavos, reaj, mesesRetro);
      const final = calcularValorFinalCentavos(reaj, retro);
      return {
        ...f,
        valor_reajustado_centavos: reaj,
        valor_retroativo_centavos: retro,
        valor_final_centavos: final,
      };
    });
    if (JSON.stringify(recalc) !== JSON.stringify(faixas)) {
      onChange(recalc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentualGlobal, percentualUnico, mesesRetro]);

  const totals = useMemo(() => somarFaixas(faixas), [faixas]);

  const updateFaixa = (idx: number, patch: Partial<FaixaEtariaItem>) => {
    const next = faixas.map((f, i) => {
      if (i !== idx) return f;
      const merged = { ...f, ...patch };
      const pct = percentualUnico ? percentualGlobal : merged.percentual;
      const reaj = calcularValorReajustadoCentavos(merged.valor_atual_centavos, pct);
      const retro = calcularRetroativoCentavos(merged.valor_atual_centavos, reaj, mesesRetro);
      const final = calcularValorFinalCentavos(reaj, retro);
      return {
        ...merged,
        valor_reajustado_centavos: reaj,
        valor_retroativo_centavos: retro,
        valor_final_centavos: final,
      };
    });
    onChange(next);
  };

  const Icone = modalidade === "enfermaria" ? BedDouble : Hotel;
  const cor = modalidade === "enfermaria"
    ? { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: "text-emerald-600", final: "text-emerald-700 dark:text-emerald-400" }
    : { border: "border-blue-500/30", bg: "bg-blue-500/5", icon: "text-blue-600", final: "text-blue-700 dark:text-blue-400" };

  return (
    <div className={`rounded-lg border ${cor.border} ${cor.bg} p-3 animate-fade-in space-y-3`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className={`h-4 w-4 ${cor.icon}`} />
          Faixas Etárias — {modalidade === "enfermaria" ? "Enfermaria" : "Apartamento"}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Switch checked={percentualUnico} onCheckedChange={onPercentualUnicoChange} />
          <span>Usar percentual único</span>
        </label>
      </div>

      <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded border bg-background/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium">Faixa</th>
              <th className="text-left p-2 font-medium">Valor Atual</th>
              <th className="text-left p-2 font-medium w-20">%</th>
              <th className="text-left p-2 font-medium">Reajustado</th>
              <th className="text-left p-2 font-medium">Retroativo</th>
              <th className="text-left p-2 font-medium">Valor Final</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, idx) => {
              const valorReais = f.valor_atual_centavos > 0 ? centavosToReais(f.valor_atual_centavos) : 0;
              return (
                <tr key={`${f.idade_inicial}-${f.idade_final}`} className="border-t">
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]">
                      {labelFaixa(f.idade_inicial, f.idade_final)}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <DecimalInput
                      placeholder="0,00"
                      className="h-8 text-xs"
                      value={valorReais}
                      onChange={(n) => updateFaixa(idx, { valor_atual_centavos: Math.round(n * 100) })}
                    />
                  </td>
                  <td className="p-2">
                    <DecimalInput
                      placeholder={percentualUnico ? `${percentualGlobal || 0}` : "0,00"}
                      className="h-8 text-xs"
                      value={percentualUnico ? 0 : f.percentual}
                      disabled={percentualUnico}
                      onChange={(n) => updateFaixa(idx, { percentual: n })}
                    />
                  </td>

                  <td className="p-2 font-medium">{formatCentavosBRL(f.valor_reajustado_centavos)}</td>
                  <td className="p-2">{formatCentavosBRL(f.valor_retroativo_centavos)}</td>
                  <td className={`p-2 font-bold ${cor.final}`}>{formatCentavosBRL(f.valor_final_centavos)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td className="p-2 font-semibold" colSpan={3}>Total</td>
              <td className="p-2 font-semibold">{formatCentavosBRL(totals.valor_reajustado_centavos)}</td>
              <td className="p-2 font-semibold">{formatCentavosBRL(totals.valor_retroativo_centavos)}</td>
              <td className={`p-2 font-bold ${cor.final}`}>{formatCentavosBRL(totals.valor_final_centavos)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
