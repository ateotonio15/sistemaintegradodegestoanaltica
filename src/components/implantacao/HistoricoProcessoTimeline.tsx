import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Lock } from "lucide-react";
import { useContratoProcessoHistorico } from "@/hooks/useContratoProcessos";
import { acaoLabel, acaoTom, setorLabel, statusLabel } from "@/lib/contrato-processo";

interface Props {
  processoId: string;
}

function partesData(iso: string) {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

const PASSO = 15;

export function HistoricoProcessoTimeline({ processoId }: Props) {
  const { data: historico = [], isLoading } = useContratoProcessoHistorico(processoId);
  const [limite, setLimite] = useState(PASSO);

  const eventos = useMemo(
    () =>
      [...historico].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [historico],
  );

  const visiveis = eventos.slice(0, limite);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico do Processo
            <Badge variant="outline">{eventos.length}</Badge>
          </p>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Registros não podem ser editados nem excluídos
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando linha do tempo…</p>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <>
            <ol className="relative space-y-4 pl-6">
              <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
              {visiveis.map((m) => {
                const { data, hora } = partesData(m.created_at);
                const setor = m.setor_destino
                  ? `${setorLabel(m.setor_origem)} → ${setorLabel(m.setor_destino)}`
                  : setorLabel(m.setor_origem);
                const mudouStatus = !!m.status_detalhado_novo &&
                  m.status_detalhado_novo !== m.status_detalhado_anterior;
                return (
                  <li key={m.id} className="relative">
                    <span
                      className={`absolute -left-6 top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${acaoTom(m.acao)}`}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium tabular-nums">
                        {data} {hora}
                      </span>
                      <Badge variant="outline">{acaoLabel(m.acao)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Usuário: {m.user_nome || m.responsavel_nome || "Sistema"} · Setor: {setor}
                    </p>
                    {mudouStatus && (
                      <p className="text-xs text-muted-foreground">
                        Status: {statusLabel(m.status_detalhado_anterior)} → {statusLabel(m.status_detalhado_novo)}
                      </p>
                    )}
                    {m.observacao && <p className="text-xs mt-1">{m.observacao}</p>}
                  </li>
                );
              })}
            </ol>
            {eventos.length > visiveis.length && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setLimite((n) => n + PASSO)}>
                  Ver eventos anteriores ({eventos.length - visiveis.length})
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
