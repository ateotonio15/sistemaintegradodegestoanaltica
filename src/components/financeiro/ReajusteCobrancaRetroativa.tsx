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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMesesOptions, formatMesReferencia, getCurrentMesReferencia, PERIODOS_FIN } from "@/lib/financeiro-utils";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { CalculadoraRetroativaDialog } from "./CalculadoraRetroativaDialog";

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

async function uploadPdfAnexo(
  file: File,
  empresaId: string,
  movimentacaoId: string,
  userId?: string | null,
) {
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

  const [openCobDialog, setOpenCobDialog] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<{ path: string; nome: string; mime: string | null } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);

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

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cobrancas as any[];
    return (cobrancas as any[]).filter((c) => {
      const emp = empresasMap[c.empresa_id];
      return (
        (emp?.nome || "").toLowerCase().includes(q) ||
        (emp?.codigo_contrato || "").toLowerCase().includes(q) ||
        (c.descricao || "").toLowerCase().includes(q)
      );
    });
  }, [cobrancas, busca, empresasMap]);

  const totalCentavos = useMemo(
    () => (lista as any[]).reduce((s, c) => s + (c.valor_centavos || 0), 0),
    [lista],
  );

  // ============ Form ============
  const [editCobId, setEditCobId] = useState<string | null>(null);
  const [editCobMovId, setEditCobMovId] = useState<string | null>(null);
  const [cobEmpresa, setCobEmpresa] = useState<string | null>(null);
  const [cobCompet, setCobCompet] = useState<string>(getCurrentMesReferencia());
  const [cobValor, setCobValor] = useState<string>("");
  const [cobDescricao, setCobDescricao] = useState("");
  const [cobFiles, setCobFiles] = useState<File[]>([]);
  const [cobSaving, setCobSaving] = useState(false);

  const resetCob = () => {
    setEditCobId(null);
    setEditCobMovId(null);
    setCobEmpresa(null);
    setCobValor("");
    setCobDescricao("");
    setCobFiles([]);
    setCobCompet(getCurrentMesReferencia());
  };

  const openEditCobranca = (c: any) => {
    setEditCobId(c.id);
    setEditCobMovId(c.financeiro_movimentacao_id ?? null);
    setCobEmpresa(c.empresa_id);
    setCobCompet(c.competencia);
    setCobValor(((c.valor_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setCobDescricao(c.descricao || "");
    setCobFiles([]);
    setOpenCobDialog(true);
  };

  const submitCobranca = async () => {
    if (!cobEmpresa) return toast.error("Selecione um contrato.");
    if (!cobCompet) return toast.error("Selecione a competência.");
    const cents = parseBRLInput(cobValor);
    if (cents <= 0) return toast.error("Informe um valor válido.");
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
          })
          .eq("id", editCobId);
        if (error) throw error;
        if (cobFiles.length > 0) {
          const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
          for (const f of cobFiles) await uploadPdfAnexo(f, cobEmpresa, movId, user?.id);
          await supabase
            .from("cobrancas_retroativas")
            .update({ financeiro_movimentacao_id: movId })
            .eq("id", editCobId);
        }
        toast.success("Cobrança atualizada.");
      } else {
        const movId = await ensureFinanceiroMovimentacao(cobEmpresa, cobCompet);
        for (const f of cobFiles) await uploadPdfAnexo(f, cobEmpresa, movId, user?.id);
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
                {lista.length} registro(s) · Total {formatBRL(totalCentavos)}
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
            {canManage && (
              <Button
                size="sm"
                className="h-8 gap-1"
                onClick={() => {
                  resetCob();
                  setCalcOpen(true);
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
            <p className="text-sm text-muted-foreground">Nenhuma cobrança retroativa registrada.</p>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {(lista as any[]).map((c) => {
              const emp = empresasMap[c.empresa_id];
              return (
                <div
                  key={c.id}
                  className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{emp?.nome || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {emp?.codigo_contrato ? `Contrato ${emp.codigo_contrato} · ` : ""}
                      Competência {formatMesReferencia(c.competencia)}
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
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
          </div>
        )}
      </CardContent>

      {/* ============ DIALOG: COBRANÇA RETROATIVA ============ */}
      <Dialog open={openCobDialog} onOpenChange={(o) => { setOpenCobDialog(o); if (!o) resetCob(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              {editCobId ? "Editar Cobrança Retroativa" : "Nova Cobrança Retroativa"}
            </DialogTitle>
            <DialogDescription>
              {editCobId
                ? "Anexar um novo PDF é opcional. Se enviado, substitui o anterior."
                : "O PDF será automaticamente anexado ao processo financeiro."}
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 flex-1"
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => handleRemoveAnexo(editCobMovId, () => setEditCobMovId(null))}
                    disabled={removingAnexo}
                    title="Remover anexo"
                  >
                    {removingAnexo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    )}
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpenCobDialog(false)} disabled={cobSaving}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => setCalcOpen(true)}
              disabled={cobSaving}
              className="gap-1.5"
            >
              <Calculator className="h-4 w-4" /> Calcular
            </Button>
            <Button onClick={submitCobranca} disabled={cobSaving} className="gap-1.5">
              {cobSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {cobSaving ? "Salvando..." : editCobId ? "Salvar alterações" : "Cadastrar"}
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

      <CalculadoraRetroativaDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        onAplicar={(totalCentavos, resumo) => {
          setCobValor((totalCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
          setCobDescricao((d) => (d ? `${d} · ${resumo}` : resumo));
          setOpenCobDialog(true);
        }}
        onPular={() => setOpenCobDialog(true)}
      />

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
