import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Download, Trash2, CheckCircle2, XCircle, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPOS = ["anexo_1", "contrato", "relatorio_vidas", "primeira_cobranca", "complementar"] as const;

const TIPO_LABEL: Record<string, string> = {
  anexo_1: "Anexo 1",
  contrato: "Contrato",
  relatorio_vidas: "Relatório de Vidas",
  primeira_cobranca: "Relatórios da Primeira Cobrança",
  complementar: "Complementar",
};

interface Props {
  empresaId: string;
  readOnly?: boolean;
}

export function EmpresaAnexosImplantacao({ empresaId, readOnly }: Props) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

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

  const handleUpload = async (file: File, tipo: string) => {
    setUploading(tipo);
    try {
      const { data: u } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `empresa/${empresaId}/${tipo}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("anexos-implantacao")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase
        .from("implantacao_anexos" as any)
        .insert({
          empresa_id: empresaId,
          tipo,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: u.user?.id,
        } as any);
      if (insErr) throw insErr;
      toast.success("Arquivo anexado");
      qc.invalidateQueries({ queryKey: ["empresa-anexos-impl", empresaId] });
      qc.invalidateQueries({ queryKey: ["recem-implantados-anexos"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(null);
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
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Anexos da Implantação</h3>
        <span className="text-xs text-muted-foreground">
          (visíveis em Recém Implantados para o Financeiro)
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIPOS.map((tipo) => {
            const list = anexos.filter((a) => a.tipo === tipo);
            const allowMultiple = tipo === "complementar" || tipo === "primeira_cobranca";
            return (
              <Card key={tipo} className={cn(list.length === 0 && "border-destructive/30")}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      {list.length > 0 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {TIPO_LABEL[tipo]}
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                        {list.length}
                      </Badge>
                    </Label>
                    {!readOnly && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          multiple={allowMultiple}
                          disabled={uploading === tipo}
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            for (const f of files) await handleUpload(f, tipo);
                            e.target.value = "";
                          }}
                        />
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <span>
                            <Upload className="h-3 w-3 mr-1" />
                            {uploading === tipo ? "Enviando..." : "Anexar"}
                          </span>
                        </Button>
                      </label>
                    )}
                  </div>
                  {list.length > 0 && (
                    <div className="space-y-1">
                      {list.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between bg-background rounded px-2 py-1 text-xs"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{a.nome_arquivo}</span>
                          </span>
                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleDownload(a)}
                              title="Baixar"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            {!readOnly && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleDelete(a)}
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
