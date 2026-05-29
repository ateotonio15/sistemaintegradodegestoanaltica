import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Eye,
  // Upload icon removed: replaced by Plus on Adicionar arquivo button
  Trash2,
  Files,
  HardDrive,
  Clock,
  Building2,
  FileSignature,
  CalendarDays,
  Plus,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { UploadArquivoDialog } from "@/components/arquivos/UploadArquivoDialog";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  compLabel,
  formatBytes,
  tipoArquivo,
} from "@/lib/arquivos-utils";

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
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [competenciaFilter, setCompetenciaFilter] = useState("todas");
  
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [usuarioFilter, setUsuarioFilter] = useState("todos");
  const [contratoFilter, setContratoFilter] = useState("todos");
  const [confirmDelete, setConfirmDelete] = useState<ArquivoRow | null>(null);
  const [previewArquivo, setPreviewArquivo] = useState<ArquivoRow | null>(null);

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

  const competenciasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    arquivos.forEach((a) => s.add(a.competencia));
    return Array.from(s).sort().reverse();
  }, [arquivos]);

  const usuariosDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    arquivos.forEach((a) => {
      if (a.uploaded_by) m.set(a.uploaded_by, a.uploaded_by_nome ?? a.uploaded_by);
    });
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [arquivos]);

  const contratosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    arquivos.forEach((a) => {
      const cc = empresasMap.get(a.empresa_id)?.codigo_contrato;
      if (cc) s.add(cc);
    });
    return Array.from(s).sort();
  }, [arquivos, empresasMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return arquivos.filter((a) => {
      const emp = empresasMap.get(a.empresa_id);
      if (empresaFilter !== "todas" && a.empresa_id !== empresaFilter) return false;
      if (contratoFilter !== "todos" && (emp?.codigo_contrato ?? "") !== contratoFilter) return false;
      if (competenciaFilter !== "todas" && a.competencia !== competenciaFilter) return false;
      
      if (tipoFilter !== "todos" && tipoArquivo(a.extensao) !== tipoFilter) return false;
      if (usuarioFilter !== "todos" && a.uploaded_by !== usuarioFilter) return false;
      if (!q) return true;
      const hay = [
        a.nome_original,
        a.competencia,
        compLabel(a.competencia),
        a.categoria,
        emp?.nome,
        emp?.codigo_contrato,
        emp?.cnpj,
        a.uploaded_by_nome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    arquivos,
    search,
    empresaFilter,
    contratoFilter,
    competenciaFilter,
    
    tipoFilter,
    usuarioFilter,
    empresasMap,
  ]);

  // Agrupamento: Empresa -> Contrato -> Competência -> arquivos[]
  const grouped = useMemo(() => {
    type Comp = { competencia: string; arquivos: ArquivoRow[] };
    type Contr = {
      contrato: string;
      empresaIds: Set<string>;
      arquivos: ArquivoRow[];
      competencias: Map<string, Comp>;
      ultimoUpload: number;
    };
    type Emp = {
      empresaId: string;
      nome: string;
      contratos: Map<string, Contr>;
      total: number;
      ultimoUpload: number;
    };
    const empMap = new Map<string, Emp>();
    for (const a of filtered) {
      const e = empresasMap.get(a.empresa_id);
      const empKey = a.empresa_id;
      const empNome = e?.nome ?? "Empresa desconhecida";
      const contrato = e?.codigo_contrato ?? "Sem contrato";
      const ts = new Date(a.created_at).getTime();
      if (!empMap.has(empKey)) {
        empMap.set(empKey, {
          empresaId: empKey,
          nome: empNome,
          contratos: new Map(),
          total: 0,
          ultimoUpload: 0,
        });
      }
      const emp = empMap.get(empKey)!;
      emp.total += 1;
      emp.ultimoUpload = Math.max(emp.ultimoUpload, ts);
      if (!emp.contratos.has(contrato)) {
        emp.contratos.set(contrato, {
          contrato,
          empresaIds: new Set(),
          arquivos: [],
          competencias: new Map(),
          ultimoUpload: 0,
        });
      }
      const c = emp.contratos.get(contrato)!;
      c.empresaIds.add(empKey);
      c.arquivos.push(a);
      c.ultimoUpload = Math.max(c.ultimoUpload, ts);
      if (!c.competencias.has(a.competencia)) {
        c.competencias.set(a.competencia, { competencia: a.competencia, arquivos: [] });
      }
      c.competencias.get(a.competencia)!.arquivos.push(a);
    }

    // Garante que TODAS as empresas apareçam — inclusive as ainda não implantadas
    // e as que ainda não têm arquivos — para permitir anexar nota/Excel pendentes
    // diretamente pela aba Arquivos.
    const filtrosArquivoAtivos =
      competenciaFilter !== "todas" ||
      tipoFilter !== "todos" ||
      usuarioFilter !== "todos";
    if (!filtrosArquivoAtivos) {
      const q = search.trim().toLowerCase();
      for (const e of empresas) {
        if (empresaFilter !== "todas" && e.id !== empresaFilter) continue;
        if (contratoFilter !== "todos" && (e.codigo_contrato ?? "") !== contratoFilter) continue;
        if (q) {
          const hay = [e.nome, e.codigo_contrato, e.cnpj]
            .filter(Boolean).join(" ").toLowerCase();
          if (!hay.includes(q)) continue;
        }
        if (empMap.has(e.id)) continue;
        const contrato = e.codigo_contrato ?? "Sem contrato";
        const contratos = new Map<string, Contr>();
        contratos.set(contrato, {
          contrato,
          empresaIds: new Set([e.id]),
          arquivos: [],
          competencias: new Map(),
          ultimoUpload: 0,
        });
        empMap.set(e.id, {
          empresaId: e.id,
          nome: e.nome,
          contratos,
          total: 0,
          ultimoUpload: 0,
        });
      }
    }

    return Array.from(empMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtered, empresasMap, empresas, empresaFilter, contratoFilter, competenciaFilter, tipoFilter, usuarioFilter, search]);


  const kpis = useMemo(() => {
    const total = arquivos.length;
    const pdfs = arquivos.filter((a) => tipoArquivo(a.extensao) === "PDF").length;
    const excels = arquivos.filter((a) => tipoArquivo(a.extensao) === "Excel").length;
    const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentes = arquivos.filter((a) => new Date(a.created_at).getTime() >= seteDias).length;
    const espaco = arquivos.reduce((acc, a) => acc + (a.tamanho_bytes ?? 0), 0);
    return { total, pdfs, excels, recentes, espaco };
  }, [arquivos]);

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

  function handlePreview(a: ArquivoRow) {
    setPreviewArquivo(a);
  }

  async function handleDelete(a: ArquivoRow) {
    try {
      const { error } = await supabase
        .from("financeiro_arquivos")
        .update({ status: "removido" })
        .eq("id", a.id);
      if (error) throw error;
      // Só remove o objeto do storage se for um upload nativo da aba Arquivos.
      // Arquivos espelhados do Financeiro pertencem àquela aba e não devem ser apagados aqui.
      if (a.origem !== "financeiro") {
        await supabase.storage.from(a.bucket || DEFAULT_BUCKET).remove([a.storage_path]).catch(() => null);
      }
      toast.success("Arquivo removido");
      queryClient.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
    } catch (e: any) {
      toast.error("Erro ao remover: " + (e?.message ?? "desconhecido"));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderArchive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Repositório Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Gestão documental dos arquivos enviados manualmente pelo Financeiro
              </p>
            </div>
          </div>
          {canEditFinanceiro && (
            <Button onClick={() => openUpload()} className="gap-2" size="lg">
              <Plus className="h-4 w-4" />
              Adicionar arquivo
            </Button>
          )}
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard icon={<Files className="h-4 w-4" />} label="Total" value={kpis.total.toString()} />
          <KpiCard
            icon={<FileText className="h-4 w-4 text-rose-500" />}
            label="PDFs"
            value={kpis.pdfs.toString()}
          />
          <KpiCard
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
            label="Excels"
            value={kpis.excels.toString()}
          />
          <KpiCard
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            label="Últimos 7 dias"
            value={kpis.recentes.toString()}
          />
          <KpiCard
            icon={<HardDrive className="h-4 w-4 text-amber-500" />}
            label="Espaço"
            value={formatBytes(kpis.espaco)}
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar arquivo, empresa, contrato, competência..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={contratoFilter} onValueChange={setContratoFilter}>
                <SelectTrigger><SelectValue placeholder="Contrato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos contratos</SelectItem>
                  {contratosDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={competenciaFilter} onValueChange={setCompetenciaFilter}>
                <SelectTrigger><SelectValue placeholder="Competência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas competências</SelectItem>
                  {competenciasDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>{compLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="Excel">Excel</SelectItem>
                  <SelectItem value="Imagem">Imagem</SelectItem>
                  <SelectItem value="Doc">Doc</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos usuários</SelectItem>
                  {usuariosDisponiveis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista agrupada: Empresa → Contrato → Competência */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">
              Repositório por contrato{" "}
              <span className="text-muted-foreground font-normal">
                ({grouped.length} empresa{grouped.length === 1 ? "" : "s"} • {filtered.length} arquivo{filtered.length === 1 ? "" : "s"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-12">Carregando...</p>
            ) : grouped.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <FolderArchive className="h-10 w-10 mx-auto opacity-50" />
                <p>Nenhum arquivo encontrado.</p>
                {canEditFinanceiro && (
                  <Button variant="outline" size="sm" onClick={() => openUpload()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar primeiro arquivo
                  </Button>
                )}
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {grouped.map((emp) => (
                  <AccordionItem
                    key={emp.empresaId}
                    value={emp.empresaId}
                    className="border rounded-lg px-3 bg-card"
                  >
                    <div className="flex items-center gap-2 py-1">
                      <AccordionTrigger className="hover:no-underline py-3 flex-1">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-left min-w-0">
                            <div className="font-semibold truncate">{emp.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.contratos.size} contrato{emp.contratos.size === 1 ? "" : "s"} • {emp.total} arquivo{emp.total === 1 ? "" : "s"}
                              {emp.ultimoUpload > 0 && (
                                <> • Último: {formatDateTime(new Date(emp.ultimoUpload).toISOString())}</>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      {canEditFinanceiro && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUpload(emp.empresaId);
                          }}
                          title="Adicionar arquivo neste contrato"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      )}
                    </div>
                    <AccordionContent className="pb-3">
                      <Accordion type="multiple" className="space-y-2 pl-2">
                        {Array.from(emp.contratos.values())
                          .sort((a, b) => a.contrato.localeCompare(b.contrato))
                          .map((c) => {
                            const compsOrdenadas = Array.from(c.competencias.values()).sort(
                              (a, b) => b.competencia.localeCompare(a.competencia),
                            );
                            return (
                              <AccordionItem
                                key={c.contrato}
                                value={`${emp.empresaId}-${c.contrato}`}
                                className="border rounded-md px-3 bg-muted/30"
                              >
                                <AccordionTrigger className="hover:no-underline py-2">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <FileSignature className="h-4 w-4 text-primary shrink-0" />
                                    <div className="text-left min-w-0">
                                      <div className="font-medium truncate">Contrato {c.contrato}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {compsOrdenadas.length} competência{compsOrdenadas.length === 1 ? "" : "s"} • {c.arquivos.length} arquivo{c.arquivos.length === 1 ? "" : "s"}
                                        {c.ultimoUpload > 0 && (
                                          <> • Último: {formatDateTime(new Date(c.ultimoUpload).toISOString())}</>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3">
                                  <div className="space-y-3 pl-2">
                                    {compsOrdenadas.map((comp) => (
                                      <div key={comp.competencia} className="border rounded-md bg-background">
                                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 rounded-t-md">
                                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm font-medium">{compLabel(comp.competencia)}</span>
                                          <Badge variant="outline" className="ml-auto">
                                            {comp.arquivos.length} arquivo{comp.arquivos.length === 1 ? "" : "s"}
                                          </Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Nome</TableHead>
                                                
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Origem</TableHead>
                                                <TableHead>Usuário</TableHead>
                                                <TableHead>Upload</TableHead>
                                                <TableHead className="text-right">Tamanho</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {comp.arquivos
                                                .slice()
                                                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                                                .map((a) => (
                                                  <TableRow key={a.id}>
                                                    <TableCell>{iconForExt(a.extensao)}</TableCell>
                                                    <TableCell className="max-w-[280px]">
                                                      <div className="truncate font-medium" title={a.nome_original}>
                                                        {a.nome_original}
                                                      </div>
                                                      {a.observacao && (
                                                        <div className="text-xs text-muted-foreground truncate" title={a.observacao}>
                                                          {a.observacao}
                                                        </div>
                                                      )}
                                                    </TableCell>
                                                    <TableCell>{tipoArquivo(a.extensao)}</TableCell>
                                                    <TableCell>
                                                      <Badge variant={a.origem === "financeiro" ? "default" : "outline"}>
                                                        {a.origem === "financeiro" ? "Financeiro" : "Arquivos"}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[140px] truncate" title={a.uploaded_by_nome ?? ""}>
                                                      {a.uploaded_by_nome ?? "—"}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-xs">
                                                      {formatDateTime(a.created_at)}
                                                    </TableCell>
                                                    <TableCell className="text-right whitespace-nowrap">
                                                      {formatBytes(a.tamanho_bytes)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(a)} title="Visualizar">
                                                          <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(a)} title="Baixar">
                                                          <Download className="h-4 w-4" />
                                                        </Button>
                                                        {canEditFinanceiro && (
                                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(a)} title="Excluir">
                                                            <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                        )}
                                                      </div>
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
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

      {previewArquivo && (
        <PreviewArquivoDialog
          open={!!previewArquivo}
          onOpenChange={(v) => !v && setPreviewArquivo(null)}
          bucket={previewArquivo.bucket || DEFAULT_BUCKET}
          storagePath={previewArquivo.storage_path}
          nomeArquivo={previewArquivo.nome_original}
          mimeType={previewArquivo.mime_type}
        />
      )}
    </>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
