import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, Eye, Download, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { PreviewArquivoDialog } from "@/components/arquivos/PreviewArquivoDialog";

const BUCKET = "anexos-movimentacoes";

interface Props {
  movimentacaoId: string | null;
  empresaNome?: string | null;
  mesReferencia?: string | null;
  periodo?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tipoArquivo(nome: string) {
  const n = (nome || "").toLowerCase();
  if (/\.(xlsx|xlsm|xls|csv)$/.test(n)) return "Excel do faturamento";
  if (/boleto/.test(n)) return "Boleto";
  if (n.endsWith(".pdf")) return "PDF da NFS-e";
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "Comprovante";
  return "Outros";
}

export function AnexosMovimentacaoDialog({
  movimentacaoId,
  empresaNome,
  mesReferencia,
  periodo,
  open,
  onOpenChange,
}: Props) {
  const [preview, setPreview] = useState<{ storage_path: string; nome_arquivo: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["anexos-mov-dialog", movimentacaoId],
    enabled: open && !!movimentacaoId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: mov, error: movErr } = await supabase
        .from("movimentacoes")
        .select("empresa_id, mes_referencia, periodo, observacoes")
        .eq("id", movimentacaoId as string)
        .single();
      if (movErr && movErr.code !== "PGRST116") throw movErr;

      // Grupo Financeiro: anexos e observações do contrato principal são compartilhados
      let irmaosMovIds: string[] = [];
      let nomePorEmpresa = new Map<string, string | null>();
      let observacoesPrincipal = "";
      let nomeGrupo: string | null = null;
      if (mov?.empresa_id) {
        const { data: vinc } = await supabase
          .from("grupos_financeiros_contratos" as any)
          .select("grupo_id")
          .eq("empresa_id", mov.empresa_id)
          .eq("ativo", true)
          .maybeSingle();
        const grupoId = (vinc as any)?.grupo_id as string | undefined;
        if (grupoId) {
          const [{ data: grupo }, { data: contratos }] = await Promise.all([
            supabase
              .from("grupos_financeiros" as any)
              .select("nome_grupo, status, contrato_principal_empresa_id")
              .eq("id", grupoId)
              .maybeSingle(),
            supabase
              .from("grupos_financeiros_contratos" as any)
              .select("empresa_id, nome_empresa")
              .eq("grupo_id", grupoId)
              .eq("ativo", true),
          ]);
          if (grupo && (grupo as any).status === "Ativo") {
            nomeGrupo = (grupo as any).nome_grupo ?? null;
            const lista = ((contratos as any[]) ?? []) as { empresa_id: string; nome_empresa: string | null }[];
            nomePorEmpresa = new Map(lista.map((c) => [c.empresa_id, c.nome_empresa]));
            const outras = lista.map((c) => c.empresa_id).filter((id) => id !== mov.empresa_id);
            if (outras.length) {
              const { data: irmaos } = await supabase
                .from("movimentacoes")
                .select("id, empresa_id, observacoes")
                .in("empresa_id", outras)
                .eq("mes_referencia", mov.mes_referencia)
                .eq("periodo", mov.periodo);
              const rows = ((irmaos as any[]) ?? []);
              irmaosMovIds = rows.map((r) => r.id as string);
              const principalId = (grupo as any).contrato_principal_empresa_id as string | null;
              if (principalId && principalId !== mov.empresa_id) {
                observacoesPrincipal = (rows.find((r) => r.empresa_id === principalId)?.observacoes ?? "").trim();
              }
            }
          }
        }
      }

      const { data: anexos, error: anexosErr } = await supabase
        .from("anexos_movimentacao")
        .select("id, nome_arquivo, storage_path, created_at, uploaded_by, movimentacao_id, empresa_id")
        .in("movimentacao_id", [movimentacaoId as string, ...irmaosMovIds])
        .order("created_at", { ascending: false });
      if (anexosErr) throw anexosErr;

      const ids = Array.from(
        new Set((anexos ?? []).map((a) => a.uploaded_by).filter(Boolean)),
      ) as string[];
      const nomes = new Map<string, string>();
      if (ids.length) {
        const { data: users } = await supabase.rpc("get_user_display_names", { _ids: ids });
        (users ?? []).forEach((u: any) => nomes.set(u.user_id, u.display_name));
      }
      return {
        nomeGrupo,
        anexos: (anexos ?? []).map((a) => ({
          ...a,
          autor: a.uploaded_by ? nomes.get(a.uploaded_by) ?? "Usuário" : null,
          do_grupo: a.movimentacao_id !== movimentacaoId,
          origem_empresa:
            a.movimentacao_id !== movimentacaoId ? nomePorEmpresa.get(a.empresa_id) ?? null : null,
        })),
        observacoes: (mov?.observacoes ?? "").trim(),
        observacoesPrincipal,
      };
    },
  });


  const handleDownload = async (storagePath: string, nome: string) => {
    const { data: file, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !file) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
      if (signed?.signedUrl) {
        window.open(signed.signedUrl, "_blank", "noopener");
        return;
      }
      toast.error("Erro ao baixar arquivo");
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-info" />
            Anexos do processo
          </DialogTitle>
          <DialogDescription>
            {[empresaNome, mesReferencia, periodo].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto space-y-5">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquareText className="h-4 w-4 text-info" />
                  Observações
                </h4>
                {data?.observacoes ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data.observacoes
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((linha, i) => {
                        const match = linha.match(/^\[(\d{2}\/\d{2}\/\d{4}(?:, \d{2}:\d{2})?) — ([^\]]+)\]\s*(.*)$/s);
                        const dataHora = match?.[1] ?? null;
                        const autor = match?.[2] ?? null;
                        const texto = match?.[3] ?? linha;
                        return (
                          <div
                            key={i}
                            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                          >
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                              {texto}
                            </p>
                            {(dataHora || autor) && (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                  {(autor || "U").charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate max-w-[180px]">{autor}</span>
                                {dataHora && (
                                  <>
                                    <span className="text-border">•</span>
                                    <span>{dataHora}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
                  </div>
                )}

                {data?.observacoesPrincipal && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-info flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Observações do contrato principal do grupo{data.nomeGrupo ? ` (${data.nomeGrupo})` : ""}
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {data.observacoesPrincipal
                        .split("\n")
                        .filter((l) => l.trim())
                        .map((linha, i) => (
                          <div key={i} className="rounded-xl border border-info/30 bg-info/5 p-3">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                              {linha}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Paperclip className="h-4 w-4 text-info" />
                  Anexos
                </h4>
                {!data?.anexos.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/30">
                    Nenhum anexo encontrado para este processo.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.anexos.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" title={a.nome_arquivo}>
                            {a.nome_arquivo}
                            {a.do_grupo && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info align-middle">
                                <Users className="h-2.5 w-2.5" />
                                Do grupo
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {tipoArquivo(a.nome_arquivo)}
                            {` · ${formatDateTime(a.created_at)}`}
                            {a.autor ? ` · Anexado por ${a.autor}` : ""}
                            {a.do_grupo ? ` · ${a.origem_empresa ?? "Contrato do grupo"}` : " · Cadastro"}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Visualizar"
                          onClick={() => setPreview({ storage_path: a.storage_path, nome_arquivo: a.nome_arquivo })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Download"
                          onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {preview && (
        <PreviewArquivoDialog
          open={!!preview}
          onOpenChange={(v) => !v && setPreview(null)}
          bucket={BUCKET}
          storagePath={preview.storage_path}
          nomeArquivo={preview.nome_arquivo}
        />
      )}
    </Dialog>
  );
}
