import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellRing, Clock, Paperclip } from "lucide-react";
import { formatMesReferencia } from "@/lib/movimentacao-utils";

type EmpresaInfo = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
};

type AlertaPendente = {
  movimentacao_id: string;
  empresa_id: string;
  empresa_nome: string;
  data_envio: string;
};

type MovInfo = {
  id: string;
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
};

/**
 * Card "Faturamentos Não Enviados" — Dashboard Cadastro.
 * Lista APENAS contratos que:
 *   1) Foram enviados ao Financeiro (alerta tipo='vencimento' Pendente existe)
 *   2) AINDA não tiveram a nota enviada (financeiro_movimentacoes.data_envio_nota IS NULL)
 *
 * O item sai da lista automaticamente quando o Financeiro preenche o
 * envio da nota (data_envio_nota), pois o trigger
 * handle_finalizar_alerta_financeiro finaliza o alerta.
 *
 * Esta visualização é informativa: mostra o que está em poder do Financeiro
 * aguardando emissão de nota. Não há botão de ação aqui.
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  // Alertas Pendentes (tipo=vencimento) — significam "enviado ao financeiro"
  const { data: alertasPendentes = [] } = useQuery<AlertaPendente[]>({
    queryKey: ["faturamentos-alertas-pendentes", empresaIdsVinculadas.sort().join(",")],
    enabled: !!user && empresaIdsVinculadas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_financeiro")
        .select("movimentacao_id, empresa_id, empresa_nome, data_envio")
        .eq("status", "Pendente")
        .in("empresa_id", empresaIdsVinculadas);
      if (error) throw error;
      return (data ?? []) as AlertaPendente[];
    },
  });

  const movIds = useMemo(
    () => Array.from(new Set(alertasPendentes.map((a) => a.movimentacao_id))),
    [alertasPendentes],
  );

  // Movimentações operacionais referenciadas pelos alertas
  const { data: movs = [] } = useQuery<MovInfo[]>({
    queryKey: ["faturamentos-movs-de-alertas", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("id", movIds);
      if (error) throw error;
      return (data ?? []) as MovInfo[];
    },
  });

  // Financeiro_movimentacoes correspondentes — para detectar nota já enviada
  const { data: notaEnviadaSet = new Set<string>() } = useQuery({
    queryKey: ["faturamentos-fin-nota-enviada", movIds.sort().join(",")],
    enabled: movs.length > 0,
    queryFn: async () => {
      const empresasMov = Array.from(new Set(movs.map((m) => m.empresa_id)));
      const mesesMov = Array.from(new Set(movs.map((m) => m.mes_referencia)));
      if (empresasMov.length === 0 || mesesMov.length === 0) return new Set<string>();

      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, mes_referencia, periodo, data_envio_nota")
        .in("empresa_id", empresasMov)
        .in("mes_referencia", mesesMov);
      if (error) throw error;

      const set = new Set<string>();
      (data ?? []).forEach((f: any) => {
        if (f.data_envio_nota) {
          set.add(`${f.empresa_id}|${f.mes_referencia}|${f.periodo}`);
        }
      });
      return set;
    },
  });

  // Anexos por movimentação
  const { data: anexosCadastroPorMov = new Map<string, number>() } = useQuery({
    queryKey: ["faturamentos-anexos-cadastro-v2", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("movimentacao_id")
        .in("movimentacao_id", movIds);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).movimentacao_id as string;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return map;
    },
  });

  // Realtime: refetch quando algo muda
  useEffect(() => {
    const ch = supabase
      .channel("faturamentos-nao-enviados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_financeiro" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-alertas-pendentes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-fin-nota-enviada"] });
        queryClient.invalidateQueries({ queryKey: ["faturamentos-alertas-pendentes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos_movimentacao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-anexos-cadastro-v2"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  type Linha = {
    key: string;
    movId: string;
    empresaNome: string;
    contrato: string | null;
    mesReferencia: string;
    periodo: string;
    dataEnvio: string;
    qtdAnexos: number;
  };

  const linhas: Linha[] = useMemo(() => {
    const empresasInfo = new Map<string, EmpresaInfo>();
    // Buscamos contrato/codigo via cache de movs/alertas (alertas já têm empresa_nome)

    const movById = new Map<string, MovInfo>();
    movs.forEach((m) => movById.set(m.id, m));

    return alertasPendentes
      .map((a): Linha | null => {
        const mov = movById.get(a.movimentacao_id);
        if (!mov) return null;
        const chaveFin = `${mov.empresa_id}|${mov.mes_referencia}|${mov.periodo}`;
        if (notaEnviadaSet.has(chaveFin)) return null; // já tem nota → sai da lista
        return {
          key: a.movimentacao_id,
          movId: a.movimentacao_id,
          empresaNome: a.empresa_nome,
          contrato: null,
          mesReferencia: mov.mes_referencia,
          periodo: mov.periodo,
          dataEnvio: a.data_envio,
          qtdAnexos: anexosCadastroPorMov.get(mov.id) ?? 0,
        };
      })
      .filter((l): l is Linha => l !== null)
      .sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));
  }, [alertasPendentes, movs, notaEnviadaSet, anexosCadastroPorMov]);

  // Buscar códigos de contrato das empresas exibidas
  const empresaIdsExibidas = useMemo(() => {
    const ids = new Set<string>();
    linhas.forEach((l) => {
      const mov = movs.find((m) => m.id === l.movId);
      if (mov) ids.add(mov.empresa_id);
    });
    return Array.from(ids);
  }, [linhas, movs]);

  const { data: contratoMap = {} } = useQuery({
    queryKey: ["faturamentos-empresa-contratos", empresaIdsExibidas.sort().join(",")],
    enabled: empresaIdsExibidas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, codigo_contrato")
        .in("id", empresaIdsExibidas);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((e: any) => {
        map[e.id] = e.codigo_contrato ?? null;
      });
      return map;
    },
  });

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
          Enviados ao Financeiro · aguardando emissão de nota
        </p>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum faturamento aguardando o Financeiro no momento.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {linhas.map((l) => {
              const mov = movs.find((m) => m.id === l.movId);
              const contrato = mov ? contratoMap[mov.empresa_id] ?? null : null;
              return (
                <div
                  key={l.key}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{l.empresaNome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Contrato:{" "}
                      <span className="font-medium text-foreground/80">{contrato ?? "—"}</span>
                      {" · "}
                      {formatMesReferencia(l.mesReferencia)} · {l.periodo}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1" title="Anexos do Cadastro">
                      <Paperclip className="h-3 w-3" />
                      {l.qtdAnexos}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="gap-1 border-warning/40 text-warning bg-warning/5"
                    >
                      <Clock className="h-3 w-3" />
                      Aguardando nota
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
