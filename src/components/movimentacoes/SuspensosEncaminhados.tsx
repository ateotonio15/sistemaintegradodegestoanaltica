import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ban, AlertTriangle } from "lucide-react";

export interface EncaminhamentoSuspenso {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  codigo_contrato: string | null;
  mes_referencia: string;
  periodo: string;
  movimentacao_id: string | null;
  status: "encaminhado" | "devolvido_fluxo_normal" | "analise_humana";
  encaminhado_em: string;
  encaminhado_por_nome: string;
  observacao: string | null;
}

/** Roda o encaminhamento automático e lê os registros da competência. */
export function useEncaminhamentosSuspensos(mes: string, userId?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    supabase.rpc("processar_contratos_suspensos" as any).then(({ error }) => {
      if (!error) qc.invalidateQueries({ queryKey: ["suspensos-encaminhados"] });
    });
  }, [qc]);
  return useQuery({
    queryKey: ["suspensos-encaminhados", mes, userId ?? null],
    queryFn: async () => {
      // Com userId: só os contratos dos quais o usuário é responsável
      let ids: string[] | null = null;
      if (userId) {
        const { data: vinc, error: e1 } = await supabase
          .from("empresa_usuarios").select("empresa_id").eq("user_id", userId);
        if (e1) throw e1;
        ids = (vinc ?? []).map((v) => v.empresa_id);
        if (!ids.length) return [] as EncaminhamentoSuspenso[];
      }
      let q = supabase
        .from("movimentacao_suspensos_encaminhamentos" as any)
        .select("id, empresa_id, empresa_nome, codigo_contrato, mes_referencia, periodo, movimentacao_id, status, encaminhado_em, encaminhado_por_nome, observacao")
        .eq("mes_referencia", mes);
      if (ids) q = q.in("empresa_id", ids);
      const { data, error } = await q.order("empresa_nome");
      if (error) throw error;
      return (data ?? []) as unknown as EncaminhamentoSuspenso[];
    },
  });
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SuspensosEncaminhadosPainel({ itens, comMovimentacao }: { itens: EncaminhamentoSuspenso[]; comMovimentacao: Set<string> }) {
  const semMov = itens.filter((i) => i.status === "encaminhado" && !comMovimentacao.has(i.empresa_id));
  const analise = itens.filter((i) => i.status === "analise_humana");
  if (!semMov.length && !analise.length) return null;
  return (
    <Card className="rounded-xl">
      <CardContent className="pt-4 space-y-3 text-sm">
        {semMov.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold flex items-center gap-2"><Ban className="h-4 w-4 text-muted-foreground" />Contratos suspensos no período (sem movimentação)</p>
            <ul className="divide-y divide-border">
              {semMov.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-medium">{i.empresa_nome}</span>
                  <span className="text-muted-foreground">#{i.codigo_contrato ?? "—"} · Período {i.periodo}</span>
                  <Badge className="bg-destructive text-destructive-foreground rounded-md">Contrato suspenso</Badge>
                  <Badge variant="outline" className="rounded-md">Encaminhado ao Financeiro</Badge>
                  <span className="text-xs text-muted-foreground">em {fmt(i.encaminhado_em)} · {i.encaminhado_por_nome}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analise.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />Reativados após o período — precisam de análise</p>
            <ul className="divide-y divide-border">
              {analise.map((i) => (
                <li key={i.id} className="py-1.5">
                  <span className="font-medium">{i.empresa_nome}</span>{" "}
                  <span className="text-muted-foreground">#{i.codigo_contrato ?? "—"} · Período {i.periodo}</span>
                  <p className="text-xs text-muted-foreground">Nenhuma movimentação retroativa foi criada automaticamente.</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
