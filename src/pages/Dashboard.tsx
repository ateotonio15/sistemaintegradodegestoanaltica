import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  PERIODOS,
  calcularStatus,
  getCurrentMesReferencia,
  getCurrentPeriodo,
  formatMesReferencia,
} from "@/lib/movimentacao-utils";
import { MovTipoChart } from "@/components/dashboard/charts/MovTipoChart";
import { StatusMovChart } from "@/components/dashboard/charts/StatusMovChart";
import { VidasTempoRealCard } from "@/components/dashboard/charts/VidasTempoRealCard";
import { VidasMensalChart } from "@/components/dashboard/charts/VidasMensalChart";
import { EmpresasMovMensalChart } from "@/components/dashboard/charts/EmpresasMovMensalChart";
import { EmpresasPorPeriodoChart } from "@/components/dashboard/charts/EmpresasPorPeriodoChart";

function ultimosMeses(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>(getCurrentPeriodo());

  const meses12 = useMemo(() => ultimosMeses(12), []);
  const mesesOpcoes = useMemo(() => {
    const set = new Set([...meses12, filterMes, getCurrentMesReferencia()]);
    return Array.from(set).sort().reverse();
  }, [meses12, filterMes]);

  // Empresas (vidas em tempo real)
  const { data: empresas = [] } = useQuery({
    queryKey: ["dashboard-geral-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, vidas, tipo_contrato, status_empresa, tipo_movimentacao");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Movimentações do mês/período filtrado
  const { data: movsPeriodo = [] } = useQuery({
    queryKey: ["dashboard-geral-movs", filterMes, filterPeriodo],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes")
        .select(
          "id, empresa_id, mes_referencia, periodo, data_envio_empresa, data_envio_financeiro, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, tipo_movimentacao)",
        )
        .eq("mes_referencia", filterMes);
      if (filterPeriodo !== "all") q = q.eq("periodo", filterPeriodo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Movimentações dos últimos 12 meses (série mensal de empresas)
  // Movimentações do mês inteiro (por período)
  const { data: movsMes = [] } = useQuery({
    queryKey: ["dashboard-geral-movs-mes", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", filterMes);
      if (error) throw error;
      return (data ?? []) as { empresa_id: string; periodo: string }[];
    },
    enabled: !!user,
  });

  // Movimentações dos últimos 12 meses (série mensal de empresas)
  const { data: movs12 = [] } = useQuery({
    queryKey: ["dashboard-geral-movs-12", meses12[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("empresa_id, mes_referencia")
        .gte("mes_referencia", meses12[0]);
      if (error) throw error;
      return (data ?? []) as { empresa_id: string; mes_referencia: string }[];
    },
    enabled: !!user,
  });

  // Histórico de vidas (entradas/saídas)
  const { data: historicoVidas = [] } = useQuery({
    queryKey: ["dashboard-geral-vidas-hist", meses12[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidas_historico_administradoras")
        .select("mes_referencia, entradas, saidas, total_atual")
        .in("mes_referencia", meses12);
      if (error) throw error;
      return (data ?? []) as { mes_referencia: string; entradas: number; saidas: number; total_atual: number }[];
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-geral-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "empresas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-geral-empresas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-geral-movs"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-geral-movs-12"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Empresas por tipo de movimentação (empresas distintas com movimentação no período)
  const porTipo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    movsPeriodo.forEach((m: any) => {
      const tipo = (m.empresas?.tipo_movimentacao || "Não informado").toString();
      const set = map.get(tipo) ?? new Set<string>();
      set.add(m.empresa_id);
      map.set(tipo, set);
    });
    return Array.from(map.entries())
      .map(([tipo, set]) => ({ tipo, total: set.size }))
      .sort((a, b) => b.total - a.total);
  }, [movsPeriodo]);

  // Status
  const status = useMemo(() => {
    let pendentes = 0,
      empresa = 0,
      financeiro = 0;
    movsPeriodo.forEach((m: any) => {
      const s = calcularStatus(m);
      if (s === "Enviado ao financeiro") financeiro += 1;
      else if (s === "Enviado para empresa") empresa += 1;
      else pendentes += 1;
    });
    return { pendentes, empresa, financeiro };
  }, [movsPeriodo]);

  // Vidas
  const vidas = useMemo(() => {
    const ativas = empresas.filter((e: any) => e.status_empresa === "Ativa");
    const totalGeral = ativas.reduce((s: number, e: any) => s + (e.vidas ?? 0), 0);
    const totalEmpresarial = ativas
      .filter((e: any) => (e.tipo_contrato ?? "").toUpperCase() === "EMPRESARIAL")
      .reduce((s: number, e: any) => s + (e.vidas ?? 0), 0);
    return { totalGeral, totalEmpresarial, empresasAtivas: ativas.length };
  }, [empresas]);

  // Série de vidas por mês
  const serieVidas = useMemo(() => {
    return meses12.map((mes) => {
      const linhas = historicoVidas.filter((h) => h.mes_referencia === mes);
      return {
        mes,
        entradas: linhas.reduce((s, h) => s + (h.entradas ?? 0), 0),
        saidas: linhas.reduce((s, h) => s + (h.saidas ?? 0), 0),
        vidas_ativas: linhas.reduce((s, h) => s + (h.total_atual ?? 0), 0),
      };
    });
  }, [meses12, historicoVidas]);

  // Empresas com movimentação por mês
  const serieEmpresas = useMemo(() => {
    return meses12.map((mes) => {
      const ids = new Set(movs12.filter((m) => m.mes_referencia === mes).map((m) => m.empresa_id));
      return { mes, empresas: ids.size };
    });
  }, [meses12, movs12]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Geral</h1>
          <p className="text-sm text-muted-foreground">Visão analítica em tempo real</p>
        </div>
        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-end gap-3 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Competência</Label>
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesOpcoes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMesReferencia(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MovTipoChart data={porTipo} />
        <StatusMovChart pendentes={status.pendentes} empresa={status.empresa} financeiro={status.financeiro} />
        <VidasTempoRealCard
          totalGeral={vidas.totalGeral}
          totalEmpresarial={vidas.totalEmpresarial}
          empresasAtivas={vidas.empresasAtivas}
        />
        <EmpresasMovMensalChart data={serieEmpresas} />
        <div className="lg:col-span-2">
          <VidasMensalChart data={serieVidas} />
        </div>
      </div>
    </div>
  );
}
