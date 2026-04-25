import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Paperclip, Download, Trash2, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FinanceiroMovimentacao,
  ACCEPTED_FILE_TYPES,
  buildStoragePath,
  formatBytes,
} from "@/lib/financeiro-utils";

type FinanceiroMovimentacaoExt = FinanceiroMovimentacao & { data_vencimento?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao: FinanceiroMovimentacaoExt | null;
  empresaNome?: string;
}

const TIPO_MAX = 60;
const TIPO_REGEX = /^[\p{L}\p{N}\s\-/.,()&]+$/u;

export function EditarMovimentacaoDialog({ open, onOpenChange, movimentacao, empresaNome }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tipoCobranca, setTipoCobranca] = useState("");
  const [dataEnvioNota, setDataEnvioNota] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dentroPrazo, setDentroPrazo] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (movimentacao) {
      setTipoCobranca(movimentacao.tipo_cobranca || "");
      setDataEnvioNota(movimentacao.data_envio_nota || "");
      setDataVencimento(movimentacao.data_vencimento || "");
      setDentroPrazo(movimentacao.dentro_prazo);
    }
  }, [movimentacao]);

  // Validações campo-a-campo (avisos discretos, não bloqueiam edição manual)
  const tipoTrimmed = tipoCobranca.trim();
  const tipoInvalido = tipoTrimmed.length > 0 && !TIPO_REGEX.test(tipoTrimmed);
  const tipoMuitoLongo = tipoTrimmed.length > TIPO_MAX;

  const hoje = new Date().toISOString().slice(0, 10);
  const envioNoFuturo = dataEnvioNota && dataEnvioNota > hoje;
  const vencimentoAntesEnvio =
    dataEnvioNota && dataVencimento && dataVencimento < dataEnvioNota;

  const hasErrors = tipoInvalido || tipoMuitoLongo || envioNoFuturo || vencimentoAntesEnvio;

  const { data: anexos = [] } = useQuery({
    queryKey: ["financeiro-anexos", movimentacao?.id],
    queryFn: async () => {
      if (!movimentacao) return [];
      const { data, error } = await supabase
        .from("anexos_financeiro")
        .select("*")
        .eq("financeiro_movimentacao_id", movimentacao.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!movimentacao && open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!movimentacao) return;
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update({
          tipo_cobranca: tipoTrimmed || null,
          data_envio_nota: dataEnvioNota || null,
          data_vencimento: dataVencimento || null,
          dentro_prazo: dentroPrazo,
        } as any)
        .eq("id", movimentacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Movimentação atualizada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !movimentacao) return;
    setUploading(true);
    try {
      const path = buildStoragePath(movimentacao.empresa_id, movimentacao.id, file.name);
      const { error: upErr } = await supabase.storage
        .from("anexos-financeiro")
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("anexos_financeiro").insert({
        financeiro_movimentacao_id: movimentacao.id,
        nome_arquivo: file.name,
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos", movimentacao.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-counts"] });
      toast.success("Arquivo enviado");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage
      .from("anexos-financeiro")
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

  const handleDelete = async (anexoId: string, path: string) => {
    if (!confirm("Excluir este anexo?")) return;
    try {
      await supabase.storage.from("anexos-financeiro").remove([path]);
      const { error } = await supabase.from("anexos_financeiro").delete().eq("id", anexoId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos", movimentacao?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-counts"] });
      toast.success("Anexo excluído");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  };

  if (!movimentacao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar movimentação</DialogTitle>
          <DialogDescription>
            {empresaNome} · {movimentacao.mes_referencia} · período {movimentacao.periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de cobrança</Label>
              <Input
                id="tipo"
                value={tipoCobranca}
                onChange={(e) => setTipoCobranca(e.target.value)}
                placeholder="Ex: Mensalidade, Coparticipação…"
                maxLength={TIPO_MAX + 20}
                aria-invalid={tipoInvalido || tipoMuitoLongo || undefined}
                className={cn(
                  (tipoInvalido || tipoMuitoLongo) && "border-warning focus-visible:ring-warning",
                )}
              />
              {tipoInvalido && (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Use apenas letras, números e pontuação simples.
                </p>
              )}
              {tipoMuitoLongo && (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Texto muito longo (máx. {TIPO_MAX} caracteres).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_nota">Data de envio da nota</Label>
              <Input
                id="data_nota"
                type="date"
                value={dataEnvioNota}
                max={hoje}
                onChange={(e) => setDataEnvioNota(e.target.value)}
                aria-invalid={!!envioNoFuturo || undefined}
                className={cn(envioNoFuturo && "border-warning focus-visible:ring-warning")}
              />
              {envioNoFuturo ? (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Data de envio não pode ser futura.
                </p>
              ) : dataEnvioNota ? (
                <p className="text-[11px] text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Nota marcada como enviada.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="data_venc">Data de vencimento</Label>
              <Input
                id="data_venc"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                aria-invalid={!!vencimentoAntesEnvio || undefined}
                className={cn(vencimentoAntesEnvio && "border-warning focus-visible:ring-warning")}
              />
              {vencimentoAntesEnvio && (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Vencimento é anterior ao envio da nota.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Dentro do prazo</p>
                <p className="text-xs text-muted-foreground">
                  Desmarque se a nota foi emitida fora do prazo.
                </p>
              </div>
              <Switch checked={dentroPrazo} onCheckedChange={setDentroPrazo} />
            </div>
          </div>

          {/* Anexos */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4 text-info" />
                Anexos ({anexos.length})
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Enviando..." : "Adicionar"}
                </span>
              </label>
            </div>

            {anexos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum anexo. Aceita PDF, Excel e CSV.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {anexos.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-2.5 py-1.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate" title={a.nome_arquivo}>
                      {a.nome_arquivo}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatBytes(a.tamanho_bytes)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(a.id, a.storage_path)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
