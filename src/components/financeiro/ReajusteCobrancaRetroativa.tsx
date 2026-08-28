import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Check,
  ChevronsUpDown,
  Upload,
  FileText,
  Loader2,
  Trash2,
  Plus,
  Search,
  Eye,
  Calculator,
  Receipt,
  Pencil,
  Building2,
  CalendarIcon,
  Paperclip,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMesesOptions, formatMesReferencia, getCurrentMesReferencia, PERIODOS_FIN } from "@/lib/financeiro-utils";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { CalculadoraRetroativaDialog, type CalcItem } from "./CalculadoraRetroativaDialog";

type EmpresaOption = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
};

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRLInput(s: string): number {
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function EmpresaCombobox({
  empresas,
  value,
  onChange,
  disabled,
}: {
  empresas: EmpresaOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = empresas.find((e) => e.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.nome}${selected.codigo_contrato ? ` · ${selected.codigo_contrato}` : ""}`
              : "Selecionar contrato..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar por nome, contrato ou CNPJ..." />
          <CommandList>
            <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
            <CommandGroup>
              {empresas.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.nome} ${e.codigo_contrato || ""} ${e.cnpj || ""}`}
                  onSelect={() => {
                    onChange(e.id === value ? null : e.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === e.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm">{e.nome}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {e.codigo_contrato || "—"} · {e.cnpj || "sem CNPJ"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function ensureFinanceiroMovimentacao(empresaId: string, mesReferencia: string): Promise<string> {
  // Sempre reaproveita a cobrança já existente da competência (não cria linha só para o retroativo)
  const { data: existing } = await supabase
    .from("financeiro_movimentacoes")
    .select("id, created_at")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", mesReferencia)
    .order("created_at", { ascending: true });
  if (existing && existing.length > 0) return existing[0].id;

  // Não existe cobrança na competência: cria usando o período cadastrado na empresa
  const { data: emp } = await supabase
    .from("empresas")
    .select("periodo_movimentacao")
    .eq("id", empresaId)
    .maybeSingle();
  const periodoEmpresa = (emp?.periodo_movimentacao as string | null) || null;

  const { data: created, error } = await supabase
    .from("financeiro_movimentacoes")
    .insert({
      empresa_id: empresaId,
      mes_referencia: mesReferencia,
      periodo: periodoEmpresa || PERIODOS_FIN[0],
      tipo_cobranca: null,
      dentro_prazo: true,
      cobranca_registrada: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}


async function getUserDisplayName(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.display_name as string | null) ?? null;
}

async function uploadPdfAnexo(
  file: File,
  empresaId: string,
  movimentacaoId: string,
  competencia: string,
  userId?: string | null,
) {
  const ext = file.name.split(".").pop() || "pdf";
  const storedName = `${crypto.randomUUID()}.${ext}`;
  const path = `${empresaId}/${movimentacaoId}/${storedName}`;

  const { error: upErr } = await supabase.storage.from("anexos-financeiro").upload(path, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: anexoData, error: insErr } = await supabase
    .from("anexos_financeiro")
    .insert({
      financeiro_movimentacao_id: movimentacaoId,
      nome_arquivo: file.name,
      storage_path: path,
      mime_type: file.type || "application/pdf",
      tamanho_bytes: file.size,
      uploaded_by: userId ?? null,
      origem: "retroativo",
    } as any)
    .select("id")
    .single();
  if (insErr) throw insErr;

  // O trigger de anexos_financeiro já cria o registro no Repositório Financeiro.
  // Aqui apenas reclassificamos esse registro como "Retroativo" (evita duplicidade).
  const uploadedByNome = await getUserDisplayName(userId);
  const { error: faErr } = await supabase
    .from("financeiro_arquivos")
    .update({
      categoria: "Retroativo",
      uploaded_by_nome: uploadedByNome,
      anexo_financeiro_id: anexoData.id,
    } as any)
    .eq("storage_path", path);
  if (faErr) throw faErr;


  return path;
}

/** Reconstrói os itens da calculadora a partir do resumo salvo na descrição. */
function parseResumoParaItens(descricao: string | null | undefined): CalcItem[] {
  if (!descricao) return [];
  const re =
    /(\d+)\s*benef\.?\s*[x×]\s*(\d+)\s*dia\(s\)\s*\((\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})\)\s*·\s*R\$\s*([\d.,]+)\/(\d+)\s*=\s*R\$\s*([\d.,]+)/g;
  const toCent = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const toISO = (v: string) => v.split("/").reverse().join("-");
  const itens: CalcItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(descricao))) {
    itens.push({
      id: `${itens.length}-${m[3]}-${m[4]}`,
      inicio: toISO(m[3]),
      fim: toISO(m[4]),
      qtd: Number(m[1]) || 0,
      dias: Number(m[2]) || 0,
      mensalCent: toCent(m[5]),
      div: Number(m[6]) || 30,
      total: toCent(m[7]),
    });
  }
  return itens;
}

export function ReajusteCobrancaRetroativa({ competencia }: { competencia?: string } = {}) {
  const { user, isAdmin, isFinanceiro } = useAuth();
  const canManage = isAdmin || isFinanceiro;
  const queryClient = useQueryClient();

  const [openCobDialog, setOpenCobDialog] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<{ path: string; nome: string; mime: string | null } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  // Cálculos registrados por cobrança (chave: id da cobrança em edição ou "nova")
  const [calcItensPorCobranca, setCalcItensPorCobranca] = useState<Record<string, CalcItem[]>>({});
  const [manualValorOpen, setManualValorOpen] = useState(false);
  const [manualValorInput, setManualValorInput] = useState("");
  

  const handleViewPdf = async (movimentacaoId: string | null) => {
    if (!movimentacaoId) {
      toast.error("Nenhum anexo vinculado a este registro.");
      return;
    }
    setLoadingPreview(movimentacaoId);
    try {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("nome_arquivo, storage_path, mime_type, created_at, origem")
        .eq("financeiro_movimentacao_id", movimentacaoId)
        .eq("origem", "retroativo")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("PDF não encontrado.");
        return;
      }
      const a = data[0];
      setPreviewAnexo({ path: a.storage_path, nome: a.nome_arquivo, mime: a.mime_type });
    } catch (e: any) {
      toast.error("Erro ao carregar PDF: " + (e?.message || "desconhecido"));
    } finally {
      setLoadingPreview(null);
    }
  };

  const [removingAnexo, setRemovingAnexo] = useState(false);
  const handleRemoveAnexo = async (movimentacaoId: string | null, onDone?: () => void) => {
    if (!movimentacaoId) return;
    if (!confirm("Remover o PDF anexado deste registro?")) return;
    setRemovingAnexo(true);
    try {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("id, storage_path")
        .eq("financeiro_movimentacao_id", movimentacaoId)
        .eq("origem", "retroativo");
      if (error) throw error;
      if (data && data.length > 0) {
        const paths = data.map((a: any) => a.storage_path).filter(Boolean);
        if (paths.length > 0) await supabase.storage.from("anexos-financeiro").remove(paths);
        await supabase.from("anexos_financeiro").delete().in("id", data.map((a: any) => a.id));
        // Garante que nenhuma cópia fique ativa no Repositório Financeiro
        if (paths.length > 0) {
          await supabase
            .from("financeiro_arquivos")
            .update({ status: "removido" } as any)
            .in("storage_path", paths);
        }
      }
      toast.success("Anexo removido.");
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
      onDone?.();
    } catch (e: any) {
      toast.error("Erro ao remover anexo: " + (e?.message || "desconhecido"));
    } finally {
      setRemovingAnexo(false);
    }
  };

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-rcr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj, status_empresa, data_rescisao, contrato_suspenso")
        .order("nome");
      if (error) throw error;
      return (data || [])
        .filter((e: any) => (e.status_empresa ?? "Ativa") === "Ativa" && !e.data_rescisao && !e.contrato_suspenso)
        .map((e: any) => ({
          id: e.id,
          nome: e.nome,
          codigo_contrato: e.codigo_contrato,
          cnpj: e.cnpj,
        })) as EmpresaOption[];
    },
  });

  const empresasMap = useMemo(() => {
    const m: Record<string, EmpresaOption> = {};
    empresas.forEach((e) => (m[e.id] = e));
    return m;
  }, [empresas]);

  const { data: cobrancas = [], isLoading: loadingCob } = useQuery({
    queryKey: ["cobrancas-retroativas", competencia ?? "todas"],
    queryFn: async () => {
      let q = supabase
        .from("cobrancas_retroativas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (competencia) q = q.eq("competencia", competencia);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const lista = useMemo(() => {
    const base = (cobrancas as any[]).filter(
      (c) => !competencia || c.competencia === competencia,
    );
    const q = busca.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => {
      const emp = empresasMap[c.empresa_id];
      return (
        (emp?.nome || "").toLowerCase().includes(q) ||
        (emp?.codigo_contrato || "").toLowerCase().includes(q) ||
        (c.descricao || "").toLowerCase().includes(q)
      );
    });
  }, [cobrancas, busca, empresasMap, competencia]);

  const confirmadasCount = useMemo(
    () => (lista as any[]).filter((c) => c.confirmado).length,
    [lista],
  );

  const totalCentavos = useMemo(
    () => (lista as any[]).reduce((s, c) => s + (c.valor_centavos || 0), 0),
    [lista],
  );

  // ============ Form ============
  const [editCobId, setEditCobId] = useState<string | null>(null);
  const [editCobMovId, setEditCobMovId] = useState<string | null>(null);
  const [cobEmpresa, setCobEmpresa] = useState<string | null>(null);
  const [cobCompet, setCobCompet] = useState<string>(competencia || getCurrentMesReferencia());
  const [cobValor, setCobValor] = useState<string>("");
  const [cobDescricao, setCobDescricao] = useState("");
  const [cobTipo, setCobTipo] = useState<"retroativa" | "devolucao">("retroativa");
  const [cobFiles, setCobFiles] = useState<File[]>([]);
  const [cobSaving, setCobSaving] = useState(false);
  const [anexoAtualNome, setAnexoAtualNome] = useState<string | null>(null);

  const resetCob = () => {
    setEditCobId(null);
    setEditCobMovId(null);
    setCobEmpresa(null);
    setCobValor("");
    setCobDescricao("");
    setCobTipo("retroativa");
    setCobFiles([]);
    setCobCompet(competencia || getCurrentMesReferencia());
    setManualValorInput("");
    
    setAnexoAtualNome(null);
    setCalcItensPorCobranca((m) => ({ ...m, nova: [] }));
  };


  const openEditCobranca = async (c: any) => {
    setEditCobId(c.id);
    setEditCobMovId(c.financeiro_movimentacao_id ?? null);
    setCobEmpresa(c.empresa_id);
    setCobCompet(c.competencia);
    setCobValor((Math.abs(c.valor_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setCobDescricao(c.descricao || "");
    setCobTipo(c.tipo === "devolucao" ? "devolucao" : "retroativa");
    setCalcItensPorCobranca((m) => ({ ...m, [c.id]: parseResumoParaItens(c.descricao) }));
    setCobFiles([]);
    setAnexoAtualNome(null);
    if (c.financeiro_movimentacao_id) {
      const { data } = await supabase
        .from("anexos_financeiro")
        .select("nome_arquivo")
        .eq("financeiro_movimentacao_id", c.financeiro_movimentacao_id)
        .eq("origem", "retroativo")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setAnexoAtualNome(data[0].nome_arquivo);
    }
    setOpenCobDialog(true);
  };

  const submitCobranca = async () => {
    if (!cobEmpresa) return toast.error("Selecione um contrato.");
    if (!cobCompet) return toast.error("Selecione a competência.");
    const centsRaw = parseBRLInput(cobValor);
    if (centsRaw === 0) return toast.error("Informe um valor válido.");
    const cents = cobTipo === "devolucao" ? -Math.abs(centsRaw) : Math.abs(centsRaw);
    if (!editCobId && cobFiles.length === 0) return toast.error("Anexe ao menos um PDF da cobrança.");
    if (cobFiles.some((f) => f.type && !f.type.includes("pdf")))
      return toast.error("Apenas arquivos PDF são aceitos.");

    setCobSaving(true);
    try {
      if (editCobId) {
        const { error } = await supabase
          .from("cobrancas_retroativas")
          .update({
            empresa_id: cobEmpresa,
            competencia: cobCompet,
            valor_centavos: cents,
            descricao: cobDescricao || null,
            tipo: cobTipo,
          })
          .eq("id", editCobId);
        if (error) throw error;
        if (cobFiles.length > 0) {
          const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
          for (const f of cobFiles) await uploadPdfAnexo(f, cobEmpresa, movId, cobCompet, user?.id);
          await supabase
            .from("cobrancas_retroativas")
            .update({ financeiro_movimentacao_id: movId })
            .eq("id", editCobId);
        }
        toast.success(cobTipo === "devolucao" ? "Devolução atualizada." : "Cobrança atualizada.");
      } else {
        const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
        for (const f of cobFiles) await uploadPdfAnexo(f, cobEmpresa, movId, cobCompet, user?.id);
        const { error } = await supabase.from("cobrancas_retroativas").insert({
          empresa_id: cobEmpresa,
          competencia: cobCompet,
          valor_centavos: cents,
          descricao: cobDescricao || null,
          financeiro_movimentacao_id: movId,
          created_by: user?.id ?? null,
          tipo: cobTipo,
        });
        if (error) throw error;
        toast.success(
          cobTipo === "devolucao"
            ? "Devolução cadastrada e PDF anexado ao processo."
            : "Cobrança retroativa cadastrada e PDF anexado ao processo.",
        );
      }
      resetCob();
      setOpenCobDialog(false);
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "falha desconhecida"));
    } finally {
      setCobSaving(false);
    }
  };

  // ===== Conferência da cobrança na planilha de faturamento =====
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [conferindoTodas, setConferindoTodas] = useState(false);

  /** Retorna o total retroativo (em centavos) encontrado nas planilhas da empresa/competência. */
  const buscarRetroativoPlanilha = async (
    empresaId: string,
    compet: string,
  ): Promise<number | null> => {
    const { data: movs, error: movErr } = await supabase
      .from("financeiro_movimentacoes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("mes_referencia", compet);
    if (movErr) throw movErr;
    const movIds = (movs || []).map((m: any) => m.id);
    if (movIds.length === 0) return null;

    const { data: anexos, error: anxErr } = await supabase
      .from("anexos_financeiro")
      .select("nome_arquivo, storage_path, mime_type")
      .in("financeiro_movimentacao_id", movIds);
    if (anxErr) throw anxErr;

    const { isXlsAnexo } = await import("@/lib/financeiro-utils");
    const xls = (anexos || []).filter((a: any) => isXlsAnexo(a) && a.storage_path);
    if (xls.length === 0) return null;

    const { analisarExcelFinanceiroPorCnpj } = await import("@/lib/excel-analysis-utils");
    let totalReais = 0;
    let algumLido = false;
    for (const a of xls) {
      try {
        const { data, error } = await supabase.storage
          .from("anexos-financeiro")
          .download((a as any).storage_path);
        if (error) throw error;
        const blocos = await analisarExcelFinanceiroPorCnpj(await data.arrayBuffer());
        algumLido = true;
        blocos.forEach((b) => (totalReais += b.retroativas?.total ?? 0));
      } catch {
        /* ignora arquivo ilegível */
      }
    }
    if (!algumLido) return null;
    return Math.round(totalReais * 100);
  };

  const conferirCobranca = async (c: any, silencioso = false) => {
    setConferindo(c.id);
    try {
      const encontrado = await buscarRetroativoPlanilha(c.empresa_id, c.competencia);
      const ehDevolucao = c.tipo === "devolucao";
      const registrado = c.valor_centavos || 0;
      const status =
        encontrado === null
          ? "nao_encontrada"
          : Math.abs(
              ehDevolucao
                ? Math.abs(encontrado) - Math.abs(registrado)
                : encontrado - registrado,
            ) <= 5
            ? "confirmada"
            : "divergente";
      const { error } = await supabase
        .from("cobrancas_retroativas")
        .update({
          conferencia_status: status,
          conferido_em: new Date().toISOString(),
          valor_planilha_centavos: encontrado,
          ...(status === "confirmada"
            ? {
                confirmado: true,
                confirmado_em: new Date().toISOString(),
                confirmado_por: user?.id ?? null,
                confirmado_origem: "planilha",
              }
            : {}),
        } as any)
        .eq("id", c.id);
      if (error) throw error;
      if (!silencioso) {
        const label = ehDevolucao ? "Devolução" : "Cobrança";
        if (status === "confirmada") toast.success(`${label} confirmada na planilha.`);
        else if (status === "divergente")
          toast.warning(
            `${label} — divergência: planilha ${formatBRL(encontrado ?? 0)} × registrado ${formatBRL(registrado)}.`,
          );
        else toast.info("Nenhuma planilha de faturamento encontrada para esta competência.");
      }
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
      return status;
    } catch (e: any) {
      if (!silencioso) toast.error("Erro ao conferir: " + (e?.message || "desconhecido"));
      return null;
    } finally {
      setConferindo(null);
    }
  };

  const conferirTodas = async () => {
    setConferindoTodas(true);
    let ok = 0;
    let div = 0;
    let semPlan = 0;
    try {
      for (const c of lista as any[]) {
        const s = await conferirCobranca(c, true);
        if (s === "confirmada") ok++;
        else if (s === "divergente") div++;
        else semPlan++;
      }
      toast.success(`Conferência: ${ok} confirmada(s), ${div} divergente(s), ${semPlan} sem planilha.`);
    } finally {
      setConferindoTodas(false);
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
    }
  };

  const confirmarManual = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase
        .from("cobrancas_retroativas")
        .update({
          confirmado: !c.confirmado,
          confirmado_em: !c.confirmado ? new Date().toISOString() : null,
          confirmado_por: !c.confirmado ? user?.id ?? null : null,
          confirmado_origem: !c.confirmado ? "manual" : null,
        } as any)
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao confirmar."),
  });

  const deleteCob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cobrancas_retroativas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança removida.");
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover."),
  });

  const meses = getMesesOptions();

  return (
    <Card className="rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">Cobrança Retroativa</CardTitle>
              <p className="text-xs text-muted-foreground">
                {lista.length} registro(s) · Total {formatBRL(totalCentavos)} ·{" "}
                {confirmadasCount} confirmada(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar contrato..."
                className="h-8 w-44 pl-8 text-xs"
              />
            </div>
            {canManage && lista.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={conferirTodas}
                disabled={conferindoTodas}
                title="Conferir os valores na planilha de faturamento da competência"
              >
                {conferindoTodas ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Conferir todas
              </Button>
            )}
            {canManage && (
              <Button
                size="sm"
                className="h-8 gap-1"
                onClick={() => {
                  resetCob();
                  setOpenCobDialog(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}

          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {loadingCob ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <Receipt className="h-6 w-6 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhuma cobrança retroativa nesta competência.</p>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {(lista as any[]).map((c) => {
              const emp = empresasMap[c.empresa_id];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40",
                    c.tipo === "devolucao" && "border-amber-500/20 bg-amber-500/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate text-foreground">{emp?.nome || "—"}</p>
                      {c.tipo === "devolucao" && (
                        <Badge className="h-5 gap-1 bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">
                          Devolução
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {emp?.codigo_contrato ? `Contrato ${emp.codigo_contrato} · ` : ""}
                      Competência {formatMesReferencia(c.competencia)}
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {c.confirmado ? (
                        <Badge className="h-5 gap-1 bg-emerald-600/15 text-emerald-500 border-emerald-600/30 text-[10px]">
                          <ShieldCheck className="h-3 w-3" />
                          Confirmada {c.confirmado_origem === "manual" ? "(manual)" : "(planilha)"}
                        </Badge>
                      ) : c.conferencia_status === "divergente" ? (
                        <Badge className="h-5 gap-1 bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">
                          <AlertTriangle className="h-3 w-3" />
                          Divergente · planilha {formatBRL(c.valor_planilha_centavos ?? 0)}
                        </Badge>
                      ) : c.conferencia_status === "nao_encontrada" ? (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          Não encontrada na planilha
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
                          Não conferida
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 tabular-nums",
                      (c.valor_centavos || 0) < 0 && "text-amber-500 bg-amber-500/10",
                    )}
                  >
                    {formatBRL(c.valor_centavos)}
                  </Badge>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Visualizar PDF"
                      onClick={() => handleViewPdf(c.financeiro_movimentacao_id ?? null)}
                      disabled={loadingPreview === c.financeiro_movimentacao_id}
                    >
                      {loadingPreview === c.financeiro_movimentacao_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      )}
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Conferir na planilha de faturamento"
                          onClick={() => conferirCobranca(c)}
                          disabled={conferindo === c.id || conferindoTodas}
                        >
                          {conferindo === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title={c.confirmado ? "Desfazer confirmação" : "Confirmar manualmente"}
                          onClick={() => confirmarManual.mutate(c)}
                        >
                          <CheckCircle2
                            className={cn(
                              "h-3.5 w-3.5",
                              c.confirmado ? "text-emerald-500" : "text-muted-foreground",
                            )}
                          />
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Editar"
                          onClick={() => openEditCobranca(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Remover"
                          onClick={() => deleteCob.mutate(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {lista.length > 0 && (
              <div className="sticky bottom-0 rounded-lg border border-primary/20 bg-card/95 backdrop-blur px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Total na competência</span>
                <span
                  className={cn(
                    "text-base font-bold tabular-nums",
                    lista.reduce((s, c) => s + (c.valor_centavos || 0), 0) < 0 && "text-amber-500",
                  )}
                >
                  {formatBRL(lista.reduce((s, c) => s + (c.valor_centavos || 0), 0))}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* ============ DIALOG: COBRANÇA RETROATIVA ============ */}
      <Dialog open={openCobDialog} onOpenChange={(o) => { setOpenCobDialog(o); if (!o) resetCob(); }}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden flex max-h-[90vh] flex-col">
          {/* Header destacado */}
          <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b px-6 py-5">
            <DialogHeader className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Receipt className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold tracking-tight truncate">
                      {editCobId ? "Editar Cobrança Retroativa" : "Nova Cobrança Retroativa"}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                      {editCobId
                        ? "Anexar um novo PDF é opcional. Se enviado, substitui o anterior."
                        : "O PDF será automaticamente anexado ao processo financeiro."}
                    </DialogDescription>
                  </div>
                </div>
                {editCobId && (
                  <Badge variant="outline" className="shrink-0 text-[10px] border-primary/30 bg-primary/10 text-primary">
                    Edição
                  </Badge>
                )}
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            {/* Seção Contrato */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Contrato <span className="text-destructive">*</span>
              </Label>
              {editCobId && cobEmpresa ? (
                <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{empresasMap[cobEmpresa]?.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {empresasMap[cobEmpresa]?.codigo_contrato
                        ? `Contrato ${empresasMap[cobEmpresa]?.codigo_contrato}`
                        : empresasMap[cobEmpresa]?.cnpj || "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <EmpresaCombobox empresas={empresas} value={cobEmpresa} onChange={setCobEmpresa} />
              )}
            </div>

            {/* Grid Competência + Valor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Competência <span className="text-destructive">*</span>
                </Label>
                <Select value={cobCompet} onValueChange={setCobCompet}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                  Valor total <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 justify-between font-normal bg-card hover:bg-accent/50"
                  onClick={() => setCalcOpen(true)}
                >
                  <span className={cn("truncate text-sm", !cobValor && "text-muted-foreground")}>
                    {cobValor ? `R$ ${cobValor}` : "Calcular valor"}
                  </span>
                  <Calculator className="ml-2 h-4 w-4 shrink-0 text-primary" />
                </Button>
              </div>
            </div>

            {/* Tipo de lançamento */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                Tipo de lançamento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={cobTipo}
                onValueChange={(v) => setCobTipo(v as "retroativa" | "devolucao")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retroativa">Cobrança retroativa</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {cobTipo === "devolucao"
                  ? "O valor será registrado como negativo (crédito para o cliente)."
                  : "O valor será registrado como positivo (débito para o cliente)."}
              </p>
            </div>

            {/* Descrição / Observação */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Descrição / Observação
              </Label>
              <Textarea
                rows={3}
                placeholder="Detalhes sobre a cobrança retroativa..."
                value={cobDescricao}
                onChange={(e) => setCobDescricao(e.target.value)}
                className="resize-none bg-card"
              />
            </div>

            {/* Seção Anexos */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium flex items-center gap-1.5 m-0">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Anexos da cobrança (PDF)
                  {editCobId ? (
                    <span className="text-[10px] font-normal text-muted-foreground">(opcional)</span>
                  ) : (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
              </div>

              {editCobId && editCobMovId && anexoAtualNome && (
                <div className="rounded-lg border bg-card px-3 py-2.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{anexoAtualNome}</p>
                    <p className="text-[10px] text-muted-foreground">PDF anexado</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleViewPdf(editCobMovId)}
                      disabled={loadingPreview === editCobMovId}
                      title="Visualizar PDF"
                    >
                      {loadingPreview === editCobMovId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveAnexo(editCobMovId, () => { setEditCobMovId(null); setAnexoAtualNome(null); })}
                      disabled={removingAnexo}
                      title="Remover anexo"
                    >
                      {removingAnexo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <FileInput files={cobFiles} onChange={setCobFiles} />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-muted/20 px-6 py-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpenCobDialog(false)} disabled={cobSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submitCobranca} disabled={cobSaving} className="gap-1.5">
              {cobSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {cobSaving ? "Salvando..." : editCobId ? "Salvar alterações" : "Cadastrar cobrança"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewAnexo && (
        <PreviewArquivoDialog
          open={!!previewAnexo}
          onOpenChange={(o) => { if (!o) setPreviewAnexo(null); }}
          bucket="anexos-financeiro"
          storagePath={previewAnexo.path}
          nomeArquivo={previewAnexo.nome}
          mimeType={previewAnexo.mime}
        />
      )}

      <CalculadoraRetroativaDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        itensIniciais={calcItensPorCobranca[editCobId ?? "nova"] ?? []}
        onItensChange={(itens) =>
          setCalcItensPorCobranca((m) => ({ ...m, [editCobId ?? "nova"]: itens }))
        }
        onAplicar={(totalCentavos, resumo) => {
          setCobValor((totalCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
          setCobDescricao(resumo);
          setOpenCobDialog(true);
        }}
        onPular={() => {
          setCalcOpen(false);
          setManualValorOpen(true);
        }}
      />

      {/* ============ DIALOG: VALOR MANUAL ============ */}
      <Dialog
        open={manualValorOpen}
        onOpenChange={(o) => {
          setManualValorOpen(o);
          if (!o) setManualValorInput("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Valor total da cobrança
            </DialogTitle>
            <DialogDescription>Informe o valor total da cobrança.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor total (R$) *</Label>
              <Input
                inputMode="numeric"
                placeholder="0,00"
                value={manualValorInput}
                onChange={(e) => setManualValorInput(formatCurrencyInput(e.target.value))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setManualValorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const cents = parseBRLInput(manualValorInput);
                if (cents === 0) return toast.error("Informe um valor válido.");
                setCobValor((Math.abs(cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
                setManualValorOpen(false);
                setManualValorInput("");
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}

function FileInput({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground truncate">
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar PDF(s)..."}
        </span>
        <input
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onChange([...files, ...Array.from(e.target.files ?? [])])}
        />
      </label>
      {files.length > 0 && (
        <div className="rounded-md border divide-y">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs truncate flex-1">{f.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

}
