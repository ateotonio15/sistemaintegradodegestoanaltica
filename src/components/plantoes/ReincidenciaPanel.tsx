import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseAssunto } from "@/components/plantoes/AtendimentoDialog";
import { parseObservacaoPlantao } from "@/lib/plantoes-observacao";

const statusClass: Record<string, string> = {
  Resolvido: "bg-primary/15 text-primary border-primary/30",
  Pendente: "bg-warning/15 text-warning border-warning/30",
  "Em andamento": "bg-accent text-accent-foreground border-border",
  Cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Histórico de atendimentos do mesmo CPF — somente "Plantões de Atendimento". */
export function ReincidenciaPanel({ cpf, fillHeight = false }: { cpf: string; fillHeight?: boolean }) {
  const digits = String(cpf || "").replace(/\D/g, "");
  const valido = digits.length === 11;
  const formatado = valido ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : "";

  const { data = [], isFetching, isError } = useQuery({
    queryKey: ["plantoes-reincidencia", digits],
    enabled: valido,
    staleTime: 30_000,
    queryFn: async () => {
      const registros: any[] = [];
      const tamanhoPagina = 500;
      for (let inicio = 0; ; inicio += tamanhoPagina) {
      const { data, error } = await supabase
        .from("plantoes_atendimentos")
        .select("id, hora, assunto, resolvido, observacao, created_at, cpf, plantao:plantoes(data)")
        .in("cpf", [digits, formatado])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(inicio, inicio + tamanhoPagina - 1);
      if (error) throw error;
      registros.push(...(data ?? []));
      if ((data?.length ?? 0) < tamanhoPagina) break;
      }
      return registros.sort((a, b) => {
        const ka = `${a.plantao?.data ?? a.created_at?.slice(0, 10)} ${a.hora ?? ""}`;
        const kb = `${b.plantao?.data ?? b.created_at?.slice(0, 10)} ${b.hora ?? ""}`;
        return kb.localeCompare(ka);
      });
    },
  });

  const lista = valido ? data : [];

  return (
    <div className={`flex flex-col rounded-md border bg-card p-3 min-h-0 ${fillHeight ? "h-full overflow-hidden" : ""}`}>
      <div className="flex shrink-0 items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reincidência ({lista.length})
        </span>
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {!valido ? (
        <p className="text-xs text-muted-foreground">Informe o CPF para ver os atendimentos anteriores.</p>
      ) : isError ? (
        <p className="text-xs text-destructive">Não foi possível carregar o histórico de atendimentos.</p>
      ) : lista.length === 0 && !isFetching ? (
        <p className="text-xs text-muted-foreground">Nenhuma reincidência encontrada para este beneficiário.</p>
      ) : (
        <div className={`space-y-2 overflow-y-auto min-h-0 pr-1 overscroll-contain ${fillHeight ? "flex-1" : "max-h-80"}`}>
          {lista.map((a) => {
            const meta = parseAssunto(a.assunto, a.resolvido);
            const obs = parseObservacaoPlantao(a.observacao).observacao;
            const dataISO: string = a.plantao?.data ?? a.created_at?.slice(0, 10) ?? "";
            const [y, m, d] = dataISO.split("-");
            return (
              <div key={a.id} className="rounded border p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-muted-foreground">{d ? `${d}/${m}/${y}` : "—"} {a.hora ?? ""}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass[meta.status] ?? "border-border"}`}>
                    {meta.status}
                  </span>
                </div>
                <div className="font-medium">{meta.tipo} · {meta.canal}</div>
                {obs && <p className="text-muted-foreground break-words">{obs}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
