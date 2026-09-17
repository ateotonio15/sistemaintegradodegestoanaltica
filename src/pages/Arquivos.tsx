import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderArchive,
  Search,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Download,
  Trash2,
  Building2,
  Plus,
  Upload,
  ChevronRight,
  FileQuestion,
  MoreHorizontal,
  FolderInput,
  Receipt,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { UploadArquivoDialog } from "@/components/arquivos/UploadArquivoDialog";
import { ArquivoPreviewInline } from "@/components/arquivos/ArquivoPreviewInline";
import { useAuth } from "@/hooks/useAuth";
import { compLabel, formatBytes, tipoArquivo } from "@/lib/arquivos-utils";
import { cn } from "@/lib/utils";
import {
  type LancamentoRetroativo,
  conferirLancamentoRetroativo,
  confirmarCobrancaArquivo,
  confirmarLancamentoManual,
  fetchLancamentosRetroativos,
  formatBRLCentavos,
  origemDoLancamento,
} from "@/lib/retroativos-espelho";

const CATEGORIAS = ["Mensalidade", "Reajuste", "Implantação", "Retroativo", "Fluxo"] as const;
type Categoria = (typeof CATEGORIAS)[number];

function categoriaChipClass(cat: string): string {
  switch (cat) {
    case "Mensalidade":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "Reajuste":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Implantação":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Retroativo":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
    case "Fluxo":
      return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}


const DEFAULT_BUCKET = "arquivos-financeiro";

interface Empresa {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
}

interface ArquivoRow {
  id: string;
  empresa_id: string;
  competencia: string;
  categoria: string;
  nome_original: string;
  extensao: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  observacao: string | null;
  uploaded_by: string | null;
  uploaded_by_nome: string | null;
  storage_path: string;
  status: string;
  versao: number;
  created_at: string;
  bucket?: string | null;
  origem?: string | null;
  financeiro_movimentacao_id?: string | null;
  cobranca_confirmada?: boolean | null;
  /** Preenchido quando a linha é um lançamento de cobrança retroativa/devolução. */
  lanc?: LancamentoRetroativo;
  /** PDF vinculado ao lançamento, quando existir. */
  arquivoVinculado?: ArquivoRow | null;
}

function iconForExt(ext: string | null) {
  const t = tipoArquivo(ext);
  switch (t) {
    case "PDF":
      return <FileText className="h-4 w-4 text-rose-500" />;
    case "Excel":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    case "Imagem":
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    case "Doc":
      return <FileText className="h-4 w-4 text-indigo-500" />;
    default:
      return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const data = formatDateBR(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${data} ${hh}:${mm}`;
}

export default function Arquivos() {
  const queryClient = useQueryClient();
  const { canEditFinanceiro, user } = useAuth();
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaults, setUploadDefaults] = useState<{ empresaId?: string }>({});
  const [searchEmpresa, setSearchEmpresa] = useState("");
  const [searchArquivo, setSearchArquivo] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [selectedArquivoId, setSelectedArquivoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ArquivoRow | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  function openUpload(empresaId?: string) {
    setUploadDefaults({ empresaId });
    setUploadOpen(true);
  }

  const { data: empresas = [] } = useQuery({
    queryKey: ["arquivos-empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });

  const { data: arquivosRaw = [], isLoading } = useQuery({
    queryKey: ["financeiro-arquivos"],
    queryFn: async () => {
      const pageSize = 1000;
      const all: ArquivoRow[] = [];
      let from = 0;
      // Pagina para contornar o limite padrão de 1000 linhas do PostgREST
      // e garantir que arquivos antigos (competências anteriores) também apareçam.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("financeiro_arquivos")
          .select("*")
          .eq("status", "ativo")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as ArquivoRow[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Lançamentos de cobrança retroativa/devolução — os mesmos exibidos na aba Financeiro
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["retroativos-lancamentos"],
    queryFn: () => fetchLancamentosRetroativos(),
  });

  // Anexos enviados junto com a cobrança retroativa (aba Financeiro)
  const { data: anexosRetro = [] } = useQuery({
    queryKey: ["anexos-retroativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select(
          "id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at, financeiro_movimentacao_id, origem",
        )
        .eq("origem", "retroativo");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        nome_arquivo: string;
        storage_path: string;
        mime_type: string | null;
        tamanho_bytes: number | null;
        created_at: string;
        financeiro_movimentacao_id: string | null;
      }>;
    },
  });

  /** Arquivos + lançamentos retroativos, na mesma lista (pasta "Retroativo"). */
  const arquivos = useMemo<ArquivoRow[]>(() => {
    const extras: ArquivoRow[] = lancamentos.map((l) => {
      const vinc =
        (l.financeiro_movimentacao_id
          ? arquivosRaw.find(
              (a) =>
                a.financeiro_movimentacao_id === l.financeiro_movimentacao_id &&
                a.categoria === "Retroativo",
            )
          : null) ?? null;
      // Sem linha no repositório: usa o anexo original enviado na aba Financeiro
      const anexo =
        !vinc && l.financeiro_movimentacao_id
          ? anexosRetro.find(
              (x) => x.financeiro_movimentacao_id === l.financeiro_movimentacao_id,
            ) ?? null
          : null;
      const nomeAnexo = vinc?.nome_original ?? anexo?.nome_arquivo ?? null;
      const titulo = `${
        l.tipo === "devolucao" ? "Devolução" : "Cobrança retroativa"
      } · ${formatBRLCentavos(l.valor_centavos)}`;
      return {
        id: `lanc-${l.id}`,
        empresa_id: l.empresa_id,
        competencia: l.competencia,
        categoria: "Retroativo",
        nome_original: nomeAnexo ? `${titulo} · ${nomeAnexo}` : titulo,
        extensao:
          vinc?.extensao ??
          (anexo?.nome_arquivo?.split(".").pop()?.toLowerCase() ?? null),
        mime_type: vinc?.mime_type ?? anexo?.mime_type ?? null,
        tamanho_bytes: vinc?.tamanho_bytes ?? anexo?.tamanho_bytes ?? null,
        observacao: l.descricao,
        uploaded_by: l.created_by,
        uploaded_by_nome: vinc?.uploaded_by_nome ?? null,
        storage_path: vinc?.storage_path ?? anexo?.storage_path ?? "",
        status: "ativo",
        versao: 1,
        created_at: l.created_at,
        bucket: vinc?.bucket ?? (anexo ? "anexos-financeiro" : DEFAULT_BUCKET),
        origem: "lancamento_retroativo",
        financeiro_movimentacao_id: l.financeiro_movimentacao_id,
        lanc: l,
        arquivoVinculado: vinc,
        anexoNome: nomeAnexo,
      };
    });
    return [...arquivosRaw, ...extras];
  }, [arquivosRaw, lancamentos, anexosRetro]);


  // Movimentações da empresa selecionada — para mostrar o período ao lado da competência
  const { data: movsEmpresa = [] } = useQuery({
    queryKey: ["arquivos-movs-empresa", selectedEmpresaId],
    enabled: !!selectedEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("mes_referencia, periodo")
        .eq("empresa_id", selectedEmpresaId!);
      if (error) throw error;
      return (data ?? []) as { mes_referencia: string; periodo: string | null }[];
    },
  });

  const movsPorCompetencia = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mv of movsEmpresa) {
      if (!mv.periodo) continue;
      const arr = m.get(mv.mes_referencia) ?? [];
      if (!arr.includes(mv.periodo)) arr.push(mv.periodo);
      m.set(mv.mes_referencia, arr);
    }
    for (const [k, arr] of m) arr.sort();
    return m;
  }, [movsEmpresa]);



  const empresasMap = useMemo(() => {
    const m = new Map<string, Empresa>();
    for (const e of empresas) m.set(e.id, e);
    return m;
  }, [empresas]);

  // Contagem de arquivos por empresa (respeitando a pasta/categoria selecionada)
  const arquivosPorEmpresa = useMemo(() => {
    const m = new Map<string, ArquivoRow[]>();
    for (const a of arquivos) {
      if (categoriaFiltro && a.categoria !== categoriaFiltro) continue;
      const arr = m.get(a.empresa_id) ?? [];
      arr.push(a);
      m.set(a.empresa_id, arr);
    }
    return m;
  }, [arquivos, categoriaFiltro]);

  // Total de arquivos por categoria (para os chips de pasta)
  const totaisPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of arquivos) m.set(a.categoria, (m.get(a.categoria) ?? 0) + 1);
    return m;
  }, [arquivos]);


  // Lista de empresas (todas + com arquivos), filtrada pela busca
  const empresasList = useMemo(() => {
    const q = searchEmpresa.trim().toLowerCase();
    return empresas
      .map((e) => ({
        ...e,
        total: arquivosPorEmpresa.get(e.id)?.length ?? 0,
      }))
      .filter((e) => {
        if (categoriaFiltro && e.total === 0) return false;
        if (!q) return true;
        return [e.nome, e.codigo_contrato, e.cnpj]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        // Empresas com arquivos primeiro
        if ((b.total > 0 ? 1 : 0) !== (a.total > 0 ? 1 : 0)) {
          return (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0);
        }
        return a.nome.localeCompare(b.nome);
      });
  }, [empresas, arquivosPorEmpresa, searchEmpresa, categoriaFiltro]);

  // Auto-seleciona a primeira empresa com arquivos
  useEffect(() => {
    if (empresasList.length === 0) return;
    const aindaVisivel = selectedEmpresaId && empresasList.some((e) => e.id === selectedEmpresaId);
    if (!aindaVisivel) {
      const primeira = empresasList.find((e) => e.total > 0) ?? empresasList[0];
      setSelectedEmpresaId(primeira.id);
    }
  }, [empresasList, selectedEmpresaId]);

  // Arquivos da empresa selecionada, filtrados
  const arquivosEmpresa = useMemo(() => {
    if (!selectedEmpresaId) return [];
    const list = arquivosPorEmpresa.get(selectedEmpresaId) ?? [];
    const q = searchArquivo.trim().toLowerCase();
    return list
      .filter((a) => {
        if (!q) return true;
        return [a.nome_original, a.categoria, compLabel(a.competencia), a.uploaded_by_nome]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [arquivosPorEmpresa, selectedEmpresaId, searchArquivo]);

  // Agrupa por competência (mais recentes primeiro)
  const arquivosPorCompetencia = useMemo(() => {
    const map = new Map<string, ArquivoRow[]>();
    for (const a of arquivosEmpresa) {
      const arr = map.get(a.competencia) ?? [];
      arr.push(a);
      map.set(a.competencia, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [arquivosEmpresa]);

  // Auto-seleciona primeiro arquivo quando muda de empresa
  useEffect(() => {
    if (arquivosEmpresa.length === 0) {
      setSelectedArquivoId(null);
      return;
    }
    if (!selectedArquivoId || !arquivosEmpresa.find((a) => a.id === selectedArquivoId)) {
      setSelectedArquivoId(arquivosEmpresa[0].id);
    }
  }, [arquivosEmpresa, selectedArquivoId]);

  const selectedEmpresa = selectedEmpresaId ? empresasMap.get(selectedEmpresaId) : null;
  const selectedArquivo = selectedArquivoId
    ? arquivosEmpresa.find((a) => a.id === selectedArquivoId) ?? null
    : null;

  async function handleDownload(a: ArquivoRow) {
    try {
      const { data, error } = await supabase.storage.from(a.bucket || DEFAULT_BUCKET).download(a.storage_path);
      if (error || !data) throw error ?? new Error("Falha ao baixar");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome_original;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? "desconhecido"));
    }
  }

  async function handleChangeCategoria(a: ArquivoRow, novaCategoria: string) {
    if (a.categoria === novaCategoria) return;
    try {
      const { error } = await supabase
        .from("financeiro_arquivos")
        .update({ categoria: novaCategoria })
        .eq("id", a.id);
      if (error) throw error;
      toast.success(`Movido para "${novaCategoria}"`);
      queryClient.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
    } catch (e: any) {
      toast.error("Erro ao mover: " + (e?.message ?? "desconhecido"));
    }
  }

  async function handleDelete(a: ArquivoRow) {
    try {
      if (a.lanc) {
        const { error } = await supabase
          .from("cobrancas_retroativas")
          .delete()
          .eq("id", a.lanc.id);
        if (error) throw error;
        toast.success("Lançamento removido");
        queryClient.invalidateQueries({ queryKey: ["retroativos-lancamentos"] });
        queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
        if (selectedArquivoId === a.id) setSelectedArquivoId(null);
        return;
      }
      const { error } = await supabase
        .from("financeiro_arquivos")
        .update({ status: "removido" })
        .eq("id", a.id);
      if (error) throw error;
      if (a.origem !== "financeiro") {
        await supabase.storage.from(a.bucket || DEFAULT_BUCKET).remove([a.storage_path]).catch(() => null);
      }
      toast.success("Arquivo removido");
      queryClient.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
      if (selectedArquivoId === a.id) setSelectedArquivoId(null);
    } catch (e: any) {
      toast.error("Erro ao remover: " + (e?.message ?? "desconhecido"));
    } finally {
      setConfirmDelete(null);
    }
  }

  /** Confere o lançamento contra a planilha de faturamento (mesma regra da aba Financeiro). */
  async function handleConferir(a: ArquivoRow) {
    if (!a.lanc) return;
    setConferindo(a.id);
    try {
      const res = await conferirLancamentoRetroativo(a.lanc, user?.id ?? null);
      const label = res.ehDevolucao ? "Devolução" : "Cobrança";
      if (res.status === "confirmada") toast.success(`${label} confirmada na planilha.`);
      else if (res.status === "divergente")
        toast.warning(
          `${label} — divergência: planilha ${formatBRLCentavos(
            res.encontradoCentavos ?? 0,
          )} × registrado ${formatBRLCentavos(res.registradoCentavos)}.`,
        );
      else if (res.planilha && !res.baldeExiste)
        toast.info(
          res.origem === "reajuste"
            ? "A planilha não tem abas de cobrança retroativa (só há lançamentos de beneficiários)."
            : "A planilha não tem retroativo de beneficiários (só há abas de reajuste).",
        );
      else toast.info("Nenhuma planilha de faturamento encontrada para esta competência.");
      queryClient.invalidateQueries({ queryKey: ["retroativos-lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
    } catch (e: any) {
      toast.error("Erro ao conferir: " + (e?.message ?? "desconhecido"));
    } finally {
      setConferindo(null);
    }
  }

  /** Confirma/desfaz manualmente a cobrança — de um lançamento ou de um arquivo. */
  async function handleConfirmar(a: ArquivoRow) {
    setAcaoPendente(a.id);
    try {
      if (a.lanc) {
        const novo = await confirmarLancamentoManual(a.lanc, user?.id ?? null);
        toast.success(novo ? "Cobrança confirmada." : "Confirmação removida.");
        queryClient.invalidateQueries({ queryKey: ["retroativos-lancamentos"] });
        queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
      } else {
        const novo = await confirmarCobrancaArquivo(a, user?.id ?? null);
        toast.success(novo ? "Cobrança do arquivo confirmada." : "Confirmação removida.");
        queryClient.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
        queryClient.invalidateQueries({ queryKey: ["arquivos-reajuste-rcr"] });
      }
    } catch (e: any) {
      toast.error("Erro ao confirmar: " + (e?.message ?? "desconhecido"));
    } finally {
      setAcaoPendente(null);
    }
  }

  return (
    <>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header com pastas */}
        <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-4 md:p-5">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
                  <FolderArchive className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">Repositório Financeiro</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{empresas.length}</span> empresas
                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                    <span className="font-semibold text-foreground">{arquivos.length}</span> arquivos
                  </p>
                </div>
              </div>
              {canEditFinanceiro && (
                <Button onClick={() => openUpload(selectedEmpresaId ?? undefined)} className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Adicionar arquivo
                </Button>
              )}
            </div>

            {/* Pastas por categoria — visíveis no topo para acesso rápido */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground mr-1">Pastas:</span>
              <button
                type="button"
                onClick={() => setCategoriaFiltro(null)}
                className={cn(
                  "text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5",
                  !categoriaFiltro
                    ? "bg-primary/10 text-primary border-primary/30 font-medium"
                    : "border-border/60 text-muted-foreground hover:bg-muted/60",
                )}
              >
                <FolderArchive className="h-3.5 w-3.5" />
                Todas ({arquivos.length})
              </button>
              {CATEGORIAS.map((cat) => {
                const total = totaisPorCategoria.get(cat) ?? 0;
                const active = categoriaFiltro === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaFiltro(active ? null : cat)}
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5",
                      active
                        ? categoriaChipClass(cat) + " font-medium"
                        : "border-border/60 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <FolderArchive className="h-3.5 w-3.5" />
                    {cat} ({total})
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Grid 3 colunas: Empresas | Arquivos | Prévia */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(380px,440px)_minmax(0,1fr)] gap-4 h-[calc(100vh-180px)] min-h-[600px]">
          {/* ===== COLUNA 1: EMPRESAS ===== */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-4 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Empresas</h2>
                <Badge variant="secondary" className="text-xs">{empresasList.length}</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  value={searchEmpresa}
                  onChange={(e) => setSearchEmpresa(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {empresasList.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">Nenhuma empresa encontrada</div>
              ) : (
                empresasList.map((e) => {
                  const active = e.id === selectedEmpresaId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmpresaId(e.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group",
                        active
                          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                        active ? "bg-primary/15" : "bg-muted",
                      )}>
                        <Building2 className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm font-medium truncate", active && "text-primary")}>
                          {e.nome}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {e.total} arquivo{e.total === 1 ? "" : "s"}
                        </div>
                      </div>
                      {active && <ChevronRight className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ===== COLUNA 2: ARQUIVOS ===== */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-4 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold truncate">
                    {selectedEmpresa?.nome ?? "Selecione uma empresa"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {arquivosEmpresa.length} arquivo{arquivosEmpresa.length === 1 ? "" : "s"}
                  </p>
                </div>
                {canEditFinanceiro && selectedEmpresaId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => openUpload(selectedEmpresaId)}
                    title="Adicionar arquivo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar arquivos..."
                  value={searchArquivo}
                  onChange={(e) => setSearchArquivo(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
              ) : arquivosEmpresa.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12 px-4 space-y-3">
                  <FolderArchive className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p>Nenhum arquivo nesta empresa.</p>
                  {canEditFinanceiro && selectedEmpresaId && (
                    <Button size="sm" variant="outline" onClick={() => openUpload(selectedEmpresaId)}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {arquivosPorCompetencia.map(([comp, lista]) => (
                    <div key={comp}>
                      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-muted/80 backdrop-blur border-y border-border/60 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {compLabel(comp)}
                          </span>
                          {(movsPorCompetencia.get(comp) ?? []).map((tipo) => (
                            <Badge
                              key={tipo}
                              variant="outline"
                              className="h-5 text-[10px] px-1.5 font-medium border-primary/40 text-primary bg-primary/5"
                            >
                              {tipo}
                            </Badge>
                          ))}
                        </div>
                        <Badge variant="outline" className="h-5 text-[10px] px-1.5 shrink-0">
                          {lista.length}
                        </Badge>
                      </div>
                      <div className="divide-y">
                        {lista.map((a) => {
                          const active = a.id === selectedArquivoId;
                            return (
                              <div
                                key={a.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedArquivoId(a.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedArquivoId(a.id);
                                  }
                                }}
                                className={cn(
                                  "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer",
                                  active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent",
                                )}
                              >
                                <div className="shrink-0 mt-0.5 h-6 w-6 flex items-center justify-center">
                                  {a.lanc ? (
                                    <Receipt className="h-4 w-4 text-purple-500" />
                                  ) : (
                                    iconForExt(a.extensao)
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={cn("text-sm font-medium truncate leading-snug", active && "text-primary")} title={a.nome_original}>
                                    {a.nome_original}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className={cn("h-5 text-[10px] px-1.5 font-medium border", categoriaChipClass(a.categoria))}
                                    >
                                      {a.categoria}
                                    </Badge>
                                    {a.lanc ? (
                                      <>
                                        <Badge
                                          variant="outline"
                                          className="h-5 text-[10px] px-1.5 font-medium border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                        >
                                          Lançamento
                                        </Badge>
                                        {a.lanc.confirmado ? (
                                          <Badge className="h-5 gap-1 bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-600/30 text-[10px]">
                                            <ShieldCheck className="h-3 w-3" /> Confirmada
                                          </Badge>
                                        ) : a.lanc.conferencia_status === "divergente" ? (
                                          <Badge className="h-5 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30">
                                            Divergente
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
                                            Não conferida
                                          </Badge>
                                        )}
                                      </>
                                    ) : (
                                      canEditFinanceiro && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => e.stopPropagation()}
                                              className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
                                              title="Mover para outra pasta"
                                            >
                                              <MoreHorizontal className="h-3.5 w-3.5" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                                              <FolderInput className="h-3.5 w-3.5" />
                                              Mover para pasta
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {CATEGORIAS.map((cat) => (
                                              <DropdownMenuItem
                                                key={cat}
                                                disabled={a.categoria === cat}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleChangeCategoria(a, cat);
                                                }}
                                              >
                                                <Badge
                                                  variant="outline"
                                                  className={cn("h-5 text-[10px] px-1.5 mr-2 border", categoriaChipClass(cat))}
                                                >
                                                  {cat}
                                                </Badge>
                                                {a.categoria === cat && (
                                                  <span className="ml-auto text-[10px] text-muted-foreground">atual</span>
                                                )}
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )
                                    )}
                                    <span className="text-muted-foreground/40">·</span>
                                    <span>
                                      {a.lanc
                                        ? a.arquivoVinculado
                                          ? "PDF anexado"
                                          : "sem PDF"
                                        : formatBytes(a.tamanho_bytes)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground text-right shrink-0 mt-0.5">
                                  {formatDateBR(new Date(a.created_at))}
                                </div>
                              </div>
                            );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* ===== COLUNA 3: PRÉVIA + DETALHES + AÇÕES ===== */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            {selectedArquivo ? (
              <>
                {/* Cabeçalho do arquivo */}
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-3">
                  <div className="shrink-0">{iconForExt(selectedArquivo.extensao)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate" title={selectedArquivo.nome_original}>
                      {selectedArquivo.nome_original}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Badge variant={selectedArquivo.origem === "financeiro" ? "default" : "outline"} className="h-4 text-[9px] px-1.5">
                        {selectedArquivo.origem === "financeiro" ? "Financeiro" : "Arquivos"}
                      </Badge>
                      <span>·</span>
                      <span>{tipoArquivo(selectedArquivo.extensao)}</span>
                      <span>·</span>
                      <span>{formatBytes(selectedArquivo.tamanho_bytes)}</span>
                    </div>
                  </div>
                </div>

                {/* Prévia */}
                <div className="flex-1 min-h-0 overflow-hidden relative">
                  {selectedArquivo.storage_path ? (
                    <ArquivoPreviewInline
                      key={selectedArquivo.id}
                      bucket={selectedArquivo.bucket || DEFAULT_BUCKET}
                      storagePath={selectedArquivo.storage_path}
                      nomeArquivo={selectedArquivo.nome_original}
                      mimeType={selectedArquivo.mime_type}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                        <Receipt className="h-8 w-8 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Lançamento sem PDF anexado</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Este lançamento foi registrado manualmente na aba Financeiro.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detalhes do lançamento retroativo */}
                {selectedArquivo.lanc && (
                  <div className="border-t bg-purple-500/[0.05] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Lançamento de cobrança retroativa
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Valor</div>
                        <div className="font-semibold">
                          {formatBRLCentavos(selectedArquivo.lanc.valor_centavos)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Tipo</div>
                        <div className="font-medium">
                          {selectedArquivo.lanc.tipo === "devolucao" ? "Devolução" : "Cobrança retroativa"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Origem</div>
                        <div className="font-medium">
                          {origemDoLancamento(selectedArquivo.lanc) === "reajuste"
                            ? "Reajuste"
                            : "Beneficiários"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Situação</div>
                        <div className="font-medium">
                          {selectedArquivo.lanc.confirmado
                            ? "Confirmada"
                            : selectedArquivo.lanc.conferencia_status === "divergente"
                              ? "Divergente"
                              : "Não conferida"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="border-t px-4 py-3 flex items-center gap-2 flex-wrap">
                  {selectedArquivo.storage_path && (
                    <Button className="flex-1 gap-2" onClick={() => handleDownload(selectedArquivo)}>
                      <Download className="h-4 w-4" /> Baixar
                    </Button>
                  )}
                  {canEditFinanceiro && selectedArquivo.lanc && (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={conferindo === selectedArquivo.id}
                        onClick={() => handleConferir(selectedArquivo)}
                      >
                        {conferindo === selectedArquivo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Conferir
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={acaoPendente === selectedArquivo.id}
                        onClick={() => handleConfirmar(selectedArquivo)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {selectedArquivo.lanc.confirmado ? "Desfazer" : "Confirmar"}
                      </Button>
                    </>
                  )}
                  {canEditFinanceiro && !selectedArquivo.lanc && (
                    <>
                      <Button variant="outline" className="flex-1 gap-2" onClick={() => openUpload(selectedArquivo.empresa_id)}>
                        <Upload className="h-4 w-4" /> Substituir
                      </Button>
                      {(selectedArquivo.categoria === "Retroativo" ||
                        selectedArquivo.categoria === "Reajuste") && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          disabled={acaoPendente === selectedArquivo.id}
                          onClick={() => handleConfirmar(selectedArquivo)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {selectedArquivo.cobranca_confirmada ? "Desfazer" : "Confirmar"}
                        </Button>
                      )}
                    </>
                  )}
                  {canEditFinanceiro && (
                    <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={() => setConfirmDelete(selectedArquivo)}>
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <FileQuestion className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nenhum arquivo selecionado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione um arquivo à esquerda para ver a prévia.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadArquivoDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultEmpresaId={uploadDefaults.empresaId}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.nome_original} será removido permanentemente do repositório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
