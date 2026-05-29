import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Eye, FileText, Paperclip, Play, Loader2, CheckCircle2, X, AlertTriangle, Receipt, Info } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";
import { formatDateBR } from "@/lib/date-utils";
import { ConfigFinanceiraEmpresaDialog } from "@/components/financeiro/ConfigFinanceiraEmpresaDialog";
import { validarConfigFinanceira } from "@/lib/empresa-financeiro-config";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const data = formatDateBR(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${data} ${hh}:${mm}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome: string;
  mesReferencia: string;
  periodo: string;
  /** ID da financeiro_movimentacoes para suporte ao botão "Iniciar faturamento". */
  movimentacaoId?: string | null;
  faturamentoIniciadoEm?: string | null;
  faturamentoIniciadoPorNome?: string | null;
}

const BUCKET_FINANCEIRO = "anexos-financeiro";
const BUCKET_OPERACIONAL = "anexos-movimentacoes";
const BUCKET_IMPLANTACAO = "anexos-implantacao";


type AnexoRow = {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
  uploader_nome?: string | null;
  bucket: string;
  origem_label: "Financeiro" | "Cadastro" | "Contrato";
};


export function AnexosViewerDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  mesReferencia,
  periodo,
  movimentacaoId = null,
  faturamentoIniciadoEm = null,
  faturamentoIniciadoPorNome = null,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [iniciando, setIniciando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configContext, setConfigContext] = useState<{
    empresaId: string;
    empresaNome: string;
    movimentacaoId: string;
  } | null>(null);
  const [avisos, setAvisos] = useState<{
    exigePoPc: boolean;
    envioBoletoComNota: boolean;
    observacao: string | null;
  } | null>(null);

  const executarIniciarFaturamento = async (ctx = configContext) => {
    const targetMovimentacaoId = ctx?.movimentacaoId ?? movimentacaoId;
    const targetEmpresaId = ctx?.empresaId ?? empresaId;
    if (!targetMovimentacaoId || !user) return;
    setIniciando(true);
    try {
      // Busca o nome do usuário atual
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      const nome = prof?.display_name || prof?.username || user.email || "Usuário";

      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update({
          faturamento_iniciado_por: user.id,
          faturamento_iniciado_por_nome: nome,
          faturamento_iniciado_em: new Date().toISOString(),
        })
        .eq("id", targetMovimentacaoId);
      if (error) throw error;

      // Busca flags da empresa para exibir avisos pós-início.
      if (targetEmpresaId) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("exige_po_pc, envio_boleto_com_nota, observacao_padrao_financeiro")
          .eq("id", targetEmpresaId)
          .maybeSingle();
        const e = emp as any;
        const exigePoPc = !!e?.exige_po_pc;
        const envioBoletoComNota = !!e?.envio_boleto_com_nota;
        const observacao =
          e?.observacao_padrao_financeiro && String(e.observacao_padrao_financeiro).trim()
            ? String(e.observacao_padrao_financeiro)
            : null;

        if (exigePoPc || envioBoletoComNota || observacao) {
          setAvisos({ exigePoPc, envioBoletoComNota, observacao });
        }
      }

      toast.success("Faturamento iniciado");
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
    } catch (e: any) {
      toast.error("Erro ao iniciar faturamento: " + e.message);
    } finally {
      setIniciando(false);
    }
  };

  const handleIniciarFaturamento = async () => {
    if (!movimentacaoId || !user || !empresaId) return;
    // Valida configurações financeiras obrigatórias da empresa antes de iniciar.
    setIniciando(true);
    try {
      const { data: emp, error: empErr } = await supabase
        .from("empresas")
        .select(
          "data_emissao_fatura, data_vencimento_fatura, tipo_financeiro, pagamento_via_deposito, exige_po_pc, config_financeira_confirmada",
        )
        .eq("id", empresaId)
        .maybeSingle();
      if (empErr) {
        toast.error("Erro ao validar configurações: " + empErr.message);
        return;
      }
      const validacao = validarConfigFinanceira(emp as any);
      if (!validacao.ok) {
        const nextContext = { empresaId, empresaNome, movimentacaoId };
        setConfigContext(nextContext);
        // Fecha o dialog externo antes de abrir o de configurações para evitar
        // problemas de modais Radix aninhados (scroll-lock / pointer-events).
        toast.info(
          `Preencha as configurações financeiras antes de iniciar: ${validacao.faltantes.join(", ")}`,
          { duration: 5000 },
        );
        onOpenChange(false);
        // Pequeno atraso garante que a animação de fechar termine antes de abrir o próximo.
        setTimeout(() => setConfigOpen(true), 150);
        return;
      }
      await executarIniciarFaturamento();
    } finally {
      setIniciando(false);
    }
  };

  const handleCancelarFaturamento = async () => {
    if (!movimentacaoId) return;
    if (!confirm("Deseja realmente cancelar o faturamento em andamento?")) return;
    setCancelando(true);
    try {
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update({
          faturamento_iniciado_por: null,
          faturamento_iniciado_por_nome: null,
          faturamento_iniciado_em: null,
        })
        .eq("id", movimentacaoId);
      if (error) throw error;
      toast.success("Faturamento cancelado");
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
    } catch (e: any) {
      toast.error("Erro ao cancelar faturamento: " + e.message);
    } finally {
      setCancelando(false);
    }
  };


  const { data: anexos = [], isLoading } = useQuery<AnexoRow[]>({
    queryKey: ["anexos-viewer-merged", empresaId, mesReferencia, periodo],
    enabled: open && !!empresaId,
    queryFn: async () => {
      // 1) Movimentações financeiras do processo
      const { data: movsFin } = await supabase
        .from("financeiro_movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movFinIds = (movsFin ?? []).map((m) => m.id);

      // 2) Movimentações operacionais (cadastro) do processo
      const { data: movsOp } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movOpIds = (movsOp ?? []).map((m) => m.id);

      const [anxFinRes, anxOpRes] = await Promise.all([
        movFinIds.length
          ? supabase
              .from("anexos_financeiro")
              .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
              .in("financeiro_movimentacao_id", movFinIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        movOpIds.length
          ? supabase
              .from("anexos_movimentacao")
              .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
              .in("movimentacao_id", movOpIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (anxFinRes.error) throw anxFinRes.error;
      if (anxOpRes.error) throw anxOpRes.error;

      const fin: AnexoRow[] = (anxFinRes.data ?? []).map((a: any) => ({
        ...a,
        bucket: BUCKET_FINANCEIRO,
        origem_label: "Financeiro" as const,
      }));
      const op: AnexoRow[] = (anxOpRes.data ?? []).map((a: any) => ({
        ...a,
        bucket: BUCKET_OPERACIONAL,
        origem_label: "Cadastro" as const,
      }));

      const merged = [...fin, ...op].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const userIds = Array.from(
        new Set(merged.map((a) => a.uploaded_by).filter(Boolean) as string[]),
      );
      let nomeMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        nomeMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
      }
      return merged.map((a) => ({
        ...a,
        uploader_nome: a.uploaded_by ? nomeMap.get(a.uploaded_by) ?? null : null,
      }));
    },
  });

  const handleDownload = async (bucket: string, path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) throw error ?? new Error("Falha ao baixar arquivo");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      // Fallback: tenta abrir signed URL em nova aba
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60, { download: nome });
      if (signErr || !signed?.signedUrl) {
        toast.error("Erro ao baixar: " + (e?.message || signErr?.message || "desconhecido"));
        return;
      }
      window.open(signed.signedUrl, "_blank", "noopener");
    }
  };

  const [preview, setPreview] = useState<AnexoRow | null>(null);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-info" />
            Anexos do processo
          </DialogTitle>
          <DialogDescription>
            {empresaNome} · {mesReferencia} · {periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : anexos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum anexo encontrado para este processo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {anexos.map((a) => (
                <li
                  key={`${a.bucket}-${a.id}`}
                  className="flex items-center gap-3 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium" title={a.nome_arquivo}>
                      {a.nome_arquivo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(a.created_at)}
                      {a.uploader_nome ? ` · ${a.uploader_nome}` : ""}
                      {` · ${a.origem_label}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPreview(a)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDownload(a.bucket, a.storage_path, a.nome_arquivo)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {movimentacaoId && (
          <div className="border-t pt-3 mt-1">
            {faturamentoIniciadoEm ? (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 px-3 py-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />
                <div className="flex flex-col leading-tight flex-1 min-w-0">
                  <span className="font-medium text-blue-700 dark:text-blue-200 truncate">
                    Faturamento iniciado{faturamentoIniciadoPorNome ? ` por ${faturamentoIniciadoPorNome}` : ""}
                  </span>
                  <span className="text-xs text-blue-600/80 dark:text-blue-300/80">
                    Iniciado às {formatDateTime(faturamentoIniciadoEm)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelarFaturamento}
                  disabled={cancelando}
                  className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:text-blue-200 dark:hover:bg-blue-500/20"
                >
                  {cancelando ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleIniciarFaturamento}
                disabled={iniciando}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {iniciando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Iniciar faturamento
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      {preview && (
        <PreviewArquivoDialog
          open={!!preview}
          onOpenChange={(v) => !v && setPreview(null)}
          bucket={preview.bucket}
          storagePath={preview.storage_path}
          nomeArquivo={preview.nome_arquivo}
        />
      )}
    </Dialog>

    <ConfigFinanceiraEmpresaDialog
      open={configOpen}
      onOpenChange={(v) => {
        setConfigOpen(v);
        if (!v) setConfigContext(null);
      }}
      empresaId={configContext?.empresaId ?? empresaId}
      empresaNome={configContext?.empresaNome ?? empresaNome}
      movimentacaoId={configContext?.movimentacaoId ?? movimentacaoId}
      onSaved={() => {
        void executarIniciarFaturamento(configContext);
      }}
    />

    <Dialog open={!!avisos} onOpenChange={(v) => !v && setAvisos(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Avisos importantes desta empresa
          </DialogTitle>
          <DialogDescription>
            Atenção aos requisitos abaixo antes de prosseguir com o faturamento de{" "}
            <span className="font-medium text-foreground">{empresaNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {avisos?.exigePoPc && (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>PO/PC obrigatório</AlertTitle>
              <AlertDescription>
                Antes da emissão da nota fiscal, é necessário enviar o faturamento para
                validação da empresa.
              </AlertDescription>
            </Alert>
          )}
          {avisos?.envioBoletoComNota && (
            <Alert className="border-info/50 bg-info/10">
              <Receipt className="h-4 w-4 text-info" />
              <AlertTitle>Boleto junto com a nota</AlertTitle>
              <AlertDescription>
                Esta empresa exige envio do boleto junto com a nota fiscal.
              </AlertDescription>
            </Alert>
          )}
          {avisos?.observacao && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Observação desta empresa</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {avisos.observacao}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => setAvisos(null)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

