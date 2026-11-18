import { supabase } from "@/integrations/supabase/client";

export const ORIGEM_PADRAO_INCLUSAO = "Relatório atualizado SIGA";

/** Deixa o CPF só com números (123.456.789-00 → 12345678900). Retorna null se não tiver 11 dígitos. */
export function normalizarCpf(cpf: string | null | undefined): string | null {
  const d = String(cpf ?? "").replace(/\D/g, "");
  if (!d) return null;
  const p = d.padStart(11, "0");
  return p.length === 11 ? p : null;
}

export interface InclusaoVigenciaNova {
  empresa_id: string;
  contrato_id: string;
  fechamento_id: string;
  cpf: string;
  beneficiario_nome?: string | null;
  data_adesao: string; // YYYY-MM-DD
  data_identificacao?: string;
  origem?: string;
}

export function chaveInclusao(i: Pick<InclusaoVigenciaNova, "empresa_id" | "contrato_id" | "fechamento_id" | "cpf" | "data_adesao">): string {
  return [i.empresa_id, String(i.contrato_id).trim(), normalizarCpf(i.cpf) ?? "", i.data_adesao, i.fechamento_id].join("|");
}

/** Remove CPFs inválidos e repetidos (mesma empresa, contrato, CPF, adesão e fechamento), mantendo o primeiro. */
export function deduplicarInclusoes(itens: InclusaoVigenciaNova[], existentes: string[] = []): InclusaoVigenciaNova[] {
  const vistos = new Set(existentes);
  const out: InclusaoVigenciaNova[] = [];
  for (const it of itens) {
    const cpf = normalizarCpf(it.cpf);
    if (!cpf) continue;
    const norm = { ...it, cpf, contrato_id: String(it.contrato_id).trim() };
    const k = chaveInclusao(norm);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(norm);
  }
  return out;
}

/** Registra inclusões sem sobrescrever: registros já existentes são ignorados. */
export async function registrarInclusoesVigencia(itens: InclusaoVigenciaNova[]) {
  const novos = deduplicarInclusoes(itens).map((i) => ({ ...i, origem: i.origem ?? ORIGEM_PADRAO_INCLUSAO }));
  if (!novos.length) return 0;
  const { data, error } = await supabase
    .from("inclusoes_vigencia")
    .upsert(novos, { onConflict: "empresa_id,contrato_id,cpf,data_adesao,fechamento_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
