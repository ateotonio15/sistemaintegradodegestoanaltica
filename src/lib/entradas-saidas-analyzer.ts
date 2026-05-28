import { supabase } from "@/integrations/supabase/client";
import { extractCpfsFromLayout } from "@/lib/layout-cpf-extractor";

const STORAGE_BUCKET = "anexos-movimentacoes";

export interface EmpresaEntradaSaida {
  empresa_id: string;
  entradas: number;
  saidas: number;
  total_atual: number;
  total_anterior: number;
}

function prevMes(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function cpfsForEmpresaMes(empresaId: string, mesRef: string): Promise<Set<string>> {
  const acc = new Set<string>();
  // Pega movimentações desse mês
  const { data: movs } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("mes_referencia", mesRef);
  const movIds = (movs ?? []).map((m: any) => m.id);
  if (movIds.length === 0) return acc;

  const { data: anexos } = await supabase
    .from("anexos_movimentacao")
    .select("storage_path, nome_arquivo")
    .in("movimentacao_id", movIds);

  for (const a of anexos ?? []) {
    const ext = (a.nome_arquivo.split(".").pop() || "").toLowerCase();
    if (!["xlsx", "xlsm", "xls"].includes(ext)) continue;
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(a.storage_path);
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
