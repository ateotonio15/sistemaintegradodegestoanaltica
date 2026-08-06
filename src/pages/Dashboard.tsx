import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERIODOS,
  calcularStatus,
  formatMesReferencia,
  getCurrentMesReferencia,
  getCurrentPeriodo,
} from "@/lib/movimentacao-utils";
import { MovTipoChart } from "@/components/dashboard/charts/MovTipoChart";
import { StatusMovChart } from "@/components/dashboard/charts/StatusMovChart";
import { VidasMensalChart } from "@/components/dashboard/charts/VidasMensalChart";
import { EmpresasMovMensalChart } from "@/components/dashboard/charts/EmpresasMovMensalChart";
import { EmpresasPorPeriodoChart } from "@/components/dashboard/charts/EmpresasPorPeriodoChart";
import { EmpresasPortalChart } from "@/components/dashboard/charts/EmpresasPortalChart";
import { ChartFiltros } from "@/components/dashboard/charts/ChartFiltros";
import { KpiCard } from "@/components/dashboard/charts/KpiCard";
import { StatusPorUsuarioDialog } from "@/components/dashboard/charts/StatusPorUsuarioDialog";
import { Building2, HeartPulse, Globe, ArrowLeftRight } from "lucide-react";

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
  // Filtros independentes por gráfico
  const [statusMes, setStatusMes] = useState(getCurrentMesReferencia());
  const [statusPeriodo, setStatusPeriodo] = useState<string>(getCurrentPeriodo());
  const [periodoMes, setPeriodoMes] = useState(getCurrentMesReferencia());
  const [tipoMes, setTipoMes] = useState(getCurrentMesReferencia());
  const [tipoPeriodo, setTipoPeriodo] = useState<string>("all");
  const [statusUsuarioOpen, setStatusUsuarioOpen] = useState(false);
  // Filtro geral (aplica a todos os gráficos)
  const [geralUsuario, setGeralUsuario] = useState<string>("all");
  const [geralMes, setGeralMes] = useState(getCurrentMesReferencia());
  const [geralPeriodo, setGeralPeriodo] = useState<string>("all");
  const aplicarGeral = (mes: string, periodo: string) => {
    setStatusMes(mes);
    setPeriodoMes(mes);
    setTipoMes(mes);
    setStatusPeriodo(periodo === "all" ? "all" : periodo);
    setTipoPeriodo(periodo);
  };

  const meses12 = useMemo(() => ultimosMeses(12), []);
  const mesesOpcoes = useMemo(() => {
    const set = new Set([...meses12, statusMes, periodoMes, tipoMes, getCurrentMesReferencia()]);
    return Array.from(set).sort().reverse();
  }, [meses12, statusMes, periodoMes, tipoMes]);


  // Empresas (somente EMPRESARIAL — administradoras ficam de fora)
  const { data: empresas = [] } = useQuery({
    queryKey: ["dashboard-geral-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, vidas, tipo_contrato, status_empresa, tipo_movimentacao, contrato_via_portal, responsavel_user_id")
        .eq("tipo_contrato", "EMPRESARIAL");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const empresarialIds = useMemo(
    () => new Set((empresas ?? []).map((e: any) => e.id as string)),
    [empresas],
  );


  // Movimentações do mês/período filtrado
  const { data: movsPeriodo = [] } = useQuery({
    queryKey: ["dashboard-geral-movs", statusMes, statusPeriodo],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes")
        .select(
          "id, empresa_id, mes_referencia, periodo, data_envio_empresa, data_envio_financeiro, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, tipo_movimentacao, responsavel_contrato, responsavel_user_id)",
        )
        .eq("mes_referencia", statusMes);
      if (statusPeriodo !== "all") q = q.eq("periodo", statusPeriodo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Mapa de perfis (somente usuários internos do Cadastro / empresarial)
  const { data: profilesMap = new Map<string, string>() } = useQuery({
    queryKey: ["dashboard-geral-profiles-map-comum"],
    queryFn: async () => {
      const [{ data: emps, error: e1 }, { data: profs, error: e2 }] = await Promise.all([
        supabase.from("empresas").select("responsavel_user_id").eq("tipo_contrato", "EMPRESARIAL"),
        supabase.from("profiles").select("user_id, display_name"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const nomes = new Map<string, string>();
      (profs ?? []).forEach((p: any) => {
        if (p.user_id) nomes.set(p.user_id, p.display_name || "");
      });
      const responsaveis = new Set<string>(
        (emps ?? []).map((e: any) => e.responsavel_user_id).filter(Boolean),
      );
      const m = new Map<string, string>();
      Array.from(responsaveis)
        .sort((a, b) => (nomes.get(a) || "").localeCompare(nomes.get(b) || ""))
        .forEach((id) => m.set(id, nomes.get(id) || "Sem nome"));
      return m;
    },
    enabled: !!user,
  });




  // Movimentações do mês inteiro (por período)
  const { data: movsMes = [] } = useQuery({
    queryKey: ["dashboard-geral-movs-mes", periodoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(
          "empresa_id, periodo, empresas:empresas!movimentacoes_empresa_id_fkey(responsavel_user_id)",
        )
        .eq("mes_referencia", periodoMes);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Movimentações filtradas para o gráfico de tipo
  const { data: movsTipo = [] } = useQuery({
    queryKey: ["dashboard-geral-movs-tipo", tipoMes, tipoPeriodo],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes")
        .select("empresa_id, empresas:empresas!movimentacoes_empresa_id_fkey(responsavel_user_id)")
        .eq("mes_referencia", tipoMes);
      if (tipoPeriodo !== "all") q = q.eq("periodo", tipoPeriodo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
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
        .select("empresa_id, mes_referencia, entradas, saidas, total_atual")
        .in("mes_referencia", meses12);
      if (error) throw error;
      return (data ?? []) as { empresa_id: string; mes_referencia: string; entradas: number; saidas: number; total_atual: number }[];
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
        queryClient.invalidateQueries({ queryKey: ["dashboard-geral-movs-mes"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-geral-movs-tipo"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filtro global por usuário do Cadastro
  const matchUsuario = useMemo(
    () => (m: any) =>
      geralUsuario === "all" || (m.empresas?.responsavel_user_id ?? null) === geralUsuario,
    [geralUsuario],
  );

  // Empresa corresponde ao filtro de usuário
  const matchEmpresaUsuario = useMemo(
    () => (e: any) => geralUsuario === "all" || e.responsavel_user_id === geralUsuario,
    [geralUsuario],
  );

  // Empresas por tipo de movimentação (empresas com movimentação no mês/período filtrado)
  const porTipo = useMemo(() => {
    const idsComMovimentacao = new Set(movsTipo.filter(matchUsuario).map((m: any) => m.empresa_id));
    const map = new Map<string, number>();
    empresas
      .filter((e: any) => idsComMovimentacao.has(e.id) && matchEmpresaUsuario(e))
      .forEach((e: any) => {
        const tipo = (e.tipo_movimentacao || "Não informado").toString();
        map.set(tipo, (map.get(tipo) ?? 0) + 1);
      });
    return Array.from(map.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total);
  }, [empresas, movsTipo, matchUsuario, matchEmpresaUsuario]);

  // Empresas por canal de movimentação (Portal vs Não portal) — todas as ativas do usuário filtrado
  const porPortal = useMemo(() => {
    const base = empresas.filter(
      (e: any) => e.status_empresa === "Ativa" && matchEmpresaUsuario(e),
    );
    const viaPortal = base.filter((e: any) => e.contrato_via_portal === true).length;
    const naoPortal = base.length - viaPortal;
    return [
      { categoria: "Via portal", total: viaPortal },
      { categoria: "Não via portal", total: naoPortal },
    ];
  }, [empresas, matchEmpresaUsuario]);



  // Movimentações restritas a empresas EMPRESARIAL
  const movsPeriodoEmp = useMemo(
    () => movsPeriodo.filter((m: any) => empresarialIds.has(m.empresa_id) && matchUsuario(m)),
    [movsPeriodo, empresarialIds, matchUsuario],
  );

  // Status
  const status = useMemo(() => {
    let aguardando = 0,
      foraDoPrazo = 0,
      empresa = 0,
      financeiro = 0;
    movsPeriodoEmp.forEach((m: any) => {
      const s = calcularStatus(m);
      if (s === "Enviado ao financeiro") financeiro += 1;
      else if (s === "Enviado para empresa") empresa += 1;
      else if (s === "Fora do prazo") foraDoPrazo += 1;
      else aguardando += 1;
    });
    return { aguardando, foraDoPrazo, empresa, financeiro };
  }, [movsPeriodoEmp]);

  // Vidas (somente empresarial)
  const vidas = useMemo(() => {
    const ativas = empresas.filter((e: any) => e.status_empresa === "Ativa");
    const total = ativas.reduce((s: number, e: any) => s + (e.vidas ?? 0), 0);
    return { totalGeral: total, totalEmpresarial: total, empresasAtivas: ativas.length };
  }, [empresas]);

  // Série de vidas por mês
  const serieVidas = useMemo(() => {
    return meses12.map((mes) => {
      const linhas = historicoVidas.filter(
        (h) => h.mes_referencia === mes && empresarialIds.has(h.empresa_id),
      );
      return {
        mes,
        entradas: linhas.reduce((s, h) => s + (h.entradas ?? 0), 0),
        saidas: linhas.reduce((s, h) => s + (h.saidas ?? 0), 0),
        vidas_ativas: linhas.reduce((s, h) => s + (h.total_atual ?? 0), 0),
      };
    });
  }, [meses12, historicoVidas, empresarialIds]);

  // Empresas com movimentação por mês
  const serieEmpresas = useMemo(() => {
    return meses12.map((mes) => {
      const ids = new Set(
        movs12
          .filter((m) => m.mes_referencia === mes && empresarialIds.has(m.empresa_id))
          .map((m) => m.empresa_id),
      );
      return { mes, empresas: ids.size };
    });
  }, [meses12, movs12, empresarialIds]);

  // Empresas por período (mês selecionado)
  const seriePeriodos = useMemo(() => {
    return PERIODOS.map((p) => {
      const ids = new Set(
        movsMes
          .filter((m: any) => m.periodo === p && empresarialIds.has(m.empresa_id) && matchUsuario(m))
          .map((m: any) => m.empresa_id),
      );
      return { periodo: p, empresas: ids.size };
    });
  }, [movsMes, empresarialIds, matchUsuario]);



  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Geral</h1>
          <p className="text-sm text-muted-foreground">Visão analítica em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={geralMes}
            onValueChange={(v) => {
              setGeralMes(v);
              aplicarGeral(v, geralPeriodo);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              {mesesOpcoes.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {formatMesReferencia(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={geralPeriodo}
            onValueChange={(v) => {
              setGeralPeriodo(v);
              aplicarGeral(geralMes, v);
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos os períodos
              </SelectItem>
              {PERIODOS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={geralUsuario} onValueChange={setGeralUsuario}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos os usuários
              </SelectItem>
              {Array.from(profilesMap.entries()).map(([id, nome]) => (
                <SelectItem key={id} value={id} className="text-xs">
                  {nome || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>



      <div className="grid gap-4 lg:grid-cols-2">
        <MovTipoChart
          data={porTipo}
          filtros={
            <ChartFiltros
              meses={mesesOpcoes}
              mes={tipoMes}
              onMesChange={setTipoMes}
              periodo={tipoPeriodo}
              onPeriodoChange={setTipoPeriodo}
            />
          }
        />
        <StatusMovChart
          aguardando={status.aguardando}
          foraDoPrazo={status.foraDoPrazo}
          empresa={status.empresa}
          financeiro={status.financeiro}
          filtros={
            <ChartFiltros
              meses={mesesOpcoes}
              mes={statusMes}
              onMesChange={setStatusMes}
              periodo={statusPeriodo}
              onPeriodoChange={setStatusPeriodo}
            />
          }
          onVerPorUsuario={() => setStatusUsuarioOpen(true)}
        />
        <EmpresasPortalChart data={porPortal} />
        <VidasTempoRealCard
          totalGeral={vidas.totalGeral}
          totalEmpresarial={vidas.totalEmpresarial}
          empresasAtivas={vidas.empresasAtivas}
        />
        <EmpresasMovMensalChart data={serieEmpresas} />
        <div className="lg:col-span-2">
          <EmpresasPorPeriodoChart
            data={seriePeriodos}
            filtros={<ChartFiltros meses={mesesOpcoes} mes={periodoMes} onMesChange={setPeriodoMes} />}
          />
        </div>
        <div className="lg:col-span-2">
          <VidasMensalChart data={serieVidas} />
        </div>
      </div>

      <StatusPorUsuarioDialog
        open={statusUsuarioOpen}
        onOpenChange={setStatusUsuarioOpen}
        movs={movsPeriodoEmp as any}
        profilesMap={profilesMap}
        mes={statusMes}
        periodo={statusPeriodo}
      />
    </div>
  );
}
