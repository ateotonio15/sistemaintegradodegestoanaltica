import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FilterX,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { ArquivoPreviewInline } from "@/components/arquivos/ArquivoPreviewInline";
import { compLabel, formatBytes, tipoArquivo } from "@/lib/arquivos-utils";
import { cn } from "@/lib/utils";
import {
  agruparEnvios,
  agruparHistoricoEnvios,
  apenasAtuais,
  extensaoDe,
  FILTROS_VAZIOS,
  filtrarArquivos,
  formatarDataHoraEnvio,
  resumoEnviosEmpresa,
  versoesDoDocumento,
  type ArquivoEnvio,
  type FiltrosEnvios,
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
  const [filtros, setFiltros] = useState<FiltrosEnvios>(FILTROS_VAZIOS);
  const [abaArquivos, setAbaArquivos] = useState<"arquivos" | "historico">("arquivos");

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

  const totalEnvios = useMemo(() => new Set(arquivos.map((a) => a.envio_id)).size, [arquivos]);
  const totalSubstituidos = useMemo(() => arquivos.filter((a) => a.status !== "Atual").length, [arquivos]);

  // Opções dos filtros do topo, montadas a partir do que já foi enviado.
  const opcoesFiltros = useMemo(() => {
    const comps = new Set<string>();
    const periodos = new Set<string>();
    const categorias = new Set<string>();
    const responsaveis = new Set<string>();
    for (const a of arquivos) {
      if (a.competencia) comps.add(a.competencia);
      if (a.periodo) periodos.add(a.periodo);
      if (a.tipo_relatorio) categorias.add(a.tipo_relatorio);
      if (a.enviado_nome) responsaveis.add(a.enviado_nome);
    }
    const ord = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
    return {
      competencias: ord(comps).reverse(),
      periodos: ord(periodos),
      categorias: ord(categorias),
      responsaveis: ord(responsaveis),
      tipos: ["PDF", "Excel", "Imagem", "Outros"],
    };
  }, [arquivos]);

  const filtrosAtivos = useMemo(() => Object.values(filtros).some((v) => v !== null), [filtros]);

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
    const list = filtrarArquivos(arquivosPorEmpresa.get(selectedEmpresaId) ?? [], filtros);
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
  }, [arquivosPorEmpresa, selectedEmpresaId, searchArquivo, filtros]);

  const grupos = useMemo(() => agruparEnvios(arquivosEmpresa), [arquivosEmpresa]);

  // Todas as versões da empresa selecionada (inclui as substituídas, para o histórico).
  const arquivosTodosEmpresa = useMemo(
    () => (selectedEmpresaId ? arquivosTodosPorEmpresa.get(selectedEmpresaId) ?? [] : []),
    [arquivosTodosPorEmpresa, selectedEmpresaId],
  );

  // Histórico de envios da empresa: uma linha por e-mail, respeitando os filtros do topo.
  const historicoEnvios = useMemo(
    () => agruparHistoricoEnvios(filtrarArquivos(arquivosTodosEmpresa, filtros)),
    [arquivosTodosEmpresa, filtros],
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
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Repositório de Envios</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alimentado automaticamente pelos e-mails enviados na aba Movimentações.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {[
              { rotulo: "Empresas com arquivos", valor: arquivosPorEmpresa.size },
              { rotulo: "Arquivos atuais", valor: arquivosAtuais.length },
              { rotulo: "Arquivos substituídos", valor: totalSubstituidos },
              { rotulo: "Envios realizados", valor: totalEnvios },
            ].map((k) => (
              <div
                key={k.rotulo}
                className="rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-center shadow-sm min-w-[110px]"
              >
                <div className="text-lg font-bold leading-tight">{k.valor}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.rotulo}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Filtros do topo: valem para a lista de arquivos e para o histórico de envios. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm">
        <Select
          value={filtros.competencia ?? "todas"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, competencia: v === "todas" ? null : v }))}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as competências</SelectItem>
            {opcoesFiltros.competencias.map((c) => (
              <SelectItem key={c} value={c}>{compLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtros.periodo ?? "todos"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, periodo: v === "todos" ? null : v }))}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os períodos</SelectItem>
            {opcoesFiltros.periodos.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtros.categoria ?? "todas"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, categoria: v === "todas" ? null : v }))}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {opcoesFiltros.categorias.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtros.responsavel ?? "todos"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, responsavel: v === "todos" ? null : v }))}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {opcoesFiltros.responsaveis.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtros.tipoArquivo ?? "todos"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, tipoArquivo: v === "todos" ? null : v }))}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Tipo de arquivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {opcoesFiltros.tipos.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtrosAtivos && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setFiltros(FILTROS_VAZIOS)}
          >
            <FilterX className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

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
                <div className="px-4 py-3 grid grid-cols-1 2xl:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
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
                {/* Histórico de versões: as substituídas nunca são apagadas e ficam aqui. */}
                {versoes.length > 0 && (
                  <div className="border-t px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Histórico de versões</span>
                    </div>
                    <div className="space-y-1">
                      {versoes.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedArquivoId(v.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors",
                            v.id === selectedArquivo.id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60",
                          )}
                        >
                          <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-medium shrink-0">
                            v{v.versao}
                          </Badge>
                          <span className="text-muted-foreground shrink-0">{formatarDataHoraEnvio(v.enviado_em)}</span>
                          {v.enviado_nome && (
                            <span className="text-muted-foreground truncate">· {v.enviado_nome}</span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 text-[10px] px-1.5 font-medium ml-auto shrink-0",
                              v.status === "Atual"
                                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                : "text-muted-foreground",
                            )}
                          >
                            {v.status}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
