import { Star, History } from "lucide-react";
import { usePrioridadeHistorico } from "@/hooks/usePrioridadeMaxima";
import { formatDateBR } from "@/lib/date-utils";

export function PrioridadeInfoCard({ empresaId }: { empresaId: string }) {
  const { data } = usePrioridadeHistorico(empresaId);
  const ativo = (data ?? []).find((r) => r.ativo);
  if (!ativo) return null;
  return (
    <div className="rounded-lg border-2 border-red-500/60 bg-red-500/5 p-3 space-y-1">
      <div className="flex items-center gap-2 text-red-600 font-semibold">
        <Star className="h-4 w-4 fill-current" />
        PRIORIDADE MÁXIMA
      </div>
      <div className="text-sm"><strong>Motivo:</strong> {ativo.motivo}</div>
      {ativo.observacoes && <div className="text-sm text-muted-foreground"><strong>Obs:</strong> {ativo.observacoes}</div>}
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <History className="h-3 w-3" />
        Criada em {formatDateBR(ativo.criado_em)} por {ativo.criado_por_nome ?? "—"}
      </div>
    </div>
  );
}
