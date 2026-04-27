import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellRing, Clock } from "lucide-react";
import { formatMesReferencia, getCurrentMesReferencia } from "@/lib/movimentacao-utils";

type FinMov = {
  id: string;
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
  data_envio_nota: string | null;
};

type EmpresaInfo = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
};

/**
 * Card "Faturamentos Não Enviados" — Dashboard Cadastro.
 * Lista TODAS as empresas vinculadas ao usuário cujo registro em
 * financeiro_movimentacoes (do mês atual) ainda não tem `data_envio_nota`.
 * Sai da lista automaticamente quando o Financeiro preenche a data.
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const mesAtual = getCurrentMesReferencia();

  // Empresas vinculadas ao usuário (Cadastro só vê as suas)
  const { data: empresaIdsVinculadas = [] } = useQuery<string[]>({
    queryKey: ["faturamentos-empresa-ids-vinculadas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const ids = new Set<string>();

      const { data: own } = await supabase
        .from("empresas")
        .select("id")
        .eq("responsavel_user_id", user.id);
      (own ?? []).forEach((e) => ids.add(e.id));

      const { data: links } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id")
        .eq("user_id", user.id);
      (links ?? []).forEach((l) => ids.add(l.empresa_id));

      return Array.from(ids);
    },
  });

  // Todos os financeiro_movimentacoes do mês atual sem data_envio_nota
  const { data: pendentes = [] } = useQuery<FinMov[]>({
    queryKey: [
      "faturamentos-fin-pendentes",
      mesAtual,
      empresaIdsVinculadas.sort().join(","),
    ],
    enabled: !!user && empresaIdsVinculadas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo, data_envio_nota")
        .eq("mes_referencia", mesAtual)
        .is("data_envio_nota", null)
        .in("empresa_id", empresaIdsVinculadas);
      if (error) throw error;
      return (data ?? []) as FinMov[];
    },
  });

  const empresaIds = useMemo(
    () => Array.from(new Set(pendentes.map((p) => p.empresa_id))),
    [pendentes],
  );

  // Info das empresas exibidas
  const { data: empresasInfo = [] } = useQuery<EmpresaInfo[]>({
    queryKey: ["faturamentos-empresas-info", empresaIds.sort().join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato")
        .in("id", empresaIds);
      if (error) throw error;
      return (data ?? []) as EmpresaInfo[];
    },
  });

  // Realtime: refetch quando algo muda
  useEffect(() => {
    const ch = supabase
      .channel("faturamentos-nao-enviados-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financeiro_movimentacoes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["faturamentos-fin-pendentes"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  type Linha = {
    key: string;
    empresaNome: string;
    contrato: string | null;
    mesReferencia: string;
    periodo: string;
  };

  const linhas: Linha[] = useMemo(() => {
    const empMap = new Map(empresasInfo.map((e) => [e.id, e]));
    return pendentes
      .map((p): Linha | null => {
        const emp = empMap.get(p.empresa_id);
        if (!emp) return null;
        return {
          key: p.id,
          empresaNome: emp.nome,
          contrato: emp.codigo_contrato,
          mesReferencia: p.mes_referencia,
          periodo: p.periodo,
        };
      })
      .filter((l): l is Linha => l !== null)
      .sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));
  }, [pendentes, empresasInfo]);

  return (
    <Card className="rounded-xl shadow-sm border-warning/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
            <BellRing className="h-4 w-4 text-warning" />
          </div>
          Faturamentos Não Enviados
          <Badge variant="outline" className="ml-1">
            {linhas.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground pl-10">
          Aguardando emissão da nota pelo Financeiro
        </p>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum faturamento aguardando o Financeiro no momento.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {linhas.map((l) => (
              <div
                key={l.key}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">
                    {l.empresaNome}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Contrato:{" "}
                    <span className="font-medium text-foreground/80">
                      {l.contrato ?? "—"}
                    </span>
                    {" · "}
                    {formatMesReferencia(l.mesReferencia)} · {l.periodo}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className="gap-1 border-warning/40 text-warning bg-warning/5"
                  >
                    <Clock className="h-3 w-3" />
                    Aguardando nota
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
