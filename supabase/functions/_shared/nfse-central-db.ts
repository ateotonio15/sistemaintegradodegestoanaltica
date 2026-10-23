import { resolverDestino, type ResultadoDestino } from "./nfse-central-regras.ts";

// deno-lint-ignore no-explicit-any
export async function carregarEResolver(db: any, cnpjTomador: string, sugerida: string | null): Promise<ResultadoDestino> {
  const [{ data: emps }, { data: pags }] = await Promise.all([
    db.from("empresas").select("id, cnpj, exige_po_pc, aguarda_faturamento_excel"),
    db.from("financeiro_pagadores").select("empresa_id, cnpj").eq("ativo", true),
  ]);
  const d = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const ids = new Set<string>();
  (emps ?? []).forEach((e: any) => d(e.cnpj) === cnpjTomador && ids.add(e.id));
  (pags ?? []).forEach((p: any) => d(p.cnpj) === cnpjTomador && ids.add(p.empresa_id));
  const { data: movs } = ids.size
    ? await db.from("financeiro_movimentacoes").select("id, empresa_id, mes_referencia, periodo, data_envio_nota").in("empresa_id", [...ids])
    : { data: [] };
  const movIds = (movs ?? []).map((x: any) => x.id);
  const { data: anexos } = movIds.length
    ? await db.from("anexos_financeiro").select("id, financeiro_movimentacao_id, mime_type, nome_arquivo, origem").in("financeiro_movimentacao_id", movIds)
    : { data: [] };
  return resolverDestino({ cnpjTomador, empresas: emps ?? [], pagadores: pags ?? [], movs: movs ?? [], anexos: anexos ?? [], sugerida });
}
