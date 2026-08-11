import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { expandirAnexosPorGrupo, fetchEmpresaGrupoMap } from "@/lib/financeiro-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Wallet,
  CalendarClock,
  AlertOctagon,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date-utils";
import {
  calcularStatusFinanceiro,
  formatMesReferencia,
  isXlsAnexo,
} from "@/lib/financeiro-utils";

type AnaliseRow = {
  rowKey: string;
  mov_id: string;
  empresa_id: string;
  empresa_nome: string;
  pagador_nome: string | null;
  pagador_cnpj: string | null;
  pagador_id: string | null;
  competencia: string;
  data_vencimento: string | null;
  data_prorrogacao: string | null;
  possui_prorrogacao: boolean;
  nota_emitida: boolean;
  xlsPaths: string[];
  filtroPagador: { cnpj: string | null; nome: string | null } | null;
};

type AnaliseDado = {
  loading: boolean;
  enfBeneficiarios: number;
  enfTotal: number;
  aptBeneficiarios: number;
  aptTotal: number;
  inclusoesTotal: number;
  exclusoesTotal: number; // negativo quando há exclusões (Moto Honda)
  totalGeral: number;
  detalhe?: any;
  erro?: string;
};

const EMPTY_ANALISE: AnaliseDado = {
  loading: false,
  enfBeneficiarios: 0,
  enfTotal: 0,
  aptBeneficiarios: 0,
  aptTotal: 0,
  inclusoesTotal: 0,
  exclusoesTotal: 0,
  totalGeral: 0,
};

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseLocalDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function diffDias(d: Date, base: Date): number {
  return Math.round((d.getTime() - base.getTime()) / 86400000);
}

/**
 * Registros antigos podem ter sido gravados na competência anterior, embora a
 * nota pertença ao ciclo do mês em que foi enviada. Nesses casos preservamos o
 * dia configurado e usamos o mês real do envio (ex.: 10/07 + envio em agosto
 * passa a vencer em 10/08).
 */
function calcularVencimentoEfetivo(
  dataVencimento: string | null,
  dataEnvioNota: string | null,
): string | null {
  if (!dataVencimento || !dataEnvioNota) return dataVencimento;
  const venc = parseLocalDate(dataVencimento);
  const envio = parseLocalDate(dataEnvioNota);
  if (!venc || !envio || venc >= envio || (venc.getFullYear() === envio.getFullYear() && venc.getMonth() === envio.getMonth())) {
    return dataVencimento;
  }
  const ultimoDia = new Date(envio.getFullYear(), envio.getMonth() + 1, 0).getDate();
  const dia = Math.min(venc.getDate(), ultimoDia);
  return `${envio.getFullYear()}-${String(envio.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function PrevisaoFinanceira() {
  type PeriodoOpt = "" | "todos" | "hoje" | "7" | "15" | "30" | "custom";
  // "Data específica" é a opção padrão ao abrir a aba
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoOpt>("custom");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"" | "todos" | "a_vencer" | "hoje" | "vencido">("");
  const [ordenacao, setOrdenacao] = useState<"" | "data" | "valor" | "empresa">("");
  // Filtros efetivamente aplicados (somente após "Confirmar")
  const [aplicado, setAplicado] = useState<{
    periodo: PeriodoOpt;
    inicio: string;
    fim: string;
    status: "" | "todos" | "a_vencer" | "hoje" | "vencido";
  } | null>(null);

  const [analises, setAnalises] = useState<Record<string, AnaliseDado>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: empresas = [] } = useQuery({
    queryKey: ["prev-fin-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["prev-fin-movs"],
    queryFn: async () => {
      // Paginado: o backend limita cada requisição a 1000 linhas
      const out: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("financeiro_movimentacoes")
          .select(
            "id, empresa_id, mes_referencia, periodo, data_envio_nota, data_vencimento, dentro_prazo, aguardando_nota_em, possui_prorrogacao, data_prorrogacao",
          )
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["prev-fin-anexos"],
    queryFn: async () => {
      const out: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id, mime_type, nome_arquivo, storage_path, origem")
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return out.filter((a: any) => a.origem !== "retroativo");
    },
  });

  const { data: pagadores = [] } = useQuery({
    queryKey: ["prev-fin-pagadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagadores")
        .select("id, empresa_id, nome_pagador, cnpj, ativo")
        .eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: empresaGrupo = new Map<string, string>() } = useQuery({
    queryKey: ["prev-fin-grupos"],
    queryFn: () => fetchEmpresaGrupoMap(supabase as any),
  });

  const empresaMap = useMemo(
    () => new Map(empresas.map((e: any) => [e.id, e])),
    [empresas],
  );
  // Compartilha anexos entre contratos do mesmo Grupo Financeiro (igual à aba Faturamento)
  const anexosPorMov = useMemo(
    () => expandirAnexosPorGrupo(movs as any, anexos as any[], empresaGrupo),
    [movs, anexos, empresaGrupo],
  );
  const pagadoresPorEmpresa = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of pagadores as any[]) {
      const list = m.get(p.empresa_id) ?? [];
      list.push(p);
      m.set(p.empresa_id, list);
    }
    return m;
  }, [pagadores]);

  // A previsão é guiada pelo vencimento. Portanto, inclui todas as
  // movimentações com vencimento, mesmo quando a nota ainda não foi emitida.
  const rows: AnaliseRow[] = useMemo(() => {
    const out: AnaliseRow[] = [];
    for (const m of movs as any[]) {
      const anex = anexosPorMov.get(m.id) ?? [];
      const status = calcularStatusFinanceiro(m, !!m.aguardando_nota_em, anex);
      if (!m.data_vencimento) continue;
      const emp = empresaMap.get(m.empresa_id) as any;
      if (!emp) continue;
      const xlsPaths = anex
        .filter((a) => isXlsAnexo(a) && a.storage_path)
        .map((a) => a.storage_path as string);
      const pags = pagadoresPorEmpresa.get(m.empresa_id) ?? [];

      const baseRow: Omit<AnaliseRow, "rowKey" | "pagador_nome" | "pagador_cnpj" | "pagador_id" | "filtroPagador"> = {
        mov_id: m.id,
        empresa_id: m.empresa_id,
        empresa_nome: emp.nome ?? "—",
        competencia: m.mes_referencia,
        data_vencimento: calcularVencimentoEfetivo(m.data_vencimento, m.data_envio_nota),
        data_prorrogacao: m.data_prorrogacao,
        possui_prorrogacao: !!m.possui_prorrogacao,
        nota_emitida: status === "Nota emitida" || status === "Enviada",
        xlsPaths,
      };

      if (pags.length === 0) {
        out.push({
          ...baseRow,
          rowKey: m.id,
          pagador_id: null,
          pagador_nome: null,
          pagador_cnpj: emp.cnpj ?? null,
          filtroPagador: null,
        });
      } else {
        // Linha-mãe filtrando pelo CNPJ da própria empresa
        out.push({
          ...baseRow,
          rowKey: m.id,
          pagador_id: null,
          pagador_nome: emp.nome,
          pagador_cnpj: emp.cnpj ?? null,
          filtroPagador: { cnpj: emp.cnpj ?? null, nome: emp.nome ?? null },
        });
        // Uma linha por pagador
        for (const p of pags) {
          out.push({
            ...baseRow,
            rowKey: `${m.id}::${p.id}`,
            pagador_id: p.id,
            pagador_nome: p.nome_pagador,
            pagador_cnpj: p.cnpj ?? null,
            filtroPagador: { cnpj: p.cnpj ?? null, nome: p.nome_pagador },
          });
        }
      }
    }
    return out;
  }, [movs, anexosPorMov, empresaMap, pagadoresPorEmpresa]);



  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Aplicar filtros + ordenação
  const baseRows = useMemo(() => {
    // Enquanto o usuário não confirmar os filtros, nada é listado
    if (!aplicado) return [] as AnaliseRow[];
    const { periodo: filtroPeriodo, inicio, fim: fimStr, status: filtroStatus } = aplicado;
    if (!filtroPeriodo) return [] as AnaliseRow[];
    if (filtroPeriodo === "custom" && (!inicio || !fimStr)) return [] as AnaliseRow[];
    const ini = parseLocalDate(inicio);
    const fim = parseLocalDate(fimStr);
    return rows.filter((r) => {
      const venc = parseLocalDate(r.data_vencimento);
      // filtro período
      if (filtroPeriodo && filtroPeriodo !== "todos") {
        if (!venc) return false;
        if (filtroPeriodo === "custom") {
          if (ini && venc < ini) return false;
          if (fim && venc > fim) return false;
        } else {
          const dias = diffDias(venc, hoje);
          if (filtroPeriodo === "hoje" && dias !== 0) return false;
          if (filtroPeriodo === "7" && (dias < 0 || dias > 7)) return false;
          if (filtroPeriodo === "15" && (dias < 0 || dias > 15)) return false;
          if (filtroPeriodo === "30" && (dias < 0 || dias > 30)) return false;
        }
      }
      if (filtroStatus && filtroStatus !== "todos") {
        if (!venc) return false;
        const dias = diffDias(venc, hoje);
        if (filtroStatus === "hoje" && dias !== 0) return false;
        if (filtroStatus === "a_vencer" && dias <= 0) return false;
        if (filtroStatus === "vencido" && dias >= 0) return false;
      }
      return true;
    });
  }, [rows, aplicado, hoje]);

  // Aplicar ordenação
  const filteredRows = useMemo(() => {
    const list = [...baseRows];
    list.sort((a, b) => {
      if (ordenacao === "empresa") return a.empresa_nome.localeCompare(b.empresa_nome, "pt-BR");
      if (ordenacao === "valor") {
        const va = analises[a.rowKey]?.totalGeral ?? 0;
        const vb = analises[b.rowKey]?.totalGeral ?? 0;
        return vb - va;
      }
      const da = parseLocalDate(a.data_vencimento)?.getTime() ?? Infinity;
      const db = parseLocalDate(b.data_vencimento)?.getTime() ?? Infinity;
      return da - db;
    });
    return list;
  }, [baseRows, ordenacao, analises]);

  // Carrega TODAS as análises do período de uma só vez (em paralelo) e
  // só libera a tabela quando tudo estiver pronto.
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!aplicado) {
      setProgresso(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const alvos = baseRows;
      setAnalises({});
      setProgresso({ done: 0, total: alvos.length });
      if (alvos.length === 0) return;

      const { analisarExcelFinanceiroPorPagador } = await import(
        "@/lib/excel-analysis-utils"
      );
      const bufCache = new Map<string, Promise<ArrayBuffer>>();
      const resultado: Record<string, AnaliseDado> = {};
      let done = 0;

      const baixar = (path: string) => {
        let p = bufCache.get(path);
        if (!p) {
          p = (async () => {
            const { data, error } = await supabase.storage
              .from("anexos-financeiro")
              .download(path);
            if (error) throw error;
            return await data.arrayBuffer();
          })();
          bufCache.set(path, p);
        }
        return p;
      };

      const processar = async (r: AnaliseRow) => {
        try {
          if (r.xlsPaths.length === 0) {
            resultado[r.rowKey] = { ...EMPTY_ANALISE, erro: "Sem planilha anexada" };
            return;
          }
          let enfBeneficiarios = 0;
          let enfTotal = 0;
          let aptBeneficiarios = 0;
          let aptTotal = 0;
          let inclusoesTotal = 0;
          let exclusoesTotal = 0;
          const detalhes: any[] = [];
          for (const path of r.xlsPaths) {
            const buf = await baixar(path);
            const res = await analisarExcelFinanceiroPorPagador(
              buf,
              r.filtroPagador
                ? { cnpj: r.filtroPagador.cnpj ?? "", nome: r.filtroPagador.nome ?? "" }
                : undefined,
            );
            enfBeneficiarios += res.enfermaria.beneficiarios;
            enfTotal += res.enfermaria.total;
            aptBeneficiarios += res.apartamento.beneficiarios;
            aptTotal += res.apartamento.total;
            inclusoesTotal += res.inclusoes?.total || 0;
            exclusoesTotal += res.exclusoes?.total || 0;
            detalhes.push(res);
          }
          resultado[r.rowKey] = {
            loading: false,
            enfBeneficiarios,
            enfTotal,
            aptBeneficiarios,
            aptTotal,
            inclusoesTotal,
            exclusoesTotal,
            totalGeral: enfTotal + aptTotal + inclusoesTotal + exclusoesTotal,
            detalhe: detalhes,
          };
        } catch (e: any) {
          resultado[r.rowKey] = {
            ...EMPTY_ANALISE,
            erro: e?.message || "Falha ao analisar planilha",
          };
        } finally {
          done++;
          if (!cancelled) setProgresso({ done, total: alvos.length });
        }
      };

      // Concorrência limitada para não saturar a rede
      const CONC = 6;
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONC, alvos.length) }, async () => {
        while (!cancelled) {
          const i = cursor++;
          if (i >= alvos.length) break;
          await processar(alvos[i]);
        }
      });
      await Promise.all(workers);
      if (cancelled) return;
      setAnalises(resultado);
      setProgresso({ done: alvos.length, total: alvos.length });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows, aplicado]);


  // KPIs respeitam o período escolhido; antes disso permanecem zerados.
  const kpis = useMemo(() => {
    let totalPrevisto = 0;
    let venceHoje = 0;
    let vencidos = 0;
    let comProrrogacao = 0;
    for (const r of filteredRows) {
      totalPrevisto += analises[r.rowKey]?.totalGeral ?? 0;
      const venc = parseLocalDate(r.data_vencimento);
      if (venc) {
        const dias = diffDias(venc, hoje);
        if (dias === 0) venceHoje++;
        else if (dias < 0) vencidos++;
      }
      if (r.possui_prorrogacao) comProrrogacao++;
    }
    return {
      totalPrevisto,
      notasEmitidas: filteredRows.filter((r) => r.nota_emitida).length,
      venceHoje,
      vencidos,
      comProrrogacao,
    };
  }, [filteredRows, analises, hoje]);

  function rowStatus(r: AnaliseRow): { label: string; variant: "default" | "destructive" | "secondary" | "outline"; cls: string } {
    const venc = parseLocalDate(r.data_vencimento);
    if (!venc) return { label: "Sem vencimento", variant: "outline", cls: "" };
    const dias = diffDias(venc, hoje);
    if (dias < 0) return { label: `Vencida há ${Math.abs(dias)}d`, variant: "destructive", cls: "bg-destructive/10 text-destructive border-destructive/30" };
    if (dias === 0) return { label: "Vence hoje", variant: "default", cls: "bg-warning/15 text-warning-foreground border-warning/40" };
    return { label: `Em ${dias}d`, variant: "secondary", cls: "" };
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Previsão financeira
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Empresas com vencimento no período — valores disponíveis são extraídos da planilha.
            </p>
          </div>
        </div>

        {/* KPIs internos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-3">
          <MiniKpi label="Total previsto" value={BRL(kpis.totalPrevisto)} icon={Wallet} accent="text-success" bg="bg-success/10" />
          <MiniKpi label="Notas emitidas" value={kpis.notasEmitidas.toString()} icon={FileText} accent="text-primary" bg="bg-primary/10" />
          <MiniKpi label="Vencendo hoje" value={kpis.venceHoje.toString()} icon={CalendarClock} accent="text-warning" bg="bg-warning/10" />
          <MiniKpi label="Vencidos" value={kpis.vencidos.toString()} icon={AlertOctagon} accent="text-destructive" bg="bg-destructive/10" />
          <MiniKpi label="Com prorrogação" value={kpis.comProrrogacao.toString()} icon={Timer} accent="text-info" bg="bg-info/10" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Select value={filtroPeriodo} onValueChange={(v: any) => setFiltroPeriodo(v)}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Período: Todos</SelectItem>
              <SelectItem value="hoje">Vencimento: Hoje</SelectItem>
              <SelectItem value="7">Próximos 7 dias</SelectItem>
              <SelectItem value="15">Próximos 15 dias</SelectItem>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="custom">Data específica (intervalo)</SelectItem>
            </SelectContent>
          </Select>
          {filtroPeriodo === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 w-[140px] text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 w-[140px] text-xs"
              />
            </div>
          )}
          <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: Todos</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="hoje">Vence hoje</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Ordenar: Data mais próxima</SelectItem>
              <SelectItem value="valor">Ordenar: Maior valor</SelectItem>
              <SelectItem value="empresa">Ordenar: Empresa A-Z</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!filtroPeriodo || (filtroPeriodo === "custom" && (!dataInicio || !dataFim))}
            onClick={() =>
              setAplicado({ periodo: filtroPeriodo, inicio: dataInicio, fim: dataFim, status: filtroStatus })
            }
          >
            Confirmar
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            <strong className="text-foreground">{filteredRows.length}</strong> registro{filteredRows.length === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        {carregando ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Carregando previsão financeira…</p>
            <p className="text-xs text-muted-foreground">
              {progresso && progresso.total > 0
                ? `Analisando planilhas ${progresso.done} de ${progresso.total}`
                : "Buscando movimentações e anexos"}
            </p>
            {progresso && progresso.total > 0 && (
              <div className="h-1.5 w-64 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round((progresso.done / progresso.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhuma empresa com vencimento encontrada para previsão financeira.
          </p>
        ) : (

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium">Pagador</th>
                  <th className="px-3 py-2 text-left font-medium">Competência</th>
                  <th className="px-3 py-2 text-right font-medium">Benef. Enf.</th>
                  <th className="px-3 py-2 text-right font-medium">Mensalidade Enf.</th>
                  <th className="px-3 py-2 text-right font-medium">Benef. Apto.</th>
                  <th className="px-3 py-2 text-right font-medium">Mensalidade Apto.</th>
                  <th className="px-3 py-2 text-right font-medium">Inclusões</th>
                  <th className="px-3 py-2 text-right font-medium">Exclusões</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-left font-medium">Vencimento original</th>
                  <th className="px-3 py-2 text-left font-medium">Prorrogação</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const a = analises[r.rowKey];
                  const st = rowStatus(r);
                  const venc = parseLocalDate(r.data_vencimento);
                  const dias = venc ? diffDias(venc, hoje) : null;
                  const isOpen = !!expanded[r.rowKey];
                  const rowCls = cn(
                    "border-b transition-colors hover:bg-accent/30",
                    dias !== null && dias < 0 && "bg-destructive/5",
                    dias === 0 && "bg-warning/5",
                  );
                  return (
                    <Fragment key={r.rowKey}>
                      <tr className={rowCls}>
                        <td className="px-2 py-2 align-top">
                          <button
                            onClick={() => setExpanded((p) => ({ ...p, [r.rowKey]: !p[r.rowKey] }))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Expandir"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-foreground">{r.empresa_nome}</div>
                          {r.pagador_cnpj && (
                            <div className="text-[11px] text-muted-foreground">{r.pagador_cnpj}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {r.pagador_nome ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top">{formatMesReferencia(r.competencia)}</td>
                        <td className="px-3 py-2 align-top text-right tabular-nums">
                          {a?.loading ? "…" : a && a.enfBeneficiarios > 0 ? a.enfBeneficiarios : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums">
                          {a?.loading ? "…" : a && a.enfTotal > 0 ? BRL(a.enfTotal) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums">
                          {a?.loading ? "…" : a && a.aptBeneficiarios > 0 ? a.aptBeneficiarios : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums">
                          {a?.loading ? "…" : a && a.aptTotal > 0 ? BRL(a.aptTotal) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums">
                          {a?.loading ? "…" : a && a.inclusoesTotal > 0 ? BRL(a.inclusoesTotal) : "—"}
                        </td>
                        <td className={cn(
                          "px-3 py-2 align-top text-right tabular-nums",
                          a && a.exclusoesTotal !== 0 && "text-destructive font-medium",
                        )}>
                          {a?.loading
                            ? "…"
                            : a && a.exclusoesTotal !== 0
                              ? `− ${BRL(Math.abs(a.exclusoesTotal))}`
                              : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right tabular-nums font-semibold text-success">
                          {a?.loading ? "…" : a && a.totalGeral !== 0 ? BRL(a.totalGeral) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {r.data_vencimento ? formatDateBR(r.data_vencimento) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {r.possui_prorrogacao && r.data_prorrogacao ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground">{formatDateBR(r.data_prorrogacao)}</span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 w-fit border-info/40 text-info">
                                Prorrogado
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant="outline" className={cn("text-[11px]", st.cls)}>
                            {st.label}
                          </Badge>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20 border-b">
                          <td></td>
                          <td colSpan={14} className="px-4 py-3">
                            <DetalheAnalise dado={a} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {!aplicado
                        ? "Selecione o período e clique em Confirmar para visualizar os registros."
                        : aplicado.status && aplicado.status !== "todos"
                          ? "Nenhum registro para os filtros selecionados. Dica: o filtro de Status pode estar excluindo notas já vencidas — tente Status: Todos."
                          : "Nenhum registro para os filtros selecionados."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value, icon: Icon, accent, bg }: { label: string; value: string; icon: any; accent: string; bg: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5 flex items-center gap-2.5">
      <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold tabular-nums text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function DetalheAnalise({ dado }: { dado?: AnaliseDado }) {
  if (!dado) return <p className="text-xs text-muted-foreground">Aguardando análise…</p>;
  if (dado.loading) return <p className="text-xs text-muted-foreground">Analisando planilha…</p>;
  if (dado.erro) return <p className="text-xs text-destructive">{dado.erro}</p>;
  const det = (dado.detalhe ?? []) as any[];
  if (det.length === 0)
    return <p className="text-xs text-muted-foreground">Sem detalhamento disponível.</p>;
  return (
    <div className="space-y-2">
      {det.map((r, i) => (
        <div key={i} className="rounded-md border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Linha k="Enfermaria — Beneficiários" v={r.enfermaria.beneficiarios} />
            <Linha k="Enfermaria — Mensalidade" v={BRL(r.enfermaria.mensalidade)} />
            <Linha k="Enfermaria — Total" v={BRL(r.enfermaria.total)} />
            <Linha k="Apartamento — Beneficiários" v={r.apartamento.beneficiarios} />
            <Linha k="Apartamento — Mensalidade" v={BRL(r.apartamento.mensalidade)} />
            <Linha k="Apartamento — Total" v={BRL(r.apartamento.total)} />
            <Linha k="Inclusões — Qtd" v={r.inclusoes?.quantidade ?? 0} />
            <Linha k="Inclusões — Total" v={BRL(r.inclusoes?.total ?? 0)} />
            {r.exclusoes && (r.exclusoes.quantidade > 0 || r.exclusoes.total !== 0) && (
              <>
                <Linha k="Exclusões — Qtd" v={r.exclusoes.quantidade ?? 0} />
                <Linha
                  k="Exclusões — Total"
                  v={
                    <span className="text-destructive">
                      {r.exclusoes.total < 0 ? `− ${BRL(Math.abs(r.exclusoes.total))}` : BRL(r.exclusoes.total)}
                    </span>
                  }
                />
              </>
            )}
          </div>
          {r.avisos?.length ? (
            <ul className="mt-2 list-disc list-inside text-[11px] text-warning">
              {r.avisos.map((a: string, j: number) => (
                <li key={j}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
      <p className="font-semibold text-foreground tabular-nums">{v}</p>
    </div>
  );
}
