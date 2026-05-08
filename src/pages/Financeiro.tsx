import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Bell, Wallet, RefreshCw, Download, Trophy, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { exportarPremio } from "@/lib/premio-export";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";

import { KpiCards } from "@/components/financeiro/KpiCards";
import { StatusChart } from "@/components/financeiro/StatusChart";
import { PeriodSummary } from "@/components/financeiro/PeriodSummary";
import { FinanceiroTable, type FinanceiroRow } from "@/components/financeiro/FinanceiroTable";
import { EditarMovimentacaoDialog } from "@/components/financeiro/EditarMovimentacaoDialog";
import { CobrancaDialog } from "@/components/financeiro/CobrancaDialog";
import { ImportPagadoresDialog } from "@/components/financeiro/ImportPagadoresDialog";
import { ReajusteCobrancaRetroativa } from "@/components/financeiro/ReajusteCobrancaRetroativa";

import {
  type FinanceiroMovimentacao,
  PERIODOS_FIN,
  calcularStatusFinanceiro,
  calcularPrazoFinanceiro,
  type StatusFinanceiro,
  getCurrentMesReferencia,
  formatMesReferencia,
  getMesesOptions,
} from "@/lib/financeiro-utils";

const STATUS_OPTIONS: StatusFinanceiro[] = [
  "Nota emitida",
  "Faturado",
  "Enviada",
  "Aguardando nota",
  "Pendente",
  "Fora do prazo",
];

export default function Financeiro() {
  const { user, loading, isAdmin, isFinanceiro, isComum } = useAuth();
  const canManageFinanceiro = isAdmin || isFinanceiro;
  const canViewFinanceiro = canManageFinanceiro || isComum;
  const queryClient = useQueryClient();

  const [mes, setMes] = useState(getCurrentMesReferencia());
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string | null>(null);
  const [somenteOverdue, setSomenteOverdue] = useState(false);

  const [editing, setEditing] = useState<FinanceiroMovimentacao | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cobOpen, setCobOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [premioOpen, setPremioOpen] = useState(false);
  const [premioPeriodo, setPremioPeriodo] = useState<string>("geral");
  const [isExportingPremio, setIsExportingPremio] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [importPagadoresOpen, setImportPagadoresOpen] = useState(false);
  const [analiseResultados, setAnaliseResultados] = useState<Record<string, import("@/lib/excel-analysis-utils").AnaliseResultado[]>>({});
  const [analiseComparacoes, setAnaliseComparacoes] = useState<Record<string, import("@/lib/excel-analysis-utils").ComparacaoResultado[]>>({});
  const [analiseLoading, setAnaliseLoading] = useState<Record<string, boolean>>({});

  // Movimentações financeiras do mês + dados de empresa via consulta separada
  const { data: financeiroRaw = [], isLoading } = useQuery({
    queryKey: ["financeiro", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("*")
        .eq("mes_referencia", mes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && canViewFinanceiro,
  });

  const empresaIds = useMemo(
    () => Array.from(new Set(financeiroRaw.map((f) => f.empresa_id))),
    [financeiroRaw],
  );

  const { data: empresasMap = {} } = useQuery({
    queryKey: ["financeiro-empresas", empresaIds.sort().join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return {};
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, data_rescisao, contrato_suspenso")
        .in("id", empresaIds);
      if (error) throw error;
      const map: Record<string, {
        nome: string;
        codigo: string | null;
        cnpj: string | null;
        tipo_movimentacao: string | null;
        periodo_movimentacao: string | null;
        data_corte: number | null;
        ativa: boolean;
      }> = {};
      data.forEach((e: any) => {
        const statusOk = (e.status_empresa ?? "Ativa") === "Ativa";
        const ativa = statusOk && !e.data_rescisao && !e.contrato_suspenso;
        map[e.id] = {
          nome: e.nome,
          codigo: e.codigo_contrato,
          cnpj: e.cnpj,
          tipo_movimentacao: e.tipo_movimentacao ?? null,
          periodo_movimentacao: e.periodo_movimentacao ?? null,
          data_corte: e.data_corte ?? null,
          ativa,
        };
      });
      return map;
    },
    enabled: empresaIds.length > 0,
  });

  // Movimentações operacionais do mês para detectar "envio operacional feito"
  // e também para contar anexos do Cadastro (anexos_movimentacao) no badge "Anexos"
  const { data: operacionaisData = { envioMap: {}, anexosCountMap: {} } } = useQuery({
    queryKey: ["financeiro-operacionais-v2", mes, empresaIds.sort().join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return { envioMap: {}, anexosCountMap: {} };
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, periodo, data_envio_financeiro")
        .eq("mes_referencia", mes)
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const envioMap: Record<string, boolean> = {};
      const movKeyById: Record<string, string> = {};
      const movIdsOp: string[] = [];
      data.forEach((m: any) => {
        const key = `${m.empresa_id}|${m.periodo}`;
        if (m.data_envio_financeiro) envioMap[key] = true;
        movKeyById[m.id] = key;
        movIdsOp.push(m.id);
      });

      const anexosCountMap: Record<string, number> = {};
      if (movIdsOp.length > 0) {
        const { data: anx, error: anxErr } = await supabase
          .from("anexos_movimentacao")
          .select("movimentacao_id")
          .in("movimentacao_id", movIdsOp);
        if (anxErr) throw anxErr;
        (anx || []).forEach((a: any) => {
          const key = movKeyById[a.movimentacao_id];
          if (key) anexosCountMap[key] = (anexosCountMap[key] || 0) + 1;
        });
      }
      return { envioMap, anexosCountMap };
    },
    enabled: empresaIds.length > 0,
  });
  const operacionaisMap = operacionaisData?.envioMap ?? {};
  const anexosCadastroCountMap = operacionaisData?.anexosCountMap ?? {};

  // Pagadores cadastrados (financeiro_pagadores) por empresa
  const { data: pagadoresCadastradosMap = {} } = useQuery({
    queryKey: ["financeiro-pagadores-all", empresaIds.sort().join(",")],
    queryFn: async () => {
      if (empresaIds.length === 0) return {};
      const { data, error } = await supabase
        .from("financeiro_pagadores")
        .select("id, empresa_id, nome_pagador, cnpj, ativo")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      const map: Record<string, Array<{ id: string; empresa_id: string; nome_pagador: string; cnpj: string | null; ativo: boolean }>> = {};
      (data || []).forEach((p: any) => {
        if (!map[p.empresa_id]) map[p.empresa_id] = [];
        map[p.empresa_id].push(p);
      });
      return map;
    },
    enabled: empresaIds.length > 0,
  });

  // Anexos por movimentação (com tipo para calcular status: PDF > XLS)
  const movIds = useMemo(() => financeiroRaw.map((f) => f.id), [financeiroRaw]);

  const { data: anexosMap = {} } = useQuery({
    queryKey: ["financeiro-anexos-list", movIds.sort().join(",")],
    queryFn: async () => {
      if (movIds.length === 0) return {};
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("financeiro_movimentacao_id, mime_type, nome_arquivo, storage_path, uploaded_by, created_at, origem")
        .in("financeiro_movimentacao_id", movIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<
        string,
        Array<{
          mime_type: string | null;
          nome_arquivo: string | null;
          storage_path: string | null;
          uploaded_by: string | null;
          created_at: string;
          origem: string | null;
        }>
      > = {};
      data.forEach((a: any) => {
        if (!map[a.financeiro_movimentacao_id]) map[a.financeiro_movimentacao_id] = [];
        map[a.financeiro_movimentacao_id].push({
          mime_type: a.mime_type ?? null,
          nome_arquivo: a.nome_arquivo ?? null,
          storage_path: a.storage_path ?? null,
          uploaded_by: a.uploaded_by ?? null,
          created_at: a.created_at,
          origem: a.origem ?? null,
        });
      });
      return map;
    },
    enabled: movIds.length > 0,
  });

  // Mapa: para cada movimentação, o user_id de quem anexou o PDF mais recente
  const pdfUploaderByMov = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(anexosMap).forEach(([movId, list]) => {
      // já vem ordenado por created_at desc
      const pdf = (list as any[]).find(
        (a) =>
          a.uploaded_by &&
          a.origem !== "retroativo" &&
          ((a.mime_type || "").toLowerCase().includes("pdf") ||
            (a.nome_arquivo || "").toLowerCase().endsWith(".pdf")),
      );
      if (pdf) map[movId] = pdf.uploaded_by;
    });
    return map;
  }, [anexosMap]);

  const uploaderIds = useMemo(
    () => Array.from(new Set(Object.values(pdfUploaderByMov))),
    [pdfUploaderByMov],
  );

  const { data: uploaderMap = {} } = useQuery({
    queryKey: ["financeiro-pdf-uploaders", uploaderIds.sort().join(",")],
    queryFn: async () => {
      if (uploaderIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", uploaderIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((p: any) => {
        map[p.user_id] = p.display_name || p.username || "—";
      });
      return map;
    },
    enabled: uploaderIds.length > 0,
  });

  // Cobranças abertas do mês
  const { data: cobrancasAbertas = [] } = useQuery({
    queryKey: ["cobrancas-abertas", mes, movIds.sort().join(",")],
    queryFn: async () => {
      if (movIds.length === 0) return [];
      const { data, error } = await supabase
        .from("cobrancas")
        .select("id, financeiro_movimentacao_id")
        .eq("status", "aberta")
        .in("financeiro_movimentacao_id", movIds);
      if (error) throw error;
      return data;
    },
    enabled: movIds.length > 0,
  });

  // Toast 1x por sessão se houver cobranças abertas
  useEffect(() => {
    if (cobrancasAbertas.length === 0) return;
    const key = `cob-toast-${mes}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.warning(`${cobrancasAbertas.length} cobrança(s) aberta(s) neste mês`);
  }, [cobrancasAbertas.length, mes]);

  // Linhas enriquecidas
  const allRows: FinanceiroRow[] = useMemo(() => {
    return financeiroRaw
      .filter((f) => {
        const emp = empresasMap[f.empresa_id];
        // Oculta empresas desativadas (rescindidas/suspensas/inativas) pelo cadastro
        return emp ? emp.ativa : true;
      })
      .map((f) => {
      const emp = empresasMap[f.empresa_id];
      const envioOperacional = !!operacionaisMap[`${f.empresa_id}|${f.periodo}`];
      // "Período / Corte" baseado na configuração da empresa
      const periodoCorte = emp
        ? emp.tipo_movimentacao === "Diária" && emp.data_corte
          ? `Diária — corte dia ${String(emp.data_corte).padStart(2, "0")}`
          : emp.periodo_movimentacao
            ? `Fechada — ${emp.periodo_movimentacao}`
            : "—"
        : "—";
      const uploaderId = pdfUploaderByMov[f.id];
      const anexosAll = anexosMap[f.id] || [];
      // Anexos vindos de Reajuste/Cobrança Retroativa não alteram o status
      const anexosParaStatus = anexosAll.filter((a: any) => a.origem !== "retroativo");
      const temRetroativo = anexosAll.some((a: any) => a.origem === "retroativo");
      return {
        ...f,
        empresa_nome: emp?.nome || "—",
        empresa_codigo: emp?.codigo ?? null,
        empresa_cnpj: emp?.cnpj ?? null,
        periodo_corte: periodoCorte,
        status: calcularStatusFinanceiro(f, envioOperacional, anexosParaStatus),
        anexos_count: anexosAll.length + (anexosCadastroCountMap[`${f.empresa_id}|${f.periodo}`] || 0),
        enviado_por_nome: uploaderId ? uploaderMap[uploaderId] || null : null,
        retroativo: temRetroativo,
      };
    });
  }, [financeiroRaw, empresasMap, operacionaisMap, anexosCadastroCountMap, anexosMap, pdfUploaderByMov, uploaderMap]);

  // Tipos únicos para o filtro
  const tiposUnicos = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach((r) => {
      if (r.tipo_cobranca?.trim()) s.add(r.tipo_cobranca.trim());
    });
    return Array.from(s).sort();
  }, [allRows]);

  // KPI/Chart: aplica APENAS filtro de período
  const kpiRows = useMemo(() => {
    return filtroPeriodo ? allRows.filter((r) => r.periodo === filtroPeriodo) : allRows;
  }, [allRows, filtroPeriodo]);

  // PeriodSummary: contagem total (sem filtros)
  const countByPeriodo = useMemo(() => {
    const c: Record<string, number> = {};
    PERIODOS_FIN.forEach((p) => (c[p] = 0));
    allRows.forEach((r) => {
      c[r.periodo] = (c[r.periodo] || 0) + 1;
    });
    return c;
  }, [allRows]);

  // Tabela: aplica TODOS os filtros e expande 1 linha por pagador cadastrado
  const filteredRows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = allRows.filter((r) => {
      if (filtroPeriodo && r.periodo !== filtroPeriodo) return false;
      if (filtroStatus !== "all" && r.status !== filtroStatus) return false;
      if (filtroTipo !== "all" && (r.tipo_cobranca || "") !== filtroTipo) return false;
      if (somenteOverdue && (r.dentro_prazo || r.data_envio_nota)) return false;
      return true;
    });

    // Sempre mantém a linha da empresa-mãe + adiciona uma linha por pagador cadastrado.
    const expanded: FinanceiroRow[] = [];
    base.forEach((r) => {
      // Linha da empresa principal (sempre presente)
      expanded.push({ ...r, rowKey: r.id, pagador_id: null });

      // Linhas adicionais para cada pagador cadastrado ativo
      const pagadores = (pagadoresCadastradosMap[r.empresa_id] || []).filter((p) => p.ativo);
      pagadores.forEach((p) => {
        expanded.push({
          ...r,
          empresa_nome: p.nome_pagador,
          empresa_cnpj: p.cnpj ?? r.empresa_cnpj,
          rowKey: `${r.id}::${p.id}`,
          pagador_id: p.id,
        });
      });
    });

    // Filtro de busca aplicado SOBRE as linhas já expandidas (busca pelo pagador certo)
    if (!q) return expanded;
    return expanded.filter((r) => {
      const hay = `${r.empresa_nome} ${r.empresa_codigo || ""} ${r.empresa_cnpj || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, busca, filtroStatus, filtroTipo, filtroPeriodo, somenteOverdue, pagadoresCadastradosMap]);

  // KPIs
  const kpis = useMemo(() => {
    // Pagadores = empresa-mãe (1) + pagadores cadastrados ativos
    const empresasUnicas = new Set(kpiRows.map((r) => r.empresa_id));
    let totalPagadores = 0;
    empresasUnicas.forEach((empId) => {
      const lista = (pagadoresCadastradosMap[empId] || []).filter((p: any) => p.ativo);
      totalPagadores += 1 + lista.length;
    });
    // Contratos = código de contrato distintos. Empresas sem código contam individualmente.
    const contratosSet = new Set(
      kpiRows.map((r) => r.empresa_codigo?.trim() || `__sem__${r.empresa_id}`),
    );
    const foraDoPrazo = kpiRows.filter((r) => {
      const p = calcularPrazoFinanceiro({
        aguardando_nota_em: (r as any).aguardando_nota_em,
        data_envio_nota: r.data_envio_nota,
        dia_emissao: (r as any).dia_emissao,
      });
      return p.categoria === "Fora do prazo";
    }).length;
    return {
      totalEmpresas: contratosSet.size,
      totalPagadores,
      notasEnviadas: kpiRows.filter((r) => r.status === "Enviada" || r.status === "Nota emitida").length,
      aguardandoNota: kpiRows.filter((r) => r.status === "Aguardando nota").length,
      pendentes: kpiRows.filter((r) => r.status === "Pendente").length,
      foraDoPrazo,
    };
  }, [kpiRows, pagadoresCadastradosMap]);

  // Provisionar movimentações financeiras do mês:
  // - Todas as empresas ATIVAS com período válido
  // - + Empresas INATIVAS que tenham movimentação operacional registrada no mês
  //   (para alinhar a contagem com a aba Dashboard / "Resumo Geral por Período")
  const provisionarMutation = useMutation({
    mutationFn: async () => {
      const { data: empresas, error: empErr } = await supabase
        .from("empresas")
        .select("id, nome, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, responsavel_contrato");
      if (empErr) throw empErr;

      // Movimentações operacionais já existentes no mês (para incluir Inativas com histórico)
      const { data: movsMes, error: movErr } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mes);
      if (movErr) throw movErr;

      const operacionaisPorEmpresa = new Map<string, Set<string>>();
      (movsMes || []).forEach((m) => {
        if (!operacionaisPorEmpresa.has(m.empresa_id)) {
          operacionaisPorEmpresa.set(m.empresa_id, new Set());
        }
        operacionaisPorEmpresa.get(m.empresa_id)!.add(m.periodo);
      });

      const PERIODOS_VALIDOS = new Set(PERIODOS_FIN as readonly string[]);
      const linhas: Array<{
        empresa_id: string;
        mes_referencia: string;
        periodo: string;
        dentro_prazo: boolean;
        responsavel: string | null;
      }> = [];

      for (const e of empresas || []) {
        const ativa = e.status_empresa === "Ativa";
        const periodosOperacionais = operacionaisPorEmpresa.get(e.id);

        // Inativa sem movimentação no mês → ignorar
        if (!ativa && !periodosOperacionais) continue;

        const periodos = new Set<string>();

        // Período-base configurado na empresa (somente se Ativa)
        if (ativa) {
          let base: string | null = null;
          if (e.tipo_movimentacao === "Diária" && e.data_corte) {
            base = periodoDaDataCorte(e.data_corte);
          } else if (e.periodo_movimentacao) {
            base = e.periodo_movimentacao;
          }
          if (base && PERIODOS_VALIDOS.has(base)) periodos.add(base);
        }

        // Períodos vindos de movimentações operacionais (ativas ou inativas com histórico)
        periodosOperacionais?.forEach((p) => {
          if (PERIODOS_VALIDOS.has(p)) periodos.add(p);
        });

        periodos.forEach((periodo) => {
          linhas.push({
            empresa_id: e.id,
            mes_referencia: mes,
            periodo,
            dentro_prazo: true,
            responsavel: e.responsavel_contrato ?? null,
          });
        });
      }

      if (linhas.length === 0) {
        return { inseridas: 0, total: 0 };
      }

      // Buscar existentes para evitar duplicatas (não há índice único)
      const { data: existentes, error: exErr } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mes);
      if (exErr) throw exErr;

      const chaves = new Set((existentes || []).map((r) => `${r.empresa_id}|${r.periodo}`));
      const novas = linhas.filter((l) => !chaves.has(`${l.empresa_id}|${l.periodo}`));

      if (novas.length === 0) return { inseridas: 0, total: linhas.length };

      const { error: insErr } = await supabase.from("financeiro_movimentacoes").insert(novas);
      if (insErr) throw insErr;

      return { inseridas: novas.length, total: linhas.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      if (!res || res.total === 0) {
        toast.warning("Nenhuma empresa ativa com período financeiro válido.");
      } else if (res.inseridas === 0) {
        toast.info("Todas as movimentações deste mês já estavam provisionadas.");
      } else {
        toast.success(`${res.inseridas} movimentação(ões) financeira(s) gerada(s).`);
      }
    },
    onError: (e: any) => toast.error("Erro ao provisionar: " + e.message),
  });

  // Guards de acesso
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!canViewFinanceiro) return <Navigate to="/" replace />;

  const handleEdit = (row: FinanceiroRow) => {
    setEditing(row);
    setEditOpen(true);
  };
  const handleCobranca = (row: FinanceiroRow) => {
    setEditing(row);
    setCobOpen(true);
  };

  const handleToggleExpand = async (row: FinanceiroRow) => {
    const key = row.rowKey ?? row.id;
    if (expandedRowId === key) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(key);
    await runAnalise(row);
  };

  const handleReanalisar = async (row: FinanceiroRow) => {
    await runAnalise(row, { force: true });
  };

  // Versão do parser Excel/PDF — bumpar invalida todos os caches em memória.
  const ANALISE_PARSER_VERSION = "7";

  const runAnalise = async (
    row: FinanceiroRow,
    opts: { force?: boolean } = {},
  ) => {
    const rowKey = row.rowKey ?? row.id;
    let anexos = (anexosMap[row.id] || []) as Array<{
      mime_type: string | null;
      nome_arquivo: string | null;
      storage_path: string | null;
      created_at: string;
    }>;
    const { isXlsAnexo, isPdfAnexo } = await import("@/lib/financeiro-utils");

    // Refetch caso anexos não tenham carregado ainda
    if (anexos.length === 0) {
      await queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
      const fresh = (queryClient.getQueryData(["financeiro-anexos-list", movIds.sort().join(",")]) as any) || {};
      anexos = (fresh[row.id] || []) as typeof anexos;
    }

    const xlsAnexos = anexos.filter((a) => isXlsAnexo(a) && a.storage_path);
    const pdfAnexos = anexos.filter((a) => isPdfAnexo(a) && a.storage_path);

    const tipoAnalise = ((row as any).tipo_analise as string) || "normal";

    // Identifica filtro:
    // - Linha de pagador → filtra pelo CNPJ/nome do pagador
    // - Linha mãe COM pagadores cadastrados → filtra pelo CNPJ/nome da própria empresa
    // - Linha mãe SEM pagadores cadastrados → análise agregada (sem filtro)
    const pagadoresAtivos = (pagadoresCadastradosMap[row.empresa_id] || []).filter((p) => p.ativo);
    const pagadorAtivo = row.pagador_id
      ? pagadoresAtivos.find((p) => p.id === row.pagador_id)
      : null;
    const filtroPagador = pagadorAtivo
      ? { cnpj: pagadorAtivo.cnpj, nome: pagadorAtivo.nome_pagador }
      : pagadoresAtivos.length > 0
        ? { cnpj: row.empresa_cnpj, nome: row.empresa_nome }
        : null;
    const filtroSuffix = pagadorAtivo
      ? `::pag=${pagadorAtivo.id}`
      : filtroPagador
        ? `::mae=${row.empresa_id}`
        : `::all`;


    // Cache-key combina XLS + PDF + tipo + filtro de pagador + versão do parser
    const cacheKey =
      [...xlsAnexos, ...pdfAnexos]
        .map((a) => a.storage_path)
        .sort()
        .join("|") + `::${tipoAnalise}${filtroSuffix}::v${ANALISE_PARSER_VERSION}`;
    const cached = analiseResultados[rowKey];
    if (!opts.force && cached && (cached as any)._key === cacheKey) {
      return;
    }

    if (xlsAnexos.length === 0) {
      setAnaliseResultados((prev) => ({ ...prev, [rowKey]: [] }));
      setAnaliseComparacoes((prev) => ({ ...prev, [rowKey]: [] }));
      return;
    }

    setAnaliseLoading((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const {
        analisarExcelFinanceiroPorPagador,
        compararExcelComPdf,
        compararExcelComPdfSimplificado,
      } = await import("@/lib/excel-analysis-utils");
      const { analisarExcelMotoHonda } = await import("@/lib/excel-analysis-moto-honda");
      const { analisarPdfFinanceiro, analisarPdfFinanceiroSimplificado } = await import(
        "@/lib/pdf-analysis-utils"
      );

      // PDFs (análise completa)
      const pdfResultados = await Promise.all(
        pdfAnexos.map(async (a) => {
          try {
            const { data, error } = await supabase.storage
              .from("anexos-financeiro")
              .download(a.storage_path!);
            if (error) throw error;
            const buf = await data.arrayBuffer();
            const r = await analisarPdfFinanceiro(buf);
            return { arquivo: a.nome_arquivo || "PDF", buf, ...r };
          } catch (err: any) {
            toast.error(`Erro ao analisar PDF ${a.nome_arquivo}: ${err.message || err}`);
            return null;
          }
        }),
      );
      const pdfsValidos = pdfResultados.filter((p) => p !== null) as Array<
        import("@/lib/pdf-analysis-utils").AnalisePdfResultado & { buf: ArrayBuffer }
      >;

      // Excel — escolhe parser conforme tipo_analise
      // Para Moto Honda (parser RESUMO), filtro por pagador não se aplica — usa agregado.
      const resultados = await Promise.all(
        xlsAnexos.map(async (a) => {
          try {
            const { data, error } = await supabase.storage
              .from("anexos-financeiro")
              .download(a.storage_path!);
            if (error) throw error;
            const buf = await data.arrayBuffer();
            const r =
              tipoAnalise === "moto_honda"
                ? await analisarExcelMotoHonda(buf)
                : await analisarExcelFinanceiroPorPagador(buf, filtroPagador ?? undefined);
            return { pagador: pagadorAtivo?.nome_pagador || a.nome_arquivo || "Pagador", ...r };
          } catch (err: any) {
            toast.error(`Erro ao analisar ${a.nome_arquivo}: ${err.message || err}`);
            return {
              pagador: a.nome_arquivo || "Pagador",
              enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
              apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
              inclusoes: { quantidade: 0, total: 0 },
              avisos: [`Falha ao ler arquivo: ${err.message || err}`],
            };
          }
        }),
      );

      // Decisão simplificado vs completo (apenas Moto Honda)
      const useSimplificado =
        tipoAnalise === "moto_honda" &&
        pdfsValidos.length > 0 &&
        pdfsValidos.every((p) => {
          const semDetalhes =
            (!p.enfermaria || (p.enfermaria.total === 0 && p.enfermaria.beneficiarios === null)) &&
            (!p.apartamento || (p.apartamento.total === 0 && p.apartamento.beneficiarios === null));
          return semDetalhes;
        });

      // Seleciona o PDF correto pelo CNPJ do TOMADOR DE SERVIÇO.
      // Se houver filtro (pagador ou linha-mãe com pagadores), procura o PDF
      // cujo tomadorCnpj bate com o CNPJ do filtro. Sem match, usa fallback por índice.
      const onlyDigits = (s: string | null | undefined) =>
        (s || "").replace(/\D/g, "");
      const cnpjFiltroDigits = onlyDigits(filtroPagador?.cnpj);
      const escolherPdfPorCnpj = <T extends { tomadorCnpj?: string | null }>(
        lista: T[],
        idxFallback: number,
      ): T | null => {
        if (cnpjFiltroDigits) {
          const found = lista.find(
            (p) => onlyDigits(p.tomadorCnpj) === cnpjFiltroDigits,
          );
          if (found) return found;
        }
        return lista[idxFallback] ?? lista[0] ?? null;
      };

      let comparacoes: any[] = [];
      if (pdfsValidos.length === 0) {
        comparacoes = [];
      } else if (useSimplificado) {
        const pdfsSimples = await Promise.all(
          pdfsValidos.map(async (p) => {
            const r = await analisarPdfFinanceiroSimplificado(p.buf);
            return { arquivo: p.arquivo, tomadorCnpj: p.tomadorCnpj, ...r };
          }),
        );
        comparacoes = resultados.map((excel, idx) => {
          const pdf = escolherPdfPorCnpj(pdfsSimples, idx);
          return compararExcelComPdfSimplificado(excel, pdf);
        });
      } else {
        comparacoes = resultados.map((excel, idx) => {
          const pdf = escolherPdfPorCnpj(pdfsValidos, idx);
          return compararExcelComPdf(excel, pdf);
        });
      }

      Object.defineProperty(resultados, "_key", { value: cacheKey, enumerable: false });
      setAnaliseResultados((prev) => ({ ...prev, [rowKey]: resultados }));
      setAnaliseComparacoes((prev) => ({ ...prev, [rowKey]: comparacoes }));

      // "A Receber" só roda na linha mãe (sem pagador_id) — evita duplicar
      if (row.pagador_id) {
        return;
      }


      // ===== Geração automática de "A Receber" (apenas se validado) =====
      try {
        const temXls = xlsAnexos.length > 0;
        const temPdf = pdfsValidos.length > 0;
        const temComp = comparacoes.length > 0;
        const todasSemDivergencia =
          temComp && comparacoes.every((c) => c && c.divergencias.length === 0);

        if (temXls && temPdf && todasSemDivergencia) {
          // Soma valores agregados do Excel (todos pagadores)
          const totalBenef = resultados.reduce(
            (s, r) =>
              s +
              (r.enfermaria?.beneficiarios || 0) +
              (r.apartamento?.beneficiarios || 0),
            0,
          );
          const totalFaturado = resultados.reduce(
            (s, r) =>
              s +
              (r.enfermaria?.total || 0) +
              (r.apartamento?.total || 0),
            0,
          );
          const totalInclusoes = resultados.reduce(
            (s, r) => s + (r.inclusoes?.total || 0),
            0,
          );
          const totalExclusoes = resultados.reduce(
            (s, r) => s + (r.exclusoes?.total || 0),
            0,
          );

          // Valor Líquido NFS-e e nº NF — pega do primeiro PDF que tiver
          const pdfComValor = pdfsValidos.find((p) => p.valorLiquido && p.valorLiquido > 0);
          const valorLiquido = pdfComValor?.valorLiquido ?? null;
          const nfNumero = pdfsValidos.find((p) => p.nfNumero)?.nfNumero ?? null;

          // Dia de vencimento — preferir empresa.data_vencimento_fatura
          const { data: empData } = await supabase
            .from("empresas")
            .select("data_vencimento_fatura, cnpj, nome")
            .eq("id", row.empresa_id)
            .maybeSingle();

          const diaVenc =
            empData?.data_vencimento_fatura ??
            ((row as any).data_vencimento
              ? new Date((row as any).data_vencimento).getDate()
              : null);

          const payload = {
            financeiro_movimentacao_id: row.id,
            empresa_id: row.empresa_id,
            empresa_nome: empData?.nome || row.empresa_nome,
            empresa_cnpj: empData?.cnpj || row.empresa_cnpj,
            valor_total: valorLiquido,
            valor_faturado: totalFaturado || null,
            valor_inclusoes: totalInclusoes || null,
            valor_exclusoes: totalExclusoes || null,
            beneficiarios: totalBenef || null,
            nf_numero: nfNumero,
            dia_vencimento: diaVenc,
            data_vencimento: (row as any).data_vencimento ?? null,
            periodo: row.periodo,
            mes_referencia: row.mes_referencia,
            status: "Pendente",
          };

          const { error: upErr } = await supabase
            .from("a_receber")
            .upsert(payload, { onConflict: "financeiro_movimentacao_id" });

          if (!upErr) {
            queryClient.invalidateQueries({ queryKey: ["a_receber"] });
            toast.success(`A Receber gerado para ${payload.empresa_nome}`, {
              duration: 2500,
            });
          } else {
            console.error("[A Receber] upsert falhou:", upErr);
          }
        }
      } catch (err) {
        console.error("[A Receber] erro inesperado:", err);
      }
    } finally {
      setAnaliseLoading((prev) => ({ ...prev, [rowKey]: false }));
    }
  };

  const handleExportPremio = async () => {
    setIsExportingPremio(true);
    try {
      let q = supabase
        .from("a_receber")
        .select("*")
        .eq("mes_referencia", mes);
      const periodo = premioPeriodo === "geral" ? null : premioPeriodo;
      if (periodo) q = q.eq("periodo", periodo);
      const { data, error } = await q.order("empresa_nome", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning(
          `Nenhum registro de "A Receber" validado${periodo ? ` para o período ${periodo}` : ""}.`,
        );
        return;
      }
      await exportarPremio(data as any, { mes, periodo });
      toast.success(`PRÊMIO exportado: ${data.length} registro(s)`);
      setPremioOpen(false);
    } catch (e: any) {
      toast.error("Erro ao exportar PRÊMIO: " + (e?.message || "falha"));
    } finally {
      setIsExportingPremio(false);
    }
  };

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      toast.warning("Nenhum registro para exportar com os filtros atuais");
      return;
    }
    setIsExporting(true);
    try {
      const headers = [
        "Empresa",
        "Contrato",
        "CNPJ",
        "Período / Corte",
        "Responsável",
        "Tipo",
        "Status",
        "Envio nota",
        "Vencimento",
        "Anexos",
        "Cobrança registrada",
      ];

      const dataRows = filteredRows.map((r) => [
        r.empresa_nome,
        r.empresa_codigo || "",
        r.empresa_cnpj || "",
        r.periodo_corte,
        r.responsavel || "",
        r.tipo_cobranca || "",
        r.status,
        formatDateBR(r.data_envio_nota),
        formatDateBR(r.data_vencimento),
        r.anexos_count,
        r.cobranca_registrada ? "Sim" : "Não",
      ]);

      const totals = {
        enviadas: filteredRows.filter((r) => r.status === "Enviada").length,
        aguardando: filteredRows.filter((r) => r.status === "Aguardando nota").length,
        pendentes: filteredRows.filter((r) => r.status === "Pendente").length,
        foraPrazo: filteredRows.filter((r) => r.status === "Fora do prazo").length,
        anexos: filteredRows.reduce((s, r) => s + r.anexos_count, 0),
        cobrancas: filteredRows.filter((r) => r.cobranca_registrada).length,
      };

      const totalRow = [
        `TOTAL (${filteredRows.length} registros)`,
        "",
        "",
        "",
        "",
        "",
        `Enviadas: ${totals.enviadas} | Aguardando: ${totals.aguardando} | Pendentes: ${totals.pendentes} | Fora do prazo: ${totals.foraPrazo}`,
        "",
        "",
        totals.anexos,
        totals.cobrancas,
      ];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Financeiro");

      ws.columns = [
        { width: 38 }, // Empresa
        { width: 14 }, // Contrato
        { width: 20 }, // CNPJ
        { width: 22 }, // Período / Corte
        { width: 22 }, // Responsável
        { width: 16 }, // Tipo
        { width: 18 }, // Status
        { width: 14 }, // Envio nota
        { width: 14 }, // Vencimento
        { width: 10 }, // Anexos
        { width: 20 }, // Cobrança
      ];

      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true };

      dataRows.forEach((r) => ws.addRow(r));
      ws.addRow([]);
      const totRow = ws.addRow(totalRow);
      totRow.font = { bold: true };

      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const filename = `financeiro_${mes}_${stamp}.xlsx`;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Arquivo exportado: ${filteredRows.length} registro(s)`);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e?.message || "falha desconhecida"));
    } finally {
      setIsExporting(false);
    }
  };

  const editingNome = editing ? empresasMap[editing.empresa_id]?.nome : undefined;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Controle de notas, anexos e cobranças — {formatMesReferencia(mes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="gap-1.5"
            >
              <Download className={`h-3.5 w-3.5 ${isExporting ? "animate-pulse" : ""}`} />
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </Button>
            {canManageFinanceiro && (
              <Popover open={premioOpen} onOpenChange={setPremioOpen}>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    PRÊMIO
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Exportar PRÊMIO</p>
                      <p className="text-xs text-muted-foreground">
                        Apenas registros validados (sem divergência).
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Período</Label>
                      <RadioGroup
                        value={premioPeriodo}
                        onValueChange={setPremioPeriodo}
                        className="grid grid-cols-2 gap-1.5"
                      >
                        {[
                          { v: "geral", l: "Geral" },
                          { v: "01-05", l: "01–05" },
                          { v: "05-10", l: "05–10" },
                          { v: "10-15", l: "10–15" },
                          { v: "15-20", l: "15–20" },
                          { v: "20-25", l: "20–25" },
                          { v: "25-30", l: "25–30" },
                        ].map((o) => (
                          <label
                            key={o.v}
                            className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50"
                          >
                            <RadioGroupItem value={o.v} />
                            {o.l}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                    <Button
                      onClick={handleExportPremio}
                      disabled={isExportingPremio}
                      size="sm"
                      className="w-full gap-1.5"
                    >
                      <Download className={`h-3.5 w-3.5 ${isExportingPremio ? "animate-pulse" : ""}`} />
                      {isExportingPremio ? "Exportando..." : "Exportar PRÊMIO"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {canManageFinanceiro && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportPagadoresOpen(true)}
                className="gap-1.5"
                title="Importar pagadores via Excel"
              >
                <Upload className="h-3.5 w-3.5" />
                Importar pagadores
              </Button>
            )}
            {canManageFinanceiro && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => provisionarMutation.mutate()}
                disabled={provisionarMutation.isPending}
                className="gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${provisionarMutation.isPending ? "animate-spin" : ""}`}
                />
                {provisionarMutation.isPending ? "Gerando..." : "Gerar movimentações"}
              </Button>
            )}
            <Label htmlFor="mes-ref" className="text-xs text-muted-foreground">
              Mês
            </Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger id="mes-ref" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMesesOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMesReferencia(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Banner cobranças abertas */}
        {cobrancasAbertas.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <Bell className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">
              {cobrancasAbertas.length} cobrança(s) aberta(s)
            </AlertTitle>
            <AlertDescription className="text-foreground/80">
              Existem cobranças pendentes de resolução para o período selecionado.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <KpiCards {...kpis} />

        {/* Período + Reajuste/Cobrança + Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <PeriodSummary
              countByPeriodo={countByPeriodo}
              selected={filtroPeriodo}
              onSelect={setFiltroPeriodo}
            />
            <ReajusteCobrancaRetroativa />
          </div>
          <StatusChart
            data={kpiRows.map((r) => ({
              status: r.status,
              tipo_cobranca: r.tipo_cobranca,
              dentro_prazo: r.dentro_prazo,
              aguardando_nota_em: (r as any).aguardando_nota_em ?? null,
              data_envio_nota: r.data_envio_nota ?? null,
              dia_emissao: (r as any).dia_emissao ?? null,
            }))}
          />
        </div>

        {/* Filtros da tabela */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Empresa, CNPJ, contrato..."
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de cobrança</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tiposUnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 h-10">
              <Label className="text-xs cursor-pointer" htmlFor="overdue">
                Apenas fora do prazo
              </Label>
              <Switch id="overdue" checked={somenteOverdue} onCheckedChange={setSomenteOverdue} />
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <FinanceiroTable
          rows={filteredRows}
          onEdit={handleEdit}
          onCobranca={handleCobranca}
          isLoading={isLoading}
          expandedRowId={expandedRowId}
          onToggleExpand={handleToggleExpand}
          onReanalisar={handleReanalisar}
          analiseResultados={analiseResultados}
          analiseLoading={analiseLoading}
          analiseComparacoes={analiseComparacoes}
          readOnly={!canManageFinanceiro}
          
        />

        {/* Diálogos (somente para perfis com permissão de edição) */}
        {canManageFinanceiro && (
          <>
            <EditarMovimentacaoDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              movimentacao={editing}
              empresaNome={editingNome}
            />
            <CobrancaDialog
              open={cobOpen}
              onOpenChange={setCobOpen}
              movimentacao={editing}
              empresaNome={editingNome}
            />
            <ImportPagadoresDialog
              open={importPagadoresOpen}
              onOpenChange={setImportPagadoresOpen}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
