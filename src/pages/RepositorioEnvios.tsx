import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Search,
  Building2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  FolderArchive,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { ArquivoPreviewInline } from "@/components/arquivos/ArquivoPreviewInline";
import { compLabel, formatBytes, tipoArquivo } from "@/lib/arquivos-utils";
import { cn } from "@/lib/utils";
import {
  agruparEnvios,
  apenasAtuais,
  extensaoDe,
  formatarDataHoraEnvio,
  resumoEnviosEmpresa,
  versoesDoDocumento,
  type ArquivoEnvio,
} from "@/lib/repositorio-envios";

interface Empresa {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
}

function iconForExt(ext: string | null) {
  switch (tipoArquivo(ext)) {
    case "PDF":
      return <FileText className="h-4 w-4 text-rose-500" />;
    case "Excel":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    case "Imagem":
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    default:
      return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

/** Chip da categoria (tipo de relatório) — cores próprias, fora do Repositório Financeiro. */
function tipoChipClass(tipo: string): string {
  if (tipo.toLowerCase().includes("vidas")) return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  if (tipo.toLowerCase().includes("mensalidades")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function RepositorioEnvios() {
  const [searchEmpresa, setSearchEmpresa] = useState("");
  const [searchArquivo, setSearchArquivo] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [selectedArquivoId, setSelectedArquivoId] = useState<string | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["envios-empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });

  // Arquivos já enviados às empresas: registrados automaticamente após o e-mail sair.
  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: ["envios-empresa-arquivos"],
    queryFn: async () => {
      const pageSize = 500;
      const all: ArquivoEnvio[] = [];
      let from = 0;
      // Pagina para não perder envios de competências anteriores.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("envios_empresa_arquivos")
          .select("*")
          .order("enviado_em", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as ArquivoEnvio[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const empresasMap = useMemo(() => {
    const m = new Map<string, Empresa>();
    for (const e of empresas) m.set(e.id, e);
    return m;
  }, [empresas]);

  // Listagem principal: só a versão atual de cada documento. As substituídas
  // continuam guardadas e aparecem no "Histórico de versões" da prévia.
  const arquivosAtuais = useMemo(() => apenasAtuais(arquivos), [arquivos]);

  const arquivosPorEmpresa = useMemo(() => {
    const m = new Map<string, ArquivoEnvio[]>();
    for (const a of arquivosAtuais) {
      const arr = m.get(a.empresa_id) ?? [];
      arr.push(a);
      m.set(a.empresa_id, arr);
    }
    return m;
  }, [arquivosAtuais]);

  // Todas as versões (atuais e substituídas), para o histórico de versões.
  const arquivosTodosPorEmpresa = useMemo(() => {
    const m = new Map<string, ArquivoEnvio[]>();
    for (const a of arquivos) {
      const arr = m.get(a.empresa_id) ?? [];
      arr.push(a);
      m.set(a.empresa_id, arr);
    }
    return m;
  }, [arquivos]);

  const totalEnvios = useMemo(() => new Set(arquivosAtuais.map((a) => a.envio_id)).size, [arquivosAtuais]);

  // Lista de empresas: busca por nome, contrato ou CNPJ; quem tem arquivos vem primeiro.
  const empresasList = useMemo(() => {
    const q = searchEmpresa.trim().toLowerCase();
    return empresas
      .map((e) => ({ ...e, total: arquivosPorEmpresa.get(e.id)?.length ?? 0 }))
      .filter((e) => {
        if (!q) return true;
        return [e.nome, e.codigo_contrato, e.cnpj]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if ((b.total > 0 ? 1 : 0) !== (a.total > 0 ? 1 : 0)) return (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0);
        return a.nome.localeCompare(b.nome);
      });
  }, [empresas, arquivosPorEmpresa, searchEmpresa]);

  const arquivosEmpresa = useMemo(() => {
    if (!selectedEmpresaId) return [];
    const list = arquivosPorEmpresa.get(selectedEmpresaId) ?? [];
    const q = searchArquivo.trim().toLowerCase();
    return list
      .filter((a) => {
        if (!q) return true;
        return [a.nome_arquivo, a.tipo_relatorio, a.enviado_nome, a.contrato]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em));
  }, [arquivosPorEmpresa, selectedEmpresaId, searchArquivo]);

  const grupos = useMemo(() => agruparEnvios(arquivosEmpresa), [arquivosEmpresa]);

  // Todas as versões da empresa selecionada (inclui as substituídas, para o histórico).
  const arquivosTodosEmpresa = useMemo(
    () => (selectedEmpresaId ? arquivosTodosPorEmpresa.get(selectedEmpresaId) ?? [] : []),
    [arquivosTodosPorEmpresa, selectedEmpresaId],
  );

  // Auto-seleciona a versão atual mais recente quando muda de empresa.
  useEffect(() => {
    if (arquivosTodosEmpresa.length === 0) {
      setSelectedArquivoId(null);
      return;
    }
    if (!selectedArquivoId || !arquivosTodosEmpresa.find((a) => a.id === selectedArquivoId)) {
      setSelectedArquivoId(arquivosEmpresa[0]?.id ?? arquivosTodosEmpresa[0].id);
    }
  }, [arquivosTodosEmpresa, arquivosEmpresa, selectedArquivoId]);

  const selectedEmpresa = selectedEmpresaId ? empresasMap.get(selectedEmpresaId) ?? null : null;
  const selectedArquivo = selectedArquivoId
    ? arquivosTodosEmpresa.find((a) => a.id === selectedArquivoId) ?? null
    : null;
  const versoes = useMemo(
    () => (selectedArquivo ? versoesDoDocumento(arquivosTodosEmpresa, selectedArquivo) : []),
    [arquivosTodosEmpresa, selectedArquivo],
  );

  async function handleDownload(a: ArquivoEnvio) {
    try {
      const { data, error } = await supabase.storage.from(a.bucket).download(a.storage_path);
      if (error || !data) throw error ?? new Error("Falha ao baixar");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome_arquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? "desconhecido"));
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-4 md:p-5">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Repositório de Envios</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">{arquivosPorEmpresa.size}</span> empresas com arquivos
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="font-semibold text-foreground">{arquivosAtuais.length}</span> arquivos
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="font-semibold text-foreground">{totalEnvios}</span> envios
            </p>
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
                placeholder="Buscar por nome, contrato ou CNPJ..."
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
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/60",
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-primary/15" : "bg-muted",
                    )}>
                      <Building2 className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-medium truncate", active && "text-primary")}>{e.nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {resumoEnviosEmpresa(
                          e.total,
                          new Set((arquivosPorEmpresa.get(e.id) ?? []).map((a) => a.envio_id)).size,
                        )}
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
            <div className="flex items-center gap-2 min-w-0 mb-3">
              <h2 className="text-base font-semibold truncate">
                {selectedEmpresa?.nome ?? "Selecione uma empresa"}
              </h2>
              {selectedEmpresa?.codigo_contrato && (
                <Badge variant="outline" className="shrink-0 text-xs font-medium">
                  Contrato {selectedEmpresa.codigo_contrato}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {arquivosEmpresa.length} arquivo{arquivosEmpresa.length === 1 ? "" : "s"} enviado
              {arquivosEmpresa.length === 1 ? "" : "s"}
            </p>
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
            ) : !selectedEmpresaId ? (
              <div className="text-center text-sm text-muted-foreground py-12 px-4 space-y-3">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p>Escolha uma empresa para ver os arquivos enviados.</p>
              </div>
            ) : arquivosEmpresa.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 px-4 space-y-3">
                <FolderArchive className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p>Nenhum arquivo enviado para esta empresa.</p>
              </div>
            ) : (
              <div>
                {grupos.map((g) => (
                  <div key={g.competencia}>
                    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-muted/80 backdrop-blur border-y border-border/60 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {compLabel(g.competencia)}
                        </span>
                      </div>
                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 shrink-0">
                        {g.periodos.reduce((n, p) => n + p.arquivos.length, 0)}
                      </Badge>
                    </div>
                    {g.periodos.map((p) => (
                      <div key={p.periodo ?? "sem-periodo"}>
                        {p.periodo && (
                          <div className="px-4 pt-2 pb-1 flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Período</span>
                            <Badge
                              variant="outline"
                              className="h-5 text-[10px] px-1.5 font-medium border-primary/40 text-primary bg-primary/5"
                            >
                              {p.periodo}
                            </Badge>
                          </div>
                        )}
                        <div className="divide-y">
                          {p.arquivos.map((a) => {
                            const active = a.id === selectedArquivoId;
                            const ext = extensaoDe(a.nome_arquivo);
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
                                  active
                                    ? "bg-primary/5 border-l-2 border-l-primary"
                                    : "hover:bg-muted/40 border-l-2 border-l-transparent",
                                )}
                              >
                                <div className="shrink-0 mt-0.5 h-6 w-6 flex items-center justify-center">
                                  {iconForExt(ext)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={cn("text-sm font-medium truncate leading-snug", active && "text-primary")}
                                    title={a.nome_arquivo}
                                  >
                                    {a.tipo_relatorio}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className={cn("h-5 text-[10px] px-1.5 font-medium border", tipoChipClass(a.tipo_relatorio))}
                                    >
                                      {tipoArquivo(ext)}
                                    </Badge>
                                    <span>Enviado em {formatarDataHoraEnvio(a.enviado_em)}</span>
                                    {a.enviado_nome && <span>· {a.enviado_nome}</span>}
                                    {a.versao > 1 && (
                                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-medium">
                                        v{a.versao}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== COLUNA 3: PRÉVIA ===== */}
        <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-4 border-b bg-muted/30 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold truncate">Prévia</h2>
            {selectedArquivo && (
              <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => handleDownload(selectedArquivo)}>
                <Download className="h-4 w-4" />
                Baixar
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedArquivo ? (
              <>
                <div className="flex-1 min-h-0">
                  <ArquivoPreviewInline
                    key={selectedArquivo.id}
                    bucket={selectedArquivo.bucket}
                    storagePath={selectedArquivo.storage_path}
                    nomeArquivo={selectedArquivo.nome_arquivo}
                    mimeType={selectedArquivo.mime_type}
                  />
                </div>
                <div className="border-t overflow-y-auto max-h-[46%]">
                <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="col-span-2 min-w-0">
                    <span className="text-muted-foreground">Nome do arquivo: </span>
                    <span className="font-medium break-all">{selectedArquivo.nome_arquivo}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Empresa: </span>
                    <span className="font-medium truncate">{selectedEmpresa?.nome ?? "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Contrato: </span>
                    <span className="font-medium">{selectedArquivo.contrato || "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Competência: </span>
                    <span className="font-medium">{compLabel(selectedArquivo.competencia)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Período: </span>
                    <span className="font-medium">{selectedArquivo.periodo || "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Categoria: </span>
                    <span className="font-medium">{selectedArquivo.tipo_relatorio}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Enviado por: </span>
                    <span className="font-medium">{selectedArquivo.enviado_nome || "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Data e hora do envio: </span>
                    <span className="font-medium">{formatarDataHoraEnvio(selectedArquivo.enviado_em)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Tamanho: </span>
                    <span className="font-medium">{formatBytes(selectedArquivo.tamanho_bytes)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Origem: </span>
                    <span className="font-medium">{selectedArquivo.origem || "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Versão: </span>
                    <span className="font-medium">{selectedArquivo.versao}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">{selectedArquivo.status || "—"}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Send className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nenhum arquivo selecionado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolha uma empresa e um arquivo para ver a prévia sem baixar.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
