import { supabase } from "@/integrations/supabase/client";

/** Repete a data somente nos destinos dos arquivos enviados pela origem. */
export async function sincronizarEnvioDosAnexos(origemId: string, dataEnvio: string, mes: string) {
  const { data: anexos, error } = await supabase
    .from("anexos_movimentacao")
    .select("movimentacao_id")
    .like("storage_path", `%/${origemId}/%`)
    .neq("movimentacao_id", origemId);
  if (error) throw error;
  const destinos = [...new Set((anexos ?? []).map((a) => a.movimentacao_id))];
  if (!destinos.length) return;
  const { error: updateError } = await supabase.from("movimentacoes")
    .update({ data_envio_financeiro: dataEnvio })
    .in("id", destinos)
    .eq("mes_referencia", mes)
    .is("data_envio_financeiro", null);
  if (updateError) throw updateError;
}