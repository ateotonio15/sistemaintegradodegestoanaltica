import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquareText } from "lucide-react";

interface Props {
  /** Busca direta pela movimentação operacional */
  movimentacaoId?: string | null;
  /** Ou busca por empresa + competência + período */
  empresaId?: string | null;
  mesReferencia?: string | null;
  periodo?: string | null;
  enabled?: boolean;
  className?: string;
}

/**
 * Exibe o histórico (append-only) de observações da movimentação do mês,
 * com autor, data/hora e texto em cards.
 */
export function ObservacoesHistorico({
  movimentacaoId = null,
  empresaId = null,
  mesReferencia = null,
  periodo = null,
  enabled = true,
  className,
}: Props) {
  const canQuery = !!movimentacaoId || !!(empresaId && mesReferencia && periodo);

  const { data: observacoes = "", isLoading } = useQuery({
    queryKey: ["observacoes-mov", movimentacaoId, empresaId, mesReferencia, periodo],
    enabled: enabled && canQuery,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      let query = supabase.from("movimentacoes").select("observacoes, created_at");
      if (movimentacaoId) {
        query = query.eq("id", movimentacaoId);
      } else {
        query = query
          .eq("empresa_id", empresaId as string)
          .eq("mes_referencia", mesReferencia as string)
          .eq("periodo", periodo as string);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return ((data?.[0] as any)?.observacoes ?? "").trim() as string;
    },
  });

  const linhas = observacoes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <MessageSquareText className="h-4 w-4 text-info" />
        Observações
      </h4>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando observações...</p>
      ) : linhas.length ? (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {linhas.map((linha, i) => {
            const match = linha.match(/^\[(\d{2}\/\d{2}\/\d{4}(?:,? \d{2}:\d{2})?) — ([^\]]+)\]\s*(.*)$/s);
            const dataHora = match?.[1] ?? null;
            const autor = match?.[2] ?? null;
            const texto = match?.[3] ?? linha;
            return (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {texto}
                </p>
                {(dataHora || autor) && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {(autor || "U").charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate max-w-[180px]">{autor}</span>
                    {dataHora && (
                      <>
                        <span className="text-border">•</span>
                        <span>{dataHora}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
        </div>
      )}
    </div>
  );
}
