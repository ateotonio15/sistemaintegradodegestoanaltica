import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionState } from "@/hooks/useSessionState";
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
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Search, Bell, Wallet, RefreshCw, Download, Upload, History, Users, X } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import {
  sha256Hex,
  salvarAnalise,
  listarAnalisesComErro,
} from "@/lib/financeiro-analise-cache";
import { HistoricoAnalisesDialog } from "@/components/financeiro/HistoricoAnalisesDialog";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { formatDateBR, calcularPeriodoCobranca, formatPeriodoCobranca } from "@/lib/date-utils";

import { KpiCards } from "@/components/financeiro/KpiCards";
import { StatusChart } from "@/components/financeiro/StatusChart";
import { PeriodSummary } from "@/components/financeiro/PeriodSummary";
import { FinanceiroTable, type FinanceiroRow } from "@/components/financeiro/FinanceiroTable";
import { useEmpresaGrupoMap, useGruposFinanceirosAtivos } from "@/hooks/useGrupoFinanceiro";
import { EditarMovimentacaoDialog } from "@/components/financeiro/EditarMovimentacaoDialog";
import { CobrancaDialog } from "@/components/financeiro/CobrancaDialog";
import { ImportPagadoresDialog } from "@/components/financeiro/ImportPagadoresDialog";
import { GerarHistoricoDialog } from "@/components/financeiro/GerarHistoricoDialog";
import { ReajusteCobrancaRetroativa } from "@/components/financeiro/ReajusteCobrancaRetroativa";
import { useFinanceiroRealtime } from "@/hooks/useFinanceiroRealtime";

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
  "Aguardando validação",
  "Enviada",
  "Em faturamento",
  "Aguardando nota",
  "Pendente",
  "Fora do prazo",
];


export default function Financeiro() {
  const { user, loading, isAdmin, isFinanceiro, isComum, isViewOnly } = useAuth();
  const canManageFinanceiro = isAdmin || isFinanceiro;
  const canViewFinanceiro = canManageFinanceiro || isComum || isViewOnly;
  const queryClient = useQueryClient();
  const { data: empresaGrupoMap } = useEmpresaGrupoMap();
  const { data: gruposAtivos } = useGruposFinanceirosAtivos();

  const [mes, setMes] = useSessionState<string>("financeiro:mes", () => getCurrentMesReferencia());
  const [busca, setBusca] = useSessionState<string>("financeiro:busca", "");
  const [filtroStatus, setFiltroStatus] = useSessionState<string[]>("financeiro:filtroStatusList", []);
  const [filtroTipo, setFiltroTipo] = useSessionState<string[]>("financeiro:filtroTipoList", []);
  const [filtroPeriodo, setFiltroPeriodo] = useSessionState<string | null>("financeiro:filtroPeriodo", null);
  const [filtroAnexadoPor, setFiltroAnexadoPor] = useSessionState<string | null>("financeiro:filtroAnexadoPor", null);
  const [filtroTipoAnexo, setFiltroTipoAnexo] = useSessionState<string | null>("financeiro:filtroTipoAnexo", null);
  const [filtroGrupo, setFiltroGrupo] = useSessionState<string | null>("financeiro:filtroGrupo", null);
  const [ordenacao, setOrdenacao] = useSessionState<string>("financeiro:ordenacao", "envio_desc");
  const [somenteOverdue, setSomenteOverdue] = useSessionState<boolean>("financeiro:somenteOverdue", false);
  const [isExportingAuditoria, setIsExportingAuditoria] = useState(false);

  const [editing, setEditing] = useState<FinanceiroMovimentacao | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cobOpen, setCobOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRowId, setExpandedRowId] = useSessionState<string | null>("financeiro:expandedRowId", null);
  const [importPagadoresOpen, setImportPagadoresOpen] = useState(false);
  const [analiseResultados, setAnaliseResultados] = useState<Record<string, import("@/lib/excel-analysis-utils").AnaliseResultado[]>>({});
  const [analiseComparacoes, setAnaliseComparacoes] = useState<Record<string, import("@/lib/excel-analysis-utils").ComparacaoResultado[]>>({});
  const [analiseLoading, setAnaliseLoading] = useState<Record<string, boolean>>({});
  const [analiseNotasOrfas, setAnaliseNotasOrfas] = useState<Record<string, import("@/lib/excel-analysis-utils").NotaOrfa[]>>({});
  // Cache de análise no nível do contrato (chave = financeiro_movimentacoes.id).
  // O resultado bruto é compartilhado entre a linha-mãe e todas as linhas de pagadores/substipulantes.
  const motherAnalysisCache = useRef<Map<string, {
    key: string;
    resultados: import("@/lib/excel-analysis-utils").AnaliseResultado[];
    comparacoes: import("@/lib/excel-analysis-utils").ComparacaoResultado[];
    notasOrfas: import("@/lib/excel-analysis-utils").NotaOrfa[];
    temXls: boolean;
  }>>(new Map());
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoRow, setHistoricoRow] = useState<FinanceiroRow | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);

  // Realtime exclusivo da aba Financeiro — refetch incremental por linha,
  // sem reload, sem reset de filtros/estado. Cleanup automático ao sair.
  const { pendingCount, applyPending } = useFinanceiroRealtime({
    enabled: !!user && canViewFinanceiro,
    mesReferencia: mes,
  });

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
        .select("id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, data_rescisao, contrato_suspenso, pagamento_via_deposito, vidas, nao_faturado_financeiro, exige_po_pc, periodo_especifico_cobranca, periodo_cobranca_inicio")
        .in("id", empresaIds);
      if (error) throw error;
      const map: Record<string, {
        nome: string;
        codigo: string | null;
        cnpj: string | null;
        vidas: number | null;
        tipo_movimentacao: string | null;
        periodo_movimentacao: string | null;
        data_corte: number | null;
        ativa: boolean;
        pagamento_via_deposito: boolean;
        nao_faturado_financeiro: boolean;
        exige_po_pc: boolean;
        periodo_especifico_cobranca: boolean;
        periodo_cobranca_inicio: string | null;
      }> = {};
      data.forEach((e: any) => {
        const statusOk = (e.status_empresa ?? "Ativa") === "Ativa";
        const ativa = statusOk && !e.data_rescisao && !e.contrato_suspenso;
        map[e.id] = {
          nome: e.nome,
          codigo: e.codigo_contrato,
          cnpj: e.cnpj,
          vidas: e.vidas ?? 0,
          tipo_movimentacao: e.tipo_movimentacao ?? null,
          periodo_movimentacao: e.periodo_movimentacao ?? null,
          data_corte: e.data_corte ?? null,
          ativa,
          pagamento_via_deposito: !!e.pagamento_via_deposito,
          nao_faturado_financeiro: !!e.nao_faturado_financeiro,
          exige_po_pc: !!e.exige_po_pc,
          periodo_especifico_cobranca: !!e.periodo_especifico_cobranca,
          periodo_cobranca_inicio: e.periodo_cobranca_inicio ?? null,
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

  // Classificação do tipo de anexo (Excel / PDF NFS-e / Boleto / Comprovante / Outros)
  const classifyAnexoTipo = (nome: string | null, mime: string | null): string => {
    const n = (nome || "").toLowerCase();
    const m = (mime || "").toLowerCase();
    if (/\.(xlsx|xlsm|xls|csv)$/.test(n) || m.includes("spreadsheet") || m.includes("excel") || m === "text/csv") {
      return "Excel do faturamento";
    }
    if (/boleto/.test(n)) return "Boleto";
    if (n.endsWith(".pdf") || m === "application/pdf") return "PDF da NFS-e";
    if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(n)) return "Comprovante";
    return "Outros";
  };

  // IDs de TODOS os uploaders presentes nos anexos (para nomes nos filtros/export/auditoria)
  const allUploaderIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(anexosMap).forEach((list: any) => {
      (list as any[]).forEach((a) => { if (a.uploaded_by) s.add(a.uploaded_by); });
    });
    return Array.from(s);
  }, [anexosMap]);

  const { data: allUploaderMap = {} } = useQuery({
    queryKey: ["financeiro-anexos-uploaders", allUploaderIds.sort().join(",")],
    queryFn: async () => {
      if (allUploaderIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", allUploaderIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.user_id] = p.display_name || p.username || "—"; });
      return map;
    },
    enabled: allUploaderIds.length > 0,
  });

  const anexadoPorOptions = useMemo(() => {
    return allUploaderIds
      .map((id) => ({ id, nome: allUploaderMap[id] || "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [allUploaderIds, allUploaderMap]);

  const TIPOS_ANEXO = ["Excel do faturamento", "PDF da NFS-e"];

  // Conjunto de movIds que casam com os filtros de anexo (Anexado por / Tipo)
  const movIdsMatchAnexoFilters = useMemo(() => {
    if (!filtroAnexadoPor && !filtroTipoAnexo) return null;
    const set = new Set<string>();
    Object.entries(anexosMap).forEach(([movId, list]) => {
      const match = (list as any[]).some((a) => {
        if (filtroAnexadoPor && a.uploaded_by !== filtroAnexadoPor) return false;
        if (filtroTipoAnexo && classifyAnexoTipo(a.nome_arquivo, a.mime_type) !== filtroTipoAnexo) return false;
        return true;
      });
      if (match) set.add(movId);
    });
    return set;
  }, [anexosMap, filtroAnexadoPor, filtroTipoAnexo]);



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
        if (emp?.nao_faturado_financeiro) return false;
        // Oculta empresas desativadas (rescindidas/suspensas/inativas) pelo cadastro
        return emp ? emp.ativa : true;
      })

      .map((f) => {
      const emp = empresasMap[f.empresa_id];
      const envioOperacional = !!operacionaisMap[`${f.empresa_id}|${f.periodo}`];
      // "Período / Corte" baseado na configuração da empresa.
      // Quando a empresa possui período específico de cobrança (intervalo de 30 dias),
      // exibe o intervalo calculado para a competência da movimentação.
      let periodoCorte: string;
      if (emp?.periodo_especifico_cobranca && emp.periodo_cobranca_inicio && f.mes_referencia) {
        const intervalo = calcularPeriodoCobranca(emp.periodo_cobranca_inicio, f.mes_referencia);
        periodoCorte = intervalo
          ? `Período de: ${formatPeriodoCobranca(intervalo.inicio, intervalo.fim)}`
          : "—";
      } else {
        periodoCorte = emp
          ? emp.tipo_movimentacao === "Diária" && emp.data_corte
            ? `Diária — corte dia ${String(emp.data_corte).padStart(2, "0")}`
            : emp.periodo_movimentacao
              ? `Fechada — ${emp.periodo_movimentacao}`
              : "—"
          : "—";
      }
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
        empresa_vidas: emp?.vidas ?? 0,
        periodo_corte: periodoCorte,
        status: calcularStatusFinanceiro(f, envioOperacional, anexosParaStatus, !!emp?.exige_po_pc),
        anexos_count: anexosAll.length + (anexosCadastroCountMap[`${f.empresa_id}|${f.periodo}`] || 0),
        enviado_por_nome: uploaderId ? uploaderMap[uploaderId] || null : null,
        faturamento_iniciado_por: (f as any).faturamento_iniciado_por ?? null,
        faturamento_iniciado_por_nome: (f as any).faturamento_iniciado_por_nome ?? null,
        faturamento_iniciado_em: (f as any).faturamento_iniciado_em ?? null,
        retroativo: temRetroativo,
        pagamento_via_deposito: !!emp?.pagamento_via_deposito,
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
      if (filtroStatus.length > 0 && !filtroStatus.includes(r.status)) return false;
      if (filtroTipo.length > 0 && !filtroTipo.includes(r.tipo_cobranca || "")) return false;
      if (movIdsMatchAnexoFilters && !movIdsMatchAnexoFilters.has(r.id)) return false;
      if (somenteOverdue && (r.dentro_prazo || r.data_envio_nota)) return false;
      if (filtroGrupo) {
        const g = empresaGrupoMap?.get(r.empresa_id);
        if (!g || g.grupo_id !== filtroGrupo) return false;
      }
      return true;
    }).map((r) => {
      const g = empresaGrupoMap?.get(r.empresa_id);
      return g ? ({ ...r, grupo_nome: g.nome_grupo, grupo_id: g.grupo_id } as any) : r;
    });

    // Cada linha = 1 pagador individual (1 CNPJ).
    // - Sem pagadores cadastrados: mostra a linha-mãe sozinha.
    // - Com pagadores cadastrados: mostra um por um. Se o CNPJ da empresa-mãe NÃO estiver
    //   entre os pagadores cadastrados, inclui também a linha-mãe (evita "sumir" o CNPJ do contrato).
    const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
    const expanded: FinanceiroRow[] = [];
    base.forEach((r) => {
      const pagadores = (pagadoresCadastradosMap[r.empresa_id] || []).filter((p) => p.ativo);

      if (pagadores.length === 0) {
        expanded.push({ ...r, rowKey: r.id, pagador_id: null });
        return;
      }

      const cnpjMae = onlyDigits(r.empresa_cnpj);
      const cnpjsPagadores = new Set(pagadores.map((p) => onlyDigits(p.cnpj)).filter(Boolean));
      const maeNaoCadastrada = !!cnpjMae && !cnpjsPagadores.has(cnpjMae);

      if (maeNaoCadastrada || pagadores.length === 0) {
        expanded.push({ ...r, rowKey: r.id, pagador_id: null });
      }

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
  }, [allRows, busca, filtroStatus, filtroTipo, filtroPeriodo, somenteOverdue, pagadoresCadastradosMap, movIdsMatchAnexoFilters, filtroGrupo, empresaGrupoMap]);

  // Ordenação aplicada após filtros
  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
      (a || "").localeCompare(b || "", "pt-BR", { sensitivity: "base" });
    const cmpDate = (a: string | null | undefined, b: string | null | undefined, dir: 1 | -1) => {
      const av = a ? new Date(a).getTime() : null;
      const bv = b ? new Date(b).getTime() : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulos sempre ao final
      if (bv === null) return -1;
      return (av - bv) * dir;
    };
    switch (ordenacao) {
      case "envio_desc":
        arr.sort((a, b) => cmpDate((a as any).data_envio_nota, (b as any).data_envio_nota, -1));
        break;
      case "envio_asc":
        arr.sort((a, b) => cmpDate((a as any).data_envio_nota, (b as any).data_envio_nota, 1));
        break;
      case "venc_asc":
        arr.sort((a, b) => cmpDate((a as any).data_vencimento, (b as any).data_vencimento, 1));
        break;
      case "venc_desc":
        arr.sort((a, b) => cmpDate((a as any).data_vencimento, (b as any).data_vencimento, -1));
        break;
      case "empresa_asc":
        arr.sort((a, b) => cmpStr(a.empresa_nome, b.empresa_nome));
        break;
      case "empresa_desc":
        arr.sort((a, b) => cmpStr(b.empresa_nome, a.empresa_nome));
        break;
      case "vidas_desc":
        arr.sort((a, b) => (b.empresa_vidas || 0) - (a.empresa_vidas || 0));
        break;
      case "vidas_asc":
        arr.sort((a, b) => (a.empresa_vidas || 0) - (b.empresa_vidas || 0));
        break;
      case "status":
        arr.sort((a, b) => cmpStr(a.status, b.status) || cmpStr(a.empresa_nome, b.empresa_nome));
        break;
    }
    return arr;
  }, [filteredRows, ordenacao]);

  // KPIs
  const kpis = useMemo(() => {
    const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
    const empresasUnicas = new Map<string, string | null>();
    kpiRows.forEach((r) => {
      if (!empresasUnicas.has(r.empresa_id)) empresasUnicas.set(r.empresa_id, r.empresa_cnpj);
    });
    let totalPagadores = 0;
    empresasUnicas.forEach((cnpjMae, empId) => {
      const lista = (pagadoresCadastradosMap[empId] || []).filter((p: any) => p.ativo);
      if (lista.length === 0) {
        totalPagadores += 1;
      } else {
        const cnpjsPag = new Set(lista.map((p: any) => onlyDigits(p.cnpj)).filter(Boolean));
        const incluiMae = !!onlyDigits(cnpjMae) && !cnpjsPag.has(onlyDigits(cnpjMae));
        totalPagadores += lista.length + (incluiMae ? 1 : 0);
      }
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
        .select("id, nome, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, responsavel_contrato, nao_faturado_financeiro, data_implantacao")
        .eq("nao_faturado_financeiro", false);
      if (empErr) throw empErr;

      const PERIODO_FIM_DIA: Record<string, number> = {
        "01-05": 5, "05-10": 10, "10-15": 15, "15-20": 20, "20-25": 25, "25-30": 30,
      };
      const vigenciaAlcancaPeriodo = (dataImpl: string | null | undefined, periodo: string) => {
        if (!dataImpl) return true;
        const [yi, mi, di] = dataImpl.split("-").map(Number);
        const [yr, mrn] = mes.split("-").map(Number);
        if (yi > yr || (yi === yr && mi > mrn)) return false;
        if (yi < yr || (yi === yr && mi < mrn)) return true;
        return di <= (PERIODO_FIM_DIA[periodo] ?? 31);
      };


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
          if (base && PERIODOS_VALIDOS.has(base)) {
            // Pula contratos novos cuja vigência ultrapassa o fim do período no mês
            if (vigenciaAlcancaPeriodo((e as any).data_implantacao, base)) {
              periodos.add(base);
            }
          }
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

      // Dedup em memória (mesma empresa+período pode entrar duas vezes pela junção de fontes)
      const linhasMap = new Map<string, typeof linhas[number]>();
      for (const l of linhas) {
        const k = `${l.empresa_id}|${l.periodo}`;
        if (!linhasMap.has(k)) linhasMap.set(k, l);
      }
      const linhasDedup = Array.from(linhasMap.values());

      // Buscar existentes para evitar duplicatas
      const { data: existentes, error: exErr } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mes);
      if (exErr) throw exErr;

      const chaves = new Set((existentes || []).map((r) => `${r.empresa_id}|${r.periodo}`));
      const novas = linhasDedup.filter((l) => !chaves.has(`${l.empresa_id}|${l.periodo}`));

      if (novas.length === 0) return { inseridas: 0, total: linhasDedup.length };

      let inseridas = 0;
      for (let i = 0; i < novas.length; i += 100) {
        const batch = novas.slice(i, i + 100);
        const { data: ins, error: insErr } = await supabase
          .from("financeiro_movimentacoes")
          .upsert(batch, { onConflict: "empresa_id,mes_referencia,periodo", ignoreDuplicates: true })
          .select("id");
        if (insErr) throw insErr;
        inseridas += ins?.length ?? 0;
      }

      return { inseridas, total: linhasDedup.length };

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

  const handleGerarHistorico = (row: FinanceiroRow) => {
    setHistoricoRow(row);
    setHistoricoDialogOpen(true);
  };

  // Versão do parser Excel/PDF — bumpar invalida todos os caches em memória.
  const ANALISE_PARSER_VERSION = "14";

  // Computa a análise no NÍVEL DO CONTRATO (financeiro_movimentacoes.id).
  // Faz download/parse dos anexos uma única vez por movimentação e devolve
  // todos os blocos (1 por CNPJ encontrado na planilha). O resultado é cacheado
  // em motherAnalysisCache para ser reutilizado pelas linhas de pagadores.
  const computeMotherAnalysis = async (
    row: FinanceiroRow,
    opts: { force?: boolean } = {},
  ): Promise<{
    key: string;
    resultados: import("@/lib/excel-analysis-utils").AnaliseResultado[];
    comparacoes: import("@/lib/excel-analysis-utils").ComparacaoResultado[];
    notasOrfas: import("@/lib/excel-analysis-utils").NotaOrfa[];
    temXls: boolean;
  } | null> => {
    let anexos = (anexosMap[row.id] || []) as Array<{
      mime_type: string | null;
      nome_arquivo: string | null;
      storage_path: string | null;
      created_at: string;
    }>;
    const { isXlsAnexo, isPdfAnexo } = await import("@/lib/financeiro-utils");

    if (anexos.length === 0) {
      await queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
      const fresh = (queryClient.getQueryData(["financeiro-anexos-list", movIds.sort().join(",")]) as any) || {};
      anexos = (fresh[row.id] || []) as typeof anexos;
    }

    const xlsAnexos = anexos.filter((a) => isXlsAnexo(a) && a.storage_path);
    const pdfAnexos = anexos.filter((a) => isPdfAnexo(a) && a.storage_path);
    const tipoAnalise = ((row as any).tipo_analise as string) || "normal";

    const cacheKey =
      [...xlsAnexos, ...pdfAnexos].map((a) => a.storage_path).sort().join("|") +
      `::${tipoAnalise}::v${ANALISE_PARSER_VERSION}`;

    if (!opts.force) {
      const hit = motherAnalysisCache.current.get(row.id);
      if (hit && hit.key === cacheKey) return hit;
    }

    if (xlsAnexos.length === 0) {
      const empty = { key: cacheKey, resultados: [], comparacoes: [], notasOrfas: [], temXls: false };
      motherAnalysisCache.current.set(row.id, empty);
      return empty;
    }

    const {
      analisarExcelFinanceiroPorPagador,
      analisarExcelFinanceiroPorCnpj,
      cruzarExcelComPdfs,
      compararExcelComPdf,
      compararExcelComPdfSimplificado,
    } = await import("@/lib/excel-analysis-utils");
    const { analisarExcelMotoHonda } = await import("@/lib/excel-analysis-moto-honda");
    const { analisarPdfFinanceiro, analisarPdfFinanceiroSimplificado } = await import(
      "@/lib/pdf-analysis-utils"
    );

    // PDFs (análise completa + hash + buffer)
    const pdfResultados = await Promise.all(
      pdfAnexos.map(async (a) => {
        try {
          const { data, error } = await supabase.storage
            .from("anexos-financeiro")
            .download(a.storage_path!);
          if (error) throw error;
          const buf = await data.arrayBuffer();
          const hash = await sha256Hex(buf);
          const r = await analisarPdfFinanceiro(buf);
          return { arquivo: a.nome_arquivo || "PDF", buf, hash, ...r };
        } catch (err: any) {
          toast.error(`Erro ao analisar PDF ${a.nome_arquivo}: ${err.message || err}`);
          return null;
        }
      }),
    );
    const pdfsValidos = pdfResultados.filter((p) => p !== null) as Array<
      import("@/lib/pdf-analysis-utils").AnalisePdfResultado & {
        arquivo: string;
        buf: ArrayBuffer;
        hash: string;
      }
    >;

    const onlyDigitsLocal = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

    // ============ MOTO HONDA: fluxo legado (sem split por CNPJ) ============
    if (tipoAnalise === "moto_honda") {
      const resultados = await Promise.all(
        xlsAnexos.map(async (a) => {
          try {
            const { data, error } = await supabase.storage
              .from("anexos-financeiro")
              .download(a.storage_path!);
            if (error) throw error;
            const buf = await data.arrayBuffer();
            const hash = await sha256Hex(buf);
            const r = await analisarExcelMotoHonda(buf);
            return { pagador: a.nome_arquivo || "Pagador", _hash: hash, _arquivo: a.nome_arquivo, ...r };
          } catch (err: any) {
            toast.error(`Erro ao analisar ${a.nome_arquivo}: ${err.message || err}`);
            return {
              pagador: a.nome_arquivo || "Pagador",
              _hash: null as string | null,
              _arquivo: a.nome_arquivo,
              enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
              apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
              inclusoes: { quantidade: 0, total: 0 },
              avisos: [`Falha ao ler arquivo: ${err.message || err}`],
            };
          }
        }),
      );

      const useSimplificado =
        pdfsValidos.length > 0 &&
        pdfsValidos.every((p) => {
          const semDetalhes =
            (!p.enfermaria || (p.enfermaria.total === 0 && p.enfermaria.beneficiarios === null)) &&
            (!p.apartamento || (p.apartamento.total === 0 && p.apartamento.beneficiarios === null));
          return semDetalhes;
        });

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
          const pdf = pdfsSimples[idx] ?? pdfsSimples[0] ?? null;
          return compararExcelComPdfSimplificado(excel, pdf);
        });
      } else {
        comparacoes = resultados.map((excel, idx) => {
          const pdf = pdfsValidos[idx] ?? pdfsValidos[0] ?? null;
          return compararExcelComPdf(excel, pdf);
        });
      }

      const out = {
        key: cacheKey,
        resultados: resultados as any,
        comparacoes: comparacoes as any,
        notasOrfas: [] as any,
        temXls: true,
      };
      motherAnalysisCache.current.set(row.id, out);
      return out;
    }

    // ============ FLUXO NORMAL: agrupamento por CNPJ ============
    const blocosTotais: import("@/lib/excel-analysis-utils").AnalisePorCnpj[] = [];
    const metaByCnpj = new Map<string, { hashExcel: string | null; arquivo: string | null }>();

    for (const a of xlsAnexos) {
      try {
        const { data, error } = await supabase.storage
          .from("anexos-financeiro")
          .download(a.storage_path!);
        if (error) throw error;
        const buf = await data.arrayBuffer();
        const hash = await sha256Hex(buf);
        const blocos = await analisarExcelFinanceiroPorCnpj(buf);
        blocos.forEach((b) => {
          blocosTotais.push(b);
          const key = b.cnpj || `__nome::${b.nome}`;
          if (!metaByCnpj.has(key)) {
            metaByCnpj.set(key, { hashExcel: hash, arquivo: a.nome_arquivo ?? null });
          }
        });
      } catch (err: any) {
        toast.error(`Erro ao analisar ${a.nome_arquivo}: ${err.message || err}`);
      }
    }

    if (blocosTotais.length === 0) {
      const r = await (async () => {
        const a = xlsAnexos[0];
        const { data } = await supabase.storage.from("anexos-financeiro").download(a.storage_path!);
        const buf = await data!.arrayBuffer();
        return analisarExcelFinanceiroPorPagador(buf);
      })().catch(() => null);
      const resultados = r
        ? [{ pagador: row.empresa_nome, ...r, _hash: null, _arquivo: xlsAnexos[0]?.nome_arquivo ?? null } as any]
        : [];
      const out = { key: cacheKey, resultados, comparacoes: [], notasOrfas: [], temXls: true };
      motherAnalysisCache.current.set(row.id, out);
      return out;
    }

    const { comparacoes, notasOrfas } = cruzarExcelComPdfs(blocosTotais, pdfsValidos);

    const resultados: import("@/lib/excel-analysis-utils").AnaliseResultado[] = blocosTotais.map(
      (b, i) => {
        const key = b.cnpj || `__nome::${b.nome}`;
        const meta = metaByCnpj.get(key);
        const cmp: any = comparacoes[i] ?? null;
        const avisos: string[] = [...(b.avisos || [])];

        // Aviso quando há PDFs anexados, mas nenhum casou com este bloco do Excel
        // (tomador do PDF diverge do CNPJ do pagador → análise completa fica inviável).
        if (pdfsValidos.length > 0 && !cmp?.arquivoPdf) {
          const tomadores = pdfsValidos
            .map((p) => {
              const cnpjFmt = p.tomadorCnpj
                ? `${p.tomadorCnpj.slice(0, 2)}.${p.tomadorCnpj.slice(2, 5)}.${p.tomadorCnpj.slice(5, 8)}/${p.tomadorCnpj.slice(8, 12)}-${p.tomadorCnpj.slice(12)}`
                : "(sem CNPJ)";
              return `${p.tomadorNome || p.arquivo} — ${cnpjFmt}`;
            })
            .join("; ");
          avisos.push(
            `Anexo não confere: o tomador do PDF (${tomadores}) é diferente do pagador do Excel. ` +
              `Por isso a Análise Completa não pode ser realizada para esta linha.`,
          );
        }

        const out: any = {
          pagador: b.nomeExibicao,
          cnpj: b.cnpj,
          nomeExibicao: b.nomeExibicao,
          enfermaria: b.enfermaria,
          apartamento: b.apartamento,
          inclusoes: b.inclusoes,
          avisos,
          _hash: meta?.hashExcel ?? null,
          _arquivo: meta?.arquivo ?? null,
        };
        if (b.retroativas) out.retroativas = b.retroativas;
        if (b.exclusoes) out.exclusoes = b.exclusoes;
        return out;
      },
    );


    const out = { key: cacheKey, resultados, comparacoes, notasOrfas, temXls: true };
    motherAnalysisCache.current.set(row.id, out);

    // Persistência em background — 1 registro por CNPJ
    const extraCompleto = { resultados, comparacoes, notasOrfas };
    Promise.all(
      resultados.map((r: any, i) => {
        const cmp = comparacoes[i] ?? null;
        const cmpAny = cmp as any;
        const pdfMatch = pdfsValidos.find(
          (p) => r?.cnpj && onlyDigitsLocal(p.tomadorCnpj) === r.cnpj,
        );
        return salvarAnalise({
          empresa_id: row.empresa_id,
          financeiro_movimentacao_id: row.id,
          pagador_id: null,
          pagador_nome: r?.nomeExibicao ?? r?.pagador ?? null,
          pagador_cnpj: r?.cnpj ? onlyDigitsLocal(r.cnpj) : null,
          mes_referencia: row.mes_referencia,
          periodo: row.periodo,
          tipo_analise: tipoAnalise,
          hash_excel: (r?._hash as string | null) ?? null,
          hash_pdf: pdfMatch?.hash ?? null,
          nome_arquivo_excel: r?._arquivo ?? null,
          nome_arquivo_pdf: cmpAny?.arquivoPdf ?? null,
          resultado: r,
          comparacao: cmp,
          resultadoCompletoExtra: i === 0 ? extraCompleto : undefined,
        });
      }),
    ).catch((persistErr) => {
      console.warn("[financeiro] persist analise falhou:", persistErr);
    });

    return out;
  };

  // Filtra os blocos por CNPJ do pagador (ou pelo nome quando não há CNPJ).
  // Se nenhum bloco corresponder, devolve um placeholder com aviso para o usuário.
  const filtrarPorPagador = (
    mother: {
      resultados: import("@/lib/excel-analysis-utils").AnaliseResultado[];
      comparacoes: import("@/lib/excel-analysis-utils").ComparacaoResultado[];
    },
    row: FinanceiroRow,
  ): {
    resultados: import("@/lib/excel-analysis-utils").AnaliseResultado[];
    comparacoes: import("@/lib/excel-analysis-utils").ComparacaoResultado[];
  } => {
    const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
    const normTxt = (s: string | null | undefined) =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const cnpjAlvo = onlyDigits(row.empresa_cnpj);
    const nomeAlvo = normTxt(row.empresa_nome);

    const indices: number[] = [];
    mother.resultados.forEach((r, i) => {
      const rcnpj = onlyDigits((r as any).cnpj);
      if (cnpjAlvo && rcnpj) {
        if (rcnpj === cnpjAlvo) indices.push(i);
        return;
      }
      // Fallback por nome quando o CNPJ do pagador não foi cadastrado
      if (!cnpjAlvo && nomeAlvo) {
        const rnome = normTxt((r as any).pagador || (r as any).nomeExibicao);
        if (rnome && (rnome === nomeAlvo || rnome.includes(nomeAlvo) || nomeAlvo.includes(rnome))) {
          indices.push(i);
        }
      }
    });

    if (indices.length === 0) {
      // Quando a linha representa a empresa-mãe (sem pagador específico) e não
      // achamos bloco com CNPJ exato, devolvemos TODOS os blocos da planilha —
      // assim a análise (Excel + PDF) continua disponível mesmo quando o CNPJ
      // do contrato difere do CNPJ que aparece dentro da planilha/PDF.
      // Adiciona um aviso explicando a divergência e qual tomador foi usado.
      if (!row.pagador_id && mother.resultados.length > 0) {
        const fmtCnpj = (d: string) =>
          d.length === 14
            ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
            : d;
        const resultadosComAviso = mother.resultados.map((r: any) => {
          const blocoCnpj = onlyDigits(r?.cnpj);
          const blocoNome = r?.nomeExibicao || r?.pagador || "—";
          const mesmoCnpj = !!blocoCnpj && !!cnpjAlvo && blocoCnpj === cnpjAlvo;
          if (mesmoCnpj) return r;
          const aviso =
            `Atenção: CNPJ ${blocoCnpj ? fmtCnpj(blocoCnpj) : "(não informado)"} (tomador "${blocoNome}") ` +
            `pertence a outra empresa — não confere com o CNPJ do contrato ` +
            `${cnpjAlvo ? fmtCnpj(cnpjAlvo) : "(não cadastrado)"} (${row.empresa_nome}). ` +
            `A análise foi feita com os dados encontrados na planilha/PDF.`;
          return { ...r, avisos: [...(r?.avisos || []), aviso] };
        });
        return {
          resultados: resultadosComAviso,
          comparacoes: mother.comparacoes.slice(),
        };
      }



      // Sem bloco correspondente — devolve placeholder informando ao usuário
      const placeholder: any = {
        pagador: row.empresa_nome,
        cnpj: cnpjAlvo || "",
        nomeExibicao: row.empresa_nome,
        enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
        apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
        inclusoes: { quantidade: 0, total: 0 },
        avisos: [
          cnpjAlvo
            ? `CNPJ ${row.empresa_cnpj} não localizado na planilha do contrato.`
            : "Pagador sem CNPJ cadastrado — não foi possível casar com a planilha.",
        ],
      };
      return { resultados: [placeholder], comparacoes: mother.comparacoes.slice() };
    }


    return {
      resultados: indices.map((i) => mother.resultados[i]),
      comparacoes: indices.map((i) => mother.comparacoes[i]).filter(Boolean) as any,
    };
  };

  const runAnalise = async (
    row: FinanceiroRow,
    opts: { force?: boolean } = {},
  ) => {
    const rowKey = row.rowKey ?? row.id;

    // Cache de tela: evita reset desnecessário
    const cachedRow = analiseResultados[rowKey];

    setAnaliseLoading((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const mother = await computeMotherAnalysis(row, opts);
      if (!mother) return;

      // Sem Excel anexado em nenhum nível do contrato
      if (!mother.temXls) {
        setAnaliseResultados((prev) => ({ ...prev, [rowKey]: [] }));
        setAnaliseComparacoes((prev) => ({ ...prev, [rowKey]: [] }));
        setAnaliseNotasOrfas((prev) => ({ ...prev, [rowKey]: [] }));
        return;
      }

      // Pula re-renderização se já está com o mesmo cache key
      if (!opts.force && cachedRow && (cachedRow as any)._key === mother.key) {
        return;
      }

      // Toda linha = 1 pagador individual. Sempre filtra pelo CNPJ da própria linha.
      const filtrado = filtrarPorPagador(mother, row);
      const resFiltrados = filtrado.resultados.slice();
      Object.defineProperty(resFiltrados, "_key", { value: mother.key, enumerable: false });
      setAnaliseResultados((prev) => ({ ...prev, [rowKey]: resFiltrados }));
      setAnaliseComparacoes((prev) => ({ ...prev, [rowKey]: filtrado.comparacoes }));
      setAnaliseNotasOrfas((prev) => ({ ...prev, [rowKey]: [] }));

    } finally {
      setAnaliseLoading((prev) => (prev[rowKey] ? { ...prev, [rowKey]: false } : prev));
    }
  };



  const [isExportingErros, setIsExportingErros] = useState(false);
  const handleExportErros = async () => {
    setIsExportingErros(true);
    try {
      const fmtMoney = (n: number | null | undefined) =>
        n === null || n === undefined || isNaN(n as number)
          ? "—"
          : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n as number);
      const fmtNum = (n: number | null | undefined) =>
        n === null || n === undefined || isNaN(n as number) ? "—" : String(n);

      // Carrega análises com erro persistidas no banco para o mês atual
      const analises = await listarAnalisesComErro(mes);
      if (analises.length === 0) {
        toast.success("Nenhuma divergência encontrada — todas as análises estão OK.");
        return;
      }

      type Linha = {
        empresa: string;
        contrato: string;
        cnpj: string;
        pagador: string;
        mes: string;
        campo: string;
        valor_excel: string;
        valor_pdf: string;
        mensagem: string;
      };
      const linhas: Linha[] = [];

      for (const a of analises) {
        const emp = empresasMap[a.empresa_id];
        for (const d of a.divergencias || []) {
          const isMoney = !/benefici/i.test(d.campo);
          linhas.push({
            empresa: emp?.nome || "",
            contrato: emp?.codigo || "",
            cnpj: emp?.cnpj || "",
            pagador: a.pagador_nome || emp?.nome || "",
            mes: formatMesReferencia(a.mes_referencia),
            campo: d.campo,
            valor_excel: isMoney ? fmtMoney(d.valor_excel) : fmtNum(d.valor_excel),
            valor_pdf: isMoney ? fmtMoney(d.valor_pdf) : fmtNum(d.valor_pdf),
            mensagem: d.mensagem,
          });
        }
      }

      if (linhas.length === 0) {
        toast.success("Nenhuma divergência encontrada — todas as análises estão OK.");
        return;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Erros de Análise");
      ws.columns = [
        { header: "Empresa", key: "empresa", width: 38 },
        { header: "Contrato", key: "contrato", width: 14 },
        { header: "CNPJ", key: "cnpj", width: 20 },
        { header: "Pagador", key: "pagador", width: 38 },
        { header: "Mês", key: "mes", width: 12 },
        { header: "Campo", key: "campo", width: 32 },
        { header: "Valor Excel", key: "valor_excel", width: 18 },
        { header: "Valor PDF", key: "valor_pdf", width: 18 },
        { header: "Mensagem", key: "mensagem", width: 60 },
      ];
      ws.getRow(1).font = { bold: true };
      linhas.forEach((l) => ws.addRow(l));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financeiro-erros-${mes}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${linhas.length} erro(s) exportado(s).`);
    } catch (e: any) {
      toast.error("Falha ao exportar erros: " + (e?.message || e));
    } finally {
      setIsExportingErros(false);
    }
  };

  const handleExportAuditoriaAnexos = async () => {
    setIsExportingAuditoria(true);
    try {
      const filteredMovIds = new Set(filteredRows.map((r) => r.id));
      type LinhaAud = {
        empresa: string; contrato: string; cnpj: string; competencia: string; periodo: string;
        tipo_anexo: string; nome_arquivo: string; anexado_por: string; data_hora: string; origem: string;
      };
      const linhas: LinhaAud[] = [];
      const empById: Record<string, FinanceiroRow> = {};
      filteredRows.forEach((r) => { empById[r.id] = r; });

      Object.entries(anexosMap).forEach(([movId, list]) => {
        if (!filteredMovIds.has(movId)) return;
        const row = empById[movId];
        if (!row) return;
        (list as any[]).forEach((a) => {
          if (filtroAnexadoPor && a.uploaded_by !== filtroAnexadoPor) return;
          const tipo = classifyAnexoTipo(a.nome_arquivo, a.mime_type);
          if (filtroTipoAnexo && tipo !== filtroTipoAnexo) return;
          linhas.push({
            empresa: row.empresa_nome,
            contrato: row.empresa_codigo || "",
            cnpj: row.empresa_cnpj || "",
            competencia: formatMesReferencia(row.mes_referencia),
            periodo: row.periodo || "",
            tipo_anexo: tipo,
            nome_arquivo: a.nome_arquivo || "",
            anexado_por: a.uploaded_by ? (allUploaderMap[a.uploaded_by] || "—") : "—",
            data_hora: a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : "",
            origem: a.origem || "normal",
          });
        });
      });

      if (linhas.length === 0) {
        toast.warning("Nenhum anexo para auditar com os filtros atuais");
        return;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Auditoria de Anexos");
      ws.columns = [
        { header: "Empresa", key: "empresa", width: 38 },
        { header: "Contrato", key: "contrato", width: 14 },
        { header: "CNPJ", key: "cnpj", width: 20 },
        { header: "Competência", key: "competencia", width: 14 },
        { header: "Período", key: "periodo", width: 12 },
        { header: "Tipo do anexo", key: "tipo_anexo", width: 24 },
        { header: "Nome do arquivo", key: "nome_arquivo", width: 50 },
        { header: "Anexado por", key: "anexado_por", width: 28 },
        { header: "Data/Hora", key: "data_hora", width: 22 },
        { header: "Origem", key: "origem", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      linhas.forEach((l) => ws.addRow(l));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria-anexos-${mes}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${linhas.length} anexo(s) exportado(s).`);
    } catch (e: any) {
      toast.error("Falha ao exportar auditoria: " + (e?.message || e));
    } finally {
      setIsExportingAuditoria(false);
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
    <>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoricoOpen(true)}
              className="gap-1.5"
              title="Ver histórico de análises Excel × PDF salvas"
            >
              <History className="h-3.5 w-3.5" />
              Histórico
            </Button>
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
        </div>

        {/* Filtros da tabela */}
        <Card className="rounded-xl shadow-sm">
          {filtroGrupo && (
            <div className="px-4 pt-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Users className="h-3 w-3" />
                <span>
                  Visualizando grupo:{" "}
                  <strong>
                    {(gruposAtivos ?? []).find((g) => g.id === filtroGrupo)?.nome_grupo ?? "—"}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setFiltroGrupo(null)}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
                  title="Limpar filtro de grupo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
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
              <MultiSelectFilter
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                selected={filtroStatus}
                onChange={setFiltroStatus}
                allLabel="Todos os status"
                searchPlaceholder="Buscar status..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de cobrança</Label>
              <MultiSelectFilter
                options={tiposUnicos.map((t) => ({ value: t, label: t }))}
                selected={filtroTipo}
                onChange={setFiltroTipo}
                allLabel="Todos os tipos"
                searchPlaceholder="Buscar tipo..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Anexado por</Label>
              <MultiSelectFilter
                options={anexadoPorOptions.map((u) => ({ value: u.id, label: u.nome }))}
                selected={filtroAnexadoPor ? [filtroAnexadoPor] : []}
                onChange={(vals) => setFiltroAnexadoPor(vals.length ? vals[vals.length - 1] : null)}
                allLabel="Todos os usuários"
                searchPlaceholder="Buscar usuário..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de anexo</Label>
              <MultiSelectFilter
                options={TIPOS_ANEXO.map((t) => ({ value: t, label: t }))}
                selected={filtroTipoAnexo ? [filtroTipoAnexo] : []}
                onChange={(vals) => setFiltroTipoAnexo(vals.length ? vals[vals.length - 1] : null)}
                allLabel="Todos os tipos"
                searchPlaceholder="Buscar tipo..."
              />
            </div>


            <div className="space-y-1.5">
              <Label className="text-xs">Ordenar por</Label>
              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="envio_desc">Envio da nota (mais recente)</SelectItem>
                  <SelectItem value="envio_asc">Envio da nota (mais antigo)</SelectItem>
                  <SelectItem value="venc_asc">Vencimento (mais próximo)</SelectItem>
                  <SelectItem value="venc_desc">Vencimento (mais distante)</SelectItem>
                  <SelectItem value="empresa_asc">Empresa (A → Z)</SelectItem>
                  <SelectItem value="empresa_desc">Empresa (Z → A)</SelectItem>
                  <SelectItem value="vidas_desc">Nº de vidas (maior)</SelectItem>
                  <SelectItem value="vidas_asc">Nº de vidas (menor)</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>


          </CardContent>
        </Card>

        {/* Aviso discreto quando há um burst de alterações em tempo real */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-info/40 bg-info/5 px-3 py-2 text-sm">
            <span className="text-info">
              Novas alterações financeiras disponíveis ({pendingCount}).
            </span>
            <Button size="sm" variant="outline" onClick={applyPending} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar tabela
            </Button>
          </div>
        )}

        {/* Tabela */}
        <FinanceiroTable
          rows={sortedRows}
          onEdit={handleEdit}
          onCobranca={handleCobranca}
          isLoading={isLoading}
          expandedRowId={expandedRowId}
          onToggleExpand={handleToggleExpand}
          onReanalisar={handleReanalisar}
          onGerarHistorico={canManageFinanceiro ? handleGerarHistorico : undefined}
          analiseResultados={analiseResultados}
          analiseLoading={analiseLoading}
          analiseComparacoes={analiseComparacoes}
          readOnly={!canManageFinanceiro}
          onVisualizarGrupo={(grupoId) => setFiltroGrupo(grupoId)}
          
          
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

        <HistoricoAnalisesDialog
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          mes={mes}
          empresasMap={empresasMap as any}
          canManage={!!canManageFinanceiro}
        />

        {canManageFinanceiro && (
          <GerarHistoricoDialog
            open={historicoDialogOpen}
            onOpenChange={setHistoricoDialogOpen}
            row={historicoRow}
            resultados={historicoRow ? (analiseResultados[historicoRow.rowKey ?? historicoRow.id] ?? analiseResultados[historicoRow.id] ?? null) : null}
            anexosNomes={historicoRow ? ((anexosMap[historicoRow.id] || []).map((a: any) => a.nome_arquivo).filter(Boolean) as string[]) : []}
          />
        )}
      </div>
    </>
  );
}
