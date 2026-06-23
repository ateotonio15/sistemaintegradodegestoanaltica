import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Download, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface Props {
  empresaId: string;
  readOnly?: boolean;
  required?: boolean;
}

export function EmpresaAnexosImplantacao({ empresaId, readOnly, required = true }: Props) {

  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: anexos = [], isLoading } = useQuery<any[]>({
    queryKey: ["empresa-anexos-impl", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("id, tipo, nome_arquivo, storage_path, mime_type, created_at")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `empresa/${empresaId}/implantacao/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("anexos-implantacao")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase
        .from("implantacao_anexos" as any)
        .insert({
          empresa_id: empresaId,
          tipo: "implantacao",
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: u.user?.id,
        } as any);
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey: ["empresa-anexos-impl", empresaId] });
      qc.invalidateQueries({ queryKey: ["recem-implantados-anexos"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (a: any) => {
    const { data: signed, error } = await supabase.storage
      .from("anexos-implantacao")
      .createSignedUrl(a.storage_path, 60);
    if (error || !signed?.signedUrl) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(signed.signedUrl, "_blank");
  };

  const handleDelete = async (a: any) => {
    if (!confirm(`Remover "${a.nome_arquivo}"?`)) return;
    try {
      await supabase.storage.from("anexos-implantacao").remove([a.storage_path]);
      await supabase.from("implantacao_anexos" as any).delete().eq("id", a.id);
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["empresa-anexos-impl", empresaId] });
      qc.invalidateQueries({ queryKey: ["recem-implantados-anexos"] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao remover");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Anexos da Implantação</h3>
          <Badge variant="outline" className="h-5 text-[10px]">
            {anexos.length}
          </Badge>
          <span className="text-xs text-muted-foreground">
            (visíveis em Recém Implantados para o Financeiro)
          </span>
        </div>
        {!readOnly && (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              multiple
              disabled={uploading}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                for (const f of files) await handleUpload(f);
                e.target.value = "";
                if (files.length) toast.success("Arquivo(s) anexado(s)");
              }}
            />
            <Button asChild size="sm" variant="outline" className="h-8">
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? "Enviando..." : "Anexar arquivos"}
              </span>
            </Button>
          </label>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : anexos.length === 0 ? (
        <div className={`rounded-lg border border-dashed ${required ? "border-destructive/40" : "border-muted-foreground/30"} bg-background/50 p-6 text-center`}>
          <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            {required
              ? "Nenhum arquivo anexado. É obrigatório anexar pelo menos 1 arquivo para salvar."
              : "Nenhum arquivo anexado. Anexos são opcionais até preencher a Data de Implantação."}
          </p>
        </div>

      ) : (
        <div className="space-y-1">
          {anexos.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between bg-background rounded px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{a.nome_arquivo}</span>
              </span>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleDownload(a)}
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {!readOnly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(a)}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
