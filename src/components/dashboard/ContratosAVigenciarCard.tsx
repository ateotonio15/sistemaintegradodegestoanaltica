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
  /** key for the row (implantacao_id when present, else empresa_id) */
  id: string;
  /** implantacao_contratos.id when available — required for uploading anexos */
  implantacao_id: string | null;
  empresa_id: string | null;
  nome_empresa: string | null;
  codigo_contrato: string | null;
  total_vidas: number | null;
  data_vigencia: string | null;
  status: string | null;
  origem: "implantacao" | "empresa";
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
      // 1) Implantações com vigência futura
      const implP = supabase
        .from("implantacoes_contratos")
        .select("id, empresa_id, nome_empresa, codigo_contrato, total_vidas, data_vigencia, status")
        .gte("data_vigencia", todayIso)
        .not("status", "in", '("implantado","rejeitado")');
      // 2) Empresas "novas": sem data de implantação ou com implantação futura
      const empP = supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, vidas, data_implantacao, status_empresa")
        .or(`data_implantacao.is.null,data_implantacao.gt.${todayIso}`);

      const [implRes, empRes] = await Promise.all([implP, empP]);
      if (implRes.error) throw implRes.error;
      if (empRes.error) throw empRes.error;

      // Mapa empresa_id -> implantacao mais recente (qualquer status), para anexar arquivos
      const empresaIds = (empRes.data || []).map((e: any) => e.id);
      let implByEmpresa: Record<string, string> = {};
      if (empresaIds.length > 0) {
        const { data: linked } = await supabase
          .from("implantacoes_contratos")
          .select("id, empresa_id, created_at")
          .in("empresa_id", empresaIds)
          .order("created_at", { ascending: false });
        ((linked as any[]) || []).forEach((l) => {
          if (l.empresa_id && !implByEmpresa[l.empresa_id]) implByEmpresa[l.empresa_id] = l.id;
        });
      }

      const implRows: Row[] = ((implRes.data as any[]) || []).map((r) => ({
        id: r.id,
        implantacao_id: r.id,
        empresa_id: r.empresa_id,
        nome_empresa: r.nome_empresa,
        codigo_contrato: r.codigo_contrato,
        total_vidas: r.total_vidas,
        data_vigencia: r.data_vigencia,
        status: r.status,
        origem: "implantacao",
      }));
      const implEmpresaIds = new Set(implRows.map((r) => r.empresa_id).filter(Boolean) as string[]);
      const empRows: Row[] = ((empRes.data as any[]) || [])
        .filter((e) => !implEmpresaIds.has(e.id))
        .map((e) => ({
          id: e.id,
          implantacao_id: implByEmpresa[e.id] || null,
          empresa_id: e.id,
          nome_empresa: e.nome,
          codigo_contrato: e.codigo_contrato,
          total_vidas: e.vidas,
          data_vigencia: e.data_implantacao,
          status: e.status_empresa,
          origem: "empresa",
        }));

      const all = [...implRows, ...empRows];
      // Ordena por data (nulls por último)
      all.sort((a, b) => {
        if (!a.data_vigencia && !b.data_vigencia) return 0;
        if (!a.data_vigencia) return 1;
        if (!b.data_vigencia) return -1;
        return a.data_vigencia.localeCompare(b.data_vigencia);
      });
      return all;
    },
  });

  const implIdsForAnexos = useMemo(
    () => rows.map((r) => r.implantacao_id).filter(Boolean) as string[],
    [rows],
  );

  const { data: anexosByImpl = {} } = useQuery({
    queryKey: ["contratos-a-vigenciar-anexos", implIdsForAnexos],
    enabled: implIdsForAnexos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("id, implantacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at")
        .in("implantacao_id", implIdsForAnexos)
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
      const uid = u.user?.id;

      // Se não houver implantação ainda, cria um esboço para receber os anexos
      let implId = openRow.implantacao_id;
      if (!implId) {
        if (!openRow.empresa_id) throw new Error("Empresa não identificada.");
        const userName =
          (u.user?.user_metadata as any)?.display_name ||
          (u.user?.user_metadata as any)?.full_name ||
          u.user?.email ||
          null;
        const { data: created, error: cErr } = await supabase
          .from("implantacoes_contratos" as any)
          .insert({
            empresa_id: openRow.empresa_id,
            nome_empresa: openRow.nome_empresa,
            codigo_contrato: openRow.codigo_contrato,
            total_vidas: openRow.total_vidas,
            data_vigencia: openRow.data_vigencia,
            status: "em_implantacao",
            etapa_atual: 1,
            progresso: 0,
            created_by: uid,
            created_by_nome: userName,
          } as any)
          .select("id")
          .single();
        if (cErr) throw cErr;
        implId = (created as any).id;
        setOpenRow({ ...openRow, implantacao_id: implId });
      }

      for (const file of Array.from(files)) {
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_");
        const path = `${implId}/complementar/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("anexos-implantacao")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("implantacao_anexos" as any).insert({
          implantacao_id: implId,
          tipo: "complementar",
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: uid,
        } as any);
        if (insErr) throw insErr;
      }
      toast.success("Arquivo(s) anexado(s) com sucesso");
      qc.invalidateQueries({ queryKey: ["contratos-a-vigenciar"] });
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
                const anexos = r.implantacao_id ? anexosByImpl[r.implantacao_id] || [] : [];
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
                        {r.origem === "empresa" && (
                          <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30">
                            Nova Empresa
                          </Badge>
                        )}
                        <Badge
                          variant={proximo ? "destructive" : "secondary"}
                          className="text-xs gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          {r.data_vigencia ? formatDateBR(r.data_vigencia) : "Sem data"}
                          {dias !== null && (
                            <span className="opacity-80">
                              · {dias === 0 ? "hoje" : `em ${dias}d`}
                            </span>
                          )}
                        </Badge>
                        {r.total_vidas != null && r.total_vidas > 0 && (
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
          {openRow && (() => {
            const implId = openRow.implantacao_id;
            const list = implId ? anexosByImpl[implId] || [] : [];
            return (
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
                  {list.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum anexo enviado.
                    </div>
                  ) : (
                    list.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 flex items-center gap-3 hover:bg-accent/30"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.nome_arquivo}</p>
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
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
