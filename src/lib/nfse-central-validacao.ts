import { supabase } from "@/integrations/supabase/client";

/** Pede ao servidor a reavaliação de um recebimento. O navegador não envia valores nem resultados. */
export async function reavaliarRecebimento(recebimentoId: string) {
  const { data, error } = await supabase.functions.invoke("processar-recebimento-central", { body: { recebimento_id: recebimentoId } });
  if (error) throw error;
  return data as { estado: string; motivo?: string | null };
}
