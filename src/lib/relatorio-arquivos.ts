import { supabase } from "@/integrations/supabase/client";

export const RELATORIO_BUCKET = "relatorios-movimentacoes";
export const RELATORIO_TABELA = "movimentacao_relatorio_arquivos";
export const RELATORIO_ACCEPT = ".pdf,.xlsx,.xlsm,.xls";

export async function anexarArquivoRelatorio(movimentacaoId: string, usuarioId: string, file: File) {
  if (!/\.(pdf|xlsx|xlsm|xls)$/i.test(file.name)) throw new Error("Selecione um PDF ou Excel.");
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("O arquivo deve ter até 15 MB e não pode estar vazio.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${movimentacaoId}/${usuarioId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(RELATORIO_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from(RELATORIO_TABELA).insert({
    movimentacao_id: movimentacaoId, nome_arquivo: file.name, storage_path: path,
    mime_type: file.type || null, tamanho_bytes: file.size, uploaded_by: usuarioId,
  }).select("id").single();
  if (error) {
    await supabase.storage.from(RELATORIO_BUCKET).remove([path]);
    throw error;
  }
  return data.id;
}