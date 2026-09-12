import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { setorLabel, PENDENCIA_CRITICIDADE_BADGE, type PendenciaCriticidade } from "@/lib/contrato-processo";
import {
  RESULTADO_BADGE_VALIDACAO,
  RESULTADO_LABEL,
  resumoValidacao,
  validarCruzado,
  type ValidacaoResultado,
} from "@/lib/validacao-cruzada";
import { useExecutarValidacaoCruzada, useValidacaoCruzada } from "@/hooks/useValidacaoCruzada";

interface Props {
  processoId: string;
  implantacaoId?: string | null;
  /** Permite disparar a comparação novamente. */
  podeExecutar?: boolean;
}

const ORDEM: Record<ValidacaoResultado, number> = {
  divergente: 0,
  necessita_validacao: 1,
  nao_encontrado: 2,
  compativel: 3,
};

export function ValidacaoCruzadaSection({ processoId, implantacaoId, podeExecutar = true }: Props) {
  const { data: itens = [], isLoading } = useValidacaoCruzada(processoId);
  const executar = useExecutarValidacaoCruzada();

  const { data: impl } = useQuery({
    queryKey: ["impl-validacao-cruzada", implantacaoId],
    enabled: !!implantacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .eq("id", implantacaoId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const resumo = useMemo(() => resumoValidacao(itens), [itens]);
  const ordenados = useMemo(
    () => [...itens].sort((a, b) => ORDEM[a.resultado] - ORDEM[b.resultado] || a.rotulo.localeCompare(b.rotulo)),
    [itens],
  );

  const handleExecutar = async () => {
    if (!impl) {
      toast.error("Não foi possível carregar os dados do contrato.");
      return;
    }
    try {
      const res = await executar.mutateAsync({ processoId, itens: validarCruzado(impl) });
      toast.success(
        `Validação cruzada concluída: ${res.divergencias} divergência(s), ${res.pendencias_criadas} pendência(s) criada(s).`,
      );
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar a validação cruzada");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Validação Cruzada
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {itens.length > 0 && (
            <>
              <Badge variant="outline" className={RESULTADO_BADGE_VALIDACAO.compativel}>
                {resumo.compativeis} compatíveis
              </Badge>
              <Badge variant="outline" className={RESULTADO_BADGE_VALIDACAO.divergente}>
                {resumo.divergentes} divergentes
              </Badge>
              {resumo.criticas > 0 && (
                <Badge variant="outline" className={PENDENCIA_CRITICIDADE_BADGE.Crítica}>
                  {resumo.criticas} crítica(s)
                </Badge>
              )}
            </>
          )}
          {podeExecutar && (
            <Button size="sm" variant="outline" onClick={handleExecutar} disabled={executar.isPending || !impl}>
              {executar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {itens.length ? "Revalidar" : "Executar validação"}
            </Button>
          )}
        </div>
      </div>

      {resumo.criticas > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Existem divergências críticas em aberto. A conclusão do contrato fica bloqueada até que sejam analisadas
            pelo setor responsável.
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma comparação registrada. Execute a validação para comparar a análise do contrato com os dados do Anexo I.
        </p>
      ) : (
        <div className="space-y-2">
          {ordenados.map((i) => (
            <Card key={i.id} className={i.resultado === "divergente" ? "border-red-500/30" : undefined}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{i.rotulo}</span>
                  <Badge variant="outline" className={`text-[11px] ${RESULTADO_BADGE_VALIDACAO[i.resultado]}`}>
                    {RESULTADO_LABEL[i.resultado]}
                  </Badge>
                  {i.resultado === "divergente" && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${PENDENCIA_CRITICIDADE_BADGE[i.criticidade as PendenciaCriticidade]}`}
                      >
                        {i.criticidade}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {setorLabel(i.setor_destino)}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contrato</p>
                    <p className="font-medium break-words">{i.valor_contrato || "—"}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Anexo I</p>
                    <p className="font-medium break-words">{i.valor_anexo || "—"}</p>
                  </div>
                </div>
                {i.justificativa && <p className="text-xs text-muted-foreground">{i.justificativa}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
