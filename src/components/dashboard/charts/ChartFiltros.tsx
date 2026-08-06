import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODOS, formatMesReferencia } from "@/lib/movimentacao-utils";

interface Props {
  meses: string[];
  mes: string;
  onMesChange: (v: string) => void;
  periodo?: string;
  onPeriodoChange?: (v: string) => void;
}

export function ChartFiltros({ meses, mes, onMesChange, periodo, onPeriodoChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={mes} onValueChange={onMesChange}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {meses.map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {formatMesReferencia(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onPeriodoChange && (
        <Select value={periodo} onValueChange={onPeriodoChange}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              Todos
            </SelectItem>
            {PERIODOS.map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
