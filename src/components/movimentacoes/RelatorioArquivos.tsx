import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { anexarArquivoRelatorio, RELATORIO_ACCEPT, RELATORIO_BUCKET, RELATORIO_TABELA } from "@/lib/relatorio-arquivos";

export function RelatorioArquivos({ movimentacaoId, canEdit, ocupado, selecionados, onSelecionados, onBusy }: {
  movimentacaoId: string; canEdit: boolean; ocupado: boolean; selecionados: string[];
  onSelecionados: (ids: string[]) => void; onBusy: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [excluir, setExcluir] = useState<{ id: string; nome: string; path: string } | null>(null);
  const queryKey = ["relatorio-anexos-email", movimentacaoId];
  const arquivos = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await supabase.from(RELATORIO_TABELA).select("id, nome_arquivo, storage_path").eq("movimentacao_id", movimentacaoId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }});
  const upload = useMutation({ mutationFn: async (files: File[]) => {
    if (!canEdit || !user) throw new Error("Sem permissão para anexar relatórios.");
    onBusy(true);
    const novos = [...selecionados];
    for (const file of files) {
      const id = await anexarArquivoRelatorio(movimentacaoId, user.id, file);
      novos.push(id);
      onSelecionados([...novos]);
    }
  }, onSuccess: () => toast({ title: "Relatórios anexados" }),
  onError: (e: Error) => toast({ title: "Não foi possível anexar", description: e.message, variant: "destructive" }),
  onSettled: async () => { await queryClient.invalidateQueries({ queryKey }); onBusy(false); } });
  const remover = useMutation({ mutationFn: async () => {
    if (!excluir || !canEdit) return;
    onBusy(true);
    const { error: storageError } = await supabase.storage.from(RELATORIO_BUCKET).remove([excluir.path]);
    if (storageError) throw storageError;
    const { error, data } = await supabase.from(RELATORIO_TABELA).delete().eq("id", excluir.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Sem permissão para excluir este relatório.");
    onSelecionados(selecionados.filter(id => id !== excluir.id));
  }, onSuccess: () => { setExcluir(null); toast({ title: "Relatório excluído" }); },
  onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  onSettled: async () => { await queryClient.invalidateQueries({ queryKey }); onBusy(false); } });
  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from(RELATORIO_BUCKET).createSignedUrl(path, 60);
    if (error) { toast({ title: "Não foi possível abrir o arquivo", description: error.message, variant: "destructive" }); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium">Arquivos do relatório</span>
      {canEdit && <><input ref={input} type="file" className="hidden" multiple accept={RELATORIO_ACCEPT} disabled={ocupado} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) upload.mutate(files); }} />
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => input.current?.click()}><Paperclip className="mr-2 h-4 w-4" />{upload.isPending ? "Anexando..." : "Anexar relatórios"}</Button></>}
    </div>
    {arquivos.isLoading ? <p className="text-sm text-muted-foreground">Carregando arquivos...</p> : arquivos.isError ? <p className="text-sm text-destructive">Não foi possível carregar os relatórios.</p> : !arquivos.data?.length ? <p className="text-sm text-muted-foreground">Nenhum relatório anexado.</p> : arquivos.data.map(a => <div key={a.id} className="flex items-center gap-2 text-sm">
      {canEdit && <Checkbox aria-label={`Selecionar ${a.nome_arquivo}`} checked={selecionados.includes(a.id)} disabled={ocupado} onCheckedChange={v => onSelecionados(v ? [...selecionados, a.id] : selecionados.filter(x => x !== a.id))} />}
      <span className="min-w-0 flex-1 break-all">{a.nome_arquivo}</span>
      <Button type="button" variant="ghost" size="icon" title="Visualizar relatório" aria-label={`Visualizar ${a.nome_arquivo}`} onClick={() => baixar(a.storage_path)}><Download className="h-4 w-4" /></Button>
      {canEdit && <Button type="button" variant="ghost" size="icon" title="Excluir relatório" aria-label={`Excluir ${a.nome_arquivo}`} disabled={ocupado} onClick={() => setExcluir({ id: a.id, nome: a.nome_arquivo, path: a.storage_path })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
    </div>)}
    <AlertDialog open={!!excluir} onOpenChange={open => { if (!open && !remover.isPending) setExcluir(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir relatório?</AlertDialogTitle><AlertDialogDescription>{excluir?.nome}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remover.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remover.isPending} onClick={e => { e.preventDefault(); remover.mutate(); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}