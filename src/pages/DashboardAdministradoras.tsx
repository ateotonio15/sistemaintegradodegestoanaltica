import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Users, CalendarClock, FileSignature, ArrowLeftRight, Search, Paperclip, FileSpreadsheet, TrendingUp, TrendingDown, Scale, RefreshCw, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateBR, todayLocalISO } from "@/lib/date-utils";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";
import { sincronizarEnvioDosAnexos } from "@/lib/movimentacao-envio-anexos";
import { AnexosViewerDialog } from "@/components/dashboard/AnexosViewerDialog";
import { ImportarAdministradorasDialog } from "@/components/dashboard/ImportarAdministradorasDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { computeEntradasSaidas, type EmpresaEntradaSaida } from "@/lib/entradas-saidas-analyzer";
import { conferirInclusoesEmpresa } from "@/lib/inclusoes-vigencia-conferencia";
import { lerVidasRelatorio, compararVidas, type ComparacaoVidas } from "@/lib/vidas-contrato-comparacao";
import { gerarRelatorioPortal } from "@/services/portalEmpresaRelatorios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { labelStatusFinanceiro, statusFinanceiroColor, type StatusFinanceiro } from "@/lib/financeiro-utils";

type Empresa = Tables<"empresas">;
type Movimentacao = Tables<"movimentacoes">;

const CORTE_OPTIONS = [1, 5, 10, 20] as const;

function getPeriodoAdministradora(empresa: Empresa): string {
  if (empresa.data_corte) return periodoDaDataCorte(empresa.data_corte);
  return "01-05";
}

function nextCorteDate(dia: number): Date {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const candidate = new Date(y, m, dia);
  if (candidate < new Date(y, m, today.getDate())) {
    return new Date(y, m + 1, dia);
  }
  return candidate;
}

export default function DashboardAdministradoras() {
  const [search, setSearch] = useState("");
  const [corteFilter, setCorteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [implFilter, setImplFilter] = useState<string>("all");
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [editEnvio, setEditEnvio] = useState<string>("");
  const [anexosViewer, setAnexosViewer] = useState<{ empresa: Empresa; periodo: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { isAdmin, isComum } = useAuth();
  const queryClient = useQueryClient();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-administradoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("tipo_contrato", "ADMINISTRADORA")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const empresaIds = useMemo(() => empresas.map((e) => e.id), [empresas]);

  // Mês/Ano selecionados
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const mesRef = useMemo(() => `${ano}-${String(mes).padStart(2, "0")}`, [ano, mes]);

  const { data: movsMes = [] } = useQuery({
    queryKey: ["movs-administradoras", mesRef, empresaIds.join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .in("empresa_id", empresaIds)
        .eq("mes_referencia", mesRef);
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: empresaIds.length > 0,
  });

  const movsPorEmpresa = useMemo(() => {
    const map: Record<string, Movimentacao> = {};
    for (const mov of movsMes) {
      const current = map[mov.empresa_id];
      if (!current) {
        map[mov.empresa_id] = mov;
        continue;
      }
      const score = (m: Movimentacao) =>
        (m.data_envio_financeiro ? 1_000_000_000 : 0) + new Date(m.created_at).getTime();
      if (score(mov) > score(current)) map[mov.empresa_id] = mov;
    }
    return map;
  }, [movsMes]);

  const movIds = useMemo(() => movsMes.map((m) => m.id), [movsMes]);

  const { data: anexosCount = {} } = useQuery({
    queryKey: ["anexos-count-administradoras", mesRef, movIds.join(","), empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const counts: Record<string, number> = {};

      // 1) Anexos vinculados a movimentacoes (cadastro)
      if (movIds.length > 0) {
        const { data: anxMov, error: errMov } = await supabase
          .from("anexos_movimentacao")
          .select("movimentacao_id")
          .in("movimentacao_id", movIds);
        if (errMov) throw errMov;
        const movToEmpresa: Record<string, string> = {};
        for (const m of movsMes) movToEmpresa[m.id] = m.empresa_id;
        (anxMov ?? []).forEach((a: any) => {
          const empId = movToEmpresa[a.movimentacao_id];
          if (empId) counts[empId] = (counts[empId] ?? 0) + 1;
        });
      }

      // 2) Anexos vinculados a financeiro_movimentacoes (financeiro/nota)
      const { data: finMovs, error: errFin } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id")
        .in("empresa_id", empresaIds)
        .eq("mes_referencia", mesRef);
      if (errFin) throw errFin;
      const finIds = (finMovs ?? []).map((f: any) => f.id);
      const finToEmpresa: Record<string, string> = {};
      (finMovs ?? []).forEach((f: any) => { finToEmpresa[f.id] = f.empresa_id; });
      if (finIds.length > 0) {
        const { data: anxFin, error: errAnxFin } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id")
          .in("financeiro_movimentacao_id", finIds);
        if (errAnxFin) throw errAnxFin;
        (anxFin ?? []).forEach((a: any) => {
          const empId = finToEmpresa[a.financeiro_movimentacao_id];
          if (empId) counts[empId] = (counts[empId] ?? 0) + 1;
        });
      }

      return counts;
    },
  });

  // Nota enviada (financeiro) por empresa para o mês de referência
  const { data: notaEnviadaPorEmpresa = {} } = useQuery({
    queryKey: ["fin-nota-administradoras", mesRef, empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, data_envio_nota, created_at")
        .in("empresa_id", empresaIds)
        .eq("mes_referencia", mesRef)
        .not("data_envio_nota", "is", null);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        const cur = map[r.empresa_id];
        if (!cur || (r.data_envio_nota && r.data_envio_nota > cur)) {
          map[r.empresa_id] = r.data_envio_nota;
        }
      });
      return map;
    },
  });

  // Status de faturamento (mesma regra da aba Faturamento) via RPC SECURITY DEFINER
  type FinStatusInfo = { status: StatusFinanceiro; faturamento_por: string | null };
  const { data: finStatusMap = new Map<string, FinStatusInfo>() } = useQuery({
    queryKey: ["fin-status-administradoras", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("status_faturamento_competencia", { p_mes: mesRef });
      if (error) throw error;
      const m = new Map<string, FinStatusInfo>();
      for (const r of (data ?? []) as Array<{
        empresa_id: string;
        periodo: string | null;
        status: string;
        faturamento_por: string | null;
      }>) {
        m.set(`${r.empresa_id}|${r.periodo}`, {
          status: r.status as StatusFinanceiro,
          faturamento_por: r.faturamento_por ?? null,
        });
      }
      return m;
    },
  });

  // Atualização em tempo real do status vindo da aba Faturamento
  useEffect(() => {
    const channel = supabase
      .channel("administradoras-financeiro-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fin-status-administradoras"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos_financeiro" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fin-status-administradoras"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);



  // Histórico de entradas/saídas para o mês selecionado
  const { data: historicoMes = [] } = useQuery({
    queryKey: ["vidas-historico-adm", mesRef, empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidas_historico_administradoras")
        .select("*")
        .eq("mes_referencia", mesRef)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Histórico dos últimos 6 meses (gráfico evolução)
  const ultimos6 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, [ano, mes]);

  const { data: historico6 = [] } = useQuery({
    queryKey: ["vidas-historico-adm-6", ultimos6.join(","), empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidas_historico_administradoras")
        .select("mes_referencia, entradas, saidas, total_atual")
        .in("mes_referencia", ultimos6)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Inclusões por Vigência (somente leitura) — atribuídas pelo mês do fechamento
  const { data: inclusoesVig = [] } = useQuery({
    queryKey: ["inclusoes-vigencia-adm", ultimos6.join(","), empresaIds.join(",")],
    enabled: empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inclusoes_vigencia")
        .select("id, empresa_id, cpf, beneficiario_nome, data_adesao, data_identificacao, origem, status, fechamento_id, movimentacoes!inner(mes_referencia, periodo)")
        .in("empresa_id", empresaIds)
        .in("movimentacoes.mes_referencia", ultimos6)
        .order("data_identificacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const vigValidas = useMemo(() => inclusoesVig.filter((i) => i.status !== "divergencia_data_adesao"), [inclusoesVig]);
  const vigPorEmpresaMes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of vigValidas) if (i.movimentacoes?.mes_referencia === mesRef) m[i.empresa_id] = (m[i.empresa_id] ?? 0) + 1;
    return m;
  }, [vigValidas, mesRef]);
  const vigPorMes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of vigValidas) { const k = i.movimentacoes?.mes_referencia; if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
  }, [vigValidas]);
  const totalVigMes = useMemo(() => Object.values(vigPorEmpresaMes).reduce((s, n) => s + n, 0), [vigPorEmpresaMes]);
  const [vigOpen, setVigOpen] = useState(false);

  const entradasSaidasPorEmpresa = useMemo(() => {
    const map: Record<string, EmpresaEntradaSaida> = {};
    for (const h of historicoMes as any[]) {
      map[h.empresa_id] = {
        empresa_id: h.empresa_id,
        entradas: h.entradas,
        saidas: h.saidas,
        total_atual: h.total_atual,
        total_anterior: h.total_anterior,
      };
    }
    return map;
  }, [historicoMes]);

  const totalEntradas = useMemo(
    () => Object.values(entradasSaidasPorEmpresa).reduce((s, e) => s + e.entradas, 0),
    [entradasSaidasPorEmpresa]
  );
  const totalSaidas = useMemo(
    () => Object.values(entradasSaidasPorEmpresa).reduce((s, e) => s + e.saidas, 0),
    [entradasSaidasPorEmpresa]
  );
  const entradasConsolidadas = totalEntradas + totalVigMes;
  const saldoVidas = entradasConsolidadas - totalSaidas;

  const evolucaoChart = useMemo(() => {
    const grouped: Record<string, { mes: string; entradas: number; saidas: number; total: number }> = {};
    for (const m of ultimos6) {
      const [y, mm] = m.split("-");
      grouped[m] = { mes: `${mm}/${y.slice(2)}`, entradas: vigPorMes[m] ?? 0, fechamento: 0, vigencia: vigPorMes[m] ?? 0, saidas: 0, total: 0 } as any;
    }
    for (const h of historico6 as any[]) {
      if (!grouped[h.mes_referencia]) continue;
      grouped[h.mes_referencia].entradas += h.entradas;
      (grouped[h.mes_referencia] as any).fechamento += h.entradas;
      grouped[h.mes_referencia].saidas += h.saidas;
      grouped[h.mes_referencia].total += h.total_atual;
    }
    return Object.values(grouped);
  }, [ultimos6, historico6, vigPorMes]);

  const [calculando, setCalculando] = useState(false);
  const [progressoCalc, setProgressoCalc] = useState<{ done: number; total: number } | null>(null);
  const [resumoCalc, setResumoCalc] = useState<{ entradas: number; novas: number; divergencias: number; saidas: number; falhas: number } | null>(null);
  const handleCalcular = async () => {
    if (empresaIds.length === 0) return;
    setCalculando(true);
    setProgressoCalc({ done: 0, total: empresaIds.length });
    try {
      const res = await computeEntradasSaidas(empresaIds, mesRef, (done, total) => {
        setProgressoCalc({ done, total });
      });
      // Conferência de Inclusões por Vigência (não altera o resultado original do fechamento)
      let novas = 0, divergencias = 0, falhas = 0;
      setProgressoCalc({ done: 0, total: empresaIds.length });
      for (let i = 0; i < empresaIds.length; i++) {
        try {
          const r = await conferirInclusoesEmpresa(empresaIds[i]);
          novas += r.novas; divergencias += r.divergencias;
        } catch (err) { falhas++; console.warn("Conferência de inclusões falhou", err); }
        setProgressoCalc({ done: i + 1, total: empresaIds.length });
      }
      setResumoCalc({
        entradas: res.reduce((s, r) => s + r.entradas, 0),
        saidas: res.reduce((s, r) => s + r.saidas, 0),
        novas, divergencias, falhas,
      });
      queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm"] });
      queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm-6"] });
      queryClient.invalidateQueries({ queryKey: ["inclusoes-vigencia-adm"] });
    } catch (e: any) {
      toast.error("Erro ao calcular: " + (e?.message ?? String(e)));
    } finally {
      setCalculando(false);
      setProgressoCalc(null);
    }
  };

  const [vidasContrato, setVidasContrato] = useState<{ empresa: Empresa; carregando: boolean; erro?: string; arquivoPeriodo?: string; arquivoAtual?: string; res?: ComparacaoVidas } | null>(null);
  const recalcularVidasContrato = async (empresa: Empresa) => {
    setVidasContrato({ empresa, carregando: true });
    try {
      const { data: arqs, error } = await supabase.from("envios_empresa_arquivos")
        .select("bucket, storage_path, nome_arquivo, versao")
        .eq("empresa_id", empresa.id).eq("competencia", mesRef)
        .order("versao", { ascending: true });
      if (error) throw error;
      const doPeriodo = (arqs ?? []).find((a: any) => /\.xlsx?$/i.test(a.nome_arquivo));
      if (!doPeriodo) throw new Error("Não há relatório de vidas (Excel) deste contrato no Repositório de Envios para o mês escolhido.");
      const { data: blobPer, error: e2 } = await supabase.storage.from(doPeriodo.bucket).download(doPeriodo.storage_path);
      if (e2 || !blobPer) throw new Error("Não foi possível abrir o relatório do período.");
      const atual = await gerarRelatorioPortal(empresa.codigo_contrato, "xlsx", new AbortController().signal);
      const res = compararVidas(lerVidasRelatorio(await blobPer.arrayBuffer()), lerVidasRelatorio(await atual.blob.arrayBuffer()));
      setVidasContrato({ empresa, carregando: false, arquivoPeriodo: doPeriodo.nome_arquivo, arquivoAtual: atual.nome_arquivo, res });
    } catch (e: any) {
      setVidasContrato({ empresa, carregando: false, erro: e?.message ?? String(e) });
    }
  };

  const recomputeEmpresa = async (empresaId: string) => {
    await computeEntradasSaidas([empresaId], mesRef);
    queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm"] });
    queryClient.invalidateQueries({ queryKey: ["vidas-historico-adm-6"] });
  };


  const ativas = useMemo(() => empresas.filter((e) => e.status_empresa === "Ativa"), [empresas]);
  const totalVidas = useMemo(() => ativas.reduce((s, e) => s + (e.vidas ?? 0), 0), [ativas]);
  const implantadas = useMemo(() => ativas.filter((e) => !!e.data_implantacao), [ativas]);
  const aguardando = useMemo(() => ativas.filter((e) => !e.data_implantacao), [ativas]);

  const movsPendentes = useMemo(
    () => movsMes.filter((m) => !m.data_envio_financeiro),
    [movsMes]
  );

  const proximoFechamento = useMemo(() => {
    const datas = ativas
      .filter((e) => CORTE_OPTIONS.includes((e.data_corte ?? 0) as 1 | 5 | 10 | 20))
      .map((e) => nextCorteDate(e.data_corte!));
    if (datas.length === 0) return null;
    return new Date(Math.min(...datas.map((d) => d.getTime())));
  }, [ativas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return empresas
      .filter((e) => statusFilter === "all" ? true : e.status_empresa === statusFilter)
      .filter((e) => corteFilter === "all" ? true : String(e.data_corte ?? "") === corteFilter)
      .filter((e) => {
        if (implFilter === "all") return true;
        if (implFilter === "implantada") return !!e.data_implantacao;
        return !e.data_implantacao;
      })
      .filter((e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.codigo_contrato ?? "").toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q)
      );
  }, [empresas, search, corteFilter, statusFilter, implFilter]);

  const proximosFechamentosPorCorte = useMemo(() => {
    const groups: Record<number, Empresa[]> = {};
    for (const e of ativas) {
      const d = e.data_corte ?? 0;
      if (!CORTE_OPTIONS.includes(d as 1 | 5 | 10 | 20)) continue;
      groups[d] = groups[d] || [];
      groups[d].push(e);
    }
    return groups;
  }, [ativas]);

  const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const anosOpcoes = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  const ALERTA_LIMITE = 50; // alerta para variações > 50 vidas
  const variacaoAlerta = Math.abs(saldoVidas) >= ALERTA_LIMITE;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Administradoras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão exclusiva dos contratos de administradoras
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[150px] rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((n, i) => (
                <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px] rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosOpcoes.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(isAdmin || isComum) && (
            <Button variant="outline" onClick={handleCalcular} disabled={calculando} className="rounded-lg">
              <RefreshCw className={`mr-2 h-4 w-4 ${calculando ? "animate-spin" : ""}`} />
              {calculando && progressoCalc
                ? `Calculando ${progressoCalc.done}/${progressoCalc.total}...`
                : "Recalcular Entradas/Saídas"}
            </Button>
          )}
          {(isAdmin || isComum) && (
            <Button onClick={() => setImportOpen(true)} className="rounded-lg">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Importar Administradoras
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!resumoCalc} onOpenChange={(o) => !o && setResumoCalc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recálculo concluído</DialogTitle></DialogHeader>
          {resumoCalc && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Entradas dos fechamentos</span><strong>{resumoCalc.entradas}</strong></div>
              <div className="flex justify-between"><span>Novas inclusões por vigência</span><strong className="text-primary">+{resumoCalc.novas}</strong></div>
              <div className="flex justify-between"><span>Saídas</span><strong>{resumoCalc.saidas}</strong></div>
              <div className="flex justify-between border-t pt-2"><span>Entradas consolidadas</span><strong>{resumoCalc.entradas + resumoCalc.novas}</strong></div>
              {resumoCalc.divergencias > 0 && (
                <p className="rounded-md bg-muted p-2 text-muted-foreground">{resumoCalc.divergencias} com Divergência na Data de Adesão — conferir manualmente.</p>
              )}
              {resumoCalc.falhas > 0 && (
                <p className="text-destructive">Não foi possível conferir {resumoCalc.falhas} empresa(s).</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={vigOpen} onOpenChange={setVigOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Inclusões por vigência</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Beneficiários encontrados depois, cuja data de adesão pertence a um fechamento já feito. É uma atualização normal de consolidação.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beneficiário</TableHead><TableHead>CPF</TableHead><TableHead>Adesão</TableHead>
                <TableHead>Identificado</TableHead><TableHead>Empresa</TableHead><TableHead>Fechamento</TableHead><TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inclusoesVig.map((i) => {
                const emp = empresas.find((x) => x.id === i.empresa_id);
                const mr = i.movimentacoes?.mes_referencia as string | undefined;
                const div = i.status === "divergencia_data_adesao";
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.beneficiario_nome || "—"}</TableCell>
                    <TableCell className="tabular-nums">***.***.***-{String(i.cpf).slice(-2)}</TableCell>
                    <TableCell>{formatDateBR(i.data_adesao)}</TableCell>
                    <TableCell>{formatDateBR(i.data_identificacao)}</TableCell>
                    <TableCell className="text-sm">{emp?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {mr ? `${mr.slice(5)}/${mr.slice(0, 4)}` : "—"}{i.movimentacoes?.periodo ? ` · ${i.movimentacoes.periodo}` : ""}
                      {div && <Badge variant="outline" className="ml-1 border-amber-500/40 text-amber-600">Divergência na Data de Adesão</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-success/10 text-success">{i.origem}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
      <Dialog open={!!vidasContrato} onOpenChange={(o) => !o && setVidasContrato(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Recalcular vidas — {vidasContrato?.empresa.codigo_contrato} {vidasContrato?.empresa.nome}</DialogTitle></DialogHeader>
          {vidasContrato?.carregando && <p className="text-sm text-muted-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Buscando o relatório atualizado no sistema interno...</p>}
          {vidasContrato?.erro && <p className="text-sm text-destructive">{vidasContrato.erro}</p>}
          {vidasContrato?.res && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Vidas no período</p><p className="text-lg font-bold">{vidasContrato.res.periodo}</p></div>
                <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Vidas atualizado</p><p className="text-lg font-bold">{vidasContrato.res.atualizado}</p></div>
                <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Entradas</p><p className="text-lg font-bold text-success">+{vidasContrato.res.entradas.length}</p></div>
                <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Saídas</p><p className="text-lg font-bold text-destructive">-{vidasContrato.res.saidas.length}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">Período: {vidasContrato.arquivoPeriodo} • Atualizado: {vidasContrato.arquivoAtual}</p>
              {[["Entraram", vidasContrato.res.entradas, "text-success"], ["Saíram", vidasContrato.res.saidas, "text-destructive"]].map(([t, lista, cor]: any) => lista.length > 0 && (
                <div key={t}>
                  <p className={`font-semibold ${cor}`}>{t} ({lista.length})</p>
                  <ul className="mt-1 max-h-48 overflow-y-auto rounded border divide-y">
                    {lista.map((v: any) => (
                      <li key={v.chave} className="flex justify-between px-2 py-1">
                        <span>{v.nome ?? "—"}</span>
                        <span className="tabular-nums text-muted-foreground">{v.cpf ? `***.***.***-${v.cpf.slice(-2)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Só consulta: nenhum número do fechamento foi alterado.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ImportarAdministradorasDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Alerta de variação grande */}
      {variacaoAlerta && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${saldoVidas > 0 ? "border-success/40 bg-success/5 text-success" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
          <AlertTriangle className="h-5 w-5" />
          <div className="text-sm">
            <span className="font-semibold">
              {saldoVidas > 0 ? "Crescimento significativo de vidas" : "Redução significativa de vidas"}
            </span>{" "}
            no mês ({saldoVidas > 0 ? "+" : ""}{saldoVidas}).
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Total Administradoras" value={ativas.length} />
        <KpiCard icon={Users} label="Total Vidas" value={totalVidas.toLocaleString("pt-BR")} />
        <KpiCard icon={CalendarClock} label="Próximo Fechamento" value={proximoFechamento ? formatDateBR(proximoFechamento.toISOString().slice(0, 10)) : "—"} highlight />
        <KpiCard icon={ArrowLeftRight} label="Movimentações do Mês" value={movsMes.length} accent="amber" />
      </div>

      {/* KPI Entradas / Saídas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Entradas do Mês"
          value={`+${entradasConsolidadas}`}
          accent="success"
          sub={
            <span>
              {totalEntradas} fechamento • <span className="text-success font-medium">+{totalVigMes} vigência</span>
              {inclusoesVig.length > 0 && (
                <button type="button" onClick={() => setVigOpen(true)} className="ml-1 underline-offset-2 hover:underline text-primary">Ver inclusões por vigência</button>
              )}
            </span>
          }
        />
        <KpiCard icon={TrendingDown} label="Saídas do Mês" value={`-${totalSaidas}`} accent="destructive" />
        <KpiCard icon={Scale} label="Saldo de Vidas" value={`${saldoVidas > 0 ? "+" : ""}${saldoVidas}`} accent={saldoVidas >= 0 ? "success" : "destructive"} />
        <KpiCard icon={FileSignature} label="Contratos Pendentes" value={aguardando.length} />
      </div>

      {/* Gráfico Evolução */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Evolução — Entradas x Saídas (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolucaoChart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-popover p-2 text-xs shadow-sm space-y-0.5">
                    <p className="font-semibold">{label}</p>
                    <p>Entradas consolidadas: <strong>{d.entradas}</strong></p>
                    <p className="text-muted-foreground">Fechamento: {d.fechamento}</p>
                    <p className="text-success">Inclusões por vigência: {d.vigencia}</p>
                    <p className="text-destructive">Saídas: {d.saidas}</p>
                  </div>
                );
              }} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top row: Pending alert + Schedules (horizontal) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="rounded-xl border-primary/30 bg-primary/5 relative overflow-hidden lg:col-span-1">
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Movimentações Pendentes
              </h4>
            </div>
            {movsPendentes.length === 0 ? (
              <>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma pendência neste mês.</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">{movsPendentes.length} pendência{movsPendentes.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">
                  — {mesRef}. Aguardando envio ao financeiro.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5" />
              Próximos Fechamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CORTE_OPTIONS.map((dia) => {
                const list = proximosFechamentosPorCorte[dia] ?? [];
                const has = list.length > 0;
                const isActive = corteFilter === String(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setCorteFilter(isActive ? "all" : String(dia))}
                    className={`text-left flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isActive
                        ? "bg-primary/20 border-primary ring-1 ring-primary"
                        : has
                          ? "bg-primary/10 border-primary/20 hover:bg-primary/15"
                          : "bg-accent/10 border-border/40 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Dia {String(dia).padStart(2, "0")}
                      </p>
                      <p className={`text-sm font-semibold ${has ? "text-foreground" : "text-muted-foreground"}`}>
                        {has ? `${list.length} contrato${list.length > 1 ? "s" : ""}` : "Nenhuma"}
                      </p>
                    </div>
                    {has && <span className={`w-1 h-8 rounded-full ${isActive ? "bg-primary" : "bg-primary/70"}`} />}
                  </button>
                );
              })}
            </div>
            {corteFilter !== "all" && (
              <button
                type="button"
                onClick={() => setCorteFilter("all")}
                className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-accent/30 transition-colors"
              >
                Limpar filtro
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table (full width) */}
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, código ou CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-lg"
                />
              </div>
              <Select value={corteFilter} onValueChange={setCorteFilter}>
                <SelectTrigger className="w-[160px] rounded-lg"><SelectValue placeholder="Período corte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cortes</SelectItem>
                  {CORTE_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>Dia {String(d).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={implFilter} onValueChange={setImplFilter}>
                <SelectTrigger className="w-[180px] rounded-lg"><SelectValue placeholder="Implantação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas implantações</SelectItem>
                  <SelectItem value="implantada">Implantadas</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Contratos <span className="text-muted-foreground font-normal ml-1">({filtered.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-accent/20 hover:bg-accent/20">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">Código</TableHead>
                      <TableHead className="font-semibold text-center">Vidas Ativas</TableHead>
                      <TableHead className="font-semibold text-center">Entradas</TableHead>
                      <TableHead className="font-semibold text-center">Saídas</TableHead>
                      <TableHead className="font-semibold">Corte</TableHead>
                      <TableHead className="font-semibold">Implantação</TableHead>
                      <TableHead className="font-semibold">Enviado Financ.</TableHead>
                      <TableHead className="font-semibold">Nota Enviada</TableHead>
                      <TableHead className="font-semibold text-center">Anexos</TableHead>
                      <TableHead className="font-semibold text-right">Status Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Nenhuma administradora encontrada</TableCell></TableRow>
                    ) : (
                      filtered.map((e) => {
                        const mov = movsPorEmpresa[e.id];
                        const enviado = !!mov?.data_envio_financeiro;
                        const qtdAnexos = anexosCount[e.id] ?? 0;
                        const periodoFin = mov?.periodo ?? getPeriodoAdministradora(e);
                        const finInfo = finStatusMap.get(`${e.id}|${periodoFin}`) ?? null;
                        const es = entradasSaidasPorEmpresa[e.id];
                        const vig = vigPorEmpresaMes[e.id] ?? 0;
                        return (
                        <TableRow
                          key={e.id}
                          className="hover:bg-accent/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedEmpresa(e);
                            setEditEnvio(mov?.data_envio_financeiro ?? "");
                          }}
                        >
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell className="text-sm">{e.codigo_contrato || "—"}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            <div className="flex items-center justify-center gap-1">
                              {(e.vidas ?? 0).toLocaleString("pt-BR")}
                              <button
                                type="button"
                                title="Recalcular vidas do contrato (período x atualizado)"
                                className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={(ev) => { ev.stopPropagation(); recalcularVidasContrato(e); }}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {es || vig ? (() => {
                              const ent = (es?.entradas ?? 0) + vig;
                              return (
                                <div className="flex flex-col items-center leading-tight" title={vig ? `${es?.entradas ?? 0} fechamento + ${vig} vigência` : undefined}>
                                  <span className={ent > 0 ? "text-success font-semibold" : "text-muted-foreground"}>{ent > 0 ? `+${ent}` : "0"}</span>
                                  {vig > 0 && <span className="text-[10px] text-muted-foreground">{es?.entradas ?? 0} fech. <span className="text-success">+{vig} vig.</span></span>}
                                </div>
                              );
                            })() : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {es ? (
                              <span className={es.saidas > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                {es.saidas > 0 ? `-${es.saidas}` : "0"}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {e.data_corte ? (
                              <Badge variant="secondary" className="rounded-md">Dia {String(e.data_corte).padStart(2, "0")}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{e.data_implantacao ? formatDateBR(e.data_implantacao) : <Badge variant="outline" className="rounded-md">Aguardando</Badge>}</TableCell>
                          <TableCell>
                            {enviado ? (
                              <Badge variant="outline" className="rounded-md border-success/40 text-success">
                                {formatDateBR(mov!.data_envio_financeiro)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {notaEnviadaPorEmpresa[e.id] ? (
                              <Badge variant="outline" className="rounded-md border-success/40 text-success">
                                {formatDateBR(notaEnviadaPorEmpresa[e.id])}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`rounded-md gap-1 ${qtdAnexos > 0 ? "border-info/40 text-info cursor-pointer hover:bg-info/10" : "text-muted-foreground"}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (qtdAnexos > 0 && mov) {
                                  setAnexosViewer({ empresa: e, periodo: mov.periodo });
                                }
                              }}
                            >
                              <Paperclip className="h-3 w-3" /> {qtdAnexos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {finInfo ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <Badge className={`${statusFinanceiroColor(finInfo.status)} rounded-md gap-1 text-xs`}>
                                  {finInfo.status === "Em faturamento" && <RefreshCw className="h-3 w-3 animate-spin" />}
                                  {labelStatusFinanceiro(finInfo.status)}
                                </Badge>
                                {finInfo.status === "Em faturamento" && finInfo.faturamento_por && (
                                  <span className="text-[10px] leading-tight text-blue-600 dark:text-blue-300">
                                    por {finInfo.faturamento_por}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                        </TableRow>
                      );})


                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      <EnvioFinanceiroDialog
        empresa={selectedEmpresa}
        mesRef={mesRef}
        editEnvio={editEnvio}
        setEditEnvio={setEditEnvio}
        existingMov={selectedEmpresa ? movsPorEmpresa[selectedEmpresa.id] ?? null : null}
        onClose={() => setSelectedEmpresa(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
          queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["movs-administradoras"] });
          queryClient.invalidateQueries({ queryKey: ["anexos-count-administradoras"] });
        }}
        onAttachmentsChange={recomputeEmpresa}
      />

      <AnexosViewerDialog
        open={!!anexosViewer}
        onOpenChange={(v) => !v && setAnexosViewer(null)}
        empresaId={anexosViewer?.empresa.id ?? null}
        empresaNome={anexosViewer?.empresa.nome ?? ""}
        mesReferencia={mesRef}
        periodo={anexosViewer?.periodo ?? ""}
      />
    </div>
  );
}

function EnvioFinanceiroDialog({
  empresa,
  mesRef,
  editEnvio,
  setEditEnvio,
  existingMov,
  onClose,
  onSaved,
  onAttachmentsChange,
}: {
  empresa: Empresa | null;
  mesRef: string;
  editEnvio: string;
  setEditEnvio: (v: string) => void;
  existingMov: Movimentacao | null;
  onClose: () => void;
  onSaved: () => void;
  onAttachmentsChange: (empresaId: string) => Promise<void>;
}) {
  const [movId, setMovId] = useState<string | null>(existingMov?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [ensuring, setEnsuring] = useState(false);

  useEffect(() => {
    setMovId(existingMov?.id ?? null);
  }, [existingMov?.id, empresa?.id]);

  // Auto-cria a movimentação ao abrir o diálogo para permitir anexos imediatos
  useEffect(() => {
    if (!empresa || movId || ensuring) return;
    setEnsuring(true);
    (async () => {
      try {
        const periodo = getPeriodoAdministradora(empresa);
        // Busca existente primeiro (evita violar unique empresa+mes+periodo)
        const { data: existing, error: selErr } = await supabase
          .from("movimentacoes")
          .select("id")
          .eq("empresa_id", empresa.id)
          .eq("mes_referencia", mesRef)
          .eq("periodo", periodo)
          .maybeSingle();
        if (selErr) throw selErr;
        if (existing?.id) {
          setMovId(existing.id);
          return;
        }
        const { data, error } = await supabase
          .from("movimentacoes")
          .upsert(
            { empresa_id: empresa.id, mes_referencia: mesRef, periodo },
            { onConflict: "empresa_id,mes_referencia,periodo" }
          )
          .select("id")
          .single();
        if (error) throw error;
        setMovId(data.id);
      } catch (err: any) {
        toast.error("Erro ao preparar anexos: " + err.message);
      } finally {
        setEnsuring(false);
      }
    })();
  }, [empresa, movId, mesRef, ensuring]);

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    try {
      let id = movId;
      if (!id) {
        const periodo = getPeriodoAdministradora(empresa);
        const { data, error } = await supabase
          .from("movimentacoes")
          .upsert(
            {
              empresa_id: empresa.id,
              mes_referencia: mesRef,
              periodo,
              data_envio_financeiro: editEnvio || null,
            },
            { onConflict: "empresa_id,mes_referencia,periodo" }
          )
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setMovId(id);
      } else {
        const { error } = await supabase
          .from("movimentacoes")
          .update({ data_envio_financeiro: editEnvio || null })
          .eq("id", id);
        if (error) throw error;
      }
      if (id && editEnvio) await sincronizarEnvioDosAnexos(id, editEnvio, mesRef);
      toast.success(editEnvio ? "Envio ao financeiro registrado" : "Data de envio limpa");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={!!empresa} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle>Contrato — Envio ao Financeiro</DialogTitle>
        </DialogHeader>
        {empresa && (
          <div className="space-y-5">
            <div className="text-sm p-3 bg-accent/40 rounded-lg">
              <p className="font-medium text-foreground">{empresa.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {empresa.codigo_contrato || "—"} · {empresa.cnpj || "—"}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Data de envio ao Financeiro</Label>
              <Input
                type="date"
                value={editEnvio}
                onChange={(e) => setEditEnvio(e.target.value)}
                max={todayLocalISO()}
                className="rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Ao preencher, os documentos anexados ficam disponíveis para o Financeiro.
              </p>
            </div>

            <AnexosMovimentacao
              movimentacaoId={movId}
              empresaId={empresa.id}
              required={!!editEnvio}
              onAttachmentsChange={() => onAttachmentsChange(empresa.id)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-lg" disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="rounded-lg" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function KpiCard({
  icon: Icon,
  label,
  value,
  highlight,
  accent,
  sub,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: ReactNode;
  highlight?: boolean;
  accent?: "amber" | "success" | "destructive";
}) {
  const iconBg =
    accent === "amber" ? "bg-amber-500/10 text-amber-500"
      : accent === "success" ? "bg-success/10 text-success"
      : accent === "destructive" ? "bg-destructive/10 text-destructive"
      : "bg-primary/10 text-primary";
  return (
    <Card className={`rounded-xl shadow-sm ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${highlight ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{value}</p>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

