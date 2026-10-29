import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, History, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { resumoEnviosRelatorio, formatarEnvioRelatorio } from "@/lib/relatorio-envio-historico";

export function HistoricoEnvioRelatorio({ movimentacaoId, dataEnvioEmpresa }: { movimentacaoId: string; dataEnvioEmpresa?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const { user } = useAuth();
  const historico = useQuery({
    queryKey: ["relatorio-envio-historico", user?.id, movimentacaoId],
    enabled: !!user,
    queryFn: async () => {
      const envios = [];
      for (let inicio = 0; ; inicio += 500) {
        const { data, error } = await supabase.from("movimentacao_relatorio_envios").select("id, enviado_em, nome_remetente")
          .eq("movimentacao_id", movimentacaoId).order("enviado_em").order("id").range(inicio, inicio + 499);
        if (error) throw error;
        envios.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
      return envios;
    },
  });
  const resumo = resumoEnviosRelatorio(historico.data ?? [], dataEnvioEmpresa);
  return <section className="space-y-2 border-t border-border pt-4">
    <h3 className="text-xs font-medium uppercase text-muted-foreground">Relatório enviado à empresa</h3>
    {historico.isLoading ? <p role="status" className="text-sm text-muted-foreground">Consultando histórico...</p> : <>
      {resumo.data ? <p className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-primary" /><span>Enviado em {formatarEnvioRelatorio(resumo.data)}</span></p>
        : <p className="text-sm text-muted-foreground">{historico.isError ? "Não foi possível consultar o histórico de envio." : "Ainda não enviado para a empresa"}</p>}
      {resumo.ultimo?.nome_remetente && <p className="text-sm text-muted-foreground">Enviado por: {resumo.ultimo.nome_remetente}</p>}
      {historico.isError && resumo.data && <p className="text-sm text-muted-foreground">Histórico indisponível; exibindo a data de “Envio Empresa”.</p>}
      {resumo.quantidade > 1 && <p className="text-sm text-muted-foreground">Enviado {resumo.quantidade} vezes</p>}
      {resumo.quantidade > 0 && <Button type="button" variant="ghost" size="sm" aria-expanded={aberto} onClick={() => setAberto(v => !v)}>
        {aberto ? <ChevronUp className="mr-2 h-4 w-4" /> : <History className="mr-2 h-4 w-4" />}{aberto ? "Ocultar histórico" : "Ver histórico"}
      </Button>}
      {aberto && <ol className="space-y-3 border-l border-border pl-4">{resumo.envios.map((envio, i) => <li key={envio.id} className="text-sm">
        <p>{formatarEnvioRelatorio(envio.enviado_em)} — {i === 0 ? "Enviado" : "Reenviado"}</p>
        {envio.nome_remetente && <p className="text-muted-foreground">{envio.nome_remetente}</p>}
      </li>)}</ol>}
    </>}
  </section>;
}