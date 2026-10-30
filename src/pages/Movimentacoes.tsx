import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Download, Search, Plane, LayoutDashboard, RefreshCw, Sparkles, Mail, Send, MoreHorizontal, Eye, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useAuth } from "@/hooks/useAuth";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  calcularPeriodoPorData,
  periodoDaDataCorte,
  getCurrentMesReferencia,
  formatMesReferencia,
  formatPeriodoEmpresa,
  isPrioridadeAlertaIntenso,
} from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";
import { permiteCompetenciaMovimentacao } from "@/lib/movimentacao-primeira-competencia";
import {
  statusFinanceiroColor,
  labelStatusFinanceiro,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";

import { PrioridadeBadge } from "@/components/prioridade/PrioridadeBadge";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";
import { sincronizarEnvioDosAnexos } from "@/lib/movimentacao-envio-anexos";
import { AnexosMovimentacaoDialog } from "@/components/movimentacoes/AnexosMovimentacaoDialog";
import { useEmpresaGrupoMap } from "@/hooks/useGrupoFinanceiro";
import { papelGrupoRelatorio } from "@/lib/relatorio-grupo";
import { GrupoTag } from "@/components/financeiro/GrupoTag";
import { RelatorioManualDialog } from "@/components/movimentacoes/RelatorioManualDialog";
import { RELATORIO_VAZIO, classificarPreparacao, relatorioFinalizado, resumoEnvioRelatorios, resumoLoteEnvio, selecionarLoteRelatorios } from "@/lib/movimentacao-relatorio";
import { RelatorioStatusBadge } from "@/components/movimentacoes/RelatorioStatusBadge";
import { RelatorioLoteDialog } from "@/components/movimentacoes/RelatorioLoteDialog";
import { PrepararRelatoriosDialog, type ResultadoPreparacao } from "@/components/movimentacoes/PrepararRelatoriosDialog";
import { gerarRelatoriosPortal } from "@/services/portalEmpresaRelatorios";


import DashboardAdministradoras from "@/pages/DashboardAdministradoras";
import Dashboard from "@/pages/Dashboard";

import ExcelJS from "exceljs";

type EmpresaOption = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  responsavel_contrato: string | null;
  responsavel_user_id?: string | null;
  data_corte: number | null;
  tipo_contrato?: string | null;
};

type EmpresaResponsavel = {
  id?: string | null;
  responsavel_contrato?: string | null;
  responsavel_user_id?: string | null;
} | null | undefined;

type FeriasOriginalRow = {
  responsavel_original_nome: string | null;
  ferias_cadastro_empresas?: {
    empresa_id: string | null;
    status: string | null;
    responsavel_temporario_nome: string | null;
  }[] | null;
};


const emptyForm = {
  empresa_id: "",
  mes_referencia: getCurrentMesReferencia(),
  periodo: "01-05",
  data_envio_empresa: null as string | null,
  data_retorno_empresa: null as string | null,
  data_envio_financeiro: null as string | null,
  responsavel_movimentacao: "",
  observacoes: "",
  tipo_movimentacao: null as string | null,
};

/** Título numerado de seção dentro da janela de movimentação (só organização visual). */
function SecaoModal({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[11px] font-bold">
        {numero}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

export default function Movimentacoes() {
  const [activeTab, setActiveTab] = useState<"empresas" | "administradoras">("empresas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [verSomenteSemEmpresa, setVerSomenteSemEmpresa] = useState(false);
  const [anexosMov, setAnexosMov] = useState<{ id: string; nome: string | null; mes: string | null; periodo: string | null } | null>(null);
  const [relatorioMov, setRelatorioMov] = useState<Movimentacao | null>(null);
  const [relatorioStatusInicial, setRelatorioStatusInicial] = useState<string | undefined>(undefined);
  const [loteOpen, setLoteOpen] = useState(false);
  const [prepararResultado, setPrepararResultado] = useState<ResultadoPreparacao | null>(null);
  const [preparandoContrato, setPreparandoContrato] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin, isExecutivo, role, isViewOnly } = useAuth();
  const canEdit = !isViewOnly && isAdmin;
  const canEditDates = !isViewOnly && (isAdmin || role === "comum" || role === "administradoras");
  const [gerandoMov, setGerandoMov] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState("");
  const { data: empresaGrupoMap } = useEmpresaGrupoMap();

  /** Grupo Financeiro do contrato selecionado no formulário */
  const grupoForm = form.empresa_id ? empresaGrupoMap?.get(form.empresa_id) ?? null : null;
  const grupoPrincipalId = grupoForm?.principal_empresa_id ?? null;
  const formEhPrincipalGrupo = !!grupoPrincipalId && grupoPrincipalId === form.empresa_id;
  const formEhSecundarioGrupo = !!grupoPrincipalId && grupoPrincipalId !== form.empresa_id;





  const handleGerarMovimentacoes = async () => {
    if (gerandoMov) return;
    if (!confirm(`Gerar as movimentações faltantes da competência ${filterMes}?`)) return;
    setGerandoMov(true);
    try {
      // 1) Ativa contratos recém implantados cuja primeira competência já chegou
      let ativados = 0;
      const { data: rpcData, error: rpcErr } = await supabase.rpc("ativar_contratos_pendentes" as any);
      if (rpcErr) throw rpcErr;
      ativados = typeof rpcData === "number" ? rpcData : 0;

      // 2) Provisiona movimentações faltantes da competência selecionada
      const { data: emps, error: empErr } = await supabase
        .from("empresas")
        .select("id, nome, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, tipo_contrato, status_implantacao, primeira_competencia_financeira, responsavel_contrato, responsavel_user_id");
      if (empErr) throw empErr;

      const { data: existentes, error: movErr } = await supabase
        .from("movimentacoes")
        .select("empresa_id")
        .eq("mes_referencia", filterMes);
      if (movErr) throw movErr;
      const jaTem = new Set((existentes ?? []).map((m: any) => m.empresa_id));

      const novos: TablesInsert<"movimentacoes">[] = [];
      for (const e of (emps ?? []) as any[]) {
        if (e.status_empresa === "Inativa") continue;
        if (jaTem.has(e.id)) continue;
        if (!permiteCompetenciaMovimentacao(e, filterMes)) continue;

        const tipo = e.tipo_movimentacao ?? "Fechada";
        let periodo: string | null = null;
        if (e.tipo_contrato === "ADMINISTRADORA" && e.data_corte) periodo = periodoDaDataCorte(e.data_corte);
        else if (tipo === "Diária" && e.data_corte) periodo = periodoDaDataCorte(e.data_corte);
        else periodo = e.periodo_movimentacao ?? null;
        if (!periodo) continue;

        novos.push({
          empresa_id: e.id,
          mes_referencia: filterMes,
          periodo,
          tipo_movimentacao: tipo,
          responsavel_movimentacao:
            (e.responsavel_user_id ? profilesMap.get(e.responsavel_user_id) : null) ?? e.responsavel_contrato ?? null,
        });
      }

      let criadas = 0;
      if (novos.length > 0) {
        const { error: insErr } = await supabase.from("movimentacoes").insert(novos);
        if (insErr) throw insErr;
        criadas = novos.length;
      }

      toast({
        title: criadas > 0 || ativados > 0 ? "Movimentações geradas" : "Nada a gerar",
        description:
          criadas > 0 || ativados > 0
            ? `${criadas} movimentação(ões) criada(s)${ativados > 0 ? ` • ${ativados} contrato(s) ativado(s)` : ""}.`
            : "Todos os contratos já possuem movimentação nesta competência.",
      });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["contratos-recem-implantados"] });
    } catch (e: any) {
      toast({ title: "Erro ao gerar movimentações", description: e?.message, variant: "destructive" });
    } finally {
      setGerandoMov(false);
    }
  };




  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao, responsavel_contrato, responsavel_user_id, status_empresa, data_corte, tipo_contrato")
        .order("nome");
      if (error) throw error;
      const all = data as (EmpresaOption & { tipo_contrato?: string | null })[];
      return activeTab === "administradoras"
        ? all.filter((e) => (e.tipo_contrato ?? "") === "ADMINISTRADORA")
        : all.filter((e) => (e.tipo_contrato ?? "") !== "ADMINISTRADORA");
    },
    enabled: !!user,
  });

  const nomeContratoPrincipal = grupoPrincipalId
    ? empresas.find((e) => e.id === grupoPrincipalId)?.nome ?? null
    : null;



  const { data: profilesMap = new Map<string, string>() } = useQuery({
    queryKey: ["profiles-map-mov"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name");
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => { if (p.user_id) m.set(p.user_id, p.display_name || ""); });
      return m;
    },
    enabled: !!user,
  });

  const { data: feriasMaps = { original: new Map<string, string>(), substituto: new Map<string, string>() } } = useQuery({
    queryKey: ["ferias-owner-maps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_cadastro")
        .select("id, responsavel_original_nome, ferias_cadastro_empresas(empresa_id, status, responsavel_temporario_nome)")
        .in("status", ["em_andamento", "aguardando_retorno_contratos"]);
      if (error) throw error;

      const original = new Map<string, string>();
      const substituto = new Map<string, string>();
      ((data ?? []) as unknown as FeriasOriginalRow[]).forEach((f) => {
        const originalNome = (f.responsavel_original_nome ?? "").trim();
        (f.ferias_cadastro_empresas ?? []).forEach((e) => {
          if (!e.empresa_id) return;
          if (!["redistribuida", "aguardando_fechamento"].includes(e.status ?? "")) return;
          if (originalNome) original.set(e.empresa_id, originalNome);
          const sub = (e.responsavel_temporario_nome ?? "").trim();
          if (sub) substituto.set(e.empresa_id, sub);
        });
      });
      return { original, substituto };
    },
    enabled: !!user,
  });

  const feriasOriginalMap = feriasMaps.original;
  const feriasSubstitutoMap = feriasMaps.substituto;

  // Resp. Contrato (aba Movimentações): durante férias, mostra o substituto que
  // está tocando a movimentação; caso contrário, o responsável cadastrado na aba Empresas.
  // Prioriza responsavel_user_id (fonte de verdade da aba Empresas) sobre o texto legado.
  const respContratoOf = useCallback((emp: EmpresaResponsavel): string => {
    if (!emp) return "";
    const sub = emp.id ? feriasSubstitutoMap.get(emp.id) : undefined;
    if (sub) return sub;
    const uid = emp.responsavel_user_id;
    if (uid) {
      const nm = profilesMap.get(uid);
      if (nm) return nm;
    }
    if (emp.responsavel_contrato) return emp.responsavel_contrato;
    return "";
  }, [feriasSubstitutoMap, profilesMap]);

  // Resp. Mov.: sempre o dono original do contrato (mesmo durante férias).
  const respMovOf = useCallback((emp: EmpresaResponsavel): string => {
    if (!emp) return "";
    const original = emp.id ? feriasOriginalMap.get(emp.id) : undefined;
    if (original) return original;
    const uid = emp.responsavel_user_id;
    if (uid) {
      const nm = profilesMap.get(uid);
      if (nm) return nm;
    }
    if (emp.responsavel_contrato) return emp.responsavel_contrato;
    return "";
  }, [feriasOriginalMap, profilesMap]);


  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes", "empresa-responsavel-atual", filterMes, activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano, tipo_contrato, status_implantacao, primeira_competencia_financeira, prioridade_maxima_id, contrato_via_portal)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as (Movimentacao & { empresas?: { responsavel_contrato: string | null; tipo_contrato?: string | null } | null })[];
      return activeTab === "administradoras"
        ? rows.filter((m) => ((m.empresas as any)?.tipo_contrato ?? "") === "ADMINISTRADORA")
        : rows.filter((m) => ((m.empresas as any)?.tipo_contrato ?? "") !== "ADMINISTRADORA");
    },
    enabled: !!user,
  });


  const { data: relatorios = [], isLoading: carregandoRelatorios, isError: erroRelatorios } = useQuery({
    queryKey: ["movimentacao-relatorios", filterMes, activeTab, movimentacoes.map(m => m.id)],
    enabled: !!user && movimentacoes.length > 0,
    queryFn: async () => {
      const rows = [];
      for (let i = 0; i < movimentacoes.length; i += 100) {
        const { data, error } = await supabase.from("movimentacao_relatorios").select("*").in("movimentacao_id", movimentacoes.slice(i, i + 100).map(m => m.id));
        if (error) throw error;
        rows.push(...(data ?? []));
      }
      return rows;
    },
  });
  const relatoriosMap = new Map(relatorios.map(r => [r.movimentacao_id, r]));

  // Mapa do módulo Faturamento: (empresa_id|mes|periodo) -> { nota, status, por }
  type FinInfo = {
    data_envio_nota: string | null;
    status: StatusFinanceiro;
    faturamento_por: string | null;
  };
  const { data: finMap = new Map<string, FinInfo>() } = useQuery({
    queryKey: ["financeiro-status-map", filterMes],
    queryFn: async () => {
      // RPC SECURITY DEFINER: calcula o status igual à aba Faturamento
      // (perfis Cadastro/Executiva não têm leitura em anexos_financeiro).
      const { data, error } = await supabase.rpc("status_faturamento_competencia", {
        p_mes: filterMes,
      });
      if (error) throw error;
      const m = new Map<string, FinInfo>();
      for (const r of (data ?? []) as Array<{
        empresa_id: string;
        periodo: string | null;
        status: string;
        faturamento_por: string | null;
        data_envio_nota: string | null;
      }>) {
        m.set(`${r.empresa_id}|${filterMes}|${r.periodo}`, {
          data_envio_nota: r.data_envio_nota ?? null,
          status: r.status as StatusFinanceiro,
          faturamento_por: r.faturamento_por ?? null,
        });
      }

      return m;
    },
    enabled: !!user,
  });


  // Atualização em tempo real do status vindo da aba Faturamento
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("movimentacoes-financeiro-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_movimentacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["financeiro-status-map"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos_financeiro" }, () => {
        queryClient.invalidateQueries({ queryKey: ["financeiro-status-map"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const movimentacoesSemEmpresa = useMemo(() => {
    return movimentacoes.filter((m) => !m.empresa_id || !m.empresas);
  }, [movimentacoes]);

  const handleEmpresaChange = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    const tipo = empresa?.tipo_movimentacao ?? "Fechada";
    let periodo = form.periodo;
    if (empresa?.tipo_contrato === "ADMINISTRADORA" && empresa?.data_corte) {
      periodo = periodoDaDataCorte(empresa.data_corte);
    } else if (tipo === "Fechada" && empresa?.periodo_movimentacao) {
      periodo = empresa.periodo_movimentacao;
    } else if (tipo === "Diária" && empresa?.data_corte) {
      periodo = periodoDaDataCorte(empresa.data_corte);
    }
    setForm({ ...form, empresa_id: empresaId, tipo_movimentacao: tipo, periodo });
  };

  const handleDataEnvioChange = (dateStr: string | null) => {
    // IMPORTANTE: não recalcular o período a partir da Data de Envio Empresa.
    // O período da movimentação é definido pela data_corte/periodo_movimentacao
    // da empresa (em handleEmpresaChange) e deve permanecer fixo, senão o
    // contrato "pula" de coluna no Resumo Geral por Período ao preencher datas.
    setForm({ ...form, data_envio_empresa: dateStr });
  };

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      // Anexos não são mais obrigatórios para registrar a Data de Envio ao Financeiro.

      const payload: TablesInsert<"movimentacoes"> = {
        empresa_id: values.empresa_id,
        mes_referencia: values.mes_referencia,
        periodo: values.periodo,
        data_envio_empresa: values.data_envio_empresa,
        data_retorno_empresa: values.data_retorno_empresa,
        data_envio_financeiro: values.data_envio_financeiro,
        responsavel_movimentacao: values.responsavel_movimentacao || null,
        observacoes: (() => {
          const anteriores = (values.observacoes ?? "").trim();
          const nova = novaObservacao.trim();
          if (!nova) return anteriores || null;
          const autor = (user?.id ? profilesMap.get(user.id) : "") || user?.email || "Usuário";
          const agora = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
          const entrada = `[${agora} — ${autor}] ${nova}`;
          return anteriores ? `${anteriores}\n${entrada}` : entrada;
        })(),

        tipo_movimentacao: values.tipo_movimentacao,
      };
      if (editingId) {
        const { error } = await supabase.from("movimentacoes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("movimentacoes").insert(payload);
        if (error) throw error;
      }

      // Grupo Financeiro: contrato principal replica datas e observações
      // para os demais contratos do grupo na mesma competência/período.
      // Se o grupo não tiver um contrato principal definido, o contrato
      // que está sendo editado atua como origem da replicação.
      const grupo = empresaGrupoMap?.get(values.empresa_id);
      const podeReplicar =
        !!grupo &&
        (!grupo.principal_empresa_id || grupo.principal_empresa_id === values.empresa_id);
      if (grupo && podeReplicar) {
        const { data: contratos } = await supabase
          .from("grupos_financeiros_contratos" as any)
          .select("empresa_id")
          .eq("grupo_id", grupo.grupo_id)
          .eq("ativo", true);
        const outras = (((contratos as any[]) ?? []).map((c) => c.empresa_id as string)).filter(
          (id) => id !== values.empresa_id,
        );
        if (outras.length) {
          // Atualiza as movimentações irmãs já existentes...
          // Só preenche campos vazios nos irmãos — nunca apaga nem sobrescreve dados já registrados.
          const campos = ["data_envio_empresa", "data_retorno_empresa", "data_envio_financeiro", "observacoes"] as const;
          for (const campo of campos) {
            const valor = (payload as any)[campo];
            if (valor === null || valor === undefined || valor === "") continue;
            const { error: errUpd } = await supabase
              .from("movimentacoes")
              .update({ [campo]: valor } as any)
              .in("empresa_id", outras)
              .eq("mes_referencia", values.mes_referencia)
              .eq("periodo", values.periodo)
              .is(campo, null);
            if (errUpd) throw errUpd;
          }


          // ...e cria as que ainda não existem na competência/período,
          // para que as datas do principal apareçam em todo o grupo.
          const { data: existentes } = await supabase
            .from("movimentacoes")
            .select("empresa_id")
            .in("empresa_id", outras)
            .eq("mes_referencia", values.mes_referencia)
            .eq("periodo", values.periodo);
          const jaTem = new Set(((existentes as any[]) ?? []).map((r) => r.empresa_id as string));
          const faltantes = outras.filter((id) => !jaTem.has(id));
          if (faltantes.length) {
            const novas: TablesInsert<"movimentacoes">[] = faltantes.map((empresaId) => ({
              empresa_id: empresaId,
              mes_referencia: values.mes_referencia,
              periodo: values.periodo,
              data_envio_empresa: payload.data_envio_empresa,
              data_retorno_empresa: payload.data_retorno_empresa,
              data_envio_financeiro: payload.data_envio_financeiro,
              observacoes: payload.observacoes,
              responsavel_movimentacao: payload.responsavel_movimentacao ?? null,
              tipo_movimentacao: values.tipo_movimentacao,
            }));
            const { error: errIns } = await supabase.from("movimentacoes").insert(novas);
            if (errIns) throw errIns;
          }
        }
      }

      // Anexos enviados neste processo e direcionados a outros contratos:
      // repete a "Data Envio Financeiro" nesses contratos (só se estiver vazia).
      if (editingId && payload.data_envio_financeiro) {
        await sincronizarEnvioDosAnexos(editingId, payload.data_envio_financeiro, values.mes_referencia);
      }

    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Movimentação atualizada!" : "Movimentação criada!" });
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      toast({ title: "Movimentação excluída!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setNovaObservacao("");
  };


  const openEdit = (m: Movimentacao & { empresas?: { responsavel_contrato: string | null } | null }) => {
    setEditingId(m.id);
    setNovaObservacao("");

    setForm({
      empresa_id: m.empresa_id,
      mes_referencia: m.mes_referencia,
      periodo: m.periodo,
      data_envio_empresa: m.data_envio_empresa,
      data_retorno_empresa: m.data_retorno_empresa,
      data_envio_financeiro: m.data_envio_financeiro,
      responsavel_movimentacao: m.responsavel_movimentacao ?? "",
      observacoes: m.observacoes ?? "",
      tipo_movimentacao: m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? null,
    });
    setDialogOpen(true);
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = movimentacoes.filter((m) => {
      if ((m.empresas as any)?.status_empresa === "Inativa") return false;
      // Esconde contratos recém implantados antes da primeira competência válida
      if (!permiteCompetenciaMovimentacao(m.empresas, m.mes_referencia)) return false;
      if (verSomenteSemEmpresa) return !m.empresas;
      const status = calcularStatus(m);
      if (filterPeriodo !== "all" && m.periodo !== filterPeriodo) return false;
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterResponsavel && !(respContratoOf(m.empresas) || m.responsavel_movimentacao || "").toLowerCase().includes(filterResponsavel.toLowerCase())) return false;
      if (somentePendentes && status === "Enviado ao financeiro") return false;
      if (term) {
        const nome = (m.empresas?.nome ?? "").toLowerCase();
        const codigo = (m.empresas?.codigo_contrato ?? "").toLowerCase();
        const cnpj = ((m.empresas as any)?.cnpj ?? "").toLowerCase();
        if (!nome.includes(term) && !codigo.includes(term) && !cnpj.includes(term)) return false;
      }
      return true;
    });
    rows.sort((a, b) =>
      (a.empresas?.nome ?? "").localeCompare(b.empresas?.nome ?? "", "pt-BR", { sensitivity: "base" })
    );
    return rows;
  }, [movimentacoes, filterPeriodo, filterStatus, filterResponsavel, somentePendentes, verSomenteSemEmpresa, searchTerm, respContratoOf]);

  // Contratos de grupo que não são o principal vão no e-mail do principal: ficam fora do preparo e do lote.
  const ehMembroGrupo = (empresaId: string | null | undefined) => papelGrupoRelatorio(empresaId, empresaId ? empresaGrupoMap?.get(empresaId) : null) === "membro";
  const aptosLote = selecionarLoteRelatorios(filtered, relatoriosMap, filterMes, PERIODOS).filter(m => !ehMembroGrupo(m.empresa_id));
  const movsDoMes = useMemo(() => filtered.filter(m => m.empresa_id && m.mes_referencia === filterMes && !(papelGrupoRelatorio(m.empresa_id, empresaGrupoMap?.get(m.empresa_id)) === "membro")), [filtered, filterMes, empresaGrupoMap]);
  const loteResumo = useMemo(() => resumoLoteEnvio(movsDoMes, relatoriosMap), [movsDoMes, relatoriosMap]);
  const contextoLote = `${formatMesReferencia(filterMes)} · ${filterPeriodo === "all" ? "todos os períodos" : `Período ${filterPeriodo}`}`;

  const prepararRelatorios = useMutation({
    mutationFn: async (): Promise<ResultadoPreparacao> => {
      const semEmpresa = filtered.filter(m => !m.empresa_id && m.mes_referencia === filterMes).length;
      const empresaIds = [...new Set(movsDoMes.flatMap(m => m.empresa_id ? [m.empresa_id] : []))];
      const emails = new Map<string, string>();
      for (let i = 0; i < empresaIds.length; i += 100) {
        const { data, error } = await supabase.from("empresas").select("id, email_empresa, email_financeiro_cliente").in("id", empresaIds.slice(i, i + 100));
        if (error) throw error;
        for (const e of data ?? []) emails.set(e.id, [e.email_empresa, e.email_financeiro_cliente].filter(Boolean).join("; "));
      }
      let prontas = 0, semDestinatario = 0, comErro = semEmpresa;
      const lote: TablesInsert<"movimentacao_relatorios">[] = [];
      for (const m of movsDoMes) {
        const existente = relatoriosMap.get(m.id);
        const destinatarios = emails.get(m.empresa_id) || existente?.destinatarios || "";
        const classe = classificarPreparacao(existente, destinatarios);
        if (classe === "final") continue;
        let status = "Sem destinatário";
        if (classe === "pronto") {
          setPreparandoContrato(`Gerando relatório do contrato #${m.empresas?.codigo_contrato} (${m.empresas?.nome})...`);
          try {
            await gerarRelatoriosPortal(m.empresas?.codigo_contrato, new AbortController().signal);
            status = "Pronto para envio"; prontas++;
          } catch { status = "Erro no envio"; comErro++; }
        } else semDestinatario++;
        lote.push({
          movimentacao_id: m.id, status,
          destinatarios, cc: existente?.cc ?? "", data_envio: null, confirmacao: "Aguardando", observacoes: existente?.observacoes ?? "",
        });
      }
      for (let i = 0; i < lote.length; i += 100) {
        const { error } = await supabase.from("movimentacao_relatorios").upsert(lote.slice(i, i + 100), { onConflict: "movimentacao_id" });
        if (error) throw error;
      }
      return { encontradas: movsDoMes.length, prontas, semDestinatario, comErro };
    },
    onSuccess: async resultado => {
      await queryClient.invalidateQueries({ queryKey: ["movimentacao-relatorios"] });
      setPrepararResultado(resultado);
    },
    onError: (e: Error) => toast({ title: "Não foi possível preparar os relatórios", description: e.message, variant: "destructive" }),
    onSettled: () => setPreparandoContrato(""),
  });
  useEffect(() => { setLoteOpen(false); setPrepararResultado(null); }, [filterMes, filterPeriodo, filterStatus, filterResponsavel, somentePendentes, verSomenteSemEmpresa, searchTerm]);

  const mesesOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    // 3 meses à frente + 12 meses anteriores
    for (let i = 3; i >= -11; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const handleExportExcel = async () => {
    const rows = filtered.map((m) => {
      const status = calcularStatus(m);
      const tipo = (m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao) === "Diária" ? "Diário" : "Período";
      const notaKey = `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`;
      const dataNota = finMap.get(notaKey)?.data_envio_nota ?? "";
      return {
        "Contrato": m.empresas?.codigo_contrato ?? "",
        "CNPJ": m.empresas?.cnpj ?? "",
        "Empresa": m.empresas?.nome ?? "",
        "Resp. Contrato": respContratoOf(m.empresas),
        "TIPO DE MOVIMENTAÇÃO": tipo,
        "PERÍODO DE MOVIMENTAÇÃO": formatPeriodoEmpresa(m.empresas as any),
        "Envio Empresa": m.data_envio_empresa ?? "",
        "Financeiro": m.data_envio_financeiro ?? "",
        "Nota Enviada": dataNota,
        "Status": status,
        "Implantação": m.empresas?.data_implantacao ?? "",
        "Corretora": m.empresas?.operadora_plano ?? "",
      };
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Movimentações");
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(headers.map((h) => (r as any)[h])));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_${filterMes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFerias = async () => {
    // Busca férias não encerradas (programada, em_andamento ou aguardando_retorno_contratos)
    const { data: ferias, error: fErr } = await supabase
      .from("ferias_cadastro")
      .select("id, responsavel_original_user_id, responsavel_original_nome, data_inicio, data_fim, status")
      .in("status", ["em_andamento", "programada", "aguardando_retorno_contratos"])
      .order("data_inicio", { ascending: false });
    if (fErr) {
      toast({ title: "Erro ao buscar férias: " + fErr.message, variant: "destructive" });
      return;
    }

    const feriasIds = (ferias ?? []).map((f) => f.id);
    let redistribuicoes: any[] = [];
    if (feriasIds.length) {
      const { data: emp, error: eErr } = await supabase
        .from("ferias_cadastro_empresas")
        .select("empresa_id, responsavel_temporario_nome, ferias_id")
        .in("ferias_id", feriasIds);
      if (eErr) {
        toast({ title: "Erro ao buscar redistribuição: " + eErr.message, variant: "destructive" });
        return;
      }
      redistribuicoes = emp ?? [];
    }
    // Mapa empresa_id -> { responsavel_temporario_nome, original_nome, periodo }
    const feriasMap = new Map<string, { temp: string; original: string; periodo: string }>();
    const feriasById = new Map((ferias ?? []).map((f) => [f.id, f]));
    for (const r of redistribuicoes) {
      const f = feriasById.get(r.ferias_id);
      if (!f) continue;
      feriasMap.set(r.empresa_id, {
        temp: r.responsavel_temporario_nome ?? "",
        original: f.responsavel_original_nome ?? "",
        periodo: `${formatDateBR(f.data_inicio)} a ${formatDateBR(f.data_fim)}`,
      });
    }

    // Filtra movimentações cuja empresa está em férias
    const rowsFerias = filtered.filter((m) => feriasMap.has(m.empresa_id));
    if (rowsFerias.length === 0) {
      toast({ title: "Nenhuma empresa em férias no período filtrado." });
      return;
    }

    const rows = rowsFerias.map((m) => {
      const status = calcularStatus(m);
      const tipo = (m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao) === "Diária" ? "Diário" : "Período";
      const info = feriasMap.get(m.empresa_id)!;
      return {
        "Contrato": m.empresas?.codigo_contrato ?? "",
        "CNPJ": m.empresas?.cnpj ?? "",
        "Empresa": m.empresas?.nome ?? "",
        "Resp. Original (Férias)": info.original,
        "Resp. Temporário": info.temp,
        "Período Férias": info.periodo,
        "Tipo": tipo,
        "Período Movimentação": ((m.empresas as any)?.tipo_movimentacao === "Diária" && (m.empresas as any)?.data_corte)
          ? `Dia ${String((m.empresas as any).data_corte).padStart(2, "0")}`
          : formatPeriodoEmpresa(m.empresas as any),
        "Envio Empresa": m.data_envio_empresa ?? "",
        "Envio Financeiro": m.data_envio_financeiro ?? "",
        "Status": status,
        "Corretora": m.empresas?.operadora_plano ?? "",
      };
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Férias");
    const headers = Object.keys(rows[0]);
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    rows.forEach((r) => ws.addRow(headers.map((h) => (r as any)[h])));
    ws.columns.forEach((c) => { c.width = 22; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_ferias_${filterMes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exportado: ${rows.length} movimentação(ões) em férias` });
  };

  const selectedEmpresa = empresas.find((e) => e.id === form.empresa_id);
  const isFechada = (form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao) === "Fechada";

  const tabs = (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("empresas")}
          className={
            activeTab === "empresas"
              ? "rounded-full bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground shadow"
              : "rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          Empresas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("administradoras")}
          className={
            activeTab === "administradoras"
              ? "rounded-full bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground shadow"
              : "rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          Administradoras
        </button>
      </div>
    </div>
  );



  if (activeTab === "administradoras") {
    return (
      <div className="space-y-6">
        {tabs}
        <DashboardAdministradoras />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {tabs}



        <div className="flex items-center justify-between">

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} movimentação(ões) encontrada(s)</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await queryClient.invalidateQueries();
                toast({ title: "Informações atualizadas" });
              }}
              className="rounded-lg"
              title="Atualizar informações"
            >
              <RefreshCw className="mr-2 h-4 w-4" />Atualizar
            </Button>
            {canEditDates && (
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={handleGerarMovimentacoes}
                disabled={gerandoMov}
                title="Gerar movimentação dos novos contratos"
              >
                <Sparkles className={`mr-2 h-4 w-4 ${gerandoMov ? "animate-pulse" : ""}`} />
                {gerandoMov ? "Gerando..." : "Gerar Movimentação"}
              </Button>
            )}
            {canEditDates && (
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => prepararRelatorios.mutate()}
                disabled={prepararRelatorios.isPending || !movsDoMes.length || carregandoRelatorios || erroRelatorios}
                title="Preparar os relatórios de vidas das empresas do filtro atual"
              >
                <Mail className={`mr-2 h-4 w-4 ${prepararRelatorios.isPending ? "animate-pulse" : ""}`} />
                {prepararRelatorios.isPending ? "Preparando..." : "Preparar Relatórios"}
              </Button>
            )}
            {canEditDates && (
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => setLoteOpen(true)}
                disabled={!aptosLote.length || carregandoRelatorios || erroRelatorios}
                title="Enviar os relatórios prontos para envio"
              >
                <Send className="mr-2 h-4 w-4" />Enviar Relatórios ({aptosLote.length})
              </Button>
            )}

            
            <Button variant="outline" onClick={handleExportExcel} className="rounded-lg">
              <Download className="mr-2 h-4 w-4" />Exportar Excel
            </Button>
            <Button variant="outline" onClick={handleExportFerias} className="rounded-lg">
              <Plane className="mr-2 h-4 w-4" />Exportar Férias
            </Button>
            {canEditDates && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              {canEdit && <DialogTrigger asChild>
                <Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" />Nova Movimentação</Button>
              </DialogTrigger>}
              <DialogContent className="sm:max-w-lg w-[95vw] max-h-[92dvh] rounded-xl flex flex-col overflow-hidden p-0">
                 <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50 shrink-0">
                  <DialogTitle>{editingId ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">

                  {/* Seção 1 — Dados principais */}
                  <SecaoModal numero={1} titulo="Dados principais" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Empresa *</Label>
                      <Select value={form.empresa_id} onValueChange={handleEmpresaChange} disabled={!canEdit && !!editingId}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {empresas.filter((e) => (e as any).status_empresa === "Ativa").map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Mês Referência *</Label>
                      <Input type="month" value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })} required disabled={!canEdit && !!editingId} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipo Movimentação</Label>
                      <Input value={form.tipo_movimentacao ?? selectedEmpresa?.tipo_movimentacao ?? "—"} disabled className="bg-accent/50 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Período {isFechada ? "(fixo)" : "(automático)"}</Label>
                      {isFechada ? (
                        <Input value={form.periodo} disabled className="bg-accent/50 rounded-lg" />
                      ) : (
                        <Select value={form.periodo} onValueChange={(v) => setForm({ ...form, periodo: v })} disabled={!canEdit && !!editingId}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Seção 2 — Datas e responsável */}
                  <SecaoModal numero={2} titulo="Datas e responsável" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                       <Label className="text-sm font-medium">Responsável</Label>
                      <Input value={form.responsavel_movimentacao ?? ""} onChange={(e) => setForm({ ...form, responsavel_movimentacao: e.target.value })} disabled={!canEdit && !!editingId} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Envio p/ Empresa</Label>
                      <Input type="date" value={form.data_envio_empresa ?? ""} onChange={(e) => handleDataEnvioChange(e.target.value || null)} disabled={formEhSecundarioGrupo} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Envio Financeiro</Label>
                      <div className="flex gap-2">
                        <Input type="date" value={form.data_envio_financeiro ?? ""} onChange={(e) => setForm({ ...form, data_envio_financeiro: e.target.value || null })} disabled={formEhSecundarioGrupo} className="rounded-lg flex-1" />

                        {form.data_envio_financeiro && editingId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-lg shrink-0"
                            title="Limpar data de envio ao Financeiro"
                            onClick={() => {
                              if (confirm("Isso removerá o alerta enviado ao Financeiro. Deseja continuar?")) {
                                setForm({ ...form, data_envio_financeiro: null });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                   </div>

                  {/* Seção 3 — Observações */}
                  <SecaoModal numero={3} titulo="Observações" />
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Observações anteriores</Label>

                    {form.observacoes?.trim() ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {form.observacoes
                          .split("\n")
                          .filter((l) => l.trim())
                          .map((linha, i) => {
                            const match = linha.match(/^\[(\d{2}\/\d{2}\/\d{4}(?:, \d{2}:\d{2})?) — ([^\]]+)\]\s*(.*)$/s);
                            const dataHora = match?.[1] ?? null;
                            const autor = match?.[2] ?? null;
                            const texto = match?.[3] ?? linha;
                            return (
                              <div
                                key={i}
                                className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                              >
                                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                  {texto}
                                </p>
                                {(dataHora || autor) && (
                                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                      {(autor || "U").charAt(0).toUpperCase()}
                                    </span>
                                    <span className="truncate max-w-[180px]">{autor}</span>
                                    {dataHora && (
                                      <>
                                        <span className="text-border">•</span>
                                        <span>{dataHora}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                        <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Nova observação</Label>
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-1">
                        <Textarea
                          value={novaObservacao}
                          onChange={(e) => setNovaObservacao(e.target.value)}
                           disabled={formEhSecundarioGrupo}
                          placeholder={formEhSecundarioGrupo ? "Gerenciado pelo contrato principal do grupo" : "Adicionar nova observação (as anteriores não podem ser alteradas)"}
                          className="min-h-[90px] resize-y border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground/70"
                        />
                      </div>
                    </div>

                  </div>


                  {/* Seção 4 — Anexos e fechamento */}
                  <SecaoModal numero={4} titulo="Anexos e fechamento" />
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-3 shadow-sm">
                  {grupoForm && grupoPrincipalId && (
                     <div className={`rounded-lg border px-3 py-2 text-[11px] ${formEhSecundarioGrupo ? "border-warning/40 bg-warning/5 text-warning" : "border-info/40 bg-info/5 text-info"}`}>
                      {formEhSecundarioGrupo
                        ? `Contrato do grupo "${grupoForm.nome_grupo}". Datas, observações e anexos são gerenciados pelo contrato principal${nomeContratoPrincipal ? ` (${nomeContratoPrincipal})` : ""}.`
                        : formEhPrincipalGrupo
                          ? `Contrato principal do grupo "${grupoForm.nome_grupo}". Datas, observações e anexos serão replicados para os demais contratos na mesma competência/período.`
                          : `Contrato do grupo "${grupoForm.nome_grupo}".`}
                    </div>
                  )}

                  <AnexosMovimentacao
                     movimentacaoId={editingId}
                    empresaId={form.empresa_id || null}
                    mes={form.mes_referencia}
                    periodo={form.periodo}
                    required={!!form.data_envio_financeiro}
                    onConcluir={() => { if (!upsert.isPending) upsert.mutate(form); }}
                  />
                  </div>
                  </div>


                  <div className="shrink-0 flex justify-end gap-2 border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-lg">Cancelar</Button>
                    <Button type="submit" disabled={upsert.isPending || !form.empresa_id} className="rounded-lg">{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                  </div>

                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 flex-1 min-w-[240px]">
                <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Empresa, contrato ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-lg h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mês</Label>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[150px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mesesOptions.map((m) => <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Período</Label>
                <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                  <SelectTrigger className="w-[130px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[190px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Aguardando envio">Aguardando envio</SelectItem>
                    <SelectItem value="Enviado para empresa">Enviado p/ empresa</SelectItem>
                    <SelectItem value="Enviado ao financeiro">Enviado ao financeiro</SelectItem>
                    <SelectItem value="Fora do prazo">Fora do prazo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                <Input placeholder="Filtrar..." value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-[170px] rounded-lg h-9" />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Checkbox id="pendentes" checked={somentePendentes} onCheckedChange={(v) => setSomentePendentes(v === true)} />
                <Label htmlFor="pendentes" className="text-xs cursor-pointer">Somente pendentes</Label>
              </div>
              <Button
                variant={verSomenteSemEmpresa ? "destructive" : "outline"}
                size="sm"
                onClick={() => setVerSomenteSemEmpresa(!verSomenteSemEmpresa)}
                className="rounded-lg"
              >
                {verSomenteSemEmpresa ? "Mostrar todas" : "Ver sem empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Resumo Geral por Período</h2>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setDashboardOpen(true)}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Ir para Dashboard Geral
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = movimentacoes.filter((m) => {
                  if ((m.empresas as any)?.status_empresa === "Inativa") return false;
                  if (!permiteCompetenciaMovimentacao(m.empresas, m.mes_referencia)) return false;
                  return m.periodo === p;
                });
                const done = items.filter((m) => calcularStatus(m) === "Enviado ao financeiro").length;
                const late = items.filter((m) => calcularStatus(m) === "Fora do prazo").length;
                const progresso = resumoEnvioRelatorios(items.map(m => m.id), relatoriosMap);
                const isActiveP = p === filterPeriodo;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFilterPeriodo(isActiveP ? "all" : p)}
                    className={`rounded-xl border p-4 text-center space-y-1.5 transition-all duration-200 ${isActiveP ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20" : "hover:bg-accent hover:shadow-sm border-border/60"}`}
                  >
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success font-medium">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive font-medium">{late} fora do prazo</div>}
                    <div className="text-xs text-muted-foreground border-t border-border pt-1.5">
                      {carregandoRelatorios ? "Relatórios: carregando..." : erroRelatorios ? "Relatórios indisponíveis" : `${progresso.enviados} enviados · ${progresso.pendentes} pendentes`}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {movimentacoesSemEmpresa.length > 0 && (
          <Card className="border-destructive/40 rounded-xl">
            <CardContent className="pt-4 text-sm text-destructive">
              ⚠️ Existem {movimentacoesSemEmpresa.length} movimentações sem empresa vinculada.
              Verifique o cadastro ou corrija o empresa_id no banco.
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">TIPO DE MOVIMENTAÇÃO</TableHead>
                    <TableHead className="font-semibold">PERÍODO DE MOVIMENTAÇÃO</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Resp. Mov.</TableHead>
                    {true && <TableHead className="font-semibold">Envio Empresa</TableHead>}
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Status Faturamento</TableHead>
                    <TableHead className="font-semibold">Nota Enviada</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Relatório</TableHead>
                    {canEditDates && <TableHead className="w-24 font-semibold">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     <TableRow><TableCell colSpan={canEditDates ? 13 : 12} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                   ) : filtered.length === 0 ? (
                     <TableRow><TableCell colSpan={canEditDates ? 13 : 12} className="text-center text-muted-foreground py-12">Nenhuma movimentação encontrada</TableCell></TableRow>
                  ) : (
                    filtered.map((m) => {
                      const status = calcularStatus(m);
                      const tipo = m.tipo_movimentacao ?? m.empresas?.tipo_movimentacao ?? "—";
                      const notaKey = `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`;
                      const finInfo = finMap.get(notaKey) ?? null;
                      const dataNota = finInfo?.data_envio_nota ?? null;
                      const temPrio = !!(m.empresas as any)?.prioridade_maxima_id;
                      const prioAtiva = temPrio && !m.data_envio_financeiro;
                      const prioIntensa = prioAtiva && isPrioridadeAlertaIntenso(m.empresas as any);
                      const grupoLinha = m.empresa_id ? empresaGrupoMap?.get(m.empresa_id) ?? null : null;
                      const relatorio = relatoriosMap.get(m.id) ?? RELATORIO_VAZIO;
                      return (
                        <TableRow
                          key={m.id}
                          onDoubleClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("button, a, input, [role='menuitem'], [role='checkbox']")) return;
                            setAnexosMov({ id: m.id, nome: m.empresas?.nome ?? null, mes: m.mes_referencia ?? null, periodo: m.periodo ?? null });
                          }}
                          className={`cursor-pointer transition-colors ${!m.empresas ? "bg-destructive/5" : status === "Fora do prazo" ? "bg-destructive/5 hover:bg-destructive/10" : prioAtiva ? "bg-red-500/5 priority-row hover:bg-red-500/10" : "hover:bg-accent/50"}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>
                                  {m.empresas?.nome ?? <span className="text-destructive">Sem empresa</span>}
                                </span>

                                {(m.empresas as any)?.contrato_via_portal && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                                    title="Movimentação realizada pelo portal"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Portal
                                  </span>
                                )}
                                {temPrio && <PrioridadeBadge variant="compact" intense={prioIntensa} />}
                              </div>
                              {grupoLinha && (
                                <GrupoTag empresaId={m.empresa_id} grupoNome={grupoLinha.nome_grupo} />
                              )}
                            </div>
                          </TableCell>


                          <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{respContratoOf(m.empresas) || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="rounded-md">{tipo}</Badge></TableCell>
                          <TableCell>{m.periodo || formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                          <TableCell>
                            <Badge className={`${statusColor(status)} rounded-md`}>{status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{respMovOf(m.empresas) || "—"}</TableCell>
                          {true && <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>}
                          <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                          <TableCell>
                            {finInfo ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <Badge className={`${statusFinanceiroColor(finInfo.status)} rounded-md gap-1 text-xs`}>
                                  {finInfo.status === "Em faturamento" && (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  )}
                                  {labelStatusFinanceiro(finInfo.status)}
                                </Badge>
                                {finInfo.status === "Em faturamento" && finInfo.faturamento_por && (
                                  <span className="text-[10px] leading-tight text-blue-600 dark:text-blue-300">
                                    por {finInfo.faturamento_por}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {dataNota ? (
                              <Badge className="rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                                {formatDateBR(dataNota)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RelatorioStatusBadge
                              registro={relatorio}
                              empresaNome={m.empresas?.nome ?? "empresa"}
                              mesReferencia={m.mes_referencia ?? null}
                              dataEnvioEmpresa={m.data_envio_empresa ?? null}
                              desabilitado={carregandoRelatorios || erroRelatorios}
                              rotulo={carregandoRelatorios ? "Carregando..." : "Indisponível"}
                            />
                          </TableCell>
                          {canEditDates && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(m)} className="rounded-lg hover:bg-primary/10"><Pencil className="h-4 w-4 text-primary" /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-primary/10" aria-label={`Ações do relatório de ${m.empresas?.nome ?? "empresa"}`}>
                                    <MoreHorizontal className="h-4 w-4 text-primary" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setRelatorioStatusInicial(undefined); setRelatorioMov(m); }}>
                                    <Eye className="mr-2 h-4 w-4" /> Visualizar relatório
                                  </DropdownMenuItem>
                                  {papelGrupoRelatorio(m.empresa_id, grupoLinha) === "membro" ? (
                                    <DropdownMenuItem disabled>
                                      <Send className="mr-2 h-4 w-4" /> Enviado pelo contrato principal do grupo
                                    </DropdownMenuItem>
                                  ) : !relatorioFinalizado(relatorio) ? (
                                    <DropdownMenuItem onClick={() => { setRelatorioStatusInicial("Enviado"); setRelatorioMov(m); }}>
                                      <Send className="mr-2 h-4 w-4" /> Enviar
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => { setRelatorioStatusInicial("Enviado"); setRelatorioMov(m); }}>
                                      <RotateCcw className="mr-2 h-4 w-4" /> Reenviar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>

              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <AnexosMovimentacaoDialog
        movimentacaoId={anexosMov?.id ?? null}
        empresaNome={anexosMov?.nome}
        mesReferencia={anexosMov?.mes}
        periodo={anexosMov?.periodo}
        open={!!anexosMov}
        onOpenChange={(o) => !o && setAnexosMov(null)}
      />
      {relatorioMov && <RelatorioManualDialog
        key={`${relatorioMov.id}-${relatorioStatusInicial ?? "ver"}`}
        movimentacaoId={relatorioMov.id}
        empresaId={relatorioMov.empresa_id ?? null}
        nome={relatorioMov.empresas?.nome ?? "Sem empresa"}
        contrato={relatorioMov.empresas?.codigo_contrato ?? null}
        contexto={`${formatMesReferencia(relatorioMov.mes_referencia)} · ${relatorioMov.periodo ?? "—"}`}
        competencia={formatMesReferencia(relatorioMov.mes_referencia)}
        periodo={relatorioMov.periodo ?? null}
        registro={relatoriosMap.get(relatorioMov.id)}
        statusInicial={relatorioStatusInicial}
        dataEnvioEmpresa={relatorioMov.data_envio_empresa ?? null}
        canEdit={canEditDates}
        onClose={() => setRelatorioMov(null)}
      />}
      {loteOpen && canEditDates && <RelatorioLoteDialog
        items={aptosLote.map(m => ({ id: m.id, empresaId: m.empresa_id ?? null, nome: m.empresas?.nome ?? "Sem empresa", contrato: m.empresas?.codigo_contrato ?? null, periodo: m.periodo, destinatarios: relatoriosMap.get(m.id)?.destinatarios ?? "", cc: relatoriosMap.get(m.id)?.cc ?? "" }))}
        resumo={loteResumo}
        contexto={contextoLote}
        onClose={() => setLoteOpen(false)} />}
      {prepararResultado && <PrepararRelatoriosDialog resultado={prepararResultado} contexto={contextoLote} onClose={() => setPrepararResultado(null)} />}
      {preparandoContrato && <p role="status" className="fixed bottom-4 left-4 z-50 max-w-[90vw] border border-border bg-background p-3 text-sm text-foreground shadow-sm">{preparandoContrato}</p>}

      <Dialog open={dashboardOpen} onOpenChange={setDashboardOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Dashboard Geral</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Dashboard />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
