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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Trash2,
  Files,
  HardDrive,
  Clock,
  Building2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatBytes, tipoArquivo } from "@/lib/arquivos-utils";

const BUCKET = "anexos-implantacao";

interface ArquivoRow {
  id: string;
  implantacao_id: string;
  empresa_id: string | null;
  empresa_nome: string;
  codigo_contrato: string | null;
  nome_arquivo: string;
  extensao: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_nome: string | null;
  uploader_role: "cadastro" | "financeiro" | "outro";
  storage_path: string;
  created_at: string;
}

function extOf(nome: string): string | null {
  const m = nome.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : null;
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
  const { user, isAdmin, isComum, isFinanceiro } = useAuth();
  const currentUid = user?.id ?? null;
  const canDeleteAll = isAdmin || isComum;
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todas");
  const [confirmDelete, setConfirmDelete] = useState<ArquivoRow | null>(null);
  const [previewArquivo, setPreviewArquivo] = useState<ArquivoRow | null>(null);

  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: ["arquivos-implantacao", currentUid, isFinanceiro],
    enabled: !!currentUid,
    queryFn: async () => {
      const { data: anexos, error } = await supabase
        .from("implantacao_anexos" as any)
        .select(
          "id, implantacao_id, empresa_id, nome_arquivo, mime_type, tamanho_bytes, storage_path, uploaded_by, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (anexos as any[]) || [];
      if (list.length === 0) return [] as ArquivoRow[];

      const implIds = Array.from(new Set(list.map((a) => a.implantacao_id).filter(Boolean)));
      const uploaderIds = Array.from(
        new Set(list.map((a) => a.uploaded_by).filter(Boolean)),
      ) as string[];

      const [implRes, profRes, rolesRes] = await Promise.all([
        implIds.length
          ? supabase
              .from("implantacoes_contratos")
              .select("id, empresa_id, nome_empresa, codigo_contrato")
              .in("id", implIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        uploaderIds.length
          ? supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", uploaderIds)
          : Promise.resolve({ data: [], error: null } as any),
        uploaderIds.length
          ? supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", uploaderIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const implMap = new Map<string, any>();
      ((implRes.data as any[]) || []).forEach((i) => implMap.set(i.id, i));

      // Carrega status das empresas referenciadas para filtrar somente ATIVAS
      const empresaIds = Array.from(
        new Set(
          ((implRes.data as any[]) || [])
            .map((i) => i.empresa_id)
            .concat(list.map((a) => a.empresa_id))
            .filter(Boolean),
        ),
      ) as string[];
      const activeEmpresaIds = new Set<string>();
      if (empresaIds.length) {
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, status_empresa, contrato_suspenso")
          .in("id", empresaIds);
        ((emps as any[]) || []).forEach((e) => {
          if (e.status_empresa === "Ativa" && !e.contrato_suspenso) {
            activeEmpresaIds.add(e.id);
          }
        });
      }

      const nameMap = new Map<string, string>();
      ((profRes.data as any[]) || []).forEach((p) =>
        nameMap.set(p.user_id, p.display_name),
      );
      const roleMap = new Map<string, string>();
      ((rolesRes.data as any[]) || []).forEach((r) => roleMap.set(r.user_id, r.role));

      const rows: ArquivoRow[] = list.map((a) => {
        const impl = implMap.get(a.implantacao_id);
        const role = a.uploaded_by ? roleMap.get(a.uploaded_by) : null;
        const uploaderRole: ArquivoRow["uploader_role"] =
          role === "financeiro" ? "financeiro" : role === "comum" || role === "admin" ? "cadastro" : "outro";
        return {
          id: a.id,
          implantacao_id: a.implantacao_id,
          empresa_id: impl?.empresa_id ?? a.empresa_id ?? null,
          empresa_nome: impl?.nome_empresa ?? "Empresa não identificada",
          codigo_contrato: impl?.codigo_contrato ?? null,
          nome_arquivo: a.nome_arquivo,
          extensao: extOf(a.nome_arquivo),
          mime_type: a.mime_type,
          tamanho_bytes: a.tamanho_bytes,
          uploaded_by: a.uploaded_by,
          uploaded_by_nome: a.uploaded_by ? nameMap.get(a.uploaded_by) ?? null : null,
          uploader_role: uploaderRole,
          storage_path: a.storage_path,
          created_at: a.created_at,
        };
      });

      // Financeiro: somente os anexos que ele mesmo enviou
      if (isFinanceiro && currentUid) {
        return rows.filter((r) => r.uploaded_by === currentUid);
      }
      return rows;
    },
  });

  const empresasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    arquivos.forEach((a) => {
      if (a.empresa_id) m.set(a.empresa_id, a.empresa_nome);
    });
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [arquivos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return arquivos.filter((a) => {
      if (empresaFilter !== "todas" && a.empresa_id !== empresaFilter) return false;
      if (tipoFilter !== "todos" && tipoArquivo(a.extensao) !== tipoFilter) return false;
      if (origemFilter !== "todas" && a.uploader_role !== origemFilter) return false;
      if (!q) return true;
      const hay = [a.nome_arquivo, a.empresa_nome, a.codigo_contrato, a.uploaded_by_nome]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [arquivos, search, empresaFilter, tipoFilter, origemFilter]);

  const grouped = useMemo(() => {
    type Emp = {
      empresaId: string;
      nome: string;
      contrato: string | null;
      arquivos: ArquivoRow[];
      ultimoUpload: number;
    };
    const m = new Map<string, Emp>();
    for (const a of filtered) {
      const key = a.empresa_id ?? a.empresa_nome;
      if (!m.has(key)) {
        m.set(key, {
          empresaId: key,
          nome: a.empresa_nome,
          contrato: a.codigo_contrato,
          arquivos: [],
          ultimoUpload: 0,
        });
      }
      const e = m.get(key)!;
      e.arquivos.push(a);
      const ts = new Date(a.created_at).getTime();
      e.ultimoUpload = Math.max(e.ultimoUpload, ts);
    }
    return Array.from(m.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtered]);

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
      const { data, error } = await supabase.storage.from(BUCKET).download(a.storage_path);
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

  async function handleDelete(a: ArquivoRow) {
    const mine = !!currentUid && a.uploaded_by === currentUid;
    if (!canDeleteAll && !mine) {
      toast.error("Você só pode excluir anexos enviados por você.");
      setConfirmDelete(null);
      return;
    }
    try {
      await supabase.storage.from(BUCKET).remove([a.storage_path]).catch(() => null);
      const { error } = await supabase
        .from("implantacao_anexos" as any)
        .delete()
        .eq("id", a.id);
      if (error) throw error;
      toast.success("Arquivo removido");
      queryClient.invalidateQueries({ queryKey: ["arquivos-implantacao"] });
      queryClient.invalidateQueries({ queryKey: ["contratos-a-vigenciar-anexos"] });
    } catch (e: any) {
      toast.error("Erro ao remover: " + (e?.message ?? "desconhecido"));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderArchive className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentos de Contratos</h1>
            <p className="text-sm text-muted-foreground">
              {isFinanceiro
                ? "Documentos que você anexou aos contratos a vigenciar"
                : "Documentos anexados pelo Cadastro e Financeiro no card Contratos a Vigenciar"}
            </p>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar arquivo, empresa, contrato, usuário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresasDisponiveis.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="Excel">Excel</SelectItem>
                  <SelectItem value="Imagem">Imagem</SelectItem>
                  <SelectItem value="Doc">Doc</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              {!isFinanceiro && (
                <Select value={origemFilter} onValueChange={setOrigemFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas origens</SelectItem>
                    <SelectItem value="cadastro">Cadastro</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="outro">Outros</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista por Empresa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Documentos por empresa{" "}
              <span className="text-muted-foreground font-normal">
                ({grouped.length} empresa{grouped.length === 1 ? "" : "s"} • {filtered.length}{" "}
                arquivo{filtered.length === 1 ? "" : "s"})
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
                <p className="text-xs">
                  Os documentos aparecem aqui após serem anexados no card{" "}
                  <strong>Contratos a Vigenciar</strong> do Dashboard.
                </p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {grouped.map((emp) => (
                  <AccordionItem
                    key={emp.empresaId}
                    value={emp.empresaId}
                    className="border rounded-lg px-3 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-semibold truncate">{emp.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {emp.contrato && <>Contrato {emp.contrato} • </>}
                            {emp.arquivos.length} arquivo
                            {emp.arquivos.length === 1 ? "" : "s"}
                            {emp.ultimoUpload > 0 && (
                              <>
                                {" "}
                                • Último:{" "}
                                {formatDateTime(new Date(emp.ultimoUpload).toISOString())}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
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
                            {emp.arquivos
                              .slice()
                              .sort((a, b) => b.created_at.localeCompare(a.created_at))
                              .map((a) => {
                                const mine = !!currentUid && a.uploaded_by === currentUid;
                                const canDelete = canDeleteAll || mine;
                                return (
                                  <TableRow key={a.id}>
                                    <TableCell>{iconForExt(a.extensao)}</TableCell>
                                    <TableCell className="max-w-[280px]">
                                      <div
                                        className="truncate font-medium"
                                        title={a.nome_arquivo}
                                      >
                                        {a.nome_arquivo}
                                      </div>
                                    </TableCell>
                                    <TableCell>{tipoArquivo(a.extensao)}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          a.uploader_role === "financeiro"
                                            ? "default"
                                            : "outline"
                                        }
                                      >
                                        {a.uploader_role === "financeiro"
                                          ? "Financeiro"
                                          : a.uploader_role === "cadastro"
                                          ? "Cadastro"
                                          : "Outro"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell
                                      className="max-w-[140px] truncate"
                                      title={a.uploaded_by_nome ?? ""}
                                    >
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
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setPreviewArquivo(a)}
                                          title="Visualizar"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleDownload(a)}
                                          title="Baixar"
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                        {canDelete && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => setConfirmDelete(a)}
                                            title="Excluir"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.nome_arquivo} será removido permanentemente.
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
          bucket={BUCKET}
          storagePath={previewArquivo.storage_path}
          nomeArquivo={previewArquivo.nome_arquivo}
          mimeType={previewArquivo.mime_type}
        />
      )}
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
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
