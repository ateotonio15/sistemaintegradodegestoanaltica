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
import { useEffect, useState } from "react";
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
  // Override local para refletir início/cancelamento imediatamente na UI,
  // sem esperar o refetch do parent.
  const [localIniciadoEm, setLocalIniciadoEm] = useState<string | null>(null);
  const [localIniciadoPorNome, setLocalIniciadoPorNome] = useState<string | null>(null);
  const [localCancelado, setLocalCancelado] = useState(false);
  const [avisos, setAvisos] = useState<{
    exigePoPc: boolean;
    envioBoletoComNota: boolean;
    observacao: string | null;
  } | null>(null);

  const iniciadoEmEfetivo = localCancelado ? null : (localIniciadoEm ?? faturamentoIniciadoEm);
  const iniciadoPorEfetivo = localCancelado ? null : (localIniciadoPorNome ?? faturamentoIniciadoPorNome);

  // Reseta overrides locais quando muda a movimentação alvo ou o dialog reabre.
  useEffect(() => {
    setLocalIniciadoEm(null);
    setLocalIniciadoPorNome(null);
    setLocalCancelado(false);
  }, [movimentacaoId, open]);

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

      // Replica para todos do grupo financeiro (se houver). Quando não há grupo,
      // a RPC atualiza apenas a movimentação alvo.
      const { error } = await supabase.rpc("aplicar_iniciar_faturamento_grupo" as any, {
        p_mov_id: targetMovimentacaoId,
      });
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

      // Atualiza estado local para refletir início imediatamente na UI.
      setLocalIniciadoEm(new Date().toISOString());
      setLocalIniciadoPorNome(nome);
      setLocalCancelado(false);

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
      const { error } = await supabase.rpc("aplicar_cancelar_faturamento_grupo" as any, {
        p_mov_id: movimentacaoId,
      });
      if (error) throw error;
      // Reflete cancelamento imediatamente na UI.
      setLocalCancelado(true);
      setLocalIniciadoEm(null);
      setLocalIniciadoPorNome(null);
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
      // 0) Verifica se a empresa pertence a um grupo financeiro ativo
      const { data: vinc } = await supabase
        .from("grupos_financeiros_contratos" as any)
        .select("grupo_id, grupos_financeiros(nome_grupo, status)")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .maybeSingle();
      const grupoId = (vinc as any)?.grupo_id as string | undefined;
      const grupoNome =
        (vinc as any)?.grupos_financeiros?.status === "Ativo"
          ? ((vinc as any)?.grupos_financeiros?.nome_grupo as string)
          : null;

      // Empresas irmãs do grupo (somente para compartilhar anexos do Financeiro)
      let empresasIrmas: string[] = [];
      if (grupoId) {
        const { data: irmaos } = await supabase
          .from("grupos_financeiros_contratos" as any)
          .select("empresa_id")
          .eq("grupo_id", grupoId)
          .eq("ativo", true);
        empresasIrmas = ((irmaos as any[]) ?? [])
          .map((r) => r.empresa_id)
          .filter((id) => id && id !== empresaId);
      }

      // 1) Movimentações financeiras da empresa atual
      const { data: movsFin } = await supabase
        .from("financeiro_movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movFinIds = (movsFin ?? []).map((m) => m.id);

      // 1b) Movimentações financeiras das empresas irmãs (mesmo período)
      const { data: movsFinIrmaos } = empresasIrmas.length
        ? await supabase
            .from("financeiro_movimentacoes")
            .select("id")
            .in("empresa_id", empresasIrmas)
            .eq("mes_referencia", mesReferencia)
            .eq("periodo", periodo)
        : { data: [] as any[] };
      const movFinIrmaosIds = ((movsFinIrmaos as any[]) ?? []).map((m) => m.id);

      // 2) Movimentações operacionais (cadastro) — só desta empresa
      const { data: movsOp } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .eq("periodo", periodo);
      const movOpIds = (movsOp ?? []).map((m) => m.id);

      // 3) Anexos da implantação — só desta empresa
      const { data: impls } = await supabase
        .from("implantacoes_contratos")
        .select("id")
        .eq("empresa_id", empresaId!);
      const implIds = (impls ?? []).map((i: any) => i.id);

      const [anxFinRes, anxOpRes, anxImplRes, anxFinIrmaosRes] = await Promise.all([
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
        supabase
          .from("implantacao_anexos" as any)
          .select("id, nome_arquivo, storage_path, created_at, uploaded_by, empresa_id, implantacao_id")
          .or(
            `empresa_id.eq.${empresaId}` +
              (implIds.length ? `,implantacao_id.in.(${implIds.join(",")})` : ""),
          )
          .order("created_at", { ascending: false }),
        // Anexos financeiros das empresas irmãs (compartilhados pelo grupo)
        movFinIrmaosIds.length
          ? supabase
              .from("anexos_financeiro")
              .select("id, nome_arquivo, storage_path, created_at, uploaded_by")
              .in("financeiro_movimentacao_id", movFinIrmaosIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (anxFinRes.error) throw anxFinRes.error;
      if (anxOpRes.error) throw anxOpRes.error;
      if ((anxImplRes as any).error) throw (anxImplRes as any).error;

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
      const impl: AnexoRow[] = ((anxImplRes as any).data ?? []).map((a: any) => ({
        ...a,
        bucket: BUCKET_IMPLANTACAO,
        origem_label: "Contrato" as const,
      }));

      // Filtra apenas anexos enviados por usuários com papel "financeiro"
      const irmaosRaw = ((anxFinIrmaosRes as any).data ?? []) as any[];
      const uploadersIrmaos = Array.from(
        new Set(irmaosRaw.map((a) => a.uploaded_by).filter(Boolean) as string[]),
      );
      let financeiroSet = new Set<string>();
      if (uploadersIrmaos.length) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", uploadersIrmaos)
          .eq("role", "financeiro" as any);
        financeiroSet = new Set(((roles as any[]) ?? []).map((r) => r.user_id));
      }

      const sharedLabel =
        `Compartilhado pelo grupo${grupoNome ? ` ${grupoNome}` : ""}` as any;
      const existingPaths = new Set([...fin, ...op, ...impl].map((a) => a.storage_path));
      const grupoExtras: AnexoRow[] = irmaosRaw
        .filter(
          (a) =>
            a.uploaded_by &&
            financeiroSet.has(a.uploaded_by) &&
            !existingPaths.has(a.storage_path),
        )
        .map((a) => ({
          ...a,
          bucket: BUCKET_FINANCEIRO,
          origem_label: sharedLabel,
        }));

      const merged = [...fin, ...op, ...impl, ...grupoExtras].sort(
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

  // Data do PDF anexado na competência anterior (para referência do Financeiro)
  const mesAnterior = (() => {
    if (!mesReferencia) return null;
    const m = /^(\d{4})-(\d{2})/.exec(mesReferencia);
    if (!m) return null;
    let y = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10) - 1;
    if (mo <= 0) { mo = 12; y -= 1; }
    return `${y}-${String(mo).padStart(2, "0")}`;
  })();

  const { data: pdfAnterior } = useQuery<{ created_at: string; nome_arquivo: string } | null>({
    queryKey: ["anexo-pdf-competencia-anterior", empresaId, mesAnterior, periodo],
    enabled: open && !!empresaId && !!mesAnterior,
    queryFn: async () => {
      const { data: movs } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesAnterior!)
        .eq("periodo", periodo);
      const ids = (movs ?? []).map((m) => m.id);
      if (!ids.length) return null;
      const { data: anx } = await supabase
        .from("anexos_movimentacao")
        .select("nome_arquivo, created_at")
        .in("movimentacao_id", ids)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (anx ?? [])[0];
      return row ? { created_at: row.created_at, nome_arquivo: row.nome_arquivo } : null;
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

        {pdfAnterior && (
          <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-foreground">
            <FileText className="h-3.5 w-3.5 text-info shrink-0" />
            <span className="min-w-0">
              Anexo do Cadastro da competência anterior ({mesAnterior}) enviado em{" "}
              <strong className="text-info">{formatDateTime(pdfAnterior.created_at)}</strong>
            </span>
          </div>
        )}

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
                      {(() => {
                        const n = (a.nome_arquivo || "").toLowerCase();
                        if (/\.(xlsx|xlsm|xls|csv)$/.test(n)) return "Excel do faturamento";
                        if (/boleto/.test(n)) return "Boleto";
                        if (n.endsWith(".pdf")) return "PDF da NFS-e";
                        if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "Comprovante";
                        return "Outros";
                      })()}
                      {` · ${formatDateTime(a.created_at)}`}
                      {a.uploader_nome ? ` · Anexado por ${a.uploader_nome}` : ""}
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
            {iniciadoEmEfetivo ? (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 px-3 py-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />
                <div className="flex flex-col leading-tight flex-1 min-w-0">
                  <span className="font-medium text-blue-700 dark:text-blue-200 truncate">
                    Faturamento iniciado{iniciadoPorEfetivo ? ` por ${iniciadoPorEfetivo}` : ""}
                  </span>
                  <span className="text-xs text-blue-600/80 dark:text-blue-300/80">
                    Iniciado às {formatDateTime(iniciadoEmEfetivo)}
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

