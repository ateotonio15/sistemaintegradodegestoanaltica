import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Check,
  ChevronsUpDown,
  Upload,
  FileText,
  History,
  TrendingUp,
  Loader2,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMesesOptions, formatMesReferencia, getCurrentMesReferencia, PERIODOS_FIN } from "@/lib/financeiro-utils";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { Eye } from "lucide-react";

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
          filter={(value, search) => {
            const s = search.toLowerCase();
            return value.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome, contrato ou CNPJ..." />
          <CommandList>
            <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
            <CommandGroup>
              {empresas.map((e) => {
                const haystack = `${e.nome} ${e.codigo_contrato || ""} ${e.cnpj || ""}`;
                return (
                  <CommandItem
                    key={e.id}
                    value={haystack}
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
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function ensureFinanceiroMovimentacao(empresaId: string, mesReferencia: string): Promise<string> {
  const { data: existing } = await supabase
    .from("financeiro_movimentacoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", mesReferencia)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from("financeiro_movimentacoes")
    .insert({
      empresa_id: empresaId,
      mes_referencia: mesReferencia,
      periodo: PERIODOS_FIN[0],
      tipo_cobranca: null,
      dentro_prazo: true,
      cobranca_registrada: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function uploadPdfAnexo(file: File, empresaId: string, movimentacaoId: string, userId?: string | null) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${empresaId}/${movimentacaoId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("anexos-financeiro").upload(path, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { error: insErr } = await supabase.from("anexos_financeiro").insert({
    financeiro_movimentacao_id: movimentacaoId,
    nome_arquivo: file.name,
    storage_path: path,
    mime_type: file.type || "application/pdf",
    tamanho_bytes: file.size,
    uploaded_by: userId ?? null,
    origem: "retroativo",
  } as any);
  if (insErr) throw insErr;
  return path;
}

export function ReajusteCobrancaRetroativa() {
  const { user, isAdmin, isFinanceiro } = useAuth();
  const canManage = isAdmin || isFinanceiro;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"cobranca" | "reajuste">("cobranca");
  const [openCobDialog, setOpenCobDialog] = useState(false);
  const [openReaDialog, setOpenReaDialog] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<{ path: string; nome: string; mime: string | null } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

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
    queryKey: ["cobrancas-retroativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas_retroativas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: reajustes = [], isLoading: loadingRea } = useQuery({
    queryKey: ["reajustes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reajustes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // ============ Form Cobrança Retroativa ============
  const [editCobId, setEditCobId] = useState<string | null>(null);
  const [editCobMovId, setEditCobMovId] = useState<string | null>(null);
  const [cobEmpresa, setCobEmpresa] = useState<string | null>(null);
  const [cobCompet, setCobCompet] = useState<string>(getCurrentMesReferencia());
  const [cobValor, setCobValor] = useState<string>("");
  const [cobDescricao, setCobDescricao] = useState("");
  const [cobFile, setCobFile] = useState<File | null>(null);
  const [cobSaving, setCobSaving] = useState(false);

  const resetCob = () => {
    setEditCobId(null);
    setEditCobMovId(null);
    setCobEmpresa(null);
    setCobValor("");
    setCobDescricao("");
    setCobFile(null);
    setCobCompet(getCurrentMesReferencia());
  };

  const openEditCobranca = (c: any) => {
    setEditCobId(c.id);
    setEditCobMovId(c.financeiro_movimentacao_id ?? null);
    setCobEmpresa(c.empresa_id);
    setCobCompet(c.competencia);
    setCobValor(((c.valor_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setCobDescricao(c.descricao || "");
    setCobFile(null);
    setOpenCobDialog(true);
  };

  const submitCobranca = async () => {
    if (!cobEmpresa) return toast.error("Selecione um contrato.");
    if (!cobCompet) return toast.error("Selecione a competência.");
    const cents = parseBRLInput(cobValor);
    if (cents <= 0) return toast.error("Informe um valor válido.");
    if (!editCobId && !cobFile) return toast.error("Anexe o PDF da cobrança.");
    if (cobFile && cobFile.type && !cobFile.type.includes("pdf"))
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
          })
          .eq("id", editCobId);
        if (error) throw error;
        if (cobFile) {
          const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
          await uploadPdfAnexo(cobFile, cobEmpresa, movId, user?.id);
          await supabase
            .from("cobrancas_retroativas")
            .update({ financeiro_movimentacao_id: movId })
            .eq("id", editCobId);
        }
        toast.success("Cobrança atualizada.");
      } else {
        const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
        await uploadPdfAnexo(cobFile!, cobEmpresa, movId, user?.id);
        const { error } = await supabase.from("cobrancas_retroativas").insert({
          empresa_id: cobEmpresa,
          competencia: cobCompet,
          valor_centavos: cents,
          descricao: cobDescricao || null,
          financeiro_movimentacao_id: movId,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Cobrança retroativa cadastrada e PDF anexado ao processo.");
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


  // ============ Form Reajuste ============
  const [editReaId, setEditReaId] = useState<string | null>(null);
  const [editReaMovId, setEditReaMovId] = useState<string | null>(null);
  const [reaEmpresa, setReaEmpresa] = useState<string | null>(null);
  const [reaCompet, setReaCompet] = useState<string>(getCurrentMesReferencia());
  const [reaValor, setReaValor] = useState<string>("");
  const [reaParcelas, setReaParcelas] = useState<string>("1");
  const [possuiAporte, setPossuiAporte] = useState(false);
  const [aporteValor, setAporteValor] = useState<string>("");
  const [aporteParcelas, setAporteParcelas] = useState<string>("1");
  const [reaFile, setReaFile] = useState<File | null>(null);
  const [reaSaving, setReaSaving] = useState(false);

  const resetRea = () => {
    setEditReaId(null);
    setEditReaMovId(null);
    setReaEmpresa(null);
    setReaValor("");
    setReaParcelas("1");
    setPossuiAporte(false);
    setAporteValor("");
    setAporteParcelas("1");
    setReaFile(null);
    setReaCompet(getCurrentMesReferencia());
  };

  const openEditReajuste = (r: any) => {
    setEditReaId(r.id);
    setEditReaMovId(r.financeiro_movimentacao_id ?? null);
    setReaEmpresa(r.empresa_id);
    setReaCompet(r.competencia);
    setReaValor(((r.valor_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setReaParcelas(String(r.parcelas || 1));
    setPossuiAporte(!!r.possui_aporte);
    setAporteValor(r.valor_aporte_centavos != null
      ? ((r.valor_aporte_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "");
    setAporteParcelas(String(r.parcelas_aporte || 1));
    setReaFile(null);
    setOpenReaDialog(true);
  };

  const reaCents = parseBRLInput(reaValor);
  const reaParcInt = Math.max(1, parseInt(reaParcelas) || 1);
  const reaParcCents = Math.floor(reaCents / reaParcInt);
  const aporteCents = parseBRLInput(aporteValor);
  const aporteParcInt = Math.max(1, parseInt(aporteParcelas) || 1);
  const aporteParcCents = Math.floor(aporteCents / aporteParcInt);

  const submitReajuste = async () => {
    if (!reaEmpresa) return toast.error("Selecione um contrato.");
    if (!reaCompet) return toast.error("Selecione a competência.");
    if (reaCents <= 0) return toast.error("Informe um valor válido.");
    if (reaParcInt < 1) return toast.error("Parcelas deve ser ≥ 1.");
    if (possuiAporte && (aporteCents <= 0 || aporteParcInt < 1))
      return toast.error("Informe valor e parcelas do aporte.");
    if (!editReaId && !reaFile) return toast.error("Anexe o PDF do reajuste.");
    if (reaFile && reaFile.type && !reaFile.type.includes("pdf"))
      return toast.error("Apenas arquivos PDF são aceitos.");

    setReaSaving(true);
    try {
      if (editReaId) {
        const { error } = await supabase
          .from("reajustes")
          .update({
            empresa_id: reaEmpresa,
            competencia: reaCompet,
            valor_centavos: reaCents,
            parcelas: reaParcInt,
            possui_aporte: possuiAporte,
            valor_aporte_centavos: possuiAporte ? aporteCents : null,
            parcelas_aporte: possuiAporte ? aporteParcInt : null,
          })
          .eq("id", editReaId);
        if (error) throw error;
        if (reaFile) {
          const movId = await ensureFinanceiroMovimentacao(reaEmpresa, reaCompet);
          await uploadPdfAnexo(reaFile, reaEmpresa, movId, user?.id);
          await supabase
            .from("reajustes")
            .update({ financeiro_movimentacao_id: movId })
            .eq("id", editReaId);
        }
        toast.success("Reajuste atualizado.");
      } else {
        const movId = await ensureFinanceiroMovimentacao(reaEmpresa, reaCompet);
        await uploadPdfAnexo(reaFile!, reaEmpresa, movId, user?.id);
        const { error } = await supabase.from("reajustes").insert({
          empresa_id: reaEmpresa,
          competencia: reaCompet,
          valor_centavos: reaCents,
          parcelas: reaParcInt,
          possui_aporte: possuiAporte,
          valor_aporte_centavos: possuiAporte ? aporteCents : null,
          parcelas_aporte: possuiAporte ? aporteParcInt : null,
          financeiro_movimentacao_id: movId,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Reajuste cadastrado e PDF anexado ao processo.");
      }
      resetRea();
      setOpenReaDialog(false);
      queryClient.invalidateQueries({ queryKey: ["reajustes"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "falha desconhecida"));
    } finally {
      setReaSaving(false);
    }
  };


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

  const deleteRea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reajustes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reajuste removido.");
      queryClient.invalidateQueries({ queryKey: ["reajustes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover."),
  });

  const meses = getMesesOptions();
  const isCob = tab === "cobranca";
  const totalCount = isCob ? cobrancas.length : reajustes.length;

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold truncate">
              Reajuste e Cobrança Retroativa
              <Badge variant="outline" className="ml-2 text-[10px]">{totalCount}</Badge>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="cobranca" className="h-6 text-xs gap-1">
                  <History className="h-3 w-3" />
                  Cobrança
                </TabsTrigger>
                <TabsTrigger value="reajuste" className="h-6 text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Reajuste
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {canManage && (
              <Button
                size="sm"
                className="h-8 gap-1"
                onClick={() => (isCob ? setOpenCobDialog(true) : setOpenReaDialog(true))}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {isCob ? (
          <ListaContratos
            loading={loadingCob}
            items={cobrancas}
            empresasMap={empresasMap}
            emptyText="Nenhuma cobrança retroativa registrada."
            renderMeta={(c: any) => (
              <>
                Competência {formatMesReferencia(c.competencia)}
                {c.descricao ? ` · ${c.descricao}` : ""}
              </>
            )}
            renderRight={(c: any) => (
              <Badge variant="secondary" className="shrink-0">{formatBRL(c.valor_centavos)}</Badge>
            )}
            canManage={canManage}
            onDelete={(id) => deleteCob.mutate(id)}
            onEdit={openEditCobranca}
            onView={handleViewPdf}
            loadingPreviewId={loadingPreview}
          />

        ) : (
          <ListaContratos
            loading={loadingRea}
            items={reajustes}
            empresasMap={empresasMap}
            emptyText="Nenhum reajuste registrado."
            renderMeta={(r: any) => (
              <>
                Competência {formatMesReferencia(r.competencia)} · {r.parcelas}×{" "}
                {formatBRL(Math.floor(r.valor_centavos / r.parcelas))}
                {r.possui_aporte && r.valor_aporte_centavos != null && (
                  <>
                    {" · Aporte "}
                    {r.parcelas_aporte}× {formatBRL(Math.floor((r.valor_aporte_centavos || 0) / (r.parcelas_aporte || 1)))}
                  </>
                )}
              </>
            )}
            renderRight={(r: any) => (
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary">{formatBRL(r.valor_centavos)}</Badge>
                {r.possui_aporte && (
                  <Badge variant="outline" className="text-[10px]">+aporte</Badge>
                )}
              </div>
            )}
            canManage={canManage}
            onDelete={(id) => deleteRea.mutate(id)}
            onEdit={openEditReajuste}
            onView={handleViewPdf}
            loadingPreviewId={loadingPreview}
          />

        )}
      </CardContent>

      {/* ============ DIALOG: COBRANÇA RETROATIVA ============ */}
      <Dialog open={openCobDialog} onOpenChange={(o) => { setOpenCobDialog(o); if (!o) resetCob(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {editCobId ? "Editar Cobrança Retroativa" : "Nova Cobrança Retroativa"}
            </DialogTitle>
            <DialogDescription>
              {editCobId ? "Anexar um novo PDF é opcional. Se enviado, substitui o anterior." : "O PDF será automaticamente anexado ao processo financeiro."}
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contrato *</Label>
              <EmpresaCombobox empresas={empresas} value={cobEmpresa} onChange={setCobEmpresa} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Competência *</Label>
                <Select value={cobCompet} onValueChange={setCobCompet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (BRL) *</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={cobValor}
                  onChange={(e) => setCobValor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição / Observação</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes sobre a cobrança retroativa..."
                value={cobDescricao}
                onChange={(e) => setCobDescricao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PDF {editCobId ? "(opcional)" : "*"}</Label>
              <FileInput file={cobFile} onChange={setCobFile} />
              {editCobId && editCobMovId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 w-full"
                  onClick={() => handleViewPdf(editCobMovId)}
                  disabled={loadingPreview === editCobMovId}
                >
                  {loadingPreview === editCobMovId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  )}
                  Visualizar PDF anexado
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCobDialog(false)} disabled={cobSaving}>Cancelar</Button>
            <Button onClick={submitCobranca} disabled={cobSaving} className="gap-1.5">
              {cobSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {cobSaving ? "Salvando..." : editCobId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ============ DIALOG: REAJUSTE ============ */}
      <Dialog open={openReaDialog} onOpenChange={(o) => { setOpenReaDialog(o); if (!o) resetRea(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {editReaId ? "Editar Reajuste" : "Novo Reajuste"}
            </DialogTitle>
            <DialogDescription>
              {editReaId ? "Anexar um novo PDF é opcional. Se enviado, substitui o anterior." : "O PDF será automaticamente anexado ao processo financeiro."}
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contrato *</Label>
              <EmpresaCombobox empresas={empresas} value={reaEmpresa} onChange={setReaEmpresa} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Competência *</Label>
                <Select value={reaCompet} onValueChange={setReaCompet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (BRL) *</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={reaValor}
                  onChange={(e) => setReaValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parcelas *</Label>
                <Input
                  type="number"
                  min={1}
                  value={reaParcelas}
                  onChange={(e) => setReaParcelas(e.target.value)}
                />
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 flex flex-col justify-center">
                <span className="text-[10px] text-muted-foreground">Por parcela</span>
                <span className="text-sm font-semibold">
                  {reaCents > 0 ? `${reaParcInt}× ${formatBRL(reaParcCents)}` : "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="aporte" className="text-sm cursor-pointer">Possui aporte?</Label>
                <p className="text-[11px] text-muted-foreground">Adiciona valor e parcelamento de aporte.</p>
              </div>
              <Switch id="aporte" checked={possuiAporte} onCheckedChange={setPossuiAporte} />
            </div>
            {possuiAporte && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor aporte (BRL) *</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={aporteValor}
                    onChange={(e) => setAporteValor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelas aporte *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={aporteParcelas}
                    onChange={(e) => setAporteParcelas(e.target.value)}
                  />
                </div>
                <div className="col-span-2 rounded-md bg-muted/50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Por parcela do aporte</span>
                  <span className="text-sm font-semibold">
                    {aporteCents > 0 ? `${aporteParcInt}× ${formatBRL(aporteParcCents)}` : "—"}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">PDF {editReaId ? "(opcional)" : "*"}</Label>
              <FileInput file={reaFile} onChange={setReaFile} />
              {editReaId && editReaMovId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 w-full"
                  onClick={() => handleViewPdf(editReaMovId)}
                  disabled={loadingPreview === editReaMovId}
                >
                  {loadingPreview === editReaMovId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  )}
                  Visualizar PDF anexado
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenReaDialog(false)} disabled={reaSaving}>Cancelar</Button>
            <Button onClick={submitReajuste} disabled={reaSaving} className="gap-1.5">
              {reaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {reaSaving ? "Salvando..." : editReaId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
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
    </Card>
  );
}

function FileInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground truncate">
          {file ? file.name : "Selecionar PDF..."}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Remover
        </Button>
      )}
    </div>
  );
}

function ListaContratos({
  loading,
  items,
  empresasMap,
  emptyText,
  renderMeta,
  renderRight,
  canManage,
  onDelete,
  onEdit,
  onView,
  loadingPreviewId,
}: {
  loading: boolean;
  items: any[];
  empresasMap: Record<string, EmpresaOption>;
  emptyText: string;
  renderMeta: (item: any) => React.ReactNode;
  renderRight: (item: any) => React.ReactNode;
  canManage: boolean;
  onDelete: (id: string) => void;
  onEdit?: (item: any) => void;
  onView: (movimentacaoId: string | null) => void;
  loadingPreviewId: string | null;
}) {
  if (loading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
      {items.map((it) => {
        const emp = empresasMap[it.empresa_id];
        const clickable = !!onEdit;
        return (
          <div
            key={it.id}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onEdit!(it) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEdit!(it);
                    }
                  }
                : undefined
            }
            className={cn(
              "flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card transition-colors",
              clickable && "cursor-pointer hover:bg-accent/40"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-foreground">
                {emp?.nome || "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {emp?.codigo_contrato ? `Contrato: ${emp.codigo_contrato} · ` : ""}
                {renderMeta(it)}
              </p>
            </div>
            {renderRight(it)}
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(it.id);
                }}
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
