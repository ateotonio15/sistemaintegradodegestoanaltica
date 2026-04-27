import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, Clock, CheckCircle2, AlertCircle, Send, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  contratoDentroDoPeriodo,
  periodoVigente,
  formatMesReferencia,
} from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";

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
  data_envio_financeiro: string | null;
};

type FinKey = string; // `${empresa_id}|${mes}|${periodo}`
type FinInfo = { data_envio_nota: string | null; data_vencimento: string | null };

/**
 * Card "Faturamentos Enviado" — Dashboard Cadastro.
 * Lista contratos vinculados ao usuário que estão dentro do período atual.
 *
 * Estados por contrato (somente leitura — sem ações):
 *  - Pendente   → ainda não foi movimentado
 *  - Enviado    → data_envio_financeiro preenchida; aguarda Financeiro
 *  - Finalizado → Financeiro já enviou a nota (data_envio_nota preenchida)
 */
export function FaturamentosEnviadosCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Empresas vinculadas ao usuário (responsável direto OU via empresa_usuarios)
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
        .select("id, empresa_id, mes_referencia, periodo, data_envio_financeiro")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return (data ?? []) as MovItem[];
    },
  });

  const { data: finMap = new Map<FinKey, FinInfo>() } = useQuery({
    queryKey: ["faturamentos-finmap-card"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, mes_referencia, periodo, data_envio_nota, data_vencimento");
      if (error) throw error;
      const m = new Map<FinKey, FinInfo>();
      for (const r of data ?? []) {
        m.set(`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`, {
          data_envio_nota: (r.data_envio_nota as string) ?? null,
          data_vencimento: (r.data_vencimento as string) ?? null,
        });
      }
      return m;
    },
  });

  // Alertas de vencimento já abertos pelo Cadastro (para indicar visualmente "alerta enviado")
  const { data: alertasVencimentoAbertos = new Set<string>() } = useQuery({
    queryKey: ["alertas-vencimento-pendentes-mov-ids"],
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
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-finmap-card"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "empresas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faturamentos-empresas-vinculadas"] });
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
    status: "Pendente" | "Enviado" | "Finalizado";
    dataEnvio: string | null;
    dataNota: string | null;
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
      const finalizadaEm = finMap.get(`${e.id}|${ciclo.mes_referencia}|${ciclo.periodo}`) ?? null;
      const enviado = !!mov?.data_envio_financeiro;
      const status: Linha["status"] = finalizadaEm ? "Finalizado" : enviado ? "Enviado" : "Pendente";
      return {
        empresa: e,
        mesReferencia: ciclo.mes_referencia,
        periodo: ciclo.periodo,
        movId: mov?.id ?? null,
        status,
        dataEnvio: mov?.data_envio_financeiro ?? null,
        dataNota: finalizadaEm,
      };
    })
    .sort((a, b) => {
      const order = { Pendente: 0, Enviado: 1, Finalizado: 2 } as const;
      return order[a.status] - order[b.status] || a.empresa.nome.localeCompare(b.empresa.nome);
    });

  const pendentes = linhas.filter((l) => l.status === "Pendente").length;

  return (
    <Card className="rounded-xl shadow-sm border-warning/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-warning" />
            </div>
            Faturamentos Enviado
            <Badge variant="outline" className="ml-1">{linhas.length}</Badge>
            {pendentes > 0 && (
              <Badge className="bg-warning text-warning-foreground text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                {pendentes} pendente{pendentes > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum contrato dentro do período atual.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {linhas.map((l) => (
              <div
                key={`${l.empresa.id}-${l.mesReferencia}-${l.periodo}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">{l.empresa.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {l.empresa.codigo_contrato && <span className="mr-2">{l.empresa.codigo_contrato}</span>}
                    {formatMesReferencia(l.mesReferencia)} · {l.periodo}
                    {l.status === "Pendente" && (
                      <span className="ml-2 text-warning">— Este contrato precisa ser movimentado.</span>
                    )}
                    {l.status === "Enviado" && l.dataEnvio && (
                      <span className="ml-2">— enviado em {formatDateBR(l.dataEnvio)}</span>
                    )}
                    {l.status === "Finalizado" && l.dataNota && (
                      <span className="ml-2">— nota enviada em {formatDateBR(l.dataNota)}</span>
                    )}
                  </p>
                </div>

                {l.status === "Pendente" ? (
                  <Badge className="bg-warning text-warning-foreground shrink-0 gap-1">
                    <Clock className="h-3 w-3" /> Pendente
                  </Badge>
                ) : l.status === "Enviado" ? (
                  <Badge className="bg-info text-info-foreground shrink-0 gap-1">
                    <Send className="h-3 w-3" /> Enviado
                  </Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground shrink-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Finalizado
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
