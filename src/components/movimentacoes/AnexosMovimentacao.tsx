import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Paperclip, Upload, FileText, Download, Trash2, AlertCircle, Users } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_MIME_TYPES,
  formatBytes,
} from "@/lib/financeiro-utils";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";
import { tipoArquivo } from "@/lib/arquivos-utils";
import { formatDateBR } from "@/lib/date-utils";
import { useAnexosMovimentacaoGrupo } from "@/hooks/useAnexosMovimentacaoGrupo";


interface Props {
  movimentacaoId: string | null;
  empresaId: string | null;
  /** Quando true, mostra aviso visual de obrigatoriedade. */
  required?: boolean;
  /** Callback recebe o número atual de anexos. Útil para o pai bloquear o submit. */
  onCountChange?: (count: number) => void;
  /** Callback chamado após upload/exclusão para o pai atualizar indicadores dependentes dos anexos. */
  onAttachmentsChange?: () => void;
}

const STORAGE_BUCKET = "anexos-movimentacoes";
const ACCEPTED_FOR_MOV = `${ACCEPTED_FILE_TYPES},.png,.jpg,.jpeg,.webp`;

function buildPath(empresaId: string, movId: string, fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  return `${empresaId}/${movId}/${crypto.randomUUID()}.${ext}`;
}

export function AnexosMovimentacao({ movimentacaoId, empresaId, required, onCountChange, onAttachmentsChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [alvoExclusao, setAlvoExclusao] = useState<{ id: string; path: string; nome: string; tipo: string; criadoEm: string } | null>(null);
  const [registrarObs, setRegistrarObs] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const { data: grupoData } = useAnexosMovimentacaoGrupo(movimentacaoId);
  const anexos = grupoData?.anexos ?? [];
  const grupoInfo = grupoData?.grupo;


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
                if (updErr) throw updErr;

                queryClient.setQueriesData({ queryKey: ["movimentacoes-dashboard"] }, (old: any) => {
                  if (!Array.isArray(old)) return old;
                  return old.map((mov) => mov?.empresa_id === empresaId
                    ? { ...mov, empresas: mov.empresas ? { ...mov.empresas, vidas } : mov.empresas }
                    : mov);
                });
                toast.success(`Vidas Ativas atualizadas pelo layout: ${vidas}`);
                queryClient.invalidateQueries({ queryKey: ["empresas"] });
                queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
              }
            }
          } catch (err) {
            console.warn("Análise automática do layout falhou:", err);
            toast.error("Não foi possível atualizar Vidas Ativas pelo layout anexado.");
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["anexos-movimentacao-grupo", movimentacaoId] });
      onAttachmentsChange?.();
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

  const registrarObservacaoExclusao = async (nomeArquivo: string, tipo: string, criadoEm: string) => {
    if (!movimentacaoId) return;
    try {
      const { data: mov } = await supabase
        .from("movimentacoes")
        .select("observacoes")
        .eq("id", movimentacaoId)
        .maybeSingle();
      let autor = user?.email ?? "Usuário";
      if (user?.id) {
        const { data: nomes } = await supabase.rpc("get_user_display_names", { _ids: [user.id] });
        const nome = (nomes as any[] | null)?.[0]?.display_name;
        if (nome) autor = nome;
      }
      const agora = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const anexadoEm = formatDateBR(criadoEm);
      const entrada = `[${agora} — ${autor}] Anexo "${nomeArquivo}" (Tipo: ${tipo}, anexado em ${anexadoEm}) foi deletado a pedido do financeiro.`;
      const anteriores = (mov?.observacoes ?? "").trim();
      const { error } = await supabase
        .from("movimentacoes")
        .update({ observacoes: anteriores ? `${anteriores}\n${entrada}` : entrada })
        .eq("id", movimentacaoId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["anexos-mov-dialog", movimentacaoId] });
    } catch (err: any) {
      toast.error("Anexo excluído, mas não foi possível registrar a observação.");
    }
  };

  const confirmarExclusao = async () => {
    if (!alvoExclusao) return;
    const { id, path, nome, tipo, criadoEm } = alvoExclusao;
    setExcluindo(true);
    try {
      const { data: deleted, error } = await supabase
        .from("anexos_movimentacao")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        toast.error("Você não tem permissão para excluir este anexo.");
        return;
      }
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      if (registrarObs) await registrarObservacaoExclusao(nome, tipo, criadoEm);
      queryClient.invalidateQueries({ queryKey: ["anexos-movimentacao-grupo", movimentacaoId] });
      onAttachmentsChange?.();
      toast.success("Anexo excluído");
      setAlvoExclusao(null);
      setRegistrarObs(false);
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    } finally {
      setExcluindo(false);
    }
  };


  const handleExtrairVidas = async (path: string, nome: string) => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
      if (error) throw error;
      const buffer = await data.arrayBuffer();
      const sig = new Uint8Array(buffer.slice(0, 4));
      if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
        toast.error("Arquivo não é um Excel válido (.xlsx)");
        return;
      }
      const result = await validarRelatorioVidas(buffer);
      const vidas = result?.total_vidas ?? 0;
      if (vidas <= 0) {
        toast.warning(`Nenhuma vida identificada em ${nome}`);
        return;
      }
      const { error: updErr } = await supabase
        .from("empresas")
        .update({ vidas, updated_at: new Date().toISOString() })
        .eq("id", empresaId);
      if (updErr) throw updErr;
      toast.success(`Vidas Ativas atualizadas: ${vidas}`);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    } catch (err: any) {
      toast.error("Erro ao extrair vidas: " + err.message);
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

      {grupoInfo?.grupoId && (
        <p className="text-[11px] text-info flex items-center gap-1">
          <Users className="h-3 w-3" />
          Grupo: {grupoInfo.nomeGrupo}
          {grupoInfo.ehPrincipal
            ? " · contrato principal — os anexos aparecem em todos os contratos do grupo."
            : grupoInfo.ehSecundario
              ? " · anexos do contrato principal são exibidos aqui."
              : " · anexos compartilhados entre os contratos do grupo."}
        </p>
      )}

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
          {anexos.map((a) => {
            const ext = (a.nome_arquivo.split(".").pop() || "").toLowerCase();
            const isExcel = ["xlsx", "xlsm", "xls"].includes(ext);
            return (
              <li
                key={a.id}
                className="grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 truncate" title={a.nome_arquivo}>
                  {a.nome_arquivo}
                  {a.do_grupo && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info align-middle"
                      title={`Anexo do contrato ${a.origem_empresa ?? "do grupo"}`}
                    >
                      <Users className="h-2.5 w-2.5" />
                      Do grupo
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{formatBytes(a.tamanho_bytes)}</span>
                {isExcel ? (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-info hover:text-info" title="Extrair Vidas Ativas" onClick={() => handleExtrairVidas(a.storage_path, a.nome_arquivo)}>
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                ) : <span />}
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  title={a.do_grupo ? `Excluir anexo do contrato ${a.origem_empresa ?? "do grupo"}` : "Excluir anexo"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRegistrarObs(false);
                    setAlvoExclusao({
                      id: a.id,
                      path: a.storage_path,
                      nome: a.nome_arquivo,
                      tipo: tipoArquivo(a.nome_arquivo.split(".").pop()),
                      criadoEm: a.created_at,
                      origem: a.do_grupo ? a.origem_empresa ?? "outro contrato do grupo" : null,
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

              </li>
            );
          })}

        </ul>
      )}

      <AlertDialog
        open={!!alvoExclusao}
        onOpenChange={(v) => {
          if (!v && !excluindo) {
            setAlvoExclusao(null);
            setRegistrarObs(false);
          }
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvoExclusao?.nome
                ? `O arquivo "${alvoExclusao.nome}" será removido permanentemente.`
                : "O arquivo será removido permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 cursor-pointer">
            <Checkbox
              checked={registrarObs}
              onCheckedChange={(v) => setRegistrarObs(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed">
              Registrar na observação que o anexo foi <strong>deletado a pedido do financeiro</strong>.
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

