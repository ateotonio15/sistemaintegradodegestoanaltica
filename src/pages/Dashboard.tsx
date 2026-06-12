import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Clock, CheckCircle2, RotateCcw, RefreshCw, Users, Pencil, TrendingUp, Search, BellRing, Trash2, Paperclip } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  type Movimentacao,
  PERIODOS,
  calcularStatus,
  statusColor,
  getCurrentMesReferencia,
  getCurrentPeriodo,
  formatMesReferencia,
  formatPeriodoEmpresa,
  periodoDaDataCorte,
} from "@/lib/movimentacao-utils";
import { formatDateBR } from "@/lib/date-utils";
import { AnexosMovimentacao } from "@/components/movimentacoes/AnexosMovimentacao";
import { AnexosViewerDialog } from "@/components/dashboard/AnexosViewerDialog";
import { ImplantacoesAndamentoCard } from "@/components/dashboard/ImplantacoesAndamentoCard";

import { ImplantacoesAguardandoFechamentoCard } from "@/components/dashboard/ImplantacoesAguardandoFechamentoCard";
import { VidasOperadoraResumo } from "@/components/dashboard/VidasOperadoraResumo";
import { AlertasContratosAnaliseDiretora } from "@/components/dashboard/AlertasContratosAnaliseDiretora";
import { AlertasContratosVendas } from "@/components/dashboard/AlertasContratosVendas";
import { PrioridadeMaximaDashboardCard } from "@/components/dashboard/PrioridadeMaximaDashboardCard";
import { AlertaReajustesPendentes } from "@/components/reajustes/AlertaReajustesPendentes";
import { AlertaReajustesParaConfirmar } from "@/components/reajustes/AlertaReajustesParaConfirmar";
import { AlertaReajustesParaAprovar } from "@/components/reajustes/AlertaReajustesParaAprovar";

import { FeriasButton } from "@/components/ferias/FeriasButton";


export default function Dashboard() {
  const [filterMes, setFilterMes] = useState(getCurrentMesReferencia());
  const [filterPeriodo, setFilterPeriodo] = useState<string>(getCurrentPeriodo());
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [filterCorretora, setFilterCorretora] = useState<string>("all");
  const [filterTipoContrato, setFilterTipoContrato] = useState<string>("all");
  const [searchGlobal, setSearchGlobal] = useState("");
  const [dashboardMode, setDashboardMode] = useState<"movimentacao" | "implantacao">("movimentacao");
  const [showEmpresasAtivasModal, setShowEmpresasAtivasModal] = useState(false);
  const [showNovasEmpresasModal, setShowNovasEmpresasModal] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<Movimentacao | null>(null);
  const [editForm, setEditForm] = useState({ data_envio_empresa: "", data_envio_financeiro: "" });
  // Edit empresa inline
  const [editEmpresaDialogOpen, setEditEmpresaDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Tables<"empresas"> | null>(null);
  const [empresaEditForm, setEmpresaEditForm] = useState<any>({});
  const queryClient = useQueryClient();
  const { user, isAdmin, isExecutivo, role, isViewOnly, isDiretora, isVendas } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canEditDates = !isViewOnly && (isAdmin || role === "comum" || role === "administradoras");

  const { data: allEmpresas = [] } = useQuery({
    queryKey: ["empresas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Tables<"empresas">[];
    },
    enabled: !!user,
  });

  const { data: comunUsersEmpresas = [] } = useQuery({
    queryKey: ["comum-users-empresa-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count");
      if (error) throw error;
      return data as { user_id: string; display_name: string; empresa_count: number }[];
    },
    enabled: !!user,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRolesList = [] } = useQuery({
    queryKey: ["user-roles-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const comunUsers = allProfiles.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "comum"));
  const executivoUsers = allProfiles.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "executivo"));

  // Novas Empresas: em fase de implantação (data_implantacao nula ou futura)
  const novasEmpresas = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return allEmpresas.filter((e) => {
      if (!e.data_implantacao) return true;
      return e.data_implantacao > today;
    });
  }, [allEmpresas]);

  // Fetch executiva profiles for novas empresas
  const executivaUserIds = useMemo(() => {
    return [...new Set(novasEmpresas.map((e) => e.executiva_user_id).filter(Boolean) as string[])];
  }, [novasEmpresas]);

  const { data: executivaProfiles = [] } = useQuery({
    queryKey: ["executiva-profiles-dashboard", executivaUserIds],
    queryFn: async () => {
      if (executivaUserIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").in("user_id", executivaUserIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user && executivaUserIds.length > 0,
  });

  const executivaMap = useMemo(() => {
    const map: Record<string, string> = {};
    executivaProfiles.forEach((p) => { map[p.user_id] = p.display_name || "Sem nome"; });
    return map;
  }, [executivaProfiles]);

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-empresas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "empresas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const empresasAtivas = useMemo(() => allEmpresas.filter((e) => e.status_empresa === "Ativa"), [allEmpresas]);

  const empresasPorResponsavel = useMemo(() => {
    return comunUsersEmpresas
      .map((u) => ({
        responsavel: u.display_name?.trim() || "Sem nome",
        total: Number(u.empresa_count),
      }))
      .sort((a, b) => b.total - a.total || a.responsavel.localeCompare(b.responsavel));
  }, [comunUsersEmpresas]);

  const { data: movimentacoes = [], isLoading, isFetching } = useQuery({
    queryKey: ["movimentacoes-dashboard", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas:empresas!movimentacoes_empresa_id_fkey(id, nome, codigo_contrato, cnpj, tipo_movimentacao, periodo_movimentacao, data_corte, responsavel_contrato, responsavel_user_id, status_empresa, data_implantacao, operadora_plano, vidas, tipo_contrato)")
        .eq("mes_referencia", filterMes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Movimentacao & { empresas?: { responsavel_contrato: string | null } | null })[];
    },
    enabled: !!user,
  });

  const { data: notaEnviadaEmpresaIds = new Set<string>() } = useQuery({
    queryKey: ["financeiro-nota-enviada-ids", filterMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id")
        .eq("mes_referencia", filterMes)
        .not("data_envio_nota", "is", null);
      if (error) throw error;
      return new Set((data || []).map((r) => r.empresa_id));
    },
    enabled: !!user,
  });

  const updateMov = useMutation({
    mutationFn: async (values: { id: string; data_envio_empresa: string | null; data_envio_financeiro: string | null }) => {
      const { error } = await supabase.from("movimentacoes").update({
        data_envio_empresa: values.data_envio_empresa,
        data_envio_financeiro: values.data_envio_financeiro,
      }).eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      setEditDialogOpen(false);
      setEditingMov(null);
      toast({ title: "Movimentação atualizada!" });
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao salvar", variant: "destructive" }),
  });

  const updateEmpresa = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...payload } = values;
      const { error } = await supabase.from("empresas").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setEditEmpresaDialogOpen(false);
      setEditingEmpresa(null);
      toast({ title: "Empresa atualizada!" });
    },
    onError: () => toast({ title: "Erro ao salvar empresa", variant: "destructive" }),
  });

  const openEditFromDashboard = (m: Movimentacao) => {
    setEditingMov(m);
    setEditForm({
      data_envio_empresa: m.data_envio_empresa ?? "",
      data_envio_financeiro: m.data_envio_financeiro ?? "",
    });
    setEditDialogOpen(true);
  };

  const openEditEmpresa = (e: Tables<"empresas">) => {
    setEditingEmpresa(e);
    setEmpresaEditForm({
      nome: e.nome,
      cnpj: e.cnpj ?? "",
      codigo_contrato: e.codigo_contrato ?? "",
      responsavel_user_id: e.responsavel_user_id ?? "",
      executiva_user_id: e.executiva_user_id ?? "",
      data_implantacao: e.data_implantacao ?? "",
      data_vencimento_fatura: e.data_vencimento_fatura ?? "",
      data_emissao_fatura: e.data_emissao_fatura ?? "",
      tipo_movimentacao: e.tipo_movimentacao ?? "Fechada",
      data_corte: e.data_corte ?? "",
      periodo_movimentacao: e.periodo_movimentacao ?? "",
      email_empresa: e.email_empresa ?? "",
      telefone_empresa: e.telefone_empresa ?? "",
      contato_empresa: e.contato_empresa ?? "",
      operadora_plano: e.operadora_plano ?? "",
      prazo: e.prazo ?? "",
      grupo_contrato: e.grupo_contrato ?? "",
      status_empresa: e.status_empresa ?? "Ativa",
      observacoes: e.observacoes ?? "",
    });
    setShowNovasEmpresasModal(false);
    setEditEmpresaDialogOpen(true);
  };

  const handleSaveEmpresa = () => {
    if (!editingEmpresa) return;
    const payload: any = { id: editingEmpresa.id };
    Object.keys(empresaEditForm).forEach((k) => {
      const val = empresaEditForm[k];
      payload[k] = val === "" ? null : val;
    });
    // Map responsavel name
    if (payload.responsavel_user_id) {
      const u = comunUsers.find((u) => u.user_id === payload.responsavel_user_id) || allProfiles.find((u) => u.user_id === payload.responsavel_user_id);
      payload.responsavel_contrato = u?.display_name || null;
    }
    updateEmpresa.mutate(payload);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingRevisao, setLoadingRevisao] = useState(false);

  const handleRevisarEmpresas = async () => {
    if (!user || loadingRevisao) return;
    if (!confirm("Deseja revisar todas as empresas e movimentações? Isso corrige inconsistências e remove movimentações duplicadas (mesma empresa + mês + período).")) return;
    setLoadingRevisao(true);
    try {
      const { data: empresas, error } = await supabase.from("empresas").select("*");
      if (error) throw error;

      let errosEmp = 0;
      let corrigidosEmp = 0;

      const empresaMap = new Map<string, Tables<"empresas">>();

      for (const emp of empresas) {
        empresaMap.set(emp.id, emp);
        const updateData: Record<string, any> = {};

        if (!emp.nome) { errosEmp++; continue; }
        if (!emp.status_empresa) { updateData.status_empresa = "Ativa"; corrigidosEmp++; }
        if (!emp.tipo_movimentacao) { updateData.tipo_movimentacao = "Fechada"; corrigidosEmp++; }
        if (!emp.periodo_movimentacao && emp.tipo_movimentacao !== "Diária") { updateData.periodo_movimentacao = "01-05"; corrigidosEmp++; }
        if (!emp.data_implantacao) { const n = new Date(); updateData.data_implantacao = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; corrigidosEmp++; }
        if (!emp.prazo) { updateData.prazo = "Sem prazo definido"; corrigidosEmp++; }
        if (!emp.grupo_contrato) { updateData.grupo_contrato = "Não informado"; corrigidosEmp++; }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase.from("empresas").update(updateData).eq("id", emp.id);
          if (updateError) { console.error("Erro ao atualizar empresa:", emp.nome, updateError); errosEmp++; }
          else {
            Object.assign(emp, updateData);
            empresaMap.set(emp.id, emp);
          }
        }
      }

      // --- REVISÃO DE MOVIMENTAÇÕES ---
      const { data: allMovs, error: movError } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, periodo, tipo_movimentacao, responsavel_movimentacao, mes_referencia, data_envio_empresa, data_retorno_empresa, data_envio_financeiro, observacoes, created_at")
        .order("created_at", { ascending: true });
      if (movError) throw movError;

      let corrigidosMov = 0;
      let errosMov = 0;
      let duplicadasRemovidas = 0;

      // 1) Detectar duplicatas: mesma empresa + mes_referencia + periodo
      const grupos = new Map<string, typeof allMovs>();
      for (const m of allMovs) {
        const k = `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`;
        const arr = grupos.get(k) ?? [];
        arr.push(m);
        grupos.set(k, arr);
      }

      const idsParaApagar: string[] = [];
      for (const [, arr] of grupos) {
        if (arr.length < 2) continue;
        // Pontuação: linha com mais campos preenchidos vence; em empate, a mais antiga (created_at)
        const score = (m: any) =>
          (m.data_envio_empresa ? 1 : 0) +
          (m.data_retorno_empresa ? 1 : 0) +
          (m.data_envio_financeiro ? 1 : 0) +
          (m.observacoes ? 1 : 0) +
          (m.responsavel_movimentacao ? 1 : 0);
        arr.sort((a, b) => {
          const d = score(b) - score(a);
          if (d !== 0) return d;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        // Mantém o primeiro; remove os demais
        for (let i = 1; i < arr.length; i++) idsParaApagar.push(arr[i].id);
      }

      if (idsParaApagar.length > 0) {
        // Apagar em lotes de 100
        for (let i = 0; i < idsParaApagar.length; i += 100) {
          const slice = idsParaApagar.slice(i, i + 100);
          const { error: delErr } = await supabase.from("movimentacoes").delete().in("id", slice);
          if (delErr) {
            console.error("Erro ao remover duplicatas:", delErr);
            errosMov += slice.length;
          } else {
            duplicadasRemovidas += slice.length;
          }
        }
      }

      // 2) Corrigir as movimentações restantes (ignorando IDs apagados)
      const apagadosSet = new Set(idsParaApagar);
      for (const mov of allMovs) {
        if (apagadosSet.has(mov.id)) continue;
        const emp = empresaMap.get(mov.empresa_id);
        if (!emp) continue;

        const updateMov: Record<string, any> = {};

        // Corrigir período baseado na configuração da empresa
        let periodoCorreto: string;
        if (emp.tipo_movimentacao === "Diária" && emp.data_corte) {
          periodoCorreto = periodoDaDataCorte(emp.data_corte);
        } else if (emp.periodo_movimentacao) {
          periodoCorreto = emp.periodo_movimentacao;
        } else {
          periodoCorreto = "01-05";
        }

        if (mov.periodo !== periodoCorreto) {
          updateMov.periodo = periodoCorreto;
        }

        // Corrigir tipo_movimentacao da movimentação
        const tipoCorreto = emp.tipo_movimentacao || "Fechada";
        if (mov.tipo_movimentacao !== tipoCorreto) {
          updateMov.tipo_movimentacao = tipoCorreto;
        }

        // Corrigir responsável
        if (!mov.responsavel_movimentacao && emp.responsavel_contrato) {
          updateMov.responsavel_movimentacao = emp.responsavel_contrato;
        }

        if (Object.keys(updateMov).length > 0) {
          const { error: updErr } = await supabase.from("movimentacoes").update(updateMov).eq("id", mov.id);
          if (updErr) { console.error("Erro ao atualizar mov:", mov.id, updErr); errosMov++; }
          else { corrigidosMov++; }
        }
      }

      const totalErros = errosEmp + errosMov;
      toast({
        title: "Revisão concluída!",
        description: `Empresas: ${corrigidosEmp} corrigidas | Movimentações: ${corrigidosMov} corrigidas, ${duplicadasRemovidas} duplicada(s) removida(s) | ${totalErros} erro(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro na revisão", description: err?.message, variant: "destructive" });
    } finally {
      setLoadingRevisao(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
  };

  const handleGenerateAll = async () => {
    if (!user || isGenerating) return;
    setIsGenerating(true);
    try {
      const mesRef = filterMes;
      const { data: existing } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo")
        .eq("mes_referencia", mesRef);

      const existingSet = new Set(
        (existing || []).map((e) => `${e.empresa_id}__${e.periodo}`)
      );

      const PERIODO_FIM_DIA: Record<string, number> = {
        "01-05": 5, "05-10": 10, "10-15": 15, "15-20": 20, "20-25": 25, "25-30": 30,
      };
      const vigenciaAlcancaPeriodo = (dataImpl: string | null | undefined, periodo: string) => {
        if (!dataImpl) return true;
        const [yi, mi, di] = dataImpl.split("-").map(Number);
        const [yr, mrn] = mesRef.split("-").map(Number);
        if (yi > yr || (yi === yr && mi > mrn)) return false; // implantação em mês futuro
        if (yi < yr || (yi === yr && mi < mrn)) return true;  // implantação em mês anterior
        return di <= (PERIODO_FIM_DIA[periodo] ?? 31);
      };

      const toInsertMap = new Map<string, TablesInsert<"movimentacoes">>();
      for (const emp of empresasAtivas) {
        let periodo = "01-05";
        if (emp.tipo_movimentacao === "Diária" && emp.data_corte) {
          periodo = periodoDaDataCorte(emp.data_corte);
        } else if (emp.periodo_movimentacao) {
          periodo = emp.periodo_movimentacao;
        }

        // Pula contratos cuja vigência ultrapassa o fim do período no mês de referência
        if (!vigenciaAlcancaPeriodo(emp.data_implantacao, periodo)) continue;

        const key = `${emp.id}__${periodo}`;
        if (existingSet.has(key) || toInsertMap.has(key)) continue;
        toInsertMap.set(key, {
          empresa_id: emp.id,
          mes_referencia: mesRef,
          periodo,
          tipo_movimentacao: emp.tipo_movimentacao || "Fechada",
          responsavel_movimentacao: emp.responsavel_contrato || null,
        });
      }
      const toInsert = Array.from(toInsertMap.values());

      if (toInsert.length === 0) {
        toast({ title: "Todas as empresas já possuem movimentações neste mês." });
      } else {
        let inseridas = 0;
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { data: ins, error } = await supabase
            .from("movimentacoes")
            .upsert(batch, { onConflict: "empresa_id,mes_referencia,periodo", ignoreDuplicates: true })
            .select("id");
          if (error) throw error;
          inseridas += ins?.length ?? 0;
        }
        toast({ title: `${inseridas} movimentações geradas com sucesso!` });
        handleRefresh();
      }

    } catch (err: any) {
      console.error("Erro ao gerar movimentações:", err);
      toast({ title: "Erro ao gerar movimentações", description: err?.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const mesesOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    // 3 meses futuros + mês atual + 11 meses anteriores
    for (let i = 3; i >= -11; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    // garante que qualquer mês com movimentação existente apareça
    for (const m of movimentacoes) {
      if (m.mes_referencia) set.add(m.mes_referencia);
    }
    return Array.from(set).sort().reverse();
  }, [movimentacoes]);


  const responsaveis = useMemo(() => {
    const set = new Set(movimentacoes.map((m) => m.responsavel_movimentacao).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [movimentacoes]);

  const corretoraOptions = useMemo(() => {
    const set = new Set(
      movimentacoes
        .map((m) => ((m.empresas as any)?.operadora_plano ?? "").trim())
        .filter((v): v is string => !!v),
    );
    return Array.from(set).sort();
  }, [movimentacoes]);

  const tipoContratoOptions = useMemo(() => {
    const set = new Set(
      movimentacoes
        .map((m) => ((m.empresas as any)?.tipo_contrato ?? "").trim())
        .filter((v): v is string => !!v),
    );
    return Array.from(set).sort();
  }, [movimentacoes]);

  const activeMovimentacoes = useMemo(() => movimentacoes.filter((m) => (m.empresas as any)?.status_empresa === "Ativa"), [movimentacoes]);
  const withStatus = useMemo(() => activeMovimentacoes.map((m) => ({ ...m, status: calcularStatus(m) })), [activeMovimentacoes]);

  const filteredByResponsavel = useMemo(() => {
    let items = withStatus;
    if (filterResponsavel !== "all") {
      items = items.filter((m) => m.responsavel_movimentacao === filterResponsavel);
    }
    if (filterCorretora !== "all") {
      items = items.filter((m) => ((m.empresas as any)?.operadora_plano ?? "").trim() === filterCorretora);
    }
    if (filterTipoContrato !== "all") {
      items = items.filter((m) => ((m.empresas as any)?.tipo_contrato ?? "").trim() === filterTipoContrato);
    }
    // Apply global search
    if (searchGlobal.trim()) {
      const q = searchGlobal.toLowerCase();
      items = items.filter((m) => {
        const emp = m.empresas as any;
        return (emp?.nome || "").toLowerCase().includes(q) ||
          (emp?.codigo_contrato || "").toLowerCase().includes(q) ||
          (emp?.cnpj || "").toLowerCase().includes(q);
      });
    }
    return items;
  }, [withStatus, filterResponsavel, filterCorretora, filterTipoContrato, searchGlobal]);

  const periodItems = useMemo(() => {
    return filteredByResponsavel.filter((m) => m.periodo === filterPeriodo);
  }, [filteredByResponsavel, filterPeriodo]);

  const totalNoPeriodo = periodItems.length;
  const enviadas = periodItems.filter((m) => m.status === "Enviado para empresa").length;
  const pendentes = periodItems.filter((m) => m.status === "Aguardando envio" || m.status === "Fora do prazo").length;
  const concluidas = periodItems.filter((m) => m.status === "Enviado ao financeiro").length;

  const sortByEmpresaNome = <T extends { empresas?: { nome?: string | null } | null }>(arr: T[]) =>
    [...arr].sort((a, b) =>
      (a.empresas?.nome ?? "").localeCompare(b.empresas?.nome ?? "", "pt-BR", { sensitivity: "base" }),
    );

  const listaTrabalho = useMemo(() => {
    return sortByEmpresaNome(periodItems.filter((m) => m.status !== "Enviado ao financeiro"));
  }, [periodItems]);

  const listaConcluidas = useMemo(() => {
    return sortByEmpresaNome(periodItems.filter((m) => m.status === "Enviado ao financeiro"));
  }, [periodItems]);

  const concluidasKeys = useMemo(
    () =>
      listaConcluidas.map((m) => ({
        empresa_id: m.empresa_id,
        mes_referencia: m.mes_referencia,
        periodo: m.periodo,
      })),
    [listaConcluidas],
  );

  const empresaIdsConcluidas = useMemo(
    () => Array.from(new Set(concluidasKeys.map((k) => k.empresa_id))),
    [concluidasKeys],
  );

  const { data: anexosCountMap = {} } = useQuery<Record<string, number>>({
    queryKey: [
      "anexos-count-concluidas",
      empresaIdsConcluidas.sort().join(","),
      concluidasKeys.map((k) => `${k.mes_referencia}|${k.periodo}`).sort().join(","),
    ],
    enabled: concluidasKeys.length > 0,
    queryFn: async () => {
      // 1) Busca TODAS as movimentações (mesma empresa+mes+periodo) para os processos concluídos
      const { data: movs, error: errMov } = await supabase
        .from("movimentacoes")
        .select("id, empresa_id, mes_referencia, periodo")
        .in("empresa_id", empresaIdsConcluidas);
      if (errMov) throw errMov;
      // mantém só as que batem com algum (empresa,mes,periodo) da lista
      const keySet = new Set(
        concluidasKeys.map((k) => `${k.empresa_id}|${k.mes_referencia}|${k.periodo}`),
      );
      const movsRel = (movs ?? []).filter((mv: any) =>
        keySet.has(`${mv.empresa_id}|${mv.mes_referencia}|${mv.periodo}`),
      );
      const movIds = movsRel.map((m: any) => m.id);
      if (movIds.length === 0) return {};
      // 2) Conta anexos por movimentação
      const { data: anx, error: errAnx } = await supabase
        .from("anexos_movimentacao")
        .select("movimentacao_id")
        .in("movimentacao_id", movIds);
      if (errAnx) throw errAnx;
      const countByMov: Record<string, number> = {};
      (anx ?? []).forEach((a: any) => {
        countByMov[a.movimentacao_id] = (countByMov[a.movimentacao_id] ?? 0) + 1;
      });
      // 3) Agrega contagem por chave empresa|mes|periodo
      const map: Record<string, number> = {};
      movsRel.forEach((mv: any) => {
        const k = `${mv.empresa_id}|${mv.mes_referencia}|${mv.periodo}`;
        map[k] = (map[k] ?? 0) + (countByMov[mv.id] ?? 0);
      });
      return map;
    },
  });

  const [anexosDialog, setAnexosDialog] = useState<{
    empresaId: string;
    empresaNome: string;
    mesReferencia: string;
    periodo: string;
  } | null>(null);

  const GRUPO_CONTRATO_OPTIONS = [
    "Compulsória - Sem Dependentes",
    "Adesão - Titular / Dependente",
    "Compulsória - Titular / Adesão - Dependente",
    "Compulsória - Todos",
  ];

  return (
    <>
      <div className="space-y-8">
        <PrioridadeMaximaDashboardCard />
        {isDiretora && <AlertasContratosAnaliseDiretora />}
        {isVendas && <AlertasContratosVendas />}
        
        {role === "visualizacao" && <AlertaReajustesPendentes />}
        <AlertaReajustesParaConfirmar />
        <AlertaReajustesParaAprovar />


        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Operação do período</h2>
            <p className="text-sm text-muted-foreground mt-1">Filtre e acompanhe as movimentações em andamento</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="default" size="sm" onClick={handleGenerateAll} disabled={isGenerating} className="rounded-lg gap-2">
                <Building2 className="h-4 w-4" />
                {isGenerating ? "Gerando..." : "Gerar Movimentações"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="rounded-lg gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <FeriasButton />
        </div>

        {/* Modo do Dashboard */}
        <div className="flex items-center gap-2">
          <Button
            variant={dashboardMode === "movimentacao" ? "default" : "outline"}
            size="sm"
            onClick={() => setDashboardMode("movimentacao")}
            className="rounded-lg"
          >
            Movimentação
          </Button>
          <Button
            variant={dashboardMode === "implantacao" ? "default" : "outline"}
            size="sm"
            onClick={() => setDashboardMode("implantacao")}
            className="rounded-lg"
          >
            Implantação
          </Button>
          {isDiretora && <VidasOperadoraResumo />}
        </div>
        </div>

        {/* Filters + Search */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por empresa, código ou CNPJ..."
                    value={searchGlobal}
                    onChange={(e) => setSearchGlobal(e.target.value)}
                    className="pl-9 rounded-lg h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mês de Referência</Label>
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
                    {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                  <SelectTrigger className="w-[170px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Corretora</Label>
                <Select value={filterCorretora} onValueChange={setFilterCorretora}>
                  <SelectTrigger className="w-[180px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {corretoraOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo de Contrato</Label>
                <Select value={filterTipoContrato} onValueChange={setFilterTipoContrato}>
                  <SelectTrigger className="w-[170px] rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tipoContratoOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(filterResponsavel !== "all" || filterCorretora !== "all" || filterTipoContrato !== "all" || searchGlobal) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-transparent select-none">.</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterResponsavel("all");
                      setFilterCorretora("all");
                      setFilterTipoContrato("all");
                      setSearchGlobal("");
                    }}
                    className="rounded-lg h-9"
                  >
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary cards - 6 cards max, "Novas Empresas" only when count > 0 */}
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${novasEmpresas.length > 0 ? 6 : 5}`}>
          {/* 1. Empresas Ativas */}
          <Card className="cursor-pointer hover:shadow-md transition-all duration-200 rounded-xl border-border/60" onClick={() => setShowEmpresasAtivasModal(true)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresas Ativas</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{empresasAtivas.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Clique para ver detalhes</p>
            </CardContent>
          </Card>

          {/* 2. Novas Empresas - only if count > 0 */}
          {novasEmpresas.length > 0 && (
            <Card className="cursor-pointer hover:shadow-md transition-all duration-200 rounded-xl border-info/40 bg-info/5" onClick={() => setShowNovasEmpresasModal(true)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-info uppercase tracking-wider">Novas Empresas</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-info/15 flex items-center justify-center relative">
                  <Building2 className="h-4 w-4 text-info" />
                  <span className="absolute -top-1.5 -right-1.5 bg-info text-info-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                    {novasEmpresas.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-info">{novasEmpresas.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Em fase de implantação</p>
              </CardContent>
            </Card>
          )}

          {/* 3. Total no Período */}
          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total no Período</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{totalNoPeriodo}</div>
            </CardContent>
          </Card>

          {/* 4. Pendentes */}
          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pendentes</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-warning">{pendentes}</div>
            </CardContent>
          </Card>

          {/* 5. Enviadas p/ Empresa */}
          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enviadas p/ Empresa</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                <RotateCcw className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-info">{enviadas}</div>
            </CardContent>
          </Card>

          {/* 6. Financeiro */}
          <Card className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financeiro</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-success">{concluidas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por período */}
        {dashboardMode === "movimentacao" && (
        <>

        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Resumo Geral por Período</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PERIODOS.map((p) => {
                const items = filteredByResponsavel.filter((m) => m.periodo === p);
                const done = items.filter((m) => m.status === "Enviado ao financeiro").length;
                const late = items.filter((m) => m.status === "Fora do prazo").length;
                const isActiveP = p === filterPeriodo;
                return (
                  <button
                    key={p}
                    onClick={() => setFilterPeriodo(p)}
                    className={`rounded-xl border p-4 text-center space-y-1.5 transition-all duration-200 ${isActiveP ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20" : "hover:bg-accent hover:shadow-sm border-border/60"}`}
                  >
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-xs text-muted-foreground">{items.length} total</div>
                    {done > 0 && <div className="text-xs text-success font-medium">{done} concluída(s)</div>}
                    {late > 0 && <div className="text-xs text-destructive font-medium">{late} fora do prazo</div>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Empresas no Período (work list) */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="bg-accent/30 border-b">
            <CardTitle className="text-base font-semibold">
              Movimentações no Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>

                    <TableHead className="font-semibold">Movimentação</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">Vidas Ativas</TableHead>
                    <TableHead className="font-semibold">Período</TableHead>
                    <TableHead className="font-semibold">Envio Empresa</TableHead>
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {canEditDates && <TableHead className="w-12 font-semibold">Editar</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={canEditDates ? 10 : 9} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                  ) : listaTrabalho.length === 0 ? (
                    <TableRow><TableCell colSpan={canEditDates ? 10 : 9} className="text-center text-muted-foreground py-12">Nenhuma pendência neste período 🎉</TableCell></TableRow>
                  ) : (
                    listaTrabalho.map((m) => (
                      <TableRow key={m.id} className={`transition-colors ${m.status === "Fora do prazo" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-accent/50"}`}>
                        <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>

                        <TableCell>{m.empresas?.tipo_movimentacao || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{(m.empresas as any)?.vidas ?? "—"}</TableCell>
                        <TableCell>{formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                        <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                        <TableCell><Badge className={`${statusColor(m.status)} rounded-md`}>{m.status}</Badge></TableCell>
                        {canEditDates && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditFromDashboard(m)} className="rounded-lg hover:bg-primary/10">
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {/* Implantações em Andamento */}
        {dashboardMode === "implantacao" && <ImplantacoesAndamentoCard />}





        {/* Contratos recém implantados aguardando primeiro fechamento */}
        {dashboardMode === "implantacao" && <ImplantacoesAguardandoFechamentoCard />}


        {dashboardMode === "movimentacao" && (
        <>
        {/* Enviadas ao Financeiro */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="bg-success/5 border-b">
            <CardTitle className="text-base font-semibold">
              Enviadas ao Financeiro — Período {filterPeriodo} — {formatMesReferencia(filterMes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Movimentação</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">Vidas Ativas</TableHead>
                    <TableHead className="font-semibold">Período</TableHead>
                    <TableHead className="font-semibold">Envio Empresa</TableHead>
                    <TableHead className="font-semibold">Financeiro</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Anexos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaConcluidas.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">Nenhuma movimentação enviada ao financeiro neste período</TableCell></TableRow>
                  ) : (
                    listaConcluidas.map((m) => {
                      const qtd = anexosCountMap[`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`] ?? 0;
                      return (
                        <TableRow key={m.id} className="hover:bg-accent/50 transition-colors">
                          <TableCell className="font-medium">{m.empresas?.nome ?? "—"}</TableCell>

                          <TableCell className="text-muted-foreground">{m.empresas?.codigo_contrato || "—"}</TableCell>
                          <TableCell>{m.empresas?.tipo_movimentacao || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{(m.empresas as any)?.responsavel_contrato || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{(m.empresas as any)?.vidas ?? "—"}</TableCell>
                          <TableCell>{formatPeriodoEmpresa(m.empresas as any)}</TableCell>
                          <TableCell>{formatDateBR(m.data_envio_empresa)}</TableCell>
                          <TableCell>{formatDateBR(m.data_envio_financeiro)}</TableCell>
                          <TableCell><Badge className={`${statusColor(m.status)} rounded-md`}>{m.status}</Badge></TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-8"
                              
                              onClick={() =>
                                setAnexosDialog({
                                  empresaId: m.empresa_id,
                                  empresaNome: m.empresas?.nome ?? "",
                                  mesReferencia: m.mes_referencia,
                                  periodo: m.periodo,
                                })
                              }
                              title={qtd === 0 ? "Sem anexos" : "Ver anexos"}
                            >
                              <Paperclip className="h-3 w-3" />
                              {qtd}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </>
        )}



        <AnexosViewerDialog
          open={!!anexosDialog}
          onOpenChange={(v) => !v && setAnexosDialog(null)}
          empresaId={anexosDialog?.empresaId ?? null}
          empresaNome={anexosDialog?.empresaNome ?? ""}
          mesReferencia={anexosDialog?.mesReferencia ?? ""}
          periodo={anexosDialog?.periodo ?? ""}
        />

        {/* Empresas Ativas Modal */}
        <Dialog open={showEmpresasAtivasModal} onOpenChange={setShowEmpresasAtivasModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>Empresas Ativas por Responsável</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-accent/20 hover:bg-accent/20">
                  <TableHead className="font-semibold">Responsável</TableHead>
                  <TableHead className="text-right font-semibold">Total de Empresas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasPorResponsavel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      Nenhum responsável encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  empresasPorResponsavel.map(({ responsavel, total }) => (
                    <TableRow key={responsavel} className="hover:bg-accent/50 transition-colors">
                      <TableCell className="font-medium">{responsavel}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Novas Empresas Modal */}
        <Dialog open={showNovasEmpresasModal} onOpenChange={setShowNovasEmpresasModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-info" />
                Novas Empresas — Em Fase de Implantação
                <Badge className="bg-info/15 text-info border-info/30 ml-2">{novasEmpresas.length}</Badge>
              </DialogTitle>
            </DialogHeader>
            {novasEmpresas.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                Nenhuma empresa em fase de implantação no momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-info/5 hover:bg-info/5">
                      <TableHead className="font-semibold">Empresa</TableHead>
                      <TableHead className="font-semibold">Cód. Contrato</TableHead>
                      <TableHead className="font-semibold">CNPJ</TableHead>
                      <TableHead className="font-semibold">Responsável</TableHead>
                      <TableHead className="font-semibold">Executiva</TableHead>
                      <TableHead className="font-semibold">Implantação</TableHead>
                      <TableHead className="font-semibold">Movimentação</TableHead>
                      <TableHead className="font-semibold">Período/Corte</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novasEmpresas.map((e) => (
                      <TableRow key={e.id} className="hover:bg-info/5 transition-colors cursor-pointer" onClick={() => openEditEmpresa(e)}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{e.codigo_contrato || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{e.cnpj || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.responsavel_contrato || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.executiva_user_id ? (executivaMap[e.executiva_user_id] || "—") : "Não definida"}</TableCell>
                        <TableCell>
                          {e.data_implantacao ? (
                            <Badge className="bg-warning/15 text-warning border-warning/30 rounded-md">
                              {formatDateBR(e.data_implantacao)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-md text-muted-foreground">Não definida</Badge>
                          )}
                        </TableCell>
                        <TableCell>{e.tipo_movimentacao || "—"}</TableCell>
                        <TableCell>
                          {e.tipo_movimentacao === "Diária" ? `Corte: ${e.data_corte || "—"}` : (e.periodo_movimentacao || "—")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg hover:bg-info/10"
                            onClick={(ev) => { ev.stopPropagation(); openEditEmpresa(e); }}
                          >
                            <Pencil className="h-4 w-4 text-info" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Movimentação Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingMov(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-xl">
            <DialogHeader>
              <DialogTitle>Editar Movimentação</DialogTitle>
              <DialogDescription className="sr-only">
                Edite as datas da movimentação e gerencie os anexos relacionados.
              </DialogDescription>
            </DialogHeader>
            {editingMov && (
              <div className="min-w-0 space-y-5">
                <div className="min-w-0 text-sm text-muted-foreground p-3 bg-accent/50 rounded-lg truncate">
                  <span className="font-medium text-foreground">{(editingMov as any).empresas?.nome}</span>
                  {" — "}{(editingMov as any).empresas?.codigo_contrato || ""}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data Envio p/ Empresa</Label>
                    <Input type="date" value={editForm.data_envio_empresa} onChange={(e) => setEditForm({ ...editForm, data_envio_empresa: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data Envio Financeiro</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={editForm.data_envio_financeiro} onChange={(e) => setEditForm({ ...editForm, data_envio_financeiro: e.target.value })} className="rounded-lg flex-1" />
                      {editForm.data_envio_financeiro && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-lg shrink-0"
                          title="Limpar data de envio ao Financeiro"
                          onClick={() => {
                            if (confirm("Isso removerá o alerta enviado ao Financeiro. Deseja continuar?")) {
                              setEditForm({ ...editForm, data_envio_financeiro: "" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <AnexosMovimentacao
                  movimentacaoId={editingMov.id}
                  empresaId={editingMov.empresa_id}
                  required={!!editForm.data_envio_financeiro}
                  
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEditDialogOpen(false); setEditingMov(null); }} className="rounded-lg">Cancelar</Button>
                  <Button
                    className="rounded-lg"
                    onClick={() => updateMov.mutate({
                      id: editingMov.id,
                      data_envio_empresa: editForm.data_envio_empresa || null,
                      data_envio_financeiro: editForm.data_envio_financeiro || null,
                    })}
                    disabled={updateMov.isPending}
                  >
                    {updateMov.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Empresa Dialog - opens from Novas Empresas */}
        <Dialog open={editEmpresaDialogOpen} onOpenChange={(open) => { setEditEmpresaDialogOpen(open); if (!open) setEditingEmpresa(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
            </DialogHeader>
            {editingEmpresa && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nome *</Label>
                    <Input value={empresaEditForm.nome} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, nome: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">CNPJ</Label>
                    <Input value={empresaEditForm.cnpj} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, cnpj: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Código do Contrato</Label>
                    <Input value={empresaEditForm.codigo_contrato} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, codigo_contrato: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Responsável pelo Contrato</Label>
                    <Select value={empresaEditForm.responsavel_user_id} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, responsavel_user_id: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {comunUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.display_name || u.user_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Executiva Responsável</Label>
                    <Select value={empresaEditForm.executiva_user_id} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, executiva_user_id: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {executivoUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.display_name || u.user_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data de Implantação</Label>
                    <Input type="date" value={empresaEditForm.data_implantacao} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, data_implantacao: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data vencimento (01-31)</Label>
                    <Input type="number" min={1} max={31} value={empresaEditForm.data_vencimento_fatura} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, data_vencimento_fatura: e.target.value ? Number(e.target.value) : "" })} placeholder="Ex: 10" className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dia Emissão Fatura (1-31)</Label>
                    <Input type="number" min={1} max={31} value={empresaEditForm.data_emissao_fatura} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, data_emissao_fatura: e.target.value ? Number(e.target.value) : "" })} placeholder="Ex: 5" className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Corretora</Label>
                    <Input value={empresaEditForm.operadora_plano} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, operadora_plano: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de Contrato</Label>
                    <Select value={empresaEditForm.tipo_movimentacao} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, tipo_movimentacao: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Diária">Diário</SelectItem>
                        <SelectItem value="Fechada">Período</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {empresaEditForm.tipo_movimentacao === "Diária" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data de Corte (dia)</Label>
                      <Input type="number" min={1} max={31} value={empresaEditForm.data_corte} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, data_corte: e.target.value ? Number(e.target.value) : "" })} className="rounded-lg" />
                    </div>
                  )}
                  {empresaEditForm.tipo_movimentacao === "Fechada" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Período de Movimentação</Label>
                      <Select value={empresaEditForm.periodo_movimentacao} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, periodo_movimentacao: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">E-mail da Empresa</Label>
                    <Input type="email" value={empresaEditForm.email_empresa} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, email_empresa: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Telefone</Label>
                    <Input value={empresaEditForm.telefone_empresa} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, telefone_empresa: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Contato</Label>
                    <Input value={empresaEditForm.contato_empresa} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, contato_empresa: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Prazo</Label>
                    <Input value={empresaEditForm.prazo} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, prazo: e.target.value })} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Grupo de Contrato</Label>
                    <Select value={empresaEditForm.grupo_contrato} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, grupo_contrato: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {GRUPO_CONTRATO_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={empresaEditForm.status_empresa} onValueChange={(v) => setEmpresaEditForm({ ...empresaEditForm, status_empresa: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativa">Ativa</SelectItem>
                        <SelectItem value="Inativa">Inativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observações</Label>
                  <Input value={empresaEditForm.observacoes} onChange={(e) => setEmpresaEditForm({ ...empresaEditForm, observacoes: e.target.value })} className="rounded-lg" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEditEmpresaDialogOpen(false); setEditingEmpresa(null); }} className="rounded-lg">Cancelar</Button>
                  <Button className="rounded-lg" onClick={handleSaveEmpresa} disabled={updateEmpresa.isPending}>
                    {updateEmpresa.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
