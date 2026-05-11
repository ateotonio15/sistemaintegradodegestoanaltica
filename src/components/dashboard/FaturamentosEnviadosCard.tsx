import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, Clock, CheckCircle2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatMesReferencia, getCurrentMesReferencia, periodoVigente } from "@/lib/movimentacao-utils";
import { AnexosViewerDialog } from "./AnexosViewerDialog";

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

type AlertaPendente = {
  empresa_id: string;
  movimentacao_id: string;
};

type MovKey = {
  id: string;
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
};

/**
 * Card "Faturamentos Não Enviados" — Dashboard Cadastro/Admin.
 * Lista financeiro_movimentacoes do mês atual sem data_envio_nota.
 * Botão "Alertar Financeiro" cria um alerta Pendente (tipo='nota')
 * que aparece em "Notas a Enviar" no dashboard do Financeiro.
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isComum } = useAuth();
  const podeAlertar = isAdmin || isComum;
  const mesAtual = getCurrentMesReferencia();

  const { data: empresaIdsVinculadas = [] } = useQuery<string[]>({
    queryKey: ["faturamentos-empresa-ids-vinculadas", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      // Busca empresas com campos para validar "ativa"
      const { data: empresasData } = await supabase
        .from("empresas")
        .select("id, responsavel_user_id, status_empresa, data_rescisao, contrato_suspenso");
      const todas = (empresasData ?? []) as Array<{
        id: string;
        responsavel_user_id: string | null;
        status_empresa: string | null;
        data_rescisao: string | null;
        contrato_suspenso: boolean | null;
      }>;
      const ativas = todas.filter(
        (e) =>
          (e.status_empresa ?? "Ativa") === "Ativa" &&
          !e.data_rescisao &&
          !e.contrato_suspenso,
      );
      // Admin: todas as empresas ativas
      if (isAdmin) {
        return ativas.map((e) => e.id);
      }
      const ativasIds = new Set(ativas.map((e) => e.id));
      const ids = new Set<string>();
      todas
        .filter((e) => e.responsavel_user_id === user.id && ativasIds.has(e.id))
        .forEach((e) => ids.add(e.id));
      const { data: links } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id")
        .eq("user_id", user.id);
      (links ?? []).forEach((l) => {
        if (ativasIds.has(l.empresa_id)) ids.add(l.empresa_id);
      });
      return Array.from(ids);
    },
  });

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

  // Movimentações operacionais para mapear alerta -> (empresa, mes, periodo)
  const { data: movsOperacionais = [] } = useQuery<MovKey[]>({
    queryKey: [
      "faturamentos-movs-op",
      mesAtual,
      empresaIds.sort().join(","),
    ],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .eq("mes_referencia", mesAtual)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return (data ?? []) as MovKey[];
    },
  });

  // Alertas Pendentes do tipo nota para essas movimentações
  const movIds = useMemo(() => movsOperacionais.map((m) => m.id), [movsOperacionais]);
  const { data: alertasPendentes = [] } = useQuery<AlertaPendente[]>({
    queryKey: ["faturamentos-alertas-nota", movIds.sort().join(",")],
    enabled: movIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_financeiro")
        .select("empresa_id, movimentacao_id, tipo, status")
        .in("movimentacao_id", movIds)
        .eq("status", "Pendente");
      if (error) throw error;
      return (data ?? [])
        .filter((a: any) => a.tipo === "nota" || a.tipo === null)
        .map((a: any) => ({ empresa_id: a.empresa_id, movimentacao_id: a.movimentacao_id }));
    },
  });

  // Mapa "empresa|mes|periodo" -> tem alerta pendente?
  const alertaKeySet = useMemo(() => {
    const movMap = new Map(movsOperacionais.map((m) => [m.id, m]));
    const set = new Set<string>();
    alertasPendentes.forEach((a) => {
      const m = movMap.get(a.movimentacao_id);
      if (m) set.add(`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`);
    });
    return set;
  }, [alertasPendentes, movsOperacionais]);

  // Realtime
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_financeiro" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["faturamentos-alertas-nota"] });
          queryClient.invalidateQueries({ queryKey: ["faturamentos-movs-op"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const alertarMutation = useMutation({
    mutationFn: async (vars: { empresa_id: string; mes_referencia: string; periodo: string }) => {
      const { data, error } = await supabase.rpc("alertar_financeiro_nota", {
        p_empresa_id: vars.empresa_id,
        p_mes_referencia: vars.mes_referencia,
        p_periodo: vars.periodo,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Financeiro alertado");
      queryClient.invalidateQueries({ queryKey: ["faturamentos-alertas-nota"] });
      queryClient.invalidateQueries({ queryKey: ["faturamentos-movs-op"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao alertar Financeiro");
    },
  });

  type Linha = {
    key: string;
    empresaId: string;
    empresaNome: string;
    contrato: string | null;
    mesReferencia: string;
    periodo: string;
    temAlerta: boolean;
  };

  const linhas: Linha[] = useMemo(() => {
    const empMap = new Map(empresasInfo.map((e) => [e.id, e]));
    return pendentes
      .map((p): Linha | null => {
        const emp = empMap.get(p.empresa_id);
        if (!emp) return null;
        return {
          key: p.id,
          empresaId: p.empresa_id,
          empresaNome: emp.nome,
          contrato: emp.codigo_contrato,
          mesReferencia: p.mes_referencia,
          periodo: p.periodo,
          temAlerta: alertaKeySet.has(`${p.empresa_id}|${p.mes_referencia}|${p.periodo}`),
        };
      })
      .filter((l): l is Linha => l !== null)
      .sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));
  }, [pendentes, empresasInfo, alertaKeySet]);

  const [anexosDialog, setAnexosDialog] = useState<{
    empresaId: string;
    empresaNome: string;
    mesReferencia: string;
    periodo: string;
  } | null>(null);

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
            {linhas.map((l) => {
              const isPending =
                alertarMutation.isPending &&
                alertarMutation.variables?.empresa_id === l.empresaId &&
                alertarMutation.variables?.periodo === l.periodo;
              return (
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
                    {/* botão Anexos removido */}
                    {podeAlertar && !l.temAlerta && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-warning/40 text-warning hover:bg-warning/10"
                        disabled={isPending}
                        onClick={() =>
                          alertarMutation.mutate({
                            empresa_id: l.empresaId,
                            mes_referencia: l.mesReferencia,
                            periodo: l.periodo,
                          })
                        }
                      >
                        <BellRing className="h-3 w-3" />
                        {isPending ? "Alertando..." : "Alertar Financeiro"}
                      </Button>
                    )}
                    {l.temAlerta && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-success/40 text-success bg-success/5"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Alerta enviado
                      </Badge>
                    )}
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

      <AnexosViewerDialog
        open={!!anexosDialog}
        onOpenChange={(v) => !v && setAnexosDialog(null)}
        empresaId={anexosDialog?.empresaId ?? null}
        empresaNome={anexosDialog?.empresaNome ?? ""}
        mesReferencia={anexosDialog?.mesReferencia ?? ""}
        periodo={anexosDialog?.periodo ?? ""}
      />
    </Card>
  );
}
