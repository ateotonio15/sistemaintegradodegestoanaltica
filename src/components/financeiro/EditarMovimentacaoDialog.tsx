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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, Download, Trash2, Upload, FileText, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FinanceiroMovimentacao,
  ACCEPTED_FILE_TYPES,
  buildStoragePath,
  formatBytes,
  TIPOS_FINANCEIRO,
} from "@/lib/financeiro-utils";
import { todayLocalISO } from "@/lib/date-utils";
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
  getPagadoresDoContrato,
  replicarFinanceiroParaPagadores,
  replicarAnexosParaPagadores,
  type Pagador,
} from "@/lib/pagadores-utils";

type FinanceiroMovimentacaoExt = FinanceiroMovimentacao & {
  data_vencimento?: string | null;
  dia_emissao?: number | null;
  tipo_analise?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao: FinanceiroMovimentacaoExt | null;
  empresaNome?: string;
}

const TIPOS_ANALISE = [
  { value: "normal", label: "Análise normal" },
  { value: "faixa_etaria", label: "Análise faixa etária" },
  { value: "moto_honda", label: "Análise Moto Honda" },
] as const;

export function EditarMovimentacaoDialog({ open, onOpenChange, movimentacao, empresaNome }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tipoCobranca, setTipoCobranca] = useState("");
  const [dataEnvioNota, setDataEnvioNota] = useState("");
  const [diaVencimento, setDiaVencimento] = useState<string>("__none__");
  const [diaEmissao, setDiaEmissao] = useState<string>("__none__");
  const [tipoAnalise, setTipoAnalise] = useState<string>("normal");
  const [dentroPrazo, setDentroPrazo] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (movimentacao) {
      setTipoCobranca(movimentacao.tipo_cobranca || "");
      setDataEnvioNota(movimentacao.data_envio_nota || "");
      // extrai apenas o dia da data_vencimento (YYYY-MM-DD)
      const v = movimentacao.data_vencimento;
      if (v) {
        const m = v.match(/^\d{4}-\d{2}-(\d{2})$/);
        setDiaVencimento(m ? String(parseInt(m[1], 10)) : "__none__");
      } else {
        setDiaVencimento("__none__");
      }
      setDiaEmissao(movimentacao.dia_emissao ? String(movimentacao.dia_emissao) : "__none__");
      setTipoAnalise((movimentacao.tipo_analise as string) || "normal");
      setDentroPrazo(movimentacao.dentro_prazo);
    }
  }, [movimentacao]);

  // Validações campo-a-campo (avisos discretos, não bloqueiam edição manual)
  const tipoTrimmed = tipoCobranca.trim();

  const hoje = todayLocalISO();
  const envioNoFuturo = dataEnvioNota && dataEnvioNota > hoje;

  const hasErrors = !!envioNoFuturo;

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
      // Detecta se a data de envio acabou de ser preenchida (ou alterada) nesta edição
      const envioAlterado =
        !!dataEnvioNota && dataEnvioNota !== (movimentacao.data_envio_nota || "");
      // Reconstrói data_vencimento a partir do dia + mes_referencia (YYYY-MM)
      let dataVencimentoIso: string | null = null;
      if (diaVencimento !== "__none__") {
        const dia = parseInt(diaVencimento, 10);
        const mes = movimentacao.mes_referencia; // "YYYY-MM"
        if (mes && /^\d{4}-\d{2}$/.test(mes) && dia >= 1 && dia <= 31) {
          dataVencimentoIso = `${mes}-${String(dia).padStart(2, "0")}`;
        }
      }
      const payload: Record<string, unknown> = {
        tipo_cobranca: tipoTrimmed || null,
        data_envio_nota: dataEnvioNota || null,
        data_vencimento: dataVencimentoIso,
        dia_emissao: diaEmissao === "__none__" ? null : Number(diaEmissao),
        tipo_analise: tipoAnalise || "normal",
        dentro_prazo: dentroPrazo,
      };
      if (envioAlterado && user?.id) {
        payload.enviado_por_user_id = user.id;
      } else if (!dataEnvioNota) {
        // Se removeu a data de envio, limpa o autor
        payload.enviado_por_user_id = null;
      }
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update(payload as any)
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
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !movimentacao) return;
    setUploading(true);
    let sucessos = 0;
    const erros: string[] = [];
    try {
      for (const file of files) {
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
          sucessos += 1;
        } catch (err: any) {
          erros.push(`${file.name}: ${err.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos", movimentacao.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });

      if (sucessos > 0) {
        toast.success(
          sucessos === 1 ? "Arquivo enviado" : `${sucessos} arquivos enviados`,
        );
      }
      if (erros.length > 0) {
        toast.error(`Falha em ${erros.length} arquivo(s): ${erros.join(" | ")}`);
      }
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
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
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
              <Select
                value={tipoCobranca || "__none__"}
                onValueChange={(v) => setTipoCobranca(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Não definido —</SelectItem>
                  {TIPOS_FINANCEIRO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Tipos exclusivos do setor Financeiro.
              </p>
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
              <Label htmlFor="dia_emissao">Dia de emissão</Label>
              <Select value={diaEmissao} onValueChange={setDiaEmissao}>
                <SelectTrigger id="dia_emissao">
                  <SelectValue placeholder="Selecione o dia (01–31)" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">— Não definido —</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Emissão dia {String(d).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Períodos 20-25 e 25-30 começam com "Emissão dia 01" automaticamente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo_analise">Tipo de análise</Label>
              <Select value={tipoAnalise} onValueChange={setTipoAnalise}>
                <SelectTrigger id="tipo_analise">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ANALISE.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Controla o parser usado na análise dos anexos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dia_venc">Data de vencimento (dia)</Label>
              <Select value={diaVencimento} onValueChange={setDiaVencimento}>
                <SelectTrigger id="dia_venc">
                  <SelectValue placeholder="Selecione o dia (01–31)" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">— Não definido —</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {String(d).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Apenas o dia (01–31) do vencimento no Financeiro.
              </p>
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
                  multiple
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

          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-[11px] text-muted-foreground">
              {hasErrors ? "Corrija os campos destacados para salvar." : "Campos validados."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || hasErrors}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
