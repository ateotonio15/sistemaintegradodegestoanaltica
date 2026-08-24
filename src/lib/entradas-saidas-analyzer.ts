import { supabase } from "@/integrations/supabase/client";
import { extractCpfsFromLayout } from "@/lib/layout-cpf-extractor";

const BUCKET_MOV = "anexos-movimentacoes";
const BUCKET_IMPL = "anexos-implantacao";

export interface EmpresaEntradaSaida {
  empresa_id: string;
  entradas: number;
  saidas: number;
  total_atual: number;
  total_anterior: number;
}

export interface LayoutRef {
  bucket: string;
  storage_path: string;
  nome_arquivo: string;
}

function prevMes(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isExcel(nome: string) {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  return ["xlsx", "xlsm", "xls"].includes(ext);
}

/**
 * Reúne TODOS os layouts (Excel) de uma empresa numa competência, olhando as três
 * origens possíveis — não só os fechamentos de movimentação:
 *  - anexos_movimentacao (fechamento mensal)
 *  - anexos_financeiro (anexos da aba Faturamento, inclui primeira mensalidade)
 *  - implantacao_anexos (layout enviado na implantação, sem competência própria →
 *    associado ao mês em que foi criado)
 */
export async function layoutsForEmpresaMes(empresaId: string, mesRef: string): Promise<LayoutRef[]> {
  const refs: LayoutRef[] = [];
  const seen = new Set<string>();
  const push = (r: LayoutRef) => {
    const k = `${r.bucket}|${r.storage_path}`;
    if (!isExcel(r.nome_arquivo) || seen.has(k)) return;
    seen.add(k);
    refs.push(r);
  };

  // 1) Fechamentos de movimentação
  const { data: movs } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", mesRef);
  const movIds = (movs ?? []).map((m: any) => m.id);
  if (movIds.length) {
    const { data: anexos } = await supabase
      .from("anexos_movimentacao")
      .select("storage_path, nome_arquivo")
      .in("movimentacao_id", movIds);
    (anexos ?? []).forEach((a: any) =>
      push({ bucket: BUCKET_MOV, storage_path: a.storage_path, nome_arquivo: a.nome_arquivo }),
    );
  }

  // 2) Anexos da aba Faturamento (mesma competência)
  const { data: finMovs } = await supabase
    .from("financeiro_movimentacoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", mesRef);
  const finIds = (finMovs ?? []).map((m: any) => m.id);
  if (finIds.length) {
    const { data: finAnexos } = await supabase
      .from("anexos_financeiro")
      .select("storage_path, nome_arquivo, bucket")
      .in("financeiro_movimentacao_id", finIds);
    (finAnexos ?? []).forEach((a: any) =>
      push({
        bucket: a.bucket || "anexos-financeiro",
        storage_path: a.storage_path,
        nome_arquivo: a.nome_arquivo,
      }),
    );
  }

  // 3) Anexos de implantação criados dentro da competência
  const [y, m] = mesRef.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1).toISOString();
  const fim = new Date(y, m, 1).toISOString();
  const { data: implAnexos } = await supabase
    .from("implantacao_anexos")
    .select("storage_path, nome_arquivo, created_at")
    .eq("empresa_id", empresaId)
    .gte("created_at", inicio)
    .lt("created_at", fim);
  (implAnexos ?? []).forEach((a: any) =>
    push({ bucket: BUCKET_IMPL, storage_path: a.storage_path, nome_arquivo: a.nome_arquivo }),
  );

  return refs;
}

async function cpfsForEmpresaMes(empresaId: string, mesRef: string): Promise<Set<string>> {
  const acc = new Set<string>();
  const refs = await layoutsForEmpresaMes(empresaId, mesRef);

  for (const a of refs) {
    try {
      const { data, error } = await supabase.storage.from(a.bucket).download(a.storage_path);
      if (error || !data) continue;
      const buffer = await data.arrayBuffer();
      const sig = new Uint8Array(buffer.slice(0, 4));
      if (!(sig[0] === 0x50 && sig[1] === 0x4b)) continue;
      const cpfs = await extractCpfsFromLayout(buffer);
      cpfs.forEach((c) => acc.add(c));
    } catch (e) {
      console.warn("Falha ao processar anexo", a.nome_arquivo, e);
    }
  }
  return acc;
}

export async function computeEntradasSaidas(
  empresaIds: string[],
  mesRef: string,
  onProgress?: (done: number, total: number) => void,
): Promise<EmpresaEntradaSaida[]> {
  const prev = prevMes(mesRef);
  const out: EmpresaEntradaSaida[] = [];
  let done = 0;
  for (const empresaId of empresaIds) {
    const [atualSet, anteriorSet] = await Promise.all([
      cpfsForEmpresaMes(empresaId, mesRef),
      cpfsForEmpresaMes(empresaId, prev),
    ]);
    let entradas = 0;
    let saidas = 0;
    atualSet.forEach((c) => { if (!anteriorSet.has(c)) entradas++; });
    anteriorSet.forEach((c) => { if (!atualSet.has(c)) saidas++; });
    out.push({
      empresa_id: empresaId,
      entradas,
      saidas,
      total_atual: atualSet.size,
      total_anterior: anteriorSet.size,
    });
    done++;
    onProgress?.(done, empresaIds.length);
  }

  // Persistir histórico
  if (out.length) {
    const rows = out.map((r) => ({
      empresa_id: r.empresa_id,
      mes_referencia: mesRef,
      entradas: r.entradas,
      saidas: r.saidas,
      total_atual: r.total_atual,
      total_anterior: r.total_anterior,
      calculado_em: new Date().toISOString(),
    }));
    await supabase
      .from("vidas_historico_administradoras")
      .upsert(rows, { onConflict: "empresa_id,mes_referencia" });
  }

  return out;
}
