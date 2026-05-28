import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, FileText, Download, Trash2, AlertCircle } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_MIME_TYPES,
  formatBytes,
} from "@/lib/financeiro-utils";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";

interface Props {
  movimentacaoId: string | null;
  empresaId: string | null;
  /** Quando true, mostra aviso visual de obrigatoriedade. */
  required?: boolean;
  /** Callback recebe o número atual de anexos. Útil para o pai bloquear o submit. */
  onCountChange?: (count: number) => void;
}

const STORAGE_BUCKET = "anexos-movimentacoes";
const ACCEPTED_FOR_MOV = `${ACCEPTED_FILE_TYPES},.png,.jpg,.jpeg,.webp`;

function buildPath(empresaId: string, movId: string, fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  return `${empresaId}/${movId}/${crypto.randomUUID()}.${ext}`;
}

export function AnexosMovimentacao({ movimentacaoId, empresaId, required, onCountChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { data: anexos = [] } = useQuery({
    queryKey: ["anexos-movimentacao", movimentacaoId],
    queryFn: async () => {
      if (!movimentacaoId) return [];
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("*")
        .eq("movimentacao_id", movimentacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!movimentacaoId,
  });

  // notifica pai sobre quantidade
  if (onCountChange) {
    queueMicrotask(() => onCountChange(anexos.length));
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !movimentacaoId || !empresaId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const path = buildPath(empresaId, movimentacaoId, file.name);
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file);
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("anexos_movimentacao").insert({
          movimentacao_id: movimentacaoId,
          empresa_id: empresaId,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type || null,
          tamanho_bytes: file.size,
          uploaded_by: user?.id ?? null,
        });
        if (insErr) throw insErr;

        // Auto-análise do layout (Excel) — atualiza Vidas Ativas da empresa
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (["xlsx", "xlsm", "xls"].includes(ext)) {
          try {
            const buffer = await file.arrayBuffer();
            const sig = new Uint8Array(buffer.slice(0, 4));
            if (sig[0] === 0x50 && sig[1] === 0x4b) {
              const result = await validarRelatorioVidas(buffer);
              const vidas = result?.total_vidas ?? 0;
              if (vidas > 0) {
                const { error: updErr } = await supabase
                  .from("empresas")
                  .update({ vidas, updated_at: new Date().toISOString() })
                  .eq("id", empresaId);
                if (!updErr) {
                  toast.success(`Vidas Ativas atualizadas pelo layout: ${vidas}`);
                  queryClient.invalidateQueries({ queryKey: ["empresas"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-empresas"] });
                  queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
                }
              }
            }
          } catch (err) {
            console.warn("Análise automática do layout falhou:", err);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["anexos-movimentacao", movimentacaoId] });
      toast.success(files.length > 1 ? `${files.length} arquivos enviados` : "Arquivo enviado");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60);
    if (error) {
      toast.error("Erro ao gerar link: " + error.message);
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Excluir este anexo?")) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      const { error } = await supabase.from("anexos_movimentacao").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["anexos-movimentacao", movimentacaoId] });
      toast.success("Anexo excluído");
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const showRequiredWarn = required && anexos.length === 0;

  return (
    <div className={`min-w-0 max-w-full rounded-lg border p-3 space-y-3 overflow-hidden ${showRequiredWarn ? "border-warning/50 bg-warning/5" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-info" />
          Anexos {required && <span className="text-destructive">*</span>}
          <span className="text-muted-foreground font-normal">({anexos.length})</span>
        </div>
        <label className={`cursor-pointer ${!movimentacaoId ? "opacity-50 pointer-events-none" : ""}`}>
          <input
            type="file"
            multiple
            className="hidden"
            accept={ACCEPTED_FOR_MOV}
            onChange={handleUpload}
            disabled={uploading || !movimentacaoId}
          />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Anexar"}
          </span>
        </label>
      </div>

      {!movimentacaoId && (
        <p className="text-[11px] text-muted-foreground">
          Salve a movimentação primeiro para poder anexar documentos.
        </p>
      )}

      {showRequiredWarn && movimentacaoId && (
        <p className="text-[11px] text-warning flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Para enviar ao financeiro é obrigatório anexar documentos.
        </p>
      )}

      {anexos.length === 0 && movimentacaoId && !showRequiredWarn ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum anexo. Aceita PDF, Excel, CSV e imagens.
        </p>
      ) : (
        <ul className="min-w-0 max-w-full space-y-1.5">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="min-w-0 truncate" title={a.nome_arquivo}>{a.nome_arquivo}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(a.tamanho_bytes)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id, a.storage_path)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
