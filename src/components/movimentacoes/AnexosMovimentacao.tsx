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
import { Paperclip, Upload, FileText, FileSpreadsheet, Download, Trash2, AlertCircle, Users, Eye } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_MIME_TYPES,
  formatBytes,
} from "@/lib/financeiro-utils";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";
import { tipoArquivo } from "@/lib/arquivos-utils";
import { formatDateBR } from "@/lib/date-utils";
import { useAnexosMovimentacaoGrupo } from "@/hooks/useAnexosMovimentacaoGrupo";
import { identificarContratoDoAnexo, type ContratoAlvo } from "@/lib/anexo-contrato-match";
import { sincronizarEnvioDosAnexos } from "@/lib/movimentacao-envio-anexos";
import { ImportarArquivosButton } from "./ImportarArquivosButton";
import { ImportarDoRepositorioButton } from "./ImportarDoRepositorioButton";
import type { ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { identificarAnexoImportado, mesmoAnexoImportado } from "@/lib/anexo-importacao";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";


interface Props {
  movimentacaoId: string | null;
  empresaId: string | null;
  mes?: string;
  periodo?: string | null;
  /** Quando true, mostra aviso visual de obrigatoriedade. */
  required?: boolean;
  /** Callback recebe o número atual de anexos. Útil para o pai bloquear o submit. */
  onCountChange?: (count: number) => void;
  /** Callback chamado após upload/exclusão para o pai atualizar indicadores dependentes dos anexos. */
  onAttachmentsChange?: () => void;
  onConcluir?: () => void;
  /** Perfil executivo externo: só "Importar do Repositório"; sem upload manual, exclusão ou preparar fechamento. */
  somenteImportarRepositorio?: boolean;
}

const STORAGE_BUCKET = "anexos-movimentacoes";
const ACCEPTED_FOR_MOV = `${ACCEPTED_FILE_TYPES},.png,.jpg,.jpeg,.webp`;

function buildPath(empresaId: string, movId: string, fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  return `${empresaId}/${movId}/${crypto.randomUUID()}.${ext}`;
}

export function AnexosMovimentacao({ movimentacaoId, empresaId, mes, periodo, required, onCountChange, onAttachmentsChange, onConcluir, somenteImportarRepositorio = false }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importandoRepositorio, setImportandoRepositorio] = useState(false);
  const [preview, setPreview] = useState<{ storage_path: string; nome_arquivo: string; mime_type: string | null } | null>(null);
  const [alvoExclusao, setAlvoExclusao] = useState<{ id: string; path: string; nome: string; tipo: string; criadoEm: string; origem?: string | null } | null>(null);
  const [registrarObs, setRegistrarObs] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const { data: grupoData } = useAnexosMovimentacaoGrupo(movimentacaoId);
  const anexos = grupoData?.anexos ?? [];
  const grupoInfo = grupoData?.grupo;


  // notifica pai sobre quantidade
  if (onCountChange) {
    queueMicrotask(() => onCountChange(anexos.length));
  }

  type ItemUpload = {
    file: File;
    alvoEmpresaId: string;
    alvoMovId: string;
    contratoRotulo: string;
    periodo: string | null;
    mes: string | null;
    redirecionado: boolean;
    aviso?: string;
    automatico?: boolean;
    repositorioEnvioId?: string;
  };
  const [pendente, setPendente] = useState<ItemUpload[] | null>(null);

  const rotuloContrato = (a?: ContratoAlvo | null) =>
    a ? `${a.codigo ?? ""} ${a.nome ?? ""}`.trim() || "contrato" : "este contrato";

  const formatMes = (mes: string | null) => {
    if (!mes) return "";
    const [ano, m] = mes.split("-");
    return `${m}/${ano}`;
  };

  // Passo 1: descobre para qual contrato/período cada arquivo vai.
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !movimentacaoId || !empresaId) return;

    setUploading(true);
    try {
      // Grupo Financeiro (empresarial) ou Administradora: identificar pelo nome do arquivo o contrato
      let alvos: ContratoAlvo[] = [];
      let movAtual: { mes_referencia: string; periodo: string | null } | null = null;
      const { data: empAtual } = await supabase
        .from("empresas").select("tipo_contrato").eq("id", empresaId).maybeSingle();
      const ehAdministradora = (empAtual as any)?.tipo_contrato === "ADMINISTRADORA";
      let emps: any[] | null = null;
      if (ehAdministradora) {
        const { data } = await supabase.from("empresas").select("id, nome, codigo_contrato, cnpj").eq("tipo_contrato", "ADMINISTRADORA");
        emps = data as any[];
      } else if (grupoInfo?.grupoId && (grupoInfo.empresas?.length ?? 0) > 1) {
        const ids = grupoInfo.empresas.map((e) => e.empresa_id);
        const { data } = await supabase.from("empresas").select("id, nome, codigo_contrato, cnpj").in("id", ids);
        emps = data as any[];
      }
      if (emps?.length) {
        const { data: mv } = await supabase.from("movimentacoes").select("mes_referencia, periodo").eq("id", movimentacaoId).maybeSingle();
        alvos = emps.map((e) => ({
          empresaId: e.id, nome: e.nome, codigo: e.codigo_contrato, cnpj: e.cnpj,
        }));
        movAtual = (mv as any) ?? null;
      }

      const atual = alvos.find((x) => x.empresaId === empresaId) ?? null;
      const itens: ItemUpload[] = [];
      for (const file of files) {
        const item: ItemUpload = {
          file,
          alvoEmpresaId: empresaId,
          alvoMovId: movimentacaoId,
          contratoRotulo: rotuloContrato(atual),
          periodo: movAtual?.periodo ?? null,
          mes: movAtual?.mes_referencia ?? null,
          redirecionado: false,
        };
        if (alvos.length && movAtual) {
          const match = identificarContratoDoAnexo(file.name, alvos);
          if (match && match.empresaId !== empresaId) {
            let q = supabase
              .from("movimentacoes")
              .select("id, periodo, mes_referencia")
              .eq("empresa_id", match.empresaId)
              .eq("mes_referencia", movAtual.mes_referencia);
            // Administradoras têm períodos diferentes por contrato: vale só o mês.
            q = !ehAdministradora && movAtual.periodo ? q.eq("periodo", movAtual.periodo) : q;
            const { data: irm } = await q.limit(1).maybeSingle();
            const a = alvos.find((x) => x.empresaId === match.empresaId);
            if ((irm as any)?.id) {
              item.alvoEmpresaId = match.empresaId;
              item.alvoMovId = (irm as any).id;
              item.contratoRotulo = rotuloContrato(a);
              item.periodo = (irm as any).periodo ?? null;
              item.mes = (irm as any).mes_referencia ?? item.mes;
              item.redirecionado = true;
            } else {
              item.aviso = `Parece ser do contrato ${rotuloContrato(a)}, mas ele não tem movimentação neste mês/período. Ficará neste contrato.`;
            }
          }
        }
        itens.push(item);
      }

      // Com grupo/administradora, pede autorização antes de enviar.
      if (alvos.length) {
        setPendente(itens);
        return;
      }
      await executarUpload(itens);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const confirmarDirecionamento = async () => {
    if (!pendente) return;
    const itens = pendente;
    setPendente(null);
    setUploading(true);
    try {
      await executarUpload(itens);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Passo 2: envia de fato, já com o destino autorizado.
  const executarUpload = async (itens: ItemUpload[]) => {
    if (!empresaId || !movimentacaoId) return;
    {
      for (const { file, alvoEmpresaId, alvoMovId, automatico, repositorioEnvioId } of itens) {

        // Preserva a origem autorizada no caminho; o registro aponta para o destino.
        const path = buildPath(empresaId, movimentacaoId, file.name);
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file);
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("anexos_movimentacao").insert({
          movimentacao_id: alvoMovId,
          empresa_id: alvoEmpresaId,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type || null,
          tamanho_bytes: file.size,
          uploaded_by: user?.id ?? null,
          ...(automatico ? { origem_importacao: "API" } : {}),
          ...(repositorioEnvioId ? { repositorio_envio_id: repositorioEnvioId } : {}),
        });
        if (insErr) {
          await supabase.storage.from(STORAGE_BUCKET).remove([path]);
          throw insErr;
        }

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
                  .eq("id", alvoEmpresaId);
                if (updErr) throw updErr;
                const empresaId = alvoEmpresaId;


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
      try {
        const { data: origem, error } = await supabase.from("movimentacoes")
          .select("data_envio_financeiro, mes_referencia")
          .eq("id", movimentacaoId).single();
        if (error) throw error;
        if (origem.data_envio_financeiro) {
          await sincronizarEnvioDosAnexos(movimentacaoId, origem.data_envio_financeiro, origem.mes_referencia);
        }
      } catch {
        toast.warning('Os arquivos foram anexados, mas a data de envio não foi repetida. Salve a movimentação novamente.');
      }
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movs-administradoras"] });
      queryClient.invalidateQueries({ queryKey: ["anexos-movimentacao-grupo"] });
      queryClient.invalidateQueries({ queryKey: ["historico-fechamento", movimentacaoId] });
      onAttachmentsChange?.();
      toast.success(itens.length > 1 ? `${itens.length} arquivos enviados` : "Arquivo enviado");
    }
  };

  const importarArquivo = async (arquivo: ArquivoPortal, signal: AbortSignal): Promise<"ignorado" | void> => {
    if (!empresaId || !movimentacaoId) throw new Error("Movimentação indisponível.");
    signal.throwIfAborted();
    if (!identificarAnexoImportado(arquivo.nome_arquivo).aceito) throw new Error("Formato não permitido para importação.");
    // Nome, contrato, tipo e competência de destino determinam a identidade; não substitui anexos.
    const { data: existentes, error } = await supabase.from("anexos_movimentacao")
      .select("nome_arquivo, empresa_id, movimentacao_id, repositorio_envio_id, storage_path").eq("movimentacao_id", movimentacaoId);
    if (error) throw error;
    if (arquivo.repositorio_envio_id) {
      if ((existentes ?? []).some(a => a.repositorio_envio_id === arquivo.repositorio_envio_id)) return "ignorado";
      // Um nome igual pode conter bytes de uma versão antiga. Só ignorar cópia idêntica.
      const hash = await crypto.subtle.digest("SHA-256", await arquivo.blob.arrayBuffer());
      for (const existente of existentes ?? []) {
        if (existente.nome_arquivo !== arquivo.nome_arquivo) continue;
        const { data: copia, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(existente.storage_path);
        if (downloadError) throw downloadError;
        const outro = await crypto.subtle.digest("SHA-256", await copia.arrayBuffer());
        if (new Uint8Array(hash).every((v, i) => v === new Uint8Array(outro)[i])) return "ignorado";
      }
    } else if ((existentes ?? []).some(existente => mesmoAnexoImportado(existente, {
      nome: arquivo.nome_arquivo, contrato: arquivo.nr_contrato, empresaId, movimentacaoId,
    }))) return "ignorado";
    signal.throwIfAborted();
    await executarUpload([{
      file: new File([arquivo.blob], arquivo.nome_arquivo, { type: arquivo.blob.type }),
      alvoEmpresaId: empresaId, alvoMovId: movimentacaoId, contratoRotulo: String(arquivo.nr_contrato),
      periodo: periodo ?? null, mes: mes ?? null, redirecionado: false, automatico: true,
      repositorioEnvioId: arquivo.repositorio_envio_id,
    }]);
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
    <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="h-4 w-4 text-info" />
        Anexos {required && <span className="text-destructive">*</span>}
        <span className="text-muted-foreground font-normal">({anexos.length})</span>
      </div>
      {/* Ações secundárias em uma linha; quebram em duas sem bagunçar o layout. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
         <ImportarDoRepositorioButton movimentacaoId={movimentacaoId} empresaId={empresaId} mes={mes} periodo={periodo}
          disabled={uploading || importando || !!pendente} onBusy={setImportandoRepositorio} onImportar={importarArquivo} />
        {!somenteImportarRepositorio && (
        <label className={`cursor-pointer ${!movimentacaoId || uploading || importando || importandoRepositorio ? "opacity-50 pointer-events-none" : ""}`}>
          <input
            type="file"
            multiple
            className="hidden"
            accept={ACCEPTED_FOR_MOV}
            onChange={handleUpload}
            disabled={uploading || importando || importandoRepositorio || !movimentacaoId}
           />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/60 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Anexar manualmente"}
          </span>
        </label>
        )}
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

      {anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum anexo adicionado.
        </p>
      ) : (
        <ul aria-label="Arquivos anexados" className="min-w-0 max-w-full space-y-2">
          {anexos.map((a) => {
            const ext = (a.nome_arquivo.split(".").pop() || "").toLowerCase();
            const info = identificarAnexoImportado(a.nome_arquivo);
            const isExcel = ["xlsx", "xlsm", "xls"].includes(ext);
            const origemAutomatica = (a as any).origem_importacao === "API";
            return (
              <li
                key={a.id}
                className="flex min-w-0 max-w-full items-start gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5"
              >
                 {isExcel ? <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium" title={a.nome_arquivo}>{info.tipo === "Outros" ? a.nome_arquivo : info.tipo}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isExcel ? "Excel" : ext.toUpperCase()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {a.repositorio_envio_id ? "Importado do Repositório de Envios" : origemAutomatica ? "Importado automaticamente" : "Anexado manualmente"}
                </p>
                  {a.do_grupo && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info align-middle"
                       title={`Anexo do contrato ${a.origem_empresa ?? "do grupo"}`}
                    >
                      <Users className="h-2.5 w-2.5" />
                      Do grupo
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                {["pdf", "png", "jpg", "jpeg", "webp", "gif"].includes(ext) && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" aria-label={`Visualizar ${a.nome_arquivo}`} onClick={() => setPreview(a)}><Eye className="h-3.5 w-3.5" /></Button>}
                 {isExcel ? (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-info hover:text-info" title="Extrair Vidas Ativas" onClick={() => handleExtrairVidas(a.storage_path, a.nome_arquivo)}>
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                ) : <span />}
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Baixar" aria-label={`Baixar ${a.nome_arquivo}`} onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                   aria-label={`Remover ${a.nome_arquivo}`}
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
                </div>

              </li>
            );
          })}

        </ul>
      )}

      <div className="border-t border-border/40 pt-3">
        <ImportarArquivosButton compacto movimentacaoId={movimentacaoId} empresaId={empresaId} mes={mes} periodo={periodo}
          disabled={uploading || importandoRepositorio || !!pendente} onBusy={setImportando} onImportar={importarArquivo} onConcluir={onConcluir} />
      </div>
      {preview && <PreviewArquivoDialog open onOpenChange={open => { if (!open) setPreview(null); }} bucket={STORAGE_BUCKET} storagePath={preview.storage_path} nomeArquivo={preview.nome_arquivo} mimeType={preview.mime_type} />}
      <AlertDialog
        open={!!pendente}
        onOpenChange={(v) => {
          if (!v) setPendente(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar para onde vai cada anexo</AlertDialogTitle>
            <AlertDialogDescription>
              O sistema leu o código do contrato no nome do arquivo. Os anexos só serão enviados depois da sua autorização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {(pendente ?? []).map((it, i) => (
              <li key={i} className="rounded-md border border-border bg-muted/40 p-2">
                <div className="truncate font-medium" title={it.file.name}>{it.file.name}</div>
                <div className="text-xs text-muted-foreground">
                  Vai para: <strong className="text-foreground">{it.contratoRotulo}</strong>
                  {it.mes && <> · mês {formatMes(it.mes)}</>}
                  {it.periodo && <> · período {it.periodo}</>}
                  {!it.redirecionado && !it.aviso && " (contrato que você abriu)"}
                </div>
                {it.aviso && <div className="mt-1 text-xs text-warning">{it.aviso}</div>}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarDirecionamento();
              }}
            >
              Autorizar e anexar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              {alvoExclusao?.origem && ` Este anexo pertence a ${alvoExclusao.origem} e deixará de aparecer para todos os contratos do grupo.`}
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

