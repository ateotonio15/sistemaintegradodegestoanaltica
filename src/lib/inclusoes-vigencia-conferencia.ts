import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { normalizarCpf, ORIGEM_PADRAO_INCLUSAO } from "@/lib/inclusoes-vigencia";
import { layoutsForEmpresaMes } from "@/lib/entradas-saidas-analyzer";
import { extractCpfsFromLayout } from "@/lib/layout-cpf-extractor";
import { todayLocalISO } from "@/lib/date-utils";

export const STATUS_DIVERGENCIA = "divergencia_data_adesao";

export interface LinhaRelatorio { cpf: string; nome: string | null; data_adesao: string } // YYYY-MM-DD
export interface FechamentoProcessado { id: string; mes: string; cpfsLayout: Set<string> }
export interface InclusaoExistente { cpf: string; data_adesao: string; fechamento_id: string }
export interface NovaInclusao { cpf: string; beneficiario_nome: string | null; data_adesao: string; fechamento_id: string; status: string }

/**
 * Regra pura: a vida pertence ao fechamento do MÊS DA DATA DE ADESÃO (não da data em que foi encontrada).
 * Só registra se o fechamento já foi processado, o CPF não estava no layout dele e ainda não foi registrado.
 * Se o CPF já foi reconciliado com outra adesão, não move: marca divergência no fechamento original.
 */
export function conferirInclusoes(
  linhas: LinhaRelatorio[],
  fechamentos: FechamentoProcessado[],
  existentes: InclusaoExistente[],
): NovaInclusao[] {
  const porMes = new Map(fechamentos.map((f) => [f.mes, f]));
  const jaRegistrado = new Map<string, InclusaoExistente[]>();
  for (const e of existentes) jaRegistrado.set(e.cpf, [...(jaRegistrado.get(e.cpf) ?? []), e]);
  const out: NovaInclusao[] = [];
  const vistos = new Set<string>();
  for (const l of linhas) {
    const cpf = normalizarCpf(l.cpf);
    if (!cpf || !/^\d{4}-\d{2}-\d{2}$/.test(l.data_adesao) || vistos.has(cpf)) continue;
    vistos.add(cpf);
    const anteriores = jaRegistrado.get(cpf) ?? [];
    if (anteriores.length) {
      if (anteriores.some((a) => a.data_adesao === l.data_adesao)) continue;
      out.push({ cpf, beneficiario_nome: l.nome, data_adesao: l.data_adesao, fechamento_id: anteriores[0].fechamento_id, status: STATUS_DIVERGENCIA });
      continue;
    }
    const f = porMes.get(l.data_adesao.slice(0, 7));
    if (!f || f.cpfsLayout.size === 0 || f.cpfsLayout.has(cpf)) continue;
    out.push({ cpf, beneficiario_nome: l.nome, data_adesao: l.data_adesao, fechamento_id: f.id, status: "identificada" });
  }
  return out;
}

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_.\-/]+/g, " ").replace(/\s+/g, " ").trim();

function dataIso(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number" && v > 20000) { const p = XLSX.SSF.parse_date_code(v); return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : null; }
  const s = String(v ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Lê CPF, Nome e Data de Adesão do relatório de vidas do SIGA. */
export function lerRelatorioVidas(buffer: ArrayBuffer): LinhaRelatorio[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  for (const nomeAba of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, blankrows: false, raw: true });
    for (let h = 0; h < Math.min(20, linhas.length); h++) {
      const cab = (linhas[h] ?? []).map(norm);
      const cCpf = cab.findIndex((c) => c === "cpf" || c === "cpf beneficiario" || c === "nr cpf");
      const cAd = cab.findIndex((c) => ["dt adesao", "data adesao", "data de adesao", "adesao", "dt inclusao", "data inclusao", "inicio vigencia", "dt inicio vigencia"].includes(c));
      if (cCpf < 0 || cAd < 0) continue;
      const cNome = cab.findIndex((c) => ["beneficiario", "nome", "nome beneficiario", "nome do beneficiario"].includes(c));
      const out: LinhaRelatorio[] = [];
      for (const l of linhas.slice(h + 1)) {
        const d = dataIso(l?.[cAd]);
        if (!d || !l?.[cCpf]) continue;
        out.push({ cpf: String(l[cCpf]), nome: cNome >= 0 ? String(l[cNome] ?? "").trim() || null : null, data_adesao: d });
      }
      return out;
    }
  }
  return [];
}

async function cpfsDoFechamento(empresaId: string, mes: string): Promise<Set<string>> {
  const acc = new Set<string>();
  for (const a of await layoutsForEmpresaMes(empresaId, mes)) {
    try {
      const { data } = await supabase.storage.from(a.bucket).download(a.storage_path);
      if (!data) continue;
      (await extractCpfsFromLayout(await data.arrayBuffer())).forEach((c) => { const n = normalizarCpf(c); if (n) acc.add(n); });
    } catch { /* arquivo ilegível: ignora */ }
  }
  return acc;
}

/** Conferência pós-recálculo para uma empresa. Retorna quantas inclusões novas (sem divergências) foram registradas. */
export async function conferirInclusoesEmpresa(empresaId: string): Promise<{ novas: number; divergencias: number }> {
  const { data: emp } = await supabase.from("empresas").select("codigo_contrato").eq("id", empresaId).maybeSingle();
  const contrato = String((emp as any)?.codigo_contrato ?? "").trim();
  const { data: arqs } = await supabase.from("envios_empresa_arquivos")
    .select("bucket, storage_path, nome_arquivo").eq("empresa_id", empresaId).eq("status", "Atual")
    .order("enviado_em", { ascending: false });
  const excel = (arqs ?? []).filter((a: any) => /\.xlsx?$/i.test(a.nome_arquivo));
  let linhas: LinhaRelatorio[] = [];
  for (const a of excel) {
    const { data } = await supabase.storage.from(a.bucket).download(a.storage_path);
    if (!data) continue;
    linhas = lerRelatorioVidas(await data.arrayBuffer());
    if (linhas.length) break;
  }
  if (!linhas.length) return { novas: 0, divergencias: 0 };

  const meses = [...new Set(linhas.map((l) => l.data_adesao.slice(0, 7)))];
  const { data: movs } = await supabase.from("movimentacoes").select("id, mes_referencia, created_at")
    .eq("empresa_id", empresaId).in("mes_referencia", meses).order("created_at", { ascending: true });
  const fechamentos: FechamentoProcessado[] = [];
  const usados = new Set<string>();
  for (const m of (movs ?? []) as any[]) {
    if (usados.has(m.mes_referencia)) continue;
    usados.add(m.mes_referencia);
    fechamentos.push({ id: m.id, mes: m.mes_referencia, cpfsLayout: await cpfsDoFechamento(empresaId, m.mes_referencia) });
  }
  const { data: exist } = await supabase.from("inclusoes_vigencia").select("cpf, data_adesao, fechamento_id").eq("empresa_id", empresaId);
  const novas = conferirInclusoes(linhas, fechamentos, (exist ?? []) as InclusaoExistente[]);
  if (!novas.length) return { novas: 0, divergencias: 0 };
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("inclusoes_vigencia").upsert(
    novas.map((n) => ({ ...n, empresa_id: empresaId, contrato_id: contrato, origem: ORIGEM_PADRAO_INCLUSAO, data_identificacao: todayLocalISO(), criado_por: u.user?.id })),
    { onConflict: "empresa_id,contrato_id,cpf,data_adesao,fechamento_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  const div = novas.filter((n) => n.status === STATUS_DIVERGENCIA).length;
  return { novas: novas.length - div, divergencias: div };
}
