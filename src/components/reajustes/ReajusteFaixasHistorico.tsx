import { Button } from "@/components/ui/button";
import { ChevronDown, List } from "lucide-react";
import { useState } from "react";
import { labelFaixa, formatCentavosBRL } from "@/lib/reajuste-utils";
import { type FaixaReajusteSalva } from "@/lib/reajuste-apresentacao";

export function ReajusteFaixasHistorico({ faixas }: { faixas: FaixaReajusteSalva[] }) {
  const [aberto, setAberto] = useState(false);
  const fmt = (v: number | null) => v == null ? "—" : formatCentavosBRL(v);
  return (
    <div className="mb-3">
      <Button variant="outline" size="sm" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <List className="h-4 w-4 mr-2" />
        {aberto ? "Ocultar valores por faixa" : "Ver valores por faixa"}
        <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </Button>
      {aberto && (["enfermaria", "apartamento"] as const).map((mod) => {
        const lista = faixas.filter((f) => f.modalidade === mod).sort((a, b) => a.idade_inicial - b.idade_inicial);
        if (!lista.length) return null;
        return (
          <div key={mod} className="mt-3">
            <h4 className="font-semibold text-sm mb-2">{mod === "enfermaria" ? "Enfermaria" : "Apartamento"}</h4>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Faixa etária</th>
                    <th className="p-2 text-right">Valor base</th>
                    <th className="p-2 text-right">% Reajuste</th>
                    <th className="p-2 text-right">Valor reajustado</th>
                    <th className="p-2 text-right">Retroativo</th>
                    <th className="p-2 text-right">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={`${f.idade_inicial}-${f.idade_final}`} className="border-t">
                      <td className="p-2">{labelFaixa(f.idade_inicial, f.idade_final)}</td>
                      <td className="p-2 text-right tabular-nums">{fmt(f.valor_atual_centavos)}</td>
                      <td className="p-2 text-right tabular-nums">{f.percentual == null ? "—" : `${Number(f.percentual).toFixed(2).replace(".", ",")}%`}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{fmt(f.valor_reajustado_centavos)}</td>
                      <td className="p-2 text-right tabular-nums">{fmt(f.valor_retroativo_centavos)}</td>
                      <td className="p-2 text-right tabular-nums font-semibold text-primary">{fmt(f.valor_final_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}