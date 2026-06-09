import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, Search, Upload, Building2, Ban, Wallet, FileSpreadsheet, FileText, Users, Calendar as CalendarIcon, Mail, Phone, User, Clock } from "lucide-react";
import { PERIODOS } from "@/lib/movimentacao-utils";
import { TIPOS_FINANCEIRO } from "@/lib/financeiro-utils";
import { formatDateBR, formatDay, calcularPeriodoCobranca, formatPeriodoCobranca } from "@/lib/date-utils";
import { FAIXAS_ETARIAS, labelFaixa, formatCentavosBRL } from "@/lib/reajuste-utils";
import { Switch } from "@/components/ui/switch";
import { SuspensaoDialog } from "@/components/empresas/SuspensaoDialog";
import { ValoresFaixaEtariaDialog } from "@/components/empresas/ValoresFaixaEtariaDialog";
import { ImportarValoresIniciaisDialog } from "@/components/empresas/ImportarValoresIniciaisDialog";
import { RecalcularVidasDialog } from "@/components/empresas/RecalcularVidasDialog";
import ExcelJS from "exceljs";
import { parseAnexo1 } from "@/lib/anexo1-parser";
import { Loader2, FileUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { IsoDatePicker } from "@/components/ui/iso-date-picker";
import { GrupoFinanceiroSection } from "@/components/empresas/GrupoFinanceiroSection";
import { EmpresaAnexosImplantacao } from "@/components/empresas/EmpresaAnexosImplantacao";

type Empresa = Tables<"empresas">;

const GRUPO_CONTRATO_OPTIONS = [
  "Compulsória - Sem Dependentes",
  "Adesão - Titular / Dependente",
  "Compulsória - Titular / Adesão - Dependente",
  "Compulsória - Todos",
];

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  const isEmpty = display === "—";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</dt>
      <dd className={cn("text-sm mt-0.5 break-words", isEmpty ? "text-muted-foreground/60" : "font-medium")}>{display}</dd>
    </div>
  );
}

const emptyForm: TablesInsert<"empresas"> & { responsavel_user_id?: string | null; executiva_user_id?: string | null } = {
  nome: "",
  cnpj: "",
  codigo_contrato: "",
  responsavel_contrato: "",
  operadora_plano: "",
  data_corte: null,
  dia_movimentacao: null,
  tipo_movimentacao: "Fechada",
  periodo_movimentacao: null,
  email_empresa: "",
  status_empresa: "Ativa",
  observacoes: "",
  responsavel_user_id: null,
  executiva_user_id: null,
  telefone_empresa: "",
  contato_empresa: "",
  vidas: 0,
  tipo_contrato: "EMPRESARIAL",
  exige_po_pc: false,
  envio_boleto_com_nota: false,
  tem_coparticipacao: false,
  email_financeiro_cliente: "",
  observacao_padrao_financeiro: "",
  tipo_financeiro: "",
  valor_enfermaria_centavos: null,
  valor_apartamento_centavos: null,
  faixas_etarias: null,
  periodo_especifico_cobranca: false,
  periodo_cobranca_inicio: null,

} as any;

export default function Empresas() {
  const [search, setSearch] = useState("");
  const [showInativas, setShowInativas] = useState(false);
  const [respFilter, setRespFilter] = useState<string>("all");
  const [corretoraFilter, setCorretoraFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEmpresa, setDetailEmpresa] = useState<Empresa | null>(null);
  const [rescisaoDate, setRescisaoDate] = useState("");
  const [showRescisaoInput, setShowRescisaoInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grupoEmpresa, setGrupoEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [draftEmpresaId, setDraftEmpresaId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [dataImplantacao, setDataImplantacao] = useState("");
  const [dataVencimentoFatura, setDataVencimentoFatura] = useState<number | "">("");
  const [dataEmissaoFatura, setDataEmissaoFatura] = useState<number | "">("");
  const [suspensaoEmpresa, setSuspensaoEmpresa] = useState<Empresa | null>(null);
  const [valoresEmpresa, setValoresEmpresa] = useState<Empresa | null>(null);
  const [importValoresOpen, setImportValoresOpen] = useState(false);
  const [recalcVidasOpen, setRecalcVidasOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);
  const [importingAnexo, setImportingAnexo] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, role, isViewOnly, isExecutivo, isFinanceiro, user } = useAuth();
  const isComumLike = role === "comum" || role === "administradoras";
  const canEdit = !isViewOnly && (isAdmin || isComumLike || isExecutivo || isFinanceiro);
  const canFullEdit = isAdmin || isComumLike;
  const isComum = isComumLike;

  const { data: usuarios = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRolesList = [] } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const executivoUsers = usuarios.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "executivo"));
  const comunUsers = usuarios.filter((u) => userRolesList.some((r) => r.user_id === u.user_id && r.role === "comum"));

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
    enabled: !!user,
  });

  // Mapa empresa_id -> dia_emissao mais recente vindo da aba Financeiro
  const { data: diaEmissaoMap = {} } = useQuery({
    queryKey: ["empresas-dia-emissao-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("empresa_id, dia_emissao, mes_referencia")
        .not("dia_emissao", "is", null)
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ empresa_id: string; dia_emissao: number | null }>) {
        if (row.empresa_id && row.dia_emissao != null && map[row.empresa_id] == null) {
          map[row.empresa_id] = row.dia_emissao;
        }
      }
      return map;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel("empresas-vidas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "empresas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["empresas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const upsert = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      if (isExecutivo && editingId) {
        const { error } = await supabase.from("empresas").update({
          contato_empresa: values.contato_empresa,
          telefone_empresa: values.telefone_empresa,
          email_empresa: values.email_empresa,
          executiva_user_id: (values as any).executiva_user_id,
        }).eq("id", editingId);
        if (error) throw error;
        return;
      }
      // Validação: ao cadastrar nova empresa exige pelo menos 1 anexo
      if (!editingId && draftEmpresaId) {
        const { count } = await supabase
          .from("implantacao_anexos" as any)
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", draftEmpresaId);
        if (!count || count === 0) {
          throw new Error("Anexe pelo menos 1 arquivo da implantação antes de salvar.");
        }
      }
      const payload: any = { ...values };

      if (payload.tipo_contrato === "ADMINISTRADORA") {
        payload.tipo_movimentacao = "Diária";
        payload.periodo_movimentacao = null;
        payload.executiva_user_id = null;
        payload.email_empresa = null;
        payload.telefone_empresa = null;
        payload.contato_empresa = null;
        payload.prazo = null;
        payload.grupo_contrato = null;
        payload.responsavel_contrato = "Márcia Cristina";
        payload.responsavel_user_id = null;
      } else if (payload.tipo_movimentacao === "Diária") {
        payload.periodo_movimentacao = null;
      }
      if (dataImplantacao) payload.data_implantacao = dataImplantacao;
      if (dataVencimentoFatura) payload.data_vencimento_fatura = dataVencimentoFatura;
      if (dataEmissaoFatura) payload.data_emissao_fatura = dataEmissaoFatura;
      // Período específico de cobrança: limpa a data quando flag desativada
      if (!payload.periodo_especifico_cobranca) {
        payload.periodo_cobranca_inicio = null;
      }
      if (payload.responsavel_user_id) {
        const selectedUser = comunUsers.find((u) => u.user_id === payload.responsavel_user_id)
          || usuarios.find((u) => u.user_id === payload.responsavel_user_id);
        payload.responsavel_contrato = selectedUser?.display_name || payload.responsavel_contrato;
      }
      if (typeof payload.tipo_financeiro === "string" && payload.tipo_financeiro.trim() === "") {
        payload.tipo_financeiro = null;
      }
      if (payload.valor_enfermaria_centavos === "" || payload.valor_enfermaria_centavos === undefined) {
        payload.valor_enfermaria_centavos = null;
      }
      if (payload.valor_apartamento_centavos === "" || payload.valor_apartamento_centavos === undefined) {
        payload.valor_apartamento_centavos = null;
      }
      if (payload.tipo_contrato === "ADMINISTRADORA") {
        payload.valor_enfermaria_centavos = null;
        payload.valor_apartamento_centavos = null;
        payload.faixas_etarias = null;
      }
      if (!payload.contrato_faixa_etaria) {
        payload.faixas_etarias = null;
      } else if (payload.faixas_etarias && typeof payload.faixas_etarias === "object") {
        // mantém somente faixas com algum valor preenchido
        const fe = payload.faixas_etarias as any;
        const cleanList = (arr: any[]) =>
          (Array.isArray(arr) ? arr : [])
            .filter((f) => f && (f.centavos ?? 0) > 0)
            .map((f) => ({ ini: f.ini, fim: f.fim, centavos: f.centavos }));
        payload.faixas_etarias = {
          enfermaria: cleanList(fe.enfermaria ?? []),
          apartamento: cleanList(fe.apartamento ?? []),
        };
      }
      if (editingId) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", editingId);
        if (error) throw error;
        return { id: editingId, isNew: false };
      } else {
        const insertPayload: any = { ...payload, status_implantacao: "aguardando_primeiro_fechamento" };
        if (draftEmpresaId) insertPayload.id = draftEmpresaId;
        const { data: inserted, error } = await supabase
          .from("empresas")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        const newId = inserted!.id as string;
        try {
          const { data: comp } = await supabase.rpc("calcular_primeira_competencia" as any, { p_empresa_id: newId });
          if (comp) {
            await supabase.from("empresas").update({ primeira_competencia_financeira: comp } as any).eq("id", newId);
            const nowComp = new Date().toISOString().slice(0, 7);
            if ((comp as string) <= nowComp) {
              await supabase.from("empresas").update({ status_implantacao: "ativo" } as any).eq("id", newId);
            }
          }
        } catch (err) {
          console.warn("Falha ao calcular primeira competência", err);
        }
        return { id: newId, isNew: true };
      }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: result?.isNew ? "Empresa cadastrada!" : "Empresa atualizada!",
      });
    },
    onError: (e: any) =>
      toast({
        title: e?.message || "Erro ao salvar empresa",
        variant: "destructive",
      }),
  });


  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, dataRescisao }: { id: string; newStatus: string; dataRescisao: string | null }) => {
      const { error } = await supabase.from("empresas").update({
        status_empresa: newStatus,
        data_rescisao: dataRescisao,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: "Status da empresa atualizado!" });
      setDetailEmpresa(null);
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contratos-recem-implantados"] });
      queryClient.invalidateQueries({ queryKey: ["recem-implantados-anexos"] });
      toast({ title: "Empresa excluída!" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir", description: e?.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: TablesInsert<"empresas">[]) => {
      const { error } = await supabase.from("empresas").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      toast({ title: `${vars.length} empresa(s) importada(s) com sucesso!` });
    },
    onError: () => toast({ title: "Erro ao importar empresas", variant: "destructive" }),
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("Planilha vazia");
        // Read header row
        const headerRow = ws.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          headers[colNumber] = String(cell.value ?? "").trim();
        });
        const jsonData: Record<string, any>[] = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj: Record<string, any> = {};
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const key = headers[colNumber];
            if (key) obj[key] = cell.value;
          });
          jsonData.push(obj);
        });
        const rows: TablesInsert<"empresas">[] = jsonData.map((row) => ({
          nome: String(row["NOME_EMPRESA"] || row["nome"] || row["Nome"] || ""),
          codigo_contrato: String(row["CODIGO_CONTRATO"] || row["codigo_contrato"] || row["Código do Contrato"] || ""),
          responsavel_contrato: String(row["RESPONSAVEL_CONTRATO"] || row["responsavel_contrato"] || row["Responsável"] || ""),
        })).filter((r) => r.nome);
        if (rows.length === 0) {
          toast({ title: "Nenhuma empresa encontrada na planilha", variant: "destructive" });
          return;
        }
        importMutation.mutate(rows);
      } catch {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDraftEmpresaId(null);
    setDataImplantacao("");
    setDataVencimentoFatura("");
    setDataEmissaoFatura("");
  };

  const openEdit = (e: Empresa) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      cnpj: e.cnpj ?? "",
      codigo_contrato: e.codigo_contrato ?? "",
      responsavel_contrato: e.responsavel_contrato ?? "",
      operadora_plano: e.operadora_plano ?? "",
      data_corte: e.data_corte,
      dia_movimentacao: e.dia_movimentacao,
      tipo_movimentacao: e.tipo_movimentacao ?? "Fechada",
      periodo_movimentacao: e.periodo_movimentacao,
      email_empresa: e.email_empresa ?? "",
      status_empresa: e.status_empresa ?? "Ativa",
      observacoes: e.observacoes ?? "",
      responsavel_user_id: (e as any).responsavel_user_id ?? null,
      executiva_user_id: (e as any).executiva_user_id ?? null,
      prazo: (e as any).prazo ?? "",
      grupo_contrato: (e as any).grupo_contrato ?? "",
      telefone_empresa: (e as any).telefone_empresa ?? "",
      contato_empresa: (e as any).contato_empresa ?? "",
      contrato_faixa_etaria: (e as any).contrato_faixa_etaria ?? false,
      pagamento_via_deposito: (e as any).pagamento_via_deposito ?? false,
      vidas: (e as any).vidas ?? 0,
      tipo_contrato: (e as any).tipo_contrato ?? "EMPRESARIAL",
      exige_po_pc: (e as any).exige_po_pc ?? false,
      envio_boleto_com_nota: (e as any).envio_boleto_com_nota ?? false,
      tem_coparticipacao: (e as any).tem_coparticipacao ?? false,
      email_financeiro_cliente: (e as any).email_financeiro_cliente ?? "",
      observacao_padrao_financeiro: (e as any).observacao_padrao_financeiro ?? "",
      tipo_financeiro: (e as any).tipo_financeiro ?? "",
      valor_enfermaria_centavos: (e as any).valor_enfermaria_centavos ?? null,
      valor_apartamento_centavos: (e as any).valor_apartamento_centavos ?? null,
      faixas_etarias: (e as any).faixas_etarias ?? null,
      periodo_especifico_cobranca: (e as any).periodo_especifico_cobranca ?? false,
      periodo_cobranca_inicio: (e as any).periodo_cobranca_inicio ?? null,

    } as any);
    setDataImplantacao((e as any).data_implantacao ?? "");
    setDataVencimentoFatura((e as any).data_vencimento_fatura ?? "");
    setDataEmissaoFatura((e as any).data_emissao_fatura ?? "");
    setDialogOpen(true);
  };

  const getResponsavelName = (empresa: Empresa) => {
    const userId = (empresa as any).responsavel_user_id;
    if (userId) {
      const u = usuarios.find((u) => u.user_id === userId);
      if (u) return u.display_name || "—";
    }
    return empresa.responsavel_contrato || "—";
  };

  const getExecutivaName = (empresa: Empresa) => {
    const userId = (empresa as any).executiva_user_id;
    if (userId) {
      const u = usuarios.find((u) => u.user_id === userId);
      if (u) return u.display_name || "Não definida";
    }
    return "Não definida";
  };

  const respOptions = useMemo(() => {
    const set = new Set<string>();
    empresas.forEach((e) => { const v = (e.responsavel_contrato ?? "").trim(); if (v) set.add(v); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [empresas]);

  const corretoraOptions = useMemo(() => {
    const set = new Set<string>();
    empresas.forEach((e) => { const v = (e.operadora_plano ?? "").trim(); if (v) set.add(v); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [empresas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = empresas;
    if (isExecutivo && user) {
      list = list.filter((e) => (e as any).executiva_user_id === user.id);
    }
    return list
      .filter((e) => showInativas ? e.status_empresa === "Inativa" : e.status_empresa !== "Inativa")
      .filter((e) => respFilter === "all" || (e.responsavel_contrato ?? "").trim() === respFilter)
      .filter((e) => corretoraFilter === "all" || (e.operadora_plano ?? "").trim() === corretoraFilter)
      .filter((e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.codigo_contrato ?? "").toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q)
      );
  }, [empresas, search, showInativas, isExecutivo, user, respFilter, corretoraFilter]);

  return (
    <>
      <div className="space-y-6">
        {isExecutivo && (
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suas empresas vinculadas</p>
                <p className="text-2xl font-bold">{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isExecutivo ? `Você possui ${filtered.length} empresa(s) vinculada(s)` : `${filtered.length} empresa(s) ${showInativas ? "inativas" : "ativas"}`}
            </p>
          </div>
          {canFullEdit && (
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} className="rounded-lg">
                <Upload className="mr-2 h-4 w-4" />{importMutation.isPending ? "Importando..." : "Importar Excel"}
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setImportValoresOpen(true)} className="rounded-lg">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />Importar Valores
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" onClick={() => setRecalcVidasOpen(true)} className="rounded-lg">
                  <Users className="mr-2 h-4 w-4" />Recalcular Vidas
                </Button>
              )}
              <Dialog open={dialogOpen && !isExecutivo} onOpenChange={(open) => {
                setDialogOpen(open);
                if (open && !editingId && !draftEmpresaId) {
                  setDraftEmpresaId(crypto.randomUUID());
                }
                if (!open) resetForm();
              }}>

                <DialogTrigger asChild>
                  <Button className="rounded-lg"><Plus className="mr-2 h-4 w-4" />Nova Empresa</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl max-h-[92vh] p-0 rounded-xl overflow-hidden flex flex-col">
                  <DialogHeader className="px-6 py-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                          <Building2 className="h-5 w-5 text-primary" />
                          {editingId ? "Editar Empresa" : "Nova Empresa"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Preencha as informações da empresa. Campos com * são obrigatórios.
                        </DialogDescription>
                      </div>
                      {!editingId && (
                        <>
                          <input
                            ref={anexoInputRef}
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setImportingAnexo(true);
                              try {
                                const data = await parseAnexo1(file);
                                setForm((prev: any) => ({
                                  ...prev,
                                  nome: data.nome ?? prev.nome,
                                  cnpj: data.cnpj ?? prev.cnpj,
                                  telefone_empresa: data.telefone ?? prev.telefone_empresa,
                                  email_empresa: data.email ?? prev.email_empresa,
                                  contato_empresa: data.responsavel ?? prev.contato_empresa,
                                  vidas: data.vidas ?? prev.vidas,
                                  valor_enfermaria_centavos:
                                    data.valor_enfermaria_reais != null
                                      ? Math.round(data.valor_enfermaria_reais * 100)
                                      : prev.valor_enfermaria_centavos,
                                  valor_apartamento_centavos:
                                    data.valor_apartamento_reais != null
                                      ? Math.round(data.valor_apartamento_reais * 100)
                                      : prev.valor_apartamento_centavos,
                                }));
                                if (data.data_implantacao) setDataImplantacao(data.data_implantacao);
                                if (data.dia_vencimento) setDataVencimentoFatura(data.dia_vencimento);
                                toast({ title: "Anexo 1 importado", description: "Confira os campos preenchidos automaticamente." });
                              } catch (err: any) {
                                console.error(err);
                                toast({ title: "Erro ao importar Anexo 1", description: err?.message ?? "Falha ao processar o arquivo.", variant: "destructive" });
                              } finally {
                                setImportingAnexo(false);
                                if (anexoInputRef.current) anexoInputRef.current.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg shrink-0"
                            disabled={importingAnexo}
                            onClick={() => anexoInputRef.current?.click()}
                          >
                            {importingAnexo ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
                            ) : (
                              <><FileUp className="mr-2 h-4 w-4" />Importar Anexo 1</>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogHeader>

                  <form
                    onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex items-center gap-2 pb-1 border-b">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Identificação</h3>
                        <span className="text-xs text-muted-foreground">· Dados básicos da empresa</span>
                      </div>


                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Nome *</Label>
                        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">CNPJ</Label>
                        <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Código do Contrato *</Label>
                        <Input value={form.codigo_contrato ?? ""} onChange={(e) => setForm({ ...form, codigo_contrato: e.target.value })} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Responsável pelo Contrato *</Label>
                        {(form as any).tipo_contrato === "ADMINISTRADORA" ? (
                          <Input
                            value={(form as any).responsavel_contrato || "Márcia Cristina"}
                            readOnly
                            className="rounded-lg bg-muted transition-all duration-300 animate-fade-in"
                          />
                        ) : (
                          <Select
                            value={form.responsavel_user_id ?? ""}
                            onValueChange={(v) => setForm({ ...form, responsavel_user_id: v || null })}
                          >
                            <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                            <SelectContent>
                              {comunUsers.map((u) => (
                                <SelectItem key={u.user_id} value={u.user_id}>
                                  {u.display_name || u.user_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Executiva Responsável</Label>
                        <Select
                          value={(form as any).executiva_user_id ?? ""}
                          onValueChange={(v) => setForm({ ...form, executiva_user_id: v || null } as any)}
                        >
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione a executiva" /></SelectTrigger>
                          <SelectContent>
                            {executivoUsers.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.display_name || u.user_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 pb-1 mt-2 border-b">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Datas & Faturamento</h3>
                        <span className="text-xs text-muted-foreground">· Implantação e dias de fatura</span>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Data de Implantação *</Label>
                        <Input type="date" value={dataImplantacao} onChange={(e) => setDataImplantacao(e.target.value)} required className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Dia Vencimento Fatura (1-31) *</Label>
                        <Input type="number" min={1} max={31} value={dataVencimentoFatura} onChange={(e) => setDataVencimentoFatura(e.target.value ? Number(e.target.value) : "")} required placeholder="Ex: 10" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Dia Emissão Fatura (1-31) *</Label>
                        <Input type="number" min={1} max={31} value={dataEmissaoFatura} onChange={(e) => setDataEmissaoFatura(e.target.value ? Number(e.target.value) : "")} required placeholder="Ex: 5" className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Corretora</Label>
                        <Input value={form.operadora_plano ?? ""} onChange={(e) => setForm({ ...form, operadora_plano: e.target.value })} className="rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Vidas Ativas</Label>
                        <Input type="number" min={0} value={(form as any).vidas ?? 0} onChange={(e) => setForm({ ...form, vidas: e.target.value ? Number(e.target.value) : 0 } as any)} placeholder="0" className="rounded-lg" />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 pb-1 mt-2 border-b">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Contrato & Movimentação</h3>
                        <span className="text-xs text-muted-foreground">· Tipo, período e corte</span>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-sm font-medium">Tipo de Contrato *</Label>
                        <Select
                          value={(form as any).tipo_contrato ?? "EMPRESARIAL"}
                          onValueChange={(v) => setForm((prev) => {
                            const next: any = { ...prev, tipo_contrato: v };
                            if (v === "ADMINISTRADORA") {
                              next.responsavel_contrato = "Márcia Cristina";
                              next.responsavel_user_id = null;
                            } else if ((prev as any).responsavel_contrato === "Márcia Cristina") {
                              next.responsavel_contrato = "";
                            }
                            return next;
                          })}
                        >
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMPRESARIAL">Empresarial</SelectItem>
                            <SelectItem value="ADMINISTRADORA">Administradora</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(form as any).tipo_contrato !== "ADMINISTRADORA" && (
                        <div className="space-y-2 animate-fade-in">
                          <Label className="text-sm font-medium">Tipo de Movimentação *</Label>
                          <Select value={form.tipo_movimentacao ?? "Fechada"} onValueChange={(v) => setForm({ ...form, tipo_movimentacao: v })}>
                            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Diária">Diário</SelectItem>
                              <SelectItem value="Fechada">Período</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {(form as any).tipo_contrato !== "ADMINISTRADORA" && form.tipo_movimentacao === "Fechada" && (
                        <div className="space-y-2 animate-fade-in">
                          <Label className="text-sm font-medium">Período de Movimentação *</Label>
                          <Select value={form.periodo_movimentacao ?? ""} onValueChange={(v) => setForm({ ...form, periodo_movimentacao: v })}>
                            <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {((form as any).tipo_contrato === "ADMINISTRADORA" || form.tipo_movimentacao === "Diária") && (
                        <div className="space-y-2 animate-fade-in">
                          <Label className="text-sm font-medium">Data de Corte *</Label>
                          {(form as any).tipo_contrato === "ADMINISTRADORA" ? (
                            <Select value={form.data_corte ? String(form.data_corte) : ""} onValueChange={(v) => setForm({ ...form, data_corte: Number(v) })}>
                              <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Dia 01</SelectItem>
                                <SelectItem value="5">Dia 05</SelectItem>
                                <SelectItem value="10">Dia 10</SelectItem>
                                <SelectItem value="20">Dia 20</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input type="number" min={1} max={31} value={form.data_corte ?? ""} onChange={(e) => setForm({ ...form, data_corte: e.target.value ? Number(e.target.value) : null })} required className="rounded-lg" />
                          )}
                        </div>
                      )}
                      {(form as any).tipo_contrato !== "ADMINISTRADORA" && (
                        <>
                          <div className="sm:col-span-2 flex items-center gap-2 pb-1 mt-2 border-b animate-fade-in">
                            <Phone className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Contato</h3>
                            <span className="text-xs text-muted-foreground">· Canais e responsável</span>
                          </div>
                          <div className="space-y-2 animate-fade-in">
                            <Label className="text-sm font-medium">E-mail da Empresa</Label>
                            <Input type="email" value={form.email_empresa ?? ""} onChange={(e) => setForm({ ...form, email_empresa: e.target.value })} className="rounded-lg" />
                          </div>
                          <div className="space-y-2 animate-fade-in">
                            <Label className="text-sm font-medium">Telefone da Empresa</Label>
                            <Input value={(form as any).telefone_empresa ?? ""} onChange={(e) => setForm({ ...form, telefone_empresa: e.target.value } as any)} placeholder="(92) 99999-9999" className="rounded-lg" />
                          </div>
                          <div className="space-y-2 animate-fade-in">
                            <Label className="text-sm font-medium">Contato da Empresa</Label>
                            <Input value={(form as any).contato_empresa ?? ""} onChange={(e) => setForm({ ...form, contato_empresa: e.target.value } as any)} placeholder="Nome do contato" className="rounded-lg" />
                          </div>
                          <div className="space-y-2 animate-fade-in">
                            <Label className="text-sm font-medium">Prazo (Entrada sem carência)</Label>
                            <Input value={(form as any).prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value } as any)} placeholder="Ex: 30 dias" className="rounded-lg" />
                          </div>
                          <div className="space-y-2 animate-fade-in">
                            <Label className="text-sm font-medium">Grupo de Contrato</Label>
                            <Select value={(form as any).grupo_contrato ?? ""} onValueChange={(v) => setForm({ ...form, grupo_contrato: v } as any)}>
                              <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                              <SelectContent>
                                {GRUPO_CONTRATO_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="sm:col-span-2 flex items-center gap-2 pb-1 mt-2 border-b">
                        <Wallet className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Configurações & Valores</h3>
                        <span className="text-xs text-muted-foreground">· Status, faixa etária e valores</span>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status da Empresa</Label>
                        <Select value={form.status_empresa ?? "Ativa"} onValueChange={(v) => setForm({ ...form, status_empresa: v })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ativa">Ativa</SelectItem>
                            <SelectItem value="Inativa">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Contrato por Faixa Etária</Label>
                        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                          <Switch
                            checked={!!(form as any).contrato_faixa_etaria}
                            onCheckedChange={(v) => setForm({ ...form, contrato_faixa_etaria: v } as any)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {(form as any).contrato_faixa_etaria ? "Sim" : "Não"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-sm font-medium">Pagamento via depósito</Label>
                        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                          <Switch
                            checked={!!(form as any).pagamento_via_deposito}
                            onCheckedChange={(v) => setForm({ ...form, pagamento_via_deposito: v } as any)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {(form as any).pagamento_via_deposito
                              ? "Ativo — histórico exibirá os dados bancários para depósito"
                              : "Inativo — histórico exibirá o aviso de boleto DDA"}
                          </span>
                        </div>
                      </div>
                      {(form as any).tipo_contrato !== "ADMINISTRADORA" && !(form as any).contrato_faixa_etaria && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Valor Enfermaria (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={
                                (form as any).valor_enfermaria_centavos != null
                                  ? ((form as any).valor_enfermaria_centavos / 100).toString()
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                const cents = v === "" ? null : Math.round(parseFloat(v.replace(",", ".")) * 100);
                                setForm({ ...form, valor_enfermaria_centavos: Number.isFinite(cents as number) ? cents : null } as any);
                              }}
                              className="rounded-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Valor Apartamento (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={
                                (form as any).valor_apartamento_centavos != null
                                  ? ((form as any).valor_apartamento_centavos / 100).toString()
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                const cents = v === "" ? null : Math.round(parseFloat(v.replace(",", ".")) * 100);
                                setForm({ ...form, valor_apartamento_centavos: Number.isFinite(cents as number) ? cents : null } as any);
                              }}
                              className="rounded-lg"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tabela de Faixas Etárias — quando contrato é por faixa */}
                    {(form as any).contrato_faixa_etaria && (form as any).tipo_contrato !== "ADMINISTRADORA" && (
                      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">Valores por Faixa Etária</h3>
                          <span className="text-xs text-muted-foreground">
                            Preencha os valores por faixa de idade (em R$)
                          </span>
                        </div>
                        <div className="rounded-lg border border-border overflow-hidden bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-accent/30">
                                <TableHead className="font-semibold">Faixa</TableHead>
                                <TableHead className="font-semibold text-right">Enfermaria (R$)</TableHead>
                                <TableHead className="font-semibold text-right">Apartamento (R$)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {FAIXAS_ETARIAS.map((f) => {
                                const fe = ((form as any).faixas_etarias ?? {}) as any;
                                const enfArr: any[] = Array.isArray(fe.enfermaria) ? fe.enfermaria : [];
                                const aptArr: any[] = Array.isArray(fe.apartamento) ? fe.apartamento : [];
                                const enfItem = enfArr.find((x) => x.ini === f.idade_inicial && x.fim === f.idade_final);
                                const aptItem = aptArr.find((x) => x.ini === f.idade_inicial && x.fim === f.idade_final);
                                const setValor = (mod: "enfermaria" | "apartamento", centavos: number | null) => {
                                  const current = ((form as any).faixas_etarias ?? {}) as any;
                                  const list: any[] = Array.isArray(current[mod]) ? [...current[mod]] : [];
                                  const idx = list.findIndex((x) => x.ini === f.idade_inicial && x.fim === f.idade_final);
                                  if (centavos == null || centavos === 0) {
                                    if (idx >= 0) list.splice(idx, 1);
                                  } else {
                                    const entry = { ini: f.idade_inicial, fim: f.idade_final, centavos };
                                    if (idx >= 0) list[idx] = entry; else list.push(entry);
                                  }
                                  setForm({
                                    ...form,
                                    faixas_etarias: {
                                      enfermaria: mod === "enfermaria" ? list : (current.enfermaria ?? []),
                                      apartamento: mod === "apartamento" ? list : (current.apartamento ?? []),
                                    },
                                  } as any);
                                };
                                const toInput = (c?: number) =>
                                  c != null && c > 0 ? (c / 100).toString() : "";
                                const parseInput = (v: string): number | null => {
                                  if (v === "") return null;
                                  const n = Math.round(parseFloat(v.replace(",", ".")) * 100);
                                  return Number.isFinite(n) ? n : null;
                                };
                                return (
                                  <TableRow key={`${f.idade_inicial}-${f.idade_final}`}>
                                    <TableCell className="font-medium">{labelFaixa(f.idade_inicial, f.idade_final)}</TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={toInput(enfItem?.centavos)}
                                        onChange={(e) => setValor("enfermaria", parseInput(e.target.value))}
                                        className="rounded-md h-8 text-right tabular-nums"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={toInput(aptItem?.centavos)}
                                        onChange={(e) => setValor("apartamento", parseInput(e.target.value))}
                                        className="rounded-md h-8 text-right tabular-nums"
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Deixe em branco as faixas não aplicáveis. Esses valores podem ser revistos depois em "Valores e Faixa Etária".
                        </p>
                      </div>
                    )}



                    {/* Configurações Financeiras — admin e financeiro */}
                    {(isAdmin || isFinanceiro) && (
                      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">Configurações Financeiras</h3>
                          <span className="text-xs text-muted-foreground">(admin e financeiro)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Tipo (Financeiro)</Label>
                            <Select
                              value={(form as any).tipo_financeiro || ""}
                              onValueChange={(v) => setForm({ ...form, tipo_financeiro: v } as any)}
                            >
                              <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS_FINANCEIRO.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">E-mail financeiro do cliente</Label>
                            <Input
                              type="email"
                              value={(form as any).email_financeiro_cliente ?? ""}
                              onChange={(e) =>
                                setForm({ ...form, email_financeiro_cliente: e.target.value } as any)
                              }
                              className="rounded-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Exige PO/PC?</Label>
                            <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                              <Switch
                                checked={!!(form as any).exige_po_pc}
                                onCheckedChange={(v) =>
                                  setForm({ ...form, exige_po_pc: v } as any)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {(form as any).exige_po_pc ? "Sim" : "Não"}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Envio do boleto junto com a nota
                            </Label>
                            <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                              <Switch
                                checked={!!(form as any).envio_boleto_com_nota}
                                onCheckedChange={(v) =>
                                  setForm({ ...form, envio_boleto_com_nota: v } as any)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {(form as any).envio_boleto_com_nota ? "Sim" : "Não"}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-sm font-medium">Período de cobrança</Label>
                            <p className="text-xs text-muted-foreground">
                              Marque para empresas faturadas por intervalo específico de 30 dias (ex.: 13/05 à 12/06).
                            </p>
                            <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                              <Switch
                                checked={!!(form as any).periodo_especifico_cobranca}
                                onCheckedChange={(v) =>
                                  setForm({
                                    ...form,
                                    periodo_especifico_cobranca: v,
                                    periodo_cobranca_inicio: v ? (form as any).periodo_cobranca_inicio : null,
                                  } as any)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {(form as any).periodo_especifico_cobranca ? "Sim" : "Não"}
                              </span>
                            </div>
                            {(form as any).periodo_especifico_cobranca && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Data inicial do período</Label>
                                  <IsoDatePicker
                                    value={(form as any).periodo_cobranca_inicio}
                                    onChange={(v) =>
                                      setForm({
                                        ...form,
                                        periodo_cobranca_inicio: v,
                                      } as any)
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">
                                    Data final (calculada automaticamente)
                                  </Label>
                                  {(() => {
                                    const inicio = (form as any).periodo_cobranca_inicio;
                                    if (!inicio) {
                                      return (
                                        <div className="text-xs text-muted-foreground italic h-10 flex items-center px-3">
                                          Informe a data inicial.
                                        </div>
                                      );
                                    }
                                    const intervalo = calcularPeriodoCobranca(inicio, inicio.slice(0, 7));
                                    if (!intervalo) {
                                      return (
                                        <div className="text-xs text-destructive h-10 flex items-center px-3">
                                          Data inválida.
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="rounded-lg border bg-muted/40 px-3 h-10 flex items-center text-sm font-medium">
                                        {formatPeriodoCobranca(intervalo.inicio, intervalo.fim)}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Coparticipação</Label>
                            <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-background">
                              <Switch
                                checked={!!(form as any).tem_coparticipacao}
                                onCheckedChange={(v) =>
                                  setForm({ ...form, tem_coparticipacao: v } as any)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {(form as any).tem_coparticipacao ? "Sim" : "Não"}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-sm font-medium">Observação padrão (financeiro)</Label>
                            <Textarea
                              value={(form as any).observacao_padrao_financeiro ?? ""}
                              onChange={(e) =>
                                setForm({ ...form, observacao_padrao_financeiro: e.target.value } as any)
                              }
                              className="rounded-lg"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    )}


                    {editingId && (
                      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                        <GrupoFinanceiroSection empresaId={editingId} />
                      </div>
                    )}


                    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Observações</h3>
                      </div>
                      <Textarea
                        value={form.observacoes ?? ""}
                        onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                        className="rounded-lg bg-background"
                        rows={3}
                        placeholder="Notas internas sobre a empresa…"
                      />
                    </div>

                    {(editingId || draftEmpresaId) && (
                      <EmpresaAnexosImplantacao empresaId={(editingId || draftEmpresaId)!} />
                    )}
                    </div>

                    <div className="px-6 py-3 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-lg">Cancelar</Button>
                      <Button type="submit" disabled={upsert.isPending} className="rounded-lg min-w-[120px]">{upsert.isPending ? "Salvando..." : (editingId ? "Salvar alterações" : "Cadastrar empresa")}</Button>
                    </div>
                  </form>

                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Executivo edit dialog - restricted to contato, telefone, email + executiva */}
          {isExecutivo && (
            <Dialog open={dialogOpen && isExecutivo} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
                <DialogHeader><DialogTitle>Editar Informações</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(form); }} className="space-y-5">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Contato da Empresa</Label>
                      <Input value={(form as any).contato_empresa ?? ""} onChange={(e) => setForm({ ...form, contato_empresa: e.target.value } as any)} placeholder="Nome do contato" className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Telefone da Empresa</Label>
                      <Input value={(form as any).telefone_empresa ?? ""} onChange={(e) => setForm({ ...form, telefone_empresa: e.target.value } as any)} placeholder="(92) 99999-9999" className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">E-mail da Empresa</Label>
                      <Input type="email" value={form.email_empresa ?? ""} onChange={(e) => setForm({ ...form, email_empresa: e.target.value })} className="rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Executiva Responsável</Label>
                      <Select
                        value={(form as any).executiva_user_id ?? ""}
                        onValueChange={(v) => setForm({ ...form, executiva_user_id: v || null } as any)}
                      >
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecione a executiva" /></SelectTrigger>
                        <SelectContent>
                          {executivoUsers.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.display_name || u.user_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-lg">Cancelar</Button>
                    <Button type="submit" disabled={upsert.isPending} className="rounded-lg">{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg" />
          </div>
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="rounded-lg w-[220px]"><SelectValue placeholder="Resp. Contrato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {respOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={corretoraFilter} onValueChange={setCorretoraFilter}>
            <SelectTrigger className="rounded-lg w-[220px]"><SelectValue placeholder="Corretora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as corretoras</SelectItem>
              {corretoraOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(respFilter !== "all" || corretoraFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setRespFilter("all"); setCorretoraFilter("all"); }} className="rounded-lg">
              Limpar filtros
            </Button>
          )}
          <Button
            variant={showInativas ? "default" : "outline"}
            onClick={() => setShowInativas(!showInativas)}
            className="rounded-lg ml-auto"
          >
            {showInativas ? "Ver Ativas" : "Ver Inativas"}
          </Button>
        </div>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/20 hover:bg-accent/20">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Cód. Contrato</TableHead>
                    <TableHead className="font-semibold">Resp. Contrato</TableHead>
                    <TableHead className="font-semibold">Executiva</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold text-right">Vidas Ativas</TableHead>
                    <TableHead className="font-semibold">Corretora</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Período / Corte</TableHead>
                    <TableHead className="font-semibold">Implantação</TableHead>
                    <TableHead className="font-semibold">Venc. Fatura</TableHead>
                    <TableHead className="font-semibold">Emissão Fatura</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="w-24 font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {isLoading ? (
                      <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
                   ) : filtered.length === 0 ? (
                     <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-12">{isExecutivo ? "Você não possui empresas vinculadas." : "Nenhuma empresa encontrada"}</TableCell></TableRow>
                   ) : (
                    filtered.map((e) => {
                      const suspenso = (e as any).contrato_suspenso;
                      const faixa = (e as any).contrato_faixa_etaria;
                      return (
                        <TableRow
                          key={e.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            suspenso ? "bg-muted/50 hover:bg-muted/70" : "hover:bg-accent/50"
                          )}
                          onClick={() => setDetailEmpresa(e)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              {suspenso && <Ban className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span>{e.nome}</span>
                              {faixa && <Badge variant="outline" className="rounded-md text-[10px]">Faixa Etária</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{e.codigo_contrato || "—"}</TableCell>
                          <TableCell>{getResponsavelName(e)}</TableCell>
                          <TableCell>{getExecutivaName(e)}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{e.cnpj || "—"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{((e as any).vidas ?? 0).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-muted-foreground">{e.operadora_plano || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-md">{e.tipo_movimentacao === "Diária" ? "Diário" : "Período"}</Badge>
                          </TableCell>
                          <TableCell>
                            {(e as any).tipo_contrato === "ADMINISTRADORA"
                              ? (e.data_corte ? `Dia ${String(e.data_corte).padStart(2, "0")}` : "—")
                              : e.tipo_movimentacao === "Diária"
                              ? `Corte: dia ${e.data_corte ?? "—"}`
                              : e.periodo_movimentacao || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDateBR(e.data_implantacao)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDay(e.data_vencimento_fatura)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDay(diaEmissaoMap[e.id] ?? e.data_emissao_fatura)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={e.status_empresa === "Ativa" ? "default" : "secondary"} className="rounded-md w-fit">
                                {e.status_empresa ?? "Ativa"}
                              </Badge>
                              {suspenso && (
                                <Badge variant="outline" className="rounded-md w-fit border-muted-foreground/40 text-muted-foreground">
                                  Suspenso
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setValoresEmpresa(e)}
                                className="rounded-lg hover:bg-primary/10"
                                title="Valores e Faixa Etária"
                              >
                                <Wallet className="h-4 w-4 text-primary" />
                              </Button>
                              {canEdit && (
                                <Button variant="ghost" size="icon" onClick={() => openEdit(e)} className="rounded-lg hover:bg-primary/10" title="Editar"><Pencil className="h-4 w-4 text-primary" /></Button>
                              )}
                              {isFinanceiro && (
                                <Button variant="ghost" size="icon" onClick={() => setGrupoEmpresa({ id: e.id, nome: e.nome })} className="rounded-lg hover:bg-primary/10" title="Grupo Financeiro"><Users className="h-4 w-4 text-primary" /></Button>
                              )}
                              {canFullEdit && (
                                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)} className="rounded-lg hover:bg-destructive/10" title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </div>
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

        {/* Grupo Financeiro Modal (acesso rápido para Financeiro) */}
        <Dialog open={!!grupoEmpresa} onOpenChange={(open) => { if (!open) setGrupoEmpresa(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>Grupo Financeiro</DialogTitle>
              <DialogDescription>{grupoEmpresa?.nome}</DialogDescription>
            </DialogHeader>
            {grupoEmpresa && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <GrupoFinanceiroSection empresaId={grupoEmpresa.id} />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={!!detailEmpresa} onOpenChange={(open) => { if (!open) { setDetailEmpresa(null); setShowRescisaoInput(false); setRescisaoDate(""); } }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Detalhes da Empresa</DialogTitle>
              <DialogDescription>Informações completas da empresa cadastrada.</DialogDescription>
            </DialogHeader>
            {detailEmpresa && (
              <div>
                {/* Hero header */}
                <div className="px-6 pt-6 pb-5 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Detalhes da Empresa</p>
                      <h2 className="text-xl font-semibold leading-tight mt-0.5 break-words">{detailEmpresa.nome || "—"}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {detailEmpresa.codigo_contrato && (
                          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Contrato {detailEmpresa.codigo_contrato}</span>
                        )}
                        {detailEmpresa.cnpj && (
                          <>
                            <span className="opacity-40">•</span>
                            <span className="font-mono">{detailEmpresa.cnpj}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <Badge variant={detailEmpresa.status_empresa === "Ativa" ? "default" : "secondary"} className="rounded-md">
                          {detailEmpresa.status_empresa ?? "Ativa"}
                        </Badge>
                        {(detailEmpresa as any).contrato_faixa_etaria && (
                          <Badge variant="outline" className="rounded-md">Faixa Etária</Badge>
                        )}
                        {(detailEmpresa as any).contrato_suspenso && (
                          <Badge variant="destructive" className="rounded-md gap-1"><Ban className="h-3 w-3" />Suspenso</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-6">
                  {(detailEmpresa as any).contrato_suspenso && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 text-destructive">
                        <Ban className="h-4 w-4" />
                        <span className="text-sm font-semibold">Suspenso desde {formatDateBR((detailEmpresa as any).data_suspensao)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-6">Motivo: {(detailEmpresa as any).motivo_suspensao || "—"}</p>
                    </div>
                  )}

                  {/* Contrato */}
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      <FileText className="h-3.5 w-3.5" /> Contrato
                    </h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border rounded-lg p-4 bg-card">
                      <DetailRow label="Operadora / Corretora" value={detailEmpresa.operadora_plano} />
                      <DetailRow label="Grupo de Contrato" value={(detailEmpresa as any).grupo_contrato} />
                      <DetailRow label="Tipo de Movimentação" value={detailEmpresa.tipo_movimentacao === "Diária" ? "Diário" : "Período"} />
                      <DetailRow label="Período de Movimentação" value={detailEmpresa.periodo_movimentacao} />
                      <DetailRow label="Data de Implantação" value={formatDateBR(detailEmpresa.data_implantacao)} />
                      <DetailRow label="Data de Corte" value={detailEmpresa.data_corte ? `Dia ${detailEmpresa.data_corte}` : null} />
                      <DetailRow label="Prazo (sem carência)" value={(detailEmpresa as any).prazo} />
                      <DetailRow
                        label="Valor Enfermaria"
                        value={
                          (detailEmpresa as any).valor_enfermaria_centavos != null
                            ? ((detailEmpresa as any).valor_enfermaria_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : null
                        }
                      />
                      <DetailRow
                        label="Valor Apartamento"
                        value={
                          (detailEmpresa as any).valor_apartamento_centavos != null
                            ? ((detailEmpresa as any).valor_apartamento_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : null
                        }
                      />
                      {detailEmpresa.status_empresa === "Inativa" && (
                        <DetailRow label="Data de Rescisão" value={formatDateBR((detailEmpresa as any).data_rescisao)} />
                      )}
                    </dl>
                  </section>

                  {/* Financeiro */}
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      <Wallet className="h-3.5 w-3.5" /> Faturamento
                    </h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border rounded-lg p-4 bg-card">
                      <DetailRow label="Emissão da Fatura" value={formatDay(diaEmissaoMap[detailEmpresa.id] ?? detailEmpresa.data_emissao_fatura)} />
                      <DetailRow label="Data de Vencimento" value={formatDay(detailEmpresa.data_vencimento_fatura)} />
                    </dl>
                  </section>

                  {/* Contato */}
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      <Mail className="h-3.5 w-3.5" /> Contato
                    </h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border rounded-lg p-4 bg-card">
                      <DetailRow label="E-mail" value={detailEmpresa.email_empresa} />
                      <DetailRow label="Telefone" value={(detailEmpresa as any).telefone_empresa} />
                      <DetailRow label="Contato" value={(detailEmpresa as any).contato_empresa} />
                    </dl>
                  </section>

                  {/* Responsáveis */}
                  <section>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      <Users className="h-3.5 w-3.5" /> Responsáveis
                    </h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border rounded-lg p-4 bg-card">
                      <DetailRow label="Responsável pelo Contrato" value={getResponsavelName(detailEmpresa)} />
                      <DetailRow label="Executiva Responsável" value={getExecutivaName(detailEmpresa)} />
                    </dl>
                  </section>

                  {/* Observações + meta */}
                  {(detailEmpresa.observacoes || detailEmpresa.created_at || detailEmpresa.updated_at) && (
                    <section>
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                        <Clock className="h-3.5 w-3.5" /> Outras informações
                      </h3>
                      <div className="border rounded-lg p-4 bg-card space-y-3">
                        {detailEmpresa.observacoes && (
                          <div>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Observações</p>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{detailEmpresa.observacoes}</p>
                          </div>
                        )}
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 pt-1 border-t">
                          <DetailRow label="Criado em" value={formatDateBR(detailEmpresa.created_at)} />
                          <DetailRow label="Última atualização" value={formatDateBR(detailEmpresa.updated_at)} />
                        </dl>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
            {(isComum || isAdmin) && detailEmpresa && detailEmpresa.status_empresa === "Ativa" && showRescisaoInput && (
              <div className="border rounded-xl p-4 space-y-3 bg-accent/30">
                <Label className="text-sm font-medium">Data de Rescisão do Contrato *</Label>
                <Input
                  type="date"
                  value={rescisaoDate}
                  onChange={(e) => setRescisaoDate(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {(isComum || isAdmin) && detailEmpresa && (
                <>
                  {detailEmpresa.status_empresa === "Ativa" ? (
                    showRescisaoInput ? (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowRescisaoInput(false); setRescisaoDate(""); }} className="rounded-lg">Cancelar</Button>
                        <Button
                          variant="destructive"
                          className="rounded-lg"
                          disabled={toggleStatusMutation.isPending || !rescisaoDate}
                          onClick={() => {
                            if (!rescisaoDate) {
                              toast({ title: "Informe a data de rescisão", variant: "destructive" });
                              return;
                            }
                            toggleStatusMutation.mutate({ id: detailEmpresa.id, newStatus: "Inativa", dataRescisao: rescisaoDate });
                            setShowRescisaoInput(false);
                            setRescisaoDate("");
                          }}
                        >
                          {toggleStatusMutation.isPending ? "Atualizando..." : "Confirmar Inativação"}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="destructive" onClick={() => setShowRescisaoInput(true)} className="rounded-lg">Inativar Contrato</Button>
                    )
                  ) : (
                    <Button
                      variant="default"
                      className="rounded-lg"
                      disabled={toggleStatusMutation.isPending}
                      onClick={() => toggleStatusMutation.mutate({ id: detailEmpresa.id, newStatus: "Ativa", dataRescisao: null })}
                    >
                      {toggleStatusMutation.isPending ? "Atualizando..." : "Reativar Contrato"}
                    </Button>
                  )}
                </>
              )}
              {isAdmin && detailEmpresa && (
                <Button
                  variant={(detailEmpresa as any).contrato_suspenso ? "default" : "secondary"}
                  className="rounded-lg gap-2"
                  onClick={() => setSuspensaoEmpresa(detailEmpresa)}
                >
                  <Ban className="h-4 w-4" />
                  {(detailEmpresa as any).contrato_suspenso ? "Reativar / Histórico" : "Suspender Contrato"}
                </Button>
              )}
              <Button variant="outline" onClick={() => { setDetailEmpresa(null); setShowRescisaoInput(false); setRescisaoDate(""); }} className="rounded-lg">Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SuspensaoDialog
          open={!!suspensaoEmpresa}
          onOpenChange={(open) => { if (!open) setSuspensaoEmpresa(null); }}
          empresa={suspensaoEmpresa as any}
        />

        <ValoresFaixaEtariaDialog
          empresa={valoresEmpresa}
          open={!!valoresEmpresa}
          onOpenChange={(open) => { if (!open) setValoresEmpresa(null); }}
        />

        <ImportarValoresIniciaisDialog
          open={importValoresOpen}
          onOpenChange={setImportValoresOpen}
        />

        <RecalcularVidasDialog
          open={recalcVidasOpen}
          onOpenChange={setRecalcVidasOpen}
        />

      </div>
    </>
  );
}
