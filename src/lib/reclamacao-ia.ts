import { supabase } from "@/integrations/supabase/client";
import { SETORES, TIPOS, getReclamacoesDisponiveis } from "./constants";

export type ClassificacaoIA = { setor_responsavel: string; tipo_reclamacao: string; reclamacao: string };
export function validarClassificacaoIA(v: ClassificacaoIA) {
  return SETORES.includes(v.setor_responsavel) && TIPOS.includes(v.tipo_reclamacao) && getReclamacoesDisponiveis(v.setor_responsavel, v.tipo_reclamacao).includes(v.reclamacao);
}
export async function sugerirReclamacao(empresa: string, detalhamento: string, signal: AbortSignal): Promise<ClassificacaoIA> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Entre novamente para usar a IA");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sugerir-reclamacao`, {
    method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ empresa, detalhamento }), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error?.message || error.error || `Falha na IA (${response.status})`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("A IA não retornou uma resposta");
  const decoder = new TextDecoder();
  let buffer = "", text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "response.output_text.delta") text += event.delta;
      if (event.type === "response.refusal.delta") throw new Error(event.delta || "A IA não pode classificar esta solicitação");
      if (event.type === "error" || event.type === "response.failed") throw new Error(event.message || event.response?.error?.message || "Falha na classificação de IA");
    }
  }
  if (!text.trim()) throw new Error("A IA não retornou uma classificação");
  const result: ClassificacaoIA = JSON.parse(text);
  if (!validarClassificacaoIA(result)) throw new Error("A IA retornou uma combinação inválida; selecione os campos manualmente");
  return result;
}