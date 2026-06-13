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

export function ReajusteFaixaEtariaCards({
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
  const cor =
    modalidade === "enfermaria"
      ? {
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/5",
          ring: "ring-emerald-500/20",
          icon: "text-emerald-600",
          chip: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
          final: "text-emerald-700 dark:text-emerald-400",
          divider: "border-emerald-500/20",
        }
      : {
          border: "border-blue-500/30",
          bg: "bg-blue-500/5",
          ring: "ring-blue-500/20",
          icon: "text-blue-600",
          chip: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
          final: "text-blue-700 dark:text-blue-400",
          divider: "border-blue-500/20",
        };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className={`flex items-center justify-between gap-3 flex-wrap rounded-xl border ${cor.border} ${cor.bg} px-4 py-3`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className={`h-4 w-4 ${cor.icon}`} />
          Faixas Etárias — {modalidade === "enfermaria" ? "Enfermaria" : "Apartamento"}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Switch checked={percentualUnico} onCheckedChange={onPercentualUnicoChange} />
          <span>Usar percentual único</span>
        </label>
      </div>

      <div className="grid gap-3">
        {faixas.map((f, idx) => {
          const valorReais = f.valor_atual_centavos > 0 ? centavosToReais(f.valor_atual_centavos) : 0;
          const preenchida = f.valor_atual_centavos > 0;
          return (
            <div
              key={`${f.idade_inicial}-${f.idade_final}`}
              className={`rounded-xl border bg-card/80 shadow-sm transition-all ${
                preenchida ? `${cor.border} ring-1 ${cor.ring}` : "border-border/60 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
                <Icone className={`h-4 w-4 ${cor.icon}`} />
                <span className="text-sm font-semibold">{labelFaixa(f.idade_inicial, f.idade_final)}</span>
                <Badge variant="outline" className={`text-[10px] ml-auto ${cor.chip}`}>
                  {modalidade === "enfermaria" ? "Enfermaria" : "Apartamento"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Valor Atual</label>
                  <DecimalInput
                    placeholder="0,00"
                    className="h-10"
                    value={valorReais}
                    onChange={(n) => updateFaixa(idx, { valor_atual_centavos: Math.round(n * 100) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">%</label>
                  <DecimalInput
                    placeholder={percentualUnico ? `${percentualGlobal || 0}` : "0,00"}
                    className="h-10"
                    value={percentualUnico ? 0 : f.percentual}
                    disabled={percentualUnico}
                    onChange={(n) => updateFaixa(idx, { percentual: n })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Reajustado</label>
                  <div className="h-10 flex items-center px-3 rounded-md bg-muted/40 text-sm font-medium tabular-nums">
                    {formatCentavosBRL(f.valor_reajustado_centavos)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Retroativo</label>
                  <div className="h-10 flex items-center px-3 rounded-md bg-muted/40 text-sm font-medium tabular-nums">
                    {formatCentavosBRL(f.valor_retroativo_centavos)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Valor Final</label>
                  <div className={`h-10 flex items-center px-3 rounded-md bg-background border ${cor.border} text-sm font-bold tabular-nums ${cor.final}`}>
                    {formatCentavosBRL(f.valor_final_centavos)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`rounded-xl border ${cor.border} ${cor.bg} p-4`}>
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
          Total da modalidade
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground">Valor Atual</div>
            <div className="font-semibold tabular-nums">{formatCentavosBRL(totals.valor_atual_centavos)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Reajustado</div>
            <div className="font-semibold tabular-nums">{formatCentavosBRL(totals.valor_reajustado_centavos)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Retroativo</div>
            <div className="font-semibold tabular-nums">{formatCentavosBRL(totals.valor_retroativo_centavos)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Valor Final</div>
            <div className={`text-lg font-bold tabular-nums ${cor.final}`}>{formatCentavosBRL(totals.valor_final_centavos)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
