import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePendenciasPlantao } from "@/hooks/usePendenciasPlantao";

export function AlertaPendenciasPlantao() {
  const navigate = useNavigate();
  const { data } = usePendenciasPlantao();
  const total = data?.total ?? 0;
  if (!total) return null;
  const dias = data!.dias;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2.5 rounded-lg hover:bg-accent transition-colors text-warning"
          title={`${total} pendência${total > 1 ? "s" : ""} em aberto nos plantões`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {total > 99 ? "99+" : total}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-semibold">Pendências em aberto</div>
          <div className="text-xs text-muted-foreground">
            {total} pendência{total > 1 ? "s" : ""} em {dias.length} plantão{dias.length > 1 ? "ões" : ""}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {dias.map((d) => (
            <button
              key={d.key}
              onClick={() => navigate(`/plantoes/empresa/${d.empresaId}?data=${d.data}`)}
              className="w-full text-left px-4 py-2.5 hover:bg-accent flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.empresaNome}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  {d.plantonistas.length > 0 && ` · ${d.plantonistas.join(", ")}`}
                </div>
              </div>
              <span className="rounded-full bg-warning/15 text-warning px-2 py-0.5 text-xs font-bold">{d.total}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
