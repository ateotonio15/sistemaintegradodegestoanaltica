import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, Send, CheckCircle2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  contratoDentroDoPeriodo,
  periodoVigente,
  formatMesReferencia,
} from "@/lib/movimentacao-utils";

type EmpresaItem = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  data_corte: number | null;
  data_implantacao: string | null;
  status_empresa: string | null;
};

type MovItem = {
  id: string;
  empresa_id: string;
  mes_referencia: string;
  periodo: string;
};

/**
 * Card "Faturamentos Enviado" — Dashboard Cadastro.
 * Lista contratos vinculados ao usuário no período atual.
 *
 * Cada linha tem UM botão manual "Enviar ao Financeiro":
 *  - Sem alerta pendente → botão habilitado
 *  - Alerta pendente já criado → botão "Enviado" desabilitado
 * Nada é enviado ao Financeiro automaticamente — só via clique.
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [enviandoMovId, setEnviandoMovId] = useState<string | null>(null);

  // Empresas vinculadas ao usuário
  const { data: empresas = [] } = useQuery<EmpresaItem[]>({
    queryKey: ["faturamentos-empresas-vinculadas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data: ownEmpresas, error: ownErr } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao, status_empresa")
        .eq("responsavel_user_id", user.id)
        .eq("status_empresa", "Ativa");
      if (ownErr) throw ownErr;

      const { data: links, error: linksErr } = await supabase
        .from("empresa_usuarios")
        .select("empresa_id")
        .eq("user_id", user.id);
      if (linksErr) throw linksErr;

      let extra: EmpresaItem[] = [];
      const linkedIds = (links ?? []).map((l) => l.empresa_id);
      if (linkedIds.length > 0) {
        const { data: linked, error: linkedErr } = await supabase
          .from("empresas")
          .select("id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao, status_empresa")
          .in("id", linkedIds)
          .eq("status_empresa", "Ativa");
        if (linkedErr) throw linkedErr;
        extra = (linked ?? []) as EmpresaItem[];
      }

      const map = new Map<string, EmpresaItem>();
      for (const e of [...(ownEmpresas ?? []), ...extra]) map.set(e.id, e as EmpresaItem);
      return Array.from(map.values());
    },
  });

  const empresaIds = useMemo(() => empresas.map((e) => e.id), [empresas]);
  const { data: movs = [] } = useQuery<MovItem[]>({
    queryKey: ["faturamentos-movs-do-ciclo", empresaIds.sort().join(",")],
    enabled: !!user && empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return (data ?? []) as MovItem[];
    },
  });

  // Anexos do Cadastro por movimentação
  const movIdsForAnexos = useMemo(() => movs.map((m) => m.id), [movs]);
  const { data: anexosCadastroPorMov = new Map<string, number>() } = useQuery({
    queryKey: ["faturamentos-anexos-cadastro", movIdsForAnexos.sort().join(",")],
    enabled: !!user && movIdsForAnexos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("movimentacao_id")
        .in("movimentacao_id", movIdsForAnexos);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        const k = (r as any).movimentacao_id as string;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return map;
    },
  });

  // IDs de movimentações com alerta de envio pendente (clicaram no botão)
  const { data: movsComAlertaPendente = new Set<string>() } = useQuery({
    queryKey: ["alertas-envio-pendentes-mov-ids"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_financeiro")
        .select("movimentacao_id")
        .eq("tipo", "vencimento")
        .eq("status", "Pendente");
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.movimentacao_id));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("faturamentos-enviados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-movs-do-ciclo"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "empresas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-empresas-vinculadas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_financeiro" }, () => {
        queryClient.invalidateQueries({ queryKey: ["alertas-envio-pendentes-mov-ids"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos_movimentacao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-anexos-cadastro"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const hoje = new Date();
  type Linha = {
    empresa: EmpresaItem;
    mesReferencia: string;
    periodo: string;
    movId: string | null;
    enviado: boolean;
    qtdAnexos: number;
  };

  const linhas: Linha[] = empresas
    .filter((e) => contratoDentroDoPeriodo(e, hoje))
    .map((e) => {
      const ciclo = periodoVigente(e, hoje);
      const mov = movs.find(
        (m) =>
          m.empresa_id === e.id &&
          m.mes_referencia === ciclo.mes_referencia &&
          m.periodo === ciclo.periodo,
      );
      const qtdCadastro = mov?.id ? (anexosCadastroPorMov.get(mov.id) ?? 0) : 0;
      return {
        empresa: e,
        mesReferencia: ciclo.mes_referencia,
        periodo: ciclo.periodo,
        movId: mov?.id ?? null,
        enviado: mov?.id ? movsComAlertaPendente.has(mov.id) : false,
        qtdAnexos: qtdCadastro,
      };
    })
    .sort((a, b) => {
      // Não enviados primeiro
      if (a.enviado !== b.enviado) return a.enviado ? 1 : -1;
      return a.empresa.nome.localeCompare(b.empresa.nome);
    });

  async function enviarAoFinanceiro(l: Linha) {
    if (!l.movId || !user) return;
    setEnviandoMovId(l.movId);
    try {
      const { error } = await supabase.rpc("enviar_movimentacao_ao_financeiro", {
        p_mov_id: l.movId,
      });
      if (error) throw error;
      toast.success(`${l.empresa.nome} enviada ao Financeiro`);
      queryClient.invalidateQueries({ queryKey: ["alertas-envio-pendentes-mov-ids"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar ao Financeiro");
    } finally {
      setEnviandoMovId(null);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm border-warning/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
            <BellRing className="h-4 w-4 text-warning" />
          </div>
          Faturamentos Enviado
          <Badge variant="outline" className="ml-1">{linhas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum contrato dentro do período atual.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {linhas.map((l) => {
              const isLoading = enviandoMovId === l.movId;
              const semMov = !l.movId;
              return (
                <div
                  key={`${l.empresa.id}-${l.mesReferencia}-${l.periodo}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{l.empresa.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Contrato:{" "}
                      <span className="font-medium text-foreground/80">
                        {l.empresa.codigo_contrato ?? "—"}
                      </span>
                      {" · "}
                      {formatMesReferencia(l.mesReferencia)} · {l.periodo}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="gap-1"
                      title="Anexos do Cadastro"
                    >
                      <Paperclip className="h-3 w-3" />
                      {l.qtdAnexos}
                    </Badge>

                    {l.enviado ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="gap-1.5 border-success/40 text-success bg-success/5 cursor-not-allowed disabled:opacity-100"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Enviado
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1.5 font-medium shadow-sm"
                        disabled={isLoading || semMov}
                        title={
                          semMov
                            ? "Movimente o contrato antes de enviar ao Financeiro"
                            : "Enviar esta empresa ao Financeiro"
                        }
                        onClick={() => enviarAoFinanceiro(l)}
                      >
                        <Send className="h-4 w-4" />
                        {isLoading ? "Enviando..." : "Enviar ao Financeiro"}
                      </Button>
                    )}
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
