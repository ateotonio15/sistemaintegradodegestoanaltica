import { supabase } from "@/integrations/supabase/client";

export interface Pagador {
  id: string;
  nome: string;
  cnpj: string | null;
  codigo_contrato: string | null;
}

/**
 * Retorna todos os pagadores irmãos (mesmo codigo_contrato) — incluindo o próprio.
 * Empresas sem codigo_contrato são consideradas sozinhas.
 */
export async function getPagadoresDoContrato(
  empresaId: string,
  codigoContrato: string | null | undefined,
): Promise<Pagador[]> {
  const codigo = codigoContrato?.trim();
  if (!codigo) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome, cnpj, codigo_contrato")
      .eq("id", empresaId);
    if (error) throw error;
    return (data || []) as Pagador[];
  }
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, cnpj, codigo_contrato")
    .eq("codigo_contrato", codigo)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data || []) as Pagador[];
}

/**
 * Replica um payload de financeiro_movimentacoes em todos os pagadores do contrato
 * (exceto o próprio empresa_id de origem).
 *
 * Cria o registro se não existir; faz update caso exista.
 * Também replica os anexos (referenciando o mesmo storage_path — sem duplicar arquivo no bucket).
 */
export async function replicarFinanceiroParaPagadores(opts: {
  empresaIdOrigem: string;
  codigoContrato: string | null | undefined;
  mesReferencia: string;
  periodo: string;
  payload: Record<string, unknown>;
}): Promise<{ atualizados: number; criados: number }> {
  const pagadores = await getPagadoresDoContrato(opts.empresaIdOrigem, opts.codigoContrato);
  const irmaos = pagadores.filter((p) => p.id !== opts.empresaIdOrigem);
  if (irmaos.length === 0) return { atualizados: 0, criados: 0 };

  let atualizados = 0;
  let criados = 0;

  for (const pag of irmaos) {
    // procura registro existente
    const { data: existing, error: selErr } = await supabase
      .from("financeiro_movimentacoes")
      .select("id")
      .eq("empresa_id", pag.id)
      .eq("mes_referencia", opts.mesReferencia)
      .eq("periodo", opts.periodo)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing?.id) {
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update(opts.payload as any)
        .eq("id", existing.id);
      if (error) throw error;
      atualizados += 1;
    } else {
      const insertPayload = {
        empresa_id: pag.id,
        mes_referencia: opts.mesReferencia,
        periodo: opts.periodo,
        ...opts.payload,
      };
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .insert(insertPayload as any);
      if (error) throw error;
      criados += 1;
    }
  }
  return { atualizados, criados };
}

/**
 * Replica os anexos de uma movimentação de origem para todas as movimentações
 * irmãs (mesmo codigo_contrato, mesmo mes_referencia, mesmo periodo).
 * Os anexos são referenciados pelo mesmo storage_path (sem duplicar bytes).
 */
export async function replicarAnexosParaPagadores(opts: {
  movimentacaoOrigemId: string;
  empresaIdOrigem: string;
  codigoContrato: string | null | undefined;
  mesReferencia: string;
  periodo: string;
}): Promise<number> {
  const pagadores = await getPagadoresDoContrato(opts.empresaIdOrigem, opts.codigoContrato);
  const irmaos = pagadores.filter((p) => p.id !== opts.empresaIdOrigem);
  if (irmaos.length === 0) return 0;

  // anexos da origem
  const { data: anexosOrigem, error: anxErr } = await supabase
    .from("anexos_financeiro")
    .select("nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by")
    .eq("financeiro_movimentacao_id", opts.movimentacaoOrigemId);
  if (anxErr) throw anxErr;
  if (!anexosOrigem || anexosOrigem.length === 0) return 0;

  let totalReplicados = 0;

  for (const pag of irmaos) {
    // garante movimentação irmã
    const { data: existing } = await supabase
      .from("financeiro_movimentacoes")
      .select("id")
      .eq("empresa_id", pag.id)
      .eq("mes_referencia", opts.mesReferencia)
      .eq("periodo", opts.periodo)
      .maybeSingle();

    let movId = existing?.id;
    if (!movId) {
      const { data: novo, error } = await supabase
        .from("financeiro_movimentacoes")
        .insert({
          empresa_id: pag.id,
          mes_referencia: opts.mesReferencia,
          periodo: opts.periodo,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      movId = novo!.id;
    }

    // anexos já presentes (evita duplicar pelo storage_path)
    const { data: jaExistentes } = await supabase
      .from("anexos_financeiro")
      .select("storage_path")
      .eq("financeiro_movimentacao_id", movId);
    const setExistentes = new Set((jaExistentes || []).map((a: any) => a.storage_path));

    const aInserir = anexosOrigem
      .filter((a) => !setExistentes.has(a.storage_path))
      .map((a) => ({
        financeiro_movimentacao_id: movId!,
        nome_arquivo: a.nome_arquivo,
        storage_path: a.storage_path,
        mime_type: a.mime_type,
        tamanho_bytes: a.tamanho_bytes,
        uploaded_by: a.uploaded_by,
      }));

    if (aInserir.length > 0) {
      const { error } = await supabase.from("anexos_financeiro").insert(aInserir as any);
      if (error) throw error;
      totalReplicados += aInserir.length;
    }
  }
  return totalReplicados;
}
