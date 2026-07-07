import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { UploadArquivoDialog } from "@/components/arquivos/UploadArquivoDialog";
import { ArquivoPreviewInline } from "@/components/arquivos/ArquivoPreviewInline";
import { useAuth } from "@/hooks/useAuth";
import { compLabel, formatBytes, tipoArquivo } from "@/lib/arquivos-utils";
import { cn } from "@/lib/utils";

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
  const { canEditFinanceiro } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaults, setUploadDefaults] = useState<{ empresaId?: string }>({});
  const [searchEmpresa, setSearchEmpresa] = useState("");
  const [searchArquivo, setSearchArquivo] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [selectedArquivoId, setSelectedArquivoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ArquivoRow | null>(null);

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

  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: ["financeiro-arquivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_arquivos")
        .select("*")
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ArquivoRow[];
    },
  });

  const empresasMap = useMemo(() => {
    const m = new Map<string, Empresa>();
    for (const e of empresas) m.set(e.id, e);
    return m;
  }, [empresas]);

  // Contagem de arquivos por empresa
  const arquivosPorEmpresa = useMemo(() => {
    const m = new Map<string, ArquivoRow[]>();
    for (const a of arquivos) {
      const arr = m.get(a.empresa_id) ?? [];
      arr.push(a);
      m.set(a.empresa_id, arr);
    }
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
  }, [empresas, arquivosPorEmpresa, searchEmpresa]);

  // Auto-seleciona a primeira empresa com arquivos
  useEffect(() => {
    if (!selectedEmpresaId && empresasList.length > 0) {
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

  async function handleDelete(a: ArquivoRow) {
    try {
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

  return (
    <>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header compacto */}
        <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-4 md:p-5">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
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
        </header>

        {/* Grid 3 colunas: Empresas | Arquivos | Prévia */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(340px,400px)_minmax(0,1fr)] gap-4 h-[calc(100vh-180px)] min-h-[600px]">
          {/* ===== COLUNA 1: EMPRESAS ===== */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Empresas</h2>
                <Badge variant="secondary" className="text-[10px]">{empresasList.length}</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  value={searchEmpresa}
                  onChange={(e) => setSearchEmpresa(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {empresasList.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">Nenhuma empresa encontrada</div>
              ) : (
                empresasList.map((e) => {
                  const active = e.id === selectedEmpresaId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmpresaId(e.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group",
                        active
                          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        active ? "bg-primary/15" : "bg-muted",
                      )}>
                        <Building2 className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-xs font-medium truncate", active && "text-primary")}>
                          {e.nome}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {e.total} arquivo{e.total === 1 ? "" : "s"}
                        </div>
                      </div>
                      {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ===== COLUNA 2: ARQUIVOS ===== */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold truncate">
                    {selectedEmpresa?.nome ?? "Selecione uma empresa"}
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    {arquivosEmpresa.length} arquivo{arquivosEmpresa.length === 1 ? "" : "s"}
                  </p>
                </div>
                {canEditFinanceiro && selectedEmpresaId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => openUpload(selectedEmpresaId)}
                    title="Adicionar arquivo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar arquivos..."
                  value={searchArquivo}
                  onChange={(e) => setSearchArquivo(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center text-xs text-muted-foreground py-8">Carregando...</div>
              ) : arquivosEmpresa.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12 px-4 space-y-3">
                  <FolderArchive className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p>Nenhum arquivo nesta empresa.</p>
                  {canEditFinanceiro && selectedEmpresaId && (
                    <Button size="sm" variant="outline" onClick={() => openUpload(selectedEmpresaId)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {arquivosEmpresa.map((a) => {
                    const active = a.id === selectedArquivoId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedArquivoId(a.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                          active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent",
                        )}
                      >
                        <div className="shrink-0 mt-0.5">{iconForExt(a.extensao)}</div>
                        <div className="min-w-0 flex-1">
                          <div className={cn("text-xs font-medium truncate", active && "text-primary")} title={a.nome_original}>
                            {a.nome_original}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <span>{a.categoria}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{compLabel(a.competencia)}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right shrink-0 space-y-0.5">
                          <div>{formatDateBR(new Date(a.created_at))}</div>
                          <div>{formatBytes(a.tamanho_bytes)}</div>
                        </div>
                      </button>
                    );
                  })}
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
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ArquivoPreviewInline
                    key={selectedArquivo.id}
                    bucket={selectedArquivo.bucket || DEFAULT_BUCKET}
                    storagePath={selectedArquivo.storage_path}
                    nomeArquivo={selectedArquivo.nome_original}
                    mimeType={selectedArquivo.mime_type}
                  />
                </div>

                {/* Detalhes do documento */}
                <div className="border-t bg-muted/20 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Detalhes do documento
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Enviado por</div>
                      <div className="font-medium truncate">{selectedArquivo.uploaded_by_nome ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Data do envio</div>
                      <div className="font-medium">{formatDateTime(selectedArquivo.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Competência</div>
                      <div className="font-medium">{compLabel(selectedArquivo.competencia)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Categoria</div>
                      <div className="font-medium">{selectedArquivo.categoria}</div>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="border-t px-4 py-3 flex items-center gap-2">
                  <Button className="flex-1 gap-2" onClick={() => handleDownload(selectedArquivo)}>
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  {canEditFinanceiro && (
                    <>
                      <Button variant="outline" className="flex-1 gap-2" onClick={() => openUpload(selectedArquivo.empresa_id)}>
                        <Upload className="h-4 w-4" /> Substituir
                      </Button>
                      <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setConfirmDelete(selectedArquivo)}>
                        <Trash2 className="h-4 w-4" /> Excluir
                      </Button>
                    </>
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
