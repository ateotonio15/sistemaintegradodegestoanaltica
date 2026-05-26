import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  CalendarClock,
  Paperclip,
  Upload,
  Search,
  FileText,
  Trash2,
  Download,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  nome_empresa: string | null;
  codigo_contrato: string | null;
  total_vidas: number | null;
  data_vigencia: string | null;
  status: string;
};

type Anexo = {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function ContratosAVigenciarCard() {
  const qc = useQueryClient();
  const { isAdmin, role } = useAuth();
  const canManage = isAdmin || role === "comum" || role === "vendas";
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["contratos-a-vigenciar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos")
        .select("id, nome_empresa, codigo_contrato, total_vidas, data_vigencia, status")
        .gte("data_vigencia", todayIso)
        .not("status", "in", '("implantado","rejeitado")')
        .order("data_vigencia", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: anexosByImpl = {} } = useQuery({
    queryKey: ["contratos-a-vigenciar-anexos", rows.map((r) => r.id)],
    enabled: rows.length > 0,
    queryFn: async () => {
      const ids = rows.map((r) => r.id);
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("id, implantacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at")
        .in("implantacao_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, Anexo[]> = {};
      ((data as any[]) || []).forEach((a: any) => {
        (map[a.implantacao_id] ||= []).push(a);
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.nome_empresa || "").toLowerCase().includes(q) ||
        (r.codigo_contrato || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !openRow) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_");
        const path = `${openRow.id}/complementar/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("anexos-implantacao")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("implantacao_anexos" as any).insert({
          implantacao_id: openRow.id,
          tipo: "complementar",
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: u.user?.id,
        } as any);
        if (insErr) throw insErr;
      }
      toast.success("Arquivo(s) anexado(s) com sucesso");
      qc.invalidateQueries({ queryKey: ["contratos-a-vigenciar-anexos"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (a: Anexo) => {
    const { data } = await supabase.storage
      .from("anexos-implantacao")
      .createSignedUrl(a.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (a: Anexo) => {
    if (!canManage) return;
    if (!confirm(`Excluir o anexo "${a.nome_arquivo}"?`)) return;
    await supabase.storage.from("anexos-implantacao").remove([a.storage_path]).catch(() => {});
    await supabase.from("implantacao_anexos" as any).delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["contratos-a-vigenciar-anexos"] });
    toast.success("Anexo removido");
  };

  return (
    <>
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="bg-accent/30 border-b">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Contratos a Vigenciar
              <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-lg"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {isFetching ? "Carregando..." : "Nenhum contrato com vigência futura."}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const anexos = anexosByImpl[r.id] || [];
                const dias = daysUntil(r.data_vigencia);
                const proximo = dias !== null && dias <= 7;
                return (
                  <div
                    key={r.id}
                    className="p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">
                          {r.nome_empresa || "—"}
                        </p>
                        {r.codigo_contrato && (
                          <Badge variant="outline" className="text-xs">
                            {r.codigo_contrato}
                          </Badge>
                        )}
                        <Badge
                          variant={proximo ? "destructive" : "secondary"}
                          className="text-xs gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          {formatDateBR(r.data_vigencia)}
                          {dias !== null && (
                            <span className="opacity-80">
                              · {dias === 0 ? "hoje" : `em ${dias}d`}
                            </span>
                          )}
                        </Badge>
                        {r.total_vidas != null && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Users className="h-3 w-3" />
                            {r.total_vidas} vidas
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg"
                      onClick={() => setOpenRow(r)}
                    >
                      <Paperclip className="h-4 w-4" />
                      Anexos
                      <Badge variant="secondary" className="ml-1">
                        {anexos.length}
                      </Badge>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Anexos — {openRow?.nome_empresa}
            </DialogTitle>
          </DialogHeader>
          {openRow && (
            <div className="space-y-4">
              {canManage && (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                  <Button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-2 rounded-lg"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Anexar documento"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    PDF, imagens ou planilhas
                  </span>
                </div>
              )}
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {(anexosByImpl[openRow.id] || []).length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum anexo enviado.
                  </div>
                ) : (
                  (anexosByImpl[openRow.id] || []).map((a) => (
                    <div
                      key={a.id}
                      className="p-3 flex items-center gap-3 hover:bg-accent/30"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {a.nome_arquivo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateBR(a.created_at)}
                          {a.tamanho_bytes != null && (
                            <span> · {(a.tamanho_bytes / 1024).toFixed(0)} KB</span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(a)}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(a)}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
