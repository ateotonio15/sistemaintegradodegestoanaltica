/**
 * Validação dos arquivos de uma nota da Central (PDF × faturamento anexado),
 * usando exatamente os parsers e o cálculo central do SIGA.
 * Este módulo é empacotado para o servidor (supabase/functions/_shared/siga-validador.generated.js).
 *
 * Composição com vários arquivos (nunca soma só por estarem anexados juntos):
 * - sem bloco do CNPJ do tomador → "nao_pertinente" (ignorado);
 * - mesmo conteúdo (bytes ou valores idênticos) → "duplicado" (contado uma vez);
 * - com mensalidade → "principal" (exatamente um; dois = ambíguo);
 * - só retroativo igual ao retroativo já contido no principal → "retroativo_incluido" (não soma);
 * - só categorias ausentes no principal → "complementar" (soma).
 * Qualquer outro caso fica "Validação inconclusiva" com a ambiguidade descrita.
 */
import { analisarExcelFinanceiroPorCnpj, compararExcelComPdf, type AnalisePorCnpj } from "./excel-analysis-utils";
import { analisarPdfFinanceiro } from "./pdf-analysis-utils";
import { somarTotalFaturamento } from "./faturamento-totais";
import { sumPdfTotal } from "./pdf-total";

export type PapelArquivo = "principal" | "complementar" | "retroativo_incluido" | "duplicado" | "nao_pertinente" | "ilegivel";
export interface ArquivoComposicao { id: string; nome: string; papel: PapelArquivo; valor: number | null; duplicadoDe?: string; observacao?: string }
export interface PlanilhaEntrada { id: string; nome: string; dados: ArrayBuffer }

export interface ResultadoArquivosCentral {
  leituraOk: boolean;
  motivo: string | null;
  valorExcel: number | null;
  valorPdf: number | null;
  comparacao: ReturnType<typeof compararExcelComPdf> | null;
  tomadorPdf: string | null;
  arquivos: ArquivoComposicao[];
}

const c = (v: unknown) => Math.round((Number(v) || 0) * 100);
const CATS_EXTRA = ["exclusoes", "devolucoes", "permuta", "taxaAdesao", "coparticipacao", "complemento"] as const;

function temMensalidade(b: AnalisePorCnpj) {
  return c(b.enfermaria?.total) !== 0 || c(b.apartamento?.total) !== 0
    || (b.enfermaria?.beneficiarios ?? 0) > 0 || (b.apartamento?.beneficiarios ?? 0) > 0;
}
const retro = (b: AnalisePorCnpj) => c(b.retroativas?.total);
/** Bloco cujo único conteúdo é cobrança retroativa (inclusões = retroativos). */
function soRetroativo(b: AnalisePorCnpj) {
  return !temMensalidade(b) && retro(b) !== 0 && c(b.inclusoes?.total) === retro(b)
    && CATS_EXTRA.every((k) => c((b as any)[k]?.total) === 0);
}
function impressao(b: AnalisePorCnpj) {
  return JSON.stringify([b.enfermaria, b.apartamento, b.inclusoes?.total, b.inclusoes?.quantidade, retro(b),
    ...CATS_EXTRA.map((k) => [(b as any)[k]?.total ?? null, (b as any)[k]?.quantidade ?? null])]);
}
async function sha(buf: ArrayBuffer) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}
const brl = (n: number) => n.toFixed(2).replace(".", ",");

/** Decide a composição do faturamento do CNPJ a partir de todos os arquivos. Não lê o PDF. */
export async function comporFaturamento(planilhas: PlanilhaEntrada[], cnpjTomador: string): Promise<{
  bloco: AnalisePorCnpj | null; arquivos: ArquivoComposicao[]; ambiguidade: string | null;
}> {
  const arquivos: ArquivoComposicao[] = [];
  const unicos: { a: ArquivoComposicao; b: AnalisePorCnpj }[] = [];
  const hashes = new Map<string, string>(); const impressoes = new Map<string, string>();
  const falha = (m: string) => ({ bloco: null, arquivos, ambiguidade: m });

  for (const p of planilhas) {
    const h = await sha(p.dados);
    if (hashes.has(h)) { arquivos.push({ id: p.id, nome: p.nome, papel: "duplicado", valor: null, duplicadoDe: hashes.get(h), observacao: "Arquivo idêntico." }); continue; }
    hashes.set(h, p.id);
    let blocos: AnalisePorCnpj[];
    try { blocos = await analisarExcelFinanceiroPorCnpj(p.dados); }
    catch { arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null }); return falha(`Planilha “${p.nome}” ilegível; não é possível saber se compõe o faturamento.`); }
    const doPagador = blocos.filter((b) => (b.cnpj ?? "").replace(/\D/g, "") === cnpjTomador);
    if (!doPagador.length) { arquivos.push({ id: p.id, nome: p.nome, papel: "nao_pertinente", valor: null, observacao: "Sem bloco do CNPJ do tomador." }); continue; }
    if (doPagador.length > 1) { arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null }); return falha(`Mais de um bloco do mesmo CNPJ na planilha “${p.nome}”.`); }
    const b = doPagador[0];
    const a: ArquivoComposicao = { id: p.id, nome: p.nome, papel: "complementar", valor: somarTotalFaturamento(b as any) };
    const imp = impressao(b);
    if (impressoes.has(imp)) { arquivos.push({ ...a, papel: "duplicado", duplicadoDe: impressoes.get(imp), observacao: "Mesmos valores de outra planilha." }); continue; }
    impressoes.set(imp, p.id);
    arquivos.push(a); unicos.push({ a, b });
  }

  if (!unicos.length) return falha(planilhas.length ? "Nenhuma planilha anexada contém o CNPJ do tomador." : "Faturamento não anexado.");
  const principais = unicos.filter((u) => temMensalidade(u.b));
  if (principais.length !== 1) return falha(principais.length
    ? `Planilhas com mensalidade para o mesmo CNPJ: ${principais.map((u) => `“${u.a.nome}” (${brl(u.a.valor!)})`).join(", ")}; não é possível saber se substituem ou complementam.`
    : "Nenhuma planilha com mensalidade para o CNPJ; composição indeterminada.");
  const pr = principais[0]; pr.a.papel = "principal";
  const comp: any = structuredClone(pr.b);

  for (const u of unicos) {
    if (u === pr) continue;
    if (soRetroativo(u.b)) {
      if (retro(pr.b) === retro(u.b)) { u.a.papel = "retroativo_incluido"; u.a.observacao = "Retroativo já contido nas inclusões da planilha principal; não somado."; continue; }
      if (retro(comp) !== 0) return falha(`Retroativo de “${u.a.nome}” (${brl(retro(u.b) / 100)}) difere do retroativo já incluído (${brl(retro(comp) / 100)}).`);
      comp.inclusoes = { ...comp.inclusoes, quantidade: (comp.inclusoes?.quantidade ?? 0) + (u.b.inclusoes?.quantidade ?? 0), total: (c(comp.inclusoes?.total) + c(u.b.inclusoes.total)) / 100 };
      comp.retroativas = { ...u.b.retroativas };
      u.a.observacao = "Retroativo ausente da planilha principal; somado às inclusões.";
      continue;
    }
    const cats = ["inclusoes", ...CATS_EXTRA].filter((k) => c((u.b as any)[k]?.total) !== 0);
    const sobrepostas = cats.filter((k) => c(comp[k]?.total) !== 0);
    if (sobrepostas.length || !cats.length) return falha(sobrepostas.length
      ? `“${u.a.nome}” repete categorias já presentes (${sobrepostas.join(", ")}); não é possível saber se é complemento ou substituição.`
      : `“${u.a.nome}” não tem valores identificáveis para o CNPJ.`);
    for (const k of cats) comp[k] = { ...(u.b as any)[k] };
    if (retro(u.b) !== 0) comp.retroativas = { ...u.b.retroativas };
  }
  delete comp.totalDeclaradoExcel; // total declarado de um único arquivo não vale para a composição
  return { bloco: comp as AnalisePorCnpj, arquivos, ambiguidade: null };
}

export async function validarArquivosCentral(i: {
  pdf: ArrayBuffer; planilhas: PlanilhaEntrada[]; cnpjTomador: string; tipoAnalise?: string | null;
}): Promise<ResultadoArquivosCentral> {
  const { bloco, arquivos, ambiguidade } = await comporFaturamento(i.planilhas, i.cnpjTomador);
  const vazio = (motivo: string): ResultadoArquivosCentral => ({ leituraOk: false, motivo, valorExcel: null, valorPdf: null, comparacao: null, tomadorPdf: null, arquivos });
  if (!bloco) return vazio(ambiguidade ?? "Composição indeterminada.");

  const pdf = await analisarPdfFinanceiro(i.pdf);
  if (pdf.avisos.some((a) => /falha ao abrir/i.test(a))) return vazio("PDF ilegível.");
  const cmp = compararExcelComPdf(bloco as any, { ...pdf, arquivo: "central.pdf" } as any, i.tipoAnalise);
  cmp.tomadorCnpj = pdf.tomadorCnpj ?? null;
  const valorPdf = sumPdfTotal(cmp);
  const valorExcel = somarTotalFaturamento(bloco as any);
  const leituraOk = valorPdf != null && !!pdf.tomadorCnpj;
  return {
    leituraOk, motivo: leituraOk ? null : "PDF incompleto: tomador ou valores não encontrados.",
    valorExcel, valorPdf, comparacao: cmp, tomadorPdf: pdf.tomadorCnpj ?? null, arquivos,
  };
}
